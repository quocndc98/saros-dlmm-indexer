import { Injectable, Inject } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PublicKey } from '@solana/web3.js'
import { indexerConfig } from '../config/indexer.config'
import { TransactionEvent } from '../schemas/transaction-event.schema'
import { SolanaService } from '../services/solana.service'
import { Logger } from '@/lib'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'

@Injectable()
export class ScannerService {
  private readonly logger: Logger = new Logger(ScannerService.name)
  private isBackwardScanComplete = false
  private isProcessingQueue = false
  private startupComplete = false
  private readonly programAddress: PublicKey

  constructor(
    @Inject(indexerConfig.KEY)
    private readonly config: ConfigType<typeof indexerConfig>,
    @InjectModel(TransactionEvent.name)
    private readonly transactionModel: Model<TransactionEvent>,
    private readonly solanaService: SolanaService,
    @InjectQueue('transaction-processing')
    private readonly transactionQueue: Queue,
  ) {
    this.programAddress = new PublicKey(this.config.liquidityBookProgramAddress)
  }

  async onModuleInit() {
    this.logger.log('Initializing Scanner Service...')
    await this.initializeScanner()
  }

  private async initializeScanner() {
    try {
      // Check if we have reached genesis (have historical data)
      const genesisReached = await this.checkGenesisReached()

      if (!genesisReached) {
        this.logger.log('Genesis not reached. Starting backward scan...')
        await this.scanBackwards()
      } else {
        this.logger.log('Genesis already reached. Skipping backward scan.')
        this.isBackwardScanComplete = true
      }

      // Start processing existing unprocessed transactions in order
      await this.processUnprocessedTransactions()
      this.logger.log('Scanner initialization complete')
    } catch (error) {
      this.logger.error('Failed to initialize scanner:', error)
    }
  }

  private async checkGenesisReached(): Promise<boolean> {
    // Get oldest transaction in our DB
    const oldestInDb = await this.transactionModel
      .findOne({})
      .sort({ slot: 1, signature: 1 })
      .exec()

    if (!oldestInDb) {
      return false
    }

    try {
      // Check onchain: if no more signatures before our oldest, we reached genesis
      const olderSignatures = await this.solanaService.getSignaturesForAddress(
        this.programAddress,
        {
          limit: 1,
          before: oldestInDb.signature,
        }
      )

      const genesisReached = olderSignatures.length === 0

      if (genesisReached) {
        this.logger.log(`🎉 Genesis reached! Oldest onchain transaction: ${oldestInDb.signature}`)
      }

      return genesisReached
    } catch (error) {
      this.logger.error(`Error checking genesis:`, error)
      return false
    }
  }

  private async scanBackwards() {
    this.logger.log('Starting backward scan to genesis...')
    const BACKWARD_SCAN_LIMIT = 1000 // Limit for each batch of signatures to fetch
    let beforeSignature: string | undefined
    let hasMoreTransactions = true

    while (hasMoreTransactions && !this.isBackwardScanComplete) {
      try {
        const signatures = await this.solanaService.getSignaturesForAddress(
          this.programAddress,
          {
            limit: BACKWARD_SCAN_LIMIT,
            before: beforeSignature,
          }
        )

        if (signatures.length === 0) {
          hasMoreTransactions = false
          break
        }

        // Index signatures into database
        await this.insertBatchTransactionEvent(signatures)

        // Check if we've reached our genesis threshold
        const genesisReached = await this.checkGenesisReached()
        if (genesisReached) {
          this.logger.log('Genesis reached during backward scan')
          this.isBackwardScanComplete = true
          break
        }

        // Set the before signature for next batch (go further back in time)
        beforeSignature = signatures[signatures.length - 1].signature

        this.logger.debug(`Backward scan progress: processed ${signatures.length} signatures, last signature: ${beforeSignature}`)
      } catch (error) {
        this.logger.error(`Error in backward scan:`, error)
        // Continue with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    this.isBackwardScanComplete = true
    this.logger.log('Backward scan completed')
  }

  @Cron(CronExpression.EVERY_5_SECONDS) // Every 5 seconds
  async scanForwards() {
    if (!this.startupComplete) {
      // Don't run forward scan until initialization is complete
      return
    }

    try {
      this.logger.debug('Running forward scan for new transactions...')

      // Get the latest signature we have in our database
      const latestTransaction = await this.transactionModel
        .findOne({})
        .sort({ block_time: -1 }) // Sort by block time instead of slot
        .exec()

      const untilSignature = latestTransaction?.signature

      // Get new signatures (more recent than what we have)
      const signatures = await this.solanaService.getSignaturesForAddress(
        this.programAddress,
        {
          limit: this.config.batchSize,
          until: untilSignature, // Get signatures newer than this
        }
      )

      if (signatures.length > 0) {
        this.logger.debug(`Forward scan: found ${signatures.length} new signatures`)

        // Index new signatures
        await this.insertBatchTransactionEvent(signatures)

        // If backward scan is complete, process these new transactions immediately
        if (this.isBackwardScanComplete) {
          await this.processNewTransactions(signatures)
        }
      }

    } catch (error) {
      this.logger.error('Error in forward scan:', error)
    }
  }

  private async insertBatchTransactionEvent(signatures: any[]) {
    const transactionEvents = signatures.map(sig => ({
      signature: sig.signature,
      slot: sig.slot,
      block_time: new Date(sig.blockTime * 1000),
      is_successful: !sig.err,
      error_message: sig.err,
      processed: false,
    }))

    // Bulk insert, ignore duplicates
    try {
      await this.transactionModel.insertMany(transactionEvents, {
        ordered: false, // Continue inserting even if some fail due to duplicates
      })
      this.logger.debug(`Indexed ${transactionEvents.length} transaction signatures`)
    } catch (error) {
      // Ignore duplicate key errors, log others
      if (error.code !== 11000) {
        this.logger.error('Error indexing signatures:', error)
      }
    }
  }

  private async processUnprocessedTransactions() {
    if (this.isProcessingQueue) {
      return
    }

    this.isProcessingQueue = true
    this.logger.log('Processing unprocessed transactions in slot order...')

    try {
      // Process all unprocessed transactions in slot order
      const batchSize = this.config.batchSize
      let skip = 0
      let hasMore = true

      while (hasMore) {
        const unprocessedTransactions = await this.transactionModel
          .find({ processed: false })
          .sort({ slot: 1, signature: 1 }) // Ensure consistent ordering
          .skip(skip)
          .limit(batchSize)
          .exec()

        if (unprocessedTransactions.length === 0) {
          hasMore = false
          break
        }

        // Queue transactions for processing
        for (const transaction of unprocessedTransactions) {
          await this.queueTransactionForProcessing(transaction)
        }

        skip += batchSize
        this.logger.debug(`Queued ${unprocessedTransactions.length} transactions for processing`)

        // Small delay to prevent overwhelming the queue
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      this.logger.log('Finished queuing unprocessed transactions')
    } catch (error) {
      this.logger.error('Error processing unprocessed transactions:', error)
    } finally {
      this.isProcessingQueue = false
    }
  }

  private async processNewTransactions(signatures: any[]) {
    // Sort by slot to maintain order
    const sortedSignatures = signatures.sort((a, b) => a.slot - b.slot)

    for (const sig of sortedSignatures) {
      const transaction = await this.transactionModel
        .findOne({ signature: sig.signature })
        .exec()

      if (transaction && !transaction.processed) {
        await this.queueTransactionForProcessing(transaction)
      }
    }
  }

  private async queueTransactionForProcessing(transaction: TransactionEvent) {
    try {
      await this.transactionQueue.add(
        'process-transaction',
        {
          signature: transaction.signature,
          slot: transaction.slot,
          blockTime: transaction.block_time,
        },
        {
          priority: -transaction.slot, // Lower slot = higher priority (negative for min-heap behavior)
          attempts: this.config.maxRetries,
          backoff: {
            type: 'exponential',
            delay: this.config.retryDelayMs,
          },
        }
      )

      // Mark as processed in our database
      await this.transactionModel.updateOne(
        { _id: transaction._id },
        { processed: true, updated_at: new Date() }
      )

    } catch (error) {
      this.logger.error(`Failed to queue transaction ${transaction.signature}:`, error)
    }
  }

  // Manual trigger for scanning (used by controller/jobs)
  async startScanning() {
    if (!this.startupComplete) {
      this.logger.warn('Scanner not ready yet, initialization still in progress')
      return
    }

    this.logger.log('Manual scan triggered')

    // Run a forward scan immediately
    await this.scanForwards()

    // Process any unprocessed transactions
    if (this.isBackwardScanComplete) {
      await this.processUnprocessedTransactions()
    }
  }

  async getStatus() {
    const totalTransactions = await this.transactionModel.countDocuments()
    const processedTransactions = await this.transactionModel.countDocuments({ processed: true })
    const unprocessedTransactions = totalTransactions - processedTransactions

    // Get genesis status
    const genesisReached = await this.checkGenesisReached()
    const oldestTransaction = await this.transactionModel
      .findOne({})
      .sort({ slot: 1, signature: 1 })
      .exec()

    return {
      startupComplete: this.startupComplete,
      backwardScanComplete: this.isBackwardScanComplete,
      isProcessingQueue: this.isProcessingQueue,
      genesisReached,
      totalTransactions,
      processedTransactions,
      unprocessedTransactions,
      queuedTransactions: await this.transactionQueue.getWaiting(),
      oldestTransaction: oldestTransaction ? {
        signature: oldestTransaction.signature,
        slot: oldestTransaction.slot,
        blockTime: oldestTransaction.block_time
      } : null,
    }
  }

  /**
   * Manual method to validate genesis status
   */
  async validateGenesis() {
    const genesisReached = await this.checkGenesisReached()
    const oldestTransaction = await this.transactionModel
      .findOne({})
      .sort({ slot: 1, signature: 1 })
      .exec()

    return {
      genesisReached,
      oldestTransaction: oldestTransaction ? {
        signature: oldestTransaction.signature,
        slot: oldestTransaction.slot,
        blockTime: oldestTransaction.block_time
      } : null,
    }
  }
}
