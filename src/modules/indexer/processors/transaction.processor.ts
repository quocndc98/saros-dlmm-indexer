import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { InjectQueue } from '@nestjs/bullmq'
import { Model } from 'mongoose'
import { Job, Queue } from 'bullmq'
import { BaseProcessor } from './base.processor'
import { SolanaService } from '../services/solana.service'
import { TransactionParserService } from '../services/transaction-parser.service'
import { TransactionEvent } from '../schemas/transaction-event.schema'
import { QUEUE_NAME, JOB_TYPES, INSTRUCTION_NAMES } from '../../queue/queue.constant'
import { ParsedInstructionMessage, ParsedTransactionMessage } from '../types/indexer.types'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'

@Injectable()
export class TransactionProcessor extends BaseProcessor {
  constructor(
    private readonly solanaService: SolanaService,
    private readonly transactionParserService: TransactionParserService,
    @InjectQueue(QUEUE_NAME.SWAP_PROCESSOR) private readonly swapQueue: Queue,
    @InjectQueue(QUEUE_NAME.POSITION_PROCESSOR) private readonly positionQueue: Queue,
    @InjectQueue(QUEUE_NAME.COMPOSITION_FEES_PROCESSOR)
    private readonly compositionFeesQueue: Queue,
    @InjectQueue(QUEUE_NAME.INITIALIZE_PAIR_PROCESSOR) private readonly initializePairQueue: Queue,
    @InjectQueue(QUEUE_NAME.INITIALIZE_BIN_STEP_CONFIG_PROCESSOR)
    private readonly initializeBinStepConfigQueue: Queue,
    @InjectQueue(QUEUE_NAME.DLQ_PROCESSOR) private readonly dlqQueue: Queue,
    @InjectModel(TransactionEvent.name)
    private readonly transactionEventModel: Model<TransactionEvent>,
  ) {
    super(TransactionProcessor.name)
    this.process({} as any) // FAST TEST HERE
  }

  async process(job: Job): Promise<void> {
    this.logJobStart(job)

    try {
      const { signature } = job.data
      // const signature =
      // '4kTqfwmeVAgpSByFCrZGXt6CxezsE4dPS6SBqM3s7o4jn2RSA1K8ejnKgv537Wy1GJ3jDFsKzWFTw4z8HBk8RTkK' // init bin step config
      // const signature = '22xADbyM1btYpairSV8qMDr2LKT9MvGmiRtTjunrc5x5fc45AspajtsL6DwZr2dLvAsdhYNo9PhZRRp9vnnw6ntUrJCo' // init pair
      // const signature = '5Kna4KKq7KK465mbTaQrngr3zvaXEohzt8edDbyfKTvfSDDgdfPv7pSYofRfp1FvXrVDMpLziwFqKJgaGpB9yyLL' // init config
      // const signature = '3fMXMP7fcCG23vLeNCPZrRVNA6nM7GKbC15TGYis5wPPLcwCcUGrbYFZhPfERgw9XuwoJWgjG5gmdng5DxHTTZvR' // init quote asset badge

      // Get the parsed transaction from Solana
      const transaction = await this.solanaService.getParsedTransaction(signature)
      if (!transaction) {
        this.logger.warn(`Transaction ${signature} not found`)
        return
      }

      const message = transaction.transaction.message
      const meta = transaction.meta
      const slot = transaction.slot
      const blockTime = transaction.blockTime || 0

      // Extract liquidity book instructions
      const liquidityBookInstructions =
        this.transactionParserService.extractLiquidityBookInstructions(transaction)

      if (liquidityBookInstructions.length === 0) {
        this.logger.debug(`No liquidity book instructions found in transaction ${signature}`)
        return
      }

      // Process each instruction
      for (const instruction of liquidityBookInstructions) {
        await this.processInstruction(instruction)
      }

      // Mark transaction as processed
      await this.transactionEventModel.updateOne(
        { signature },
        {
          processed: true,
          updatedAt: new Date(),
        },
      )

      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing transaction ${job.data.signature}`)
    }
  }

  private async processInstruction(instruction: ParsedInstructionMessage): Promise<void> {
    try {
      let queueName: string
      let jobType: string

      const instructionName = LiquidityBookLibrary.getInstructionName(instruction.instruction.data)

      // Determine which processor to use based on instruction name
      switch (instructionName) {
        case INSTRUCTION_NAMES.SWAP:
          queueName = QUEUE_NAME.SWAP_PROCESSOR
          jobType = JOB_TYPES.PROCESS_SWAP
          break
        case INSTRUCTION_NAMES.CREATE_POSITION:
          queueName = QUEUE_NAME.POSITION_PROCESSOR
          jobType = JOB_TYPES.PROCESS_POSITION_CREATE
          break
        case INSTRUCTION_NAMES.INCREASE_POSITION:
          queueName = QUEUE_NAME.POSITION_PROCESSOR
          jobType = JOB_TYPES.PROCESS_POSITION_INCREASE
          break
        case INSTRUCTION_NAMES.DECREASE_POSITION:
          queueName = QUEUE_NAME.POSITION_PROCESSOR
          jobType = JOB_TYPES.PROCESS_POSITION_DECREASE
          break
        case INSTRUCTION_NAMES.CLOSE_POSITION:
          queueName = QUEUE_NAME.POSITION_PROCESSOR
          jobType = JOB_TYPES.PROCESS_POSITION_CLOSE
          break
        case INSTRUCTION_NAMES.COMPOSITION_FEES:
          queueName = QUEUE_NAME.COMPOSITION_FEES_PROCESSOR
          jobType = JOB_TYPES.PROCESS_COMPOSITION_FEES
          break
        case INSTRUCTION_NAMES.INITIALIZE_PAIR:
          queueName = QUEUE_NAME.INITIALIZE_PAIR_PROCESSOR
          jobType = JOB_TYPES.PROCESS_INITIALIZE_PAIR
          break
        case INSTRUCTION_NAMES.INITIALIZE_BIN_STEP_CONFIG:
          queueName = QUEUE_NAME.INITIALIZE_BIN_STEP_CONFIG_PROCESSOR
          jobType = JOB_TYPES.PROCESS_INITIALIZE_BIN_STEP_CONFIG
          break
        default:
          // Skip unknown instructions or add to DLQ
          this.logger.debug(`Unknown instruction: ${instructionName}`)
          return
      }

      // Add job to appropriate processor queue
      let targetQueue: Queue
      switch (queueName) {
        case QUEUE_NAME.SWAP_PROCESSOR:
          targetQueue = this.swapQueue
          break
        case QUEUE_NAME.POSITION_PROCESSOR:
          targetQueue = this.positionQueue
          break
        case QUEUE_NAME.COMPOSITION_FEES_PROCESSOR:
          targetQueue = this.compositionFeesQueue
          break
        case QUEUE_NAME.INITIALIZE_PAIR_PROCESSOR:
          targetQueue = this.initializePairQueue
          break
        case QUEUE_NAME.INITIALIZE_BIN_STEP_CONFIG_PROCESSOR:
          targetQueue = this.initializeBinStepConfigQueue
          break
        default:
          this.logger.warn(`Unknown queue: ${queueName}`)
          return
      }

      // Create job data with raw instruction data (similar to Rust approach)
      const jobData = instruction

      await targetQueue.add(jobType, jobData)
    } catch (error) {
      this.logger.error(`Error processing transaction ${instruction.transaction_signature}:`, error)

      // Add to DLQ for failed instructions
      await this.dlqQueue.add(JOB_TYPES.PROCESS_DLQ, {
        ...instruction,
        errorMessage: error.message,
      })
    }
  }
}
