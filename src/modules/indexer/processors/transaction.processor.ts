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

@Injectable()
export class TransactionProcessor extends BaseProcessor {
  constructor(
    private readonly solanaService: SolanaService,
    private readonly transactionParserService: TransactionParserService,
    @InjectQueue(QUEUE_NAME.SWAP_PROCESSOR) private readonly swapQueue: Queue,
    @InjectQueue(QUEUE_NAME.POSITION_PROCESSOR) private readonly positionQueue: Queue,
    @InjectQueue(QUEUE_NAME.COMPOSITION_FEES_PROCESSOR) private readonly compositionFeesQueue: Queue,
    @InjectQueue(QUEUE_NAME.DLQ_PROCESSOR) private readonly dlqQueue: Queue,
    @InjectModel(TransactionEvent.name)
    private readonly transactionEventModel: Model<TransactionEvent>,
  ) {
    super('TransactionProcessor')
  }

  async process(job: Job): Promise<void> {
    this.logJobStart(job)

    try {
      const { signature } = job.data

      // Get the parsed transaction from Solana
      const transaction = await this.solanaService.getParsedTransaction(signature)
      if (!transaction) {
        this.logger.warn(`Transaction ${signature} not found`)
        return
      }

      // Parse the transaction
      const parsedTransaction = this.transactionParserService.parseTransaction(signature, transaction)
      if (!parsedTransaction) {
        this.logger.warn(`Failed to parse transaction ${signature}`)
        return
      }

      // Extract liquidity book instructions
      const liquidityBookInstructions = this.transactionParserService.extractLiquidityBookInstructions(parsedTransaction)

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
          updated_at: new Date(),
        }
      )

      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing transaction ${job.data.signature}`)
    }
  }

  private async processInstruction(instruction: any): Promise<void> {
    try {
      let queueName: string
      let jobType: string

      // Determine which processor to use based on instruction name
      switch (instruction.instructionName) {
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
        default:
          // Skip unknown instructions or add to DLQ
          this.logger.debug(`Unknown instruction: ${instruction.instructionName}`)
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
        default:
          this.logger.warn(`Unknown queue: ${queueName}`)
          return
      }

      await targetQueue.add(jobType, instruction)

    } catch (error) {
      this.logger.error(`Error processing instruction ${instruction.instructionName}:`, error)

      // Add to DLQ for failed instructions
      await this.dlqQueue.add(
        JOB_TYPES.PROCESS_DLQ,
        {
          ...instruction,
          errorMessage: error.message,
        }
      )
    }
  }
}
