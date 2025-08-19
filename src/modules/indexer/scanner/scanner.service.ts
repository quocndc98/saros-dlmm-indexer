import { Injectable, Inject } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Cron, CronExpression } from '@nestjs/schedule'
import { ConfirmedSignatureInfo, PublicKey } from '@solana/web3.js'
import { indexerConfig } from '../config/indexer.config'
import { TransactionEvent } from '../schemas/transaction-event.schema'
import { SolanaService } from '../services/solana.service'
import { Logger } from '@/lib'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { JOB_TYPES, QUEUE_NAME } from '../../queue/queue.constant'
import { DELAYS, SCAN_LIMITS } from './scanner.constant'
import { sleep } from '@/utils/helper'

@Injectable()
export class ScannerService {
  private readonly logger = new Logger(ScannerService.name)
  private readonly programAddress: PublicKey
  private readonly state = {
    isBackwardScanComplete: false,
    isProcessingQueue: false,
    startupComplete: false,
  }

  constructor(
    @Inject(indexerConfig.KEY)
    private readonly config: ConfigType<typeof indexerConfig>,
    @InjectModel(TransactionEvent.name)
    private readonly transactionEventModel: Model<TransactionEvent>,
    private readonly solanaService: SolanaService,
    @InjectQueue(QUEUE_NAME.TRANSACTION_PROCESSOR)
    private readonly transactionQueue: Queue,
  ) {
    this.programAddress = new PublicKey(this.config.liquidityBookProgramAddress)
  }

  async onModuleInit() {
    this.logger.log('Initializing Scanner Service...')
    // Wait a bit before starting to ensure other services are ready
    // TODO: uncomment for production
    this.state.isBackwardScanComplete = true
    // sleep(DELAYS.INITIALIZATION).then(() => this.initializeScanner())
  }

  private async initializeScanner() {
    try {
      const genesisReached = await this.checkGenesisReached()

      if (!genesisReached) {
        this.logger.log('Genesis not reached. Starting backward scan...')
        await this.runBackwardScan()
      } else {
        this.logger.log('Genesis already reached. Skipping backward scan.')
        this.state.isBackwardScanComplete = true
      }

      // await this.processUnprocessedTransactions()
      // this.state.startupComplete = true
      // this.logger.log('Scanner initialization complete')
    } catch (error) {
      this.logger.error('Failed to initialize scanner:', error)
    }
  }

  private async checkGenesisReached(): Promise<boolean> {
    // Get oldest transaction in our DB
    const oldestSignature = await this.getOldestTransactionLocal()

    if (!oldestSignature) {
      return false // No transactions yet
    }

    try {
      // Check onchain: if no more signatures before our oldest, we reached genesis
      const olderSignatures = await this.solanaService.getSignaturesForAddress(
        this.programAddress,
        {
          limit: 1,
          before: oldestSignature,
        },
      )

      const genesisReached = olderSignatures.length === 0

      if (genesisReached) {
        this.logger.log(`🎉 Genesis reached! Oldest onchain transaction: ${oldestSignature}`)
      }

      return genesisReached
    } catch (error) {
      this.logger.error(`Error checking genesis:`, error)
      return false
    }
  }

  private async runBackwardScan() {
    this.logger.log('[BackwardScan] Starting backward scan to genesis...')
    let beforeSignature = await this.getOldestTransactionLocal()

    while (!this.state.isBackwardScanComplete) {
      try {
        const signatures = await this.solanaService.getSignaturesForAddress(this.programAddress, {
          limit: SCAN_LIMITS.BACKWARD,
          before: beforeSignature,
        })

        if (signatures.length === 0) {
          this.logger.log('[BackwardScan] Genesis reached during backward scan')
          this.state.isBackwardScanComplete = true
          break
        }

        // Index signatures into database
        // @dev Get before mean get new to old so we need to reserve to keep order real in blockchain
        const reversedSignatures = signatures.reverse()
        await this.insertBatchTransactionEvent(reversedSignatures)

        // Set the before signature for next batch (go further back in time)
        beforeSignature = reversedSignatures[0].signature

        this.logger.log(
          `[BackwardScan] Processed ${signatures.length} signatures, last signature: ${beforeSignature}`,
        )
      } catch (error) {
        this.logger.error(`[BackwardScan] Error:`, error)
        await sleep(this.config.retryDelayMs)
      }
      await sleep(DELAYS.BETWEEN_BATCHES)
    }

    this.state.isBackwardScanComplete = true
    this.logger.log('[BackwardScan] Backward scan completed')
  }

  // @Cron(CronExpression.EVERY_5_SECONDS) // TODO: uncomment for production
  async scanForwards() {
    try {
      this.logger.log('[ForwardScan] Running forward scan for new transactions...')

      const untilSignature = await this.getNewestTransactionLocal()
      // @notice ensure dont missing transaction at start time if forward and backward use diff page cursor
      if (!untilSignature) {
        this.logger.warn(
          '[ForwardScan] No transactions found in local database, skipping forward scan.',
        )
        return
      }

      const signatures = await this.solanaService.getSignaturesForAddress(this.programAddress, {
        limit: SCAN_LIMITS.FORWARD,
        until: untilSignature,
      })

      if (signatures.length > 0) {
        this.logger.log(`[ForwardScan] Found ${signatures.length} new signatures`)

        const reversedSignatures = signatures.reverse()
        await this.insertBatchTransactionEvent(reversedSignatures)

        // If backward scan is complete, process these new transactions immediately
        // if (this.isBackwardScanComplete) {
        //   await this.processNewTransactions(reversedSignatures)
        // }
      }
    } catch (error) {
      this.logger.error('[ForwardScan] Error:', error)
    }
  }

  private async insertBatchTransactionEvent(signatures: ConfirmedSignatureInfo[]) {
    const transactionEvents = signatures
      .filter((sig) => !sig.err)
      .map((sig) => ({
        signature: sig.signature,
        blockNumber: sig.slot,
        blockTime: sig.blockTime ? new Date(sig.blockTime * 1000) : null,
        processed: false,
        queued: false, // Initialize as not queued
      }))

    // Bulk insert, ignore duplicates
    try {
      await this.transactionEventModel.insertMany(transactionEvents, {
        ordered: false, // Continue inserting even if some fail due to duplicates
      })
      this.logger.log(`Indexed ${transactionEvents.length} transaction signatures`)
    } catch (error) {
      this.logger.error(
        '[insertBatchTransactionEvent] Error insert batch transaction events:',
        error,
      )
    }
  }

  // @Cron(CronExpression.EVERY_5_SECONDS)
  private async processUnprocessedTransactions() {
    if (!this.state.isBackwardScanComplete) {
      this.logger.log('Skipping unprocessed transactions processing, backward scan not complete')
      return
    }
    if (this.state.isProcessingQueue) {
      this.logger.log('Skipping unprocessed transactions processing, already processing queue')
      return
    }

    this.state.isProcessingQueue = true
    this.logger.log('Processing unprocessed transactions in slot order...')

    try {
      const batchSize = 100 // this.config.batchSize
      let hasMore = true

      while (hasMore) {
        // TODO: consider to use cursor-based pagination instead of skip
        const unprocessedTransactions = await this.transactionEventModel
          .find({
            processed: false,
            queued: { $ne: true }, // Only get transactions not yet queued
          })
          .sort({ blockNumber: 1, _id: 1 }) // Transaction inserted to db keep order real in blockchain so if same slot transaction have _id smallest will be oldest
          .limit(batchSize) // Remove skip, use cursor-based approach
          .lean()

        if (unprocessedTransactions.length === 0) {
          hasMore = false
          break
        }

        // Queue transactions for processing
        await this.queueTransactionForProcessing(unprocessedTransactions)

        this.logger.debug(`Queued ${unprocessedTransactions.length} transactions for processing`)

        await sleep(DELAYS.QUEUE_PROCESSING)
      }

      this.logger.log('Finished queuing unprocessed transactions')
    } catch (error) {
      this.logger.error('Error processing unprocessed transactions:', error)
    } finally {
      this.state.isProcessingQueue = false
    }
  }

  private async queueTransactionForProcessing(transactions: TransactionEvent[]) {
    try {
      await this.transactionQueue.addBulk(
        transactions.map((transaction) => ({
          name: JOB_TYPES.PROCESS_TRANSACTION,
          data: {
            signature: transaction.signature,
            blockNumber: transaction.blockNumber,
            blockTime: transaction.blockTime,
          },
        })),
      )

      // Mark as queued (NOT processed yet - will be marked processed in TransactionProcessor)
      await this.transactionEventModel.updateMany(
        { _id: { $in: transactions.map((tx) => tx._id) } },
        { queued: true },
      )
    } catch (error) {
      this.logger.error(
        `Failed to queue transaction from ${transactions[0].signature} to ${transactions.at(-1).signature}:`,
        error,
      )
    }
  }

  private async getOldestTransactionLocal(): Promise<string | null> {
    // @dev Fetches transactions in DESC order from RPC. InsertMany reverses the order to match blockchain chronology.
    // For same-slot txs, smaller _id means older.
    const transactionEvent = await this.transactionEventModel
      .findOne({}, { signature: 1 })
      .sort({ blockNumber: 1, _id: 1 })
      .lean()
    return transactionEvent?.signature
  }

  private async getNewestTransactionLocal(): Promise<string | null> {
    const transactionEvent = await this.transactionEventModel
      .findOne({}, { signature: 1 })
      .sort({ blockNumber: -1, _id: -1 })
      .lean()
    return transactionEvent?.signature
  }

  // Manual trigger for scanning (used by controller/jobs). TODO: this function not yet implemented completely
  async startScanning() {
    if (!this.state.startupComplete) {
      this.logger.warn('Scanner not ready yet, initialization still in progress')
      return
    }

    this.logger.log('Manual scan triggered')

    // Run a forward scan immediately
    await this.scanForwards()

    // Process any unprocessed transactions
    if (this.state.isBackwardScanComplete) {
      await this.processUnprocessedTransactions()
    }
  }

  async getStatus() {
    const totalTransactions = await this.transactionEventModel.countDocuments()
    const processedTransactions = await this.transactionEventModel.countDocuments({
      processed: true,
    })
    const unprocessedTransactions = totalTransactions - processedTransactions

    // Get genesis status
    const genesisReached = await this.checkGenesisReached()
    const oldestTransaction = await this.transactionEventModel
      .findOne({})
      .sort({ blockNumber: 1, signature: 1 })
      .exec()

    return {
      startupComplete: this.state.startupComplete,
      backwardScanComplete: this.state.isBackwardScanComplete,
      isProcessingQueue: this.state.isProcessingQueue,
      genesisReached,
      totalTransactions,
      processedTransactions,
      unprocessedTransactions,
      queuedTransactions: await this.transactionQueue.getWaiting(),
      oldestTransaction: oldestTransaction
        ? {
            signature: oldestTransaction.signature,
            blockNumber: oldestTransaction.blockNumber,
            blockTime: oldestTransaction.blockTime,
          }
        : null,
    }
  }

  /**
   * Manual method to validate genesis status
   */
  async validateGenesis() {
    const genesisReached = await this.checkGenesisReached()
    const oldestTransaction = await this.transactionEventModel
      .findOne({})
      .sort({ blockNumber: 1, signature: 1 })
      .exec()

    return {
      genesisReached,
      oldestTransaction: oldestTransaction
        ? {
            signature: oldestTransaction.signature,
            blockNumber: oldestTransaction.blockNumber,
            blockTime: oldestTransaction.blockTime,
          }
        : null,
    }
  }
}
