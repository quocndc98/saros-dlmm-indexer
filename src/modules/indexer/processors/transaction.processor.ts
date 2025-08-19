import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { InjectQueue } from '@nestjs/bullmq'
import { Model } from 'mongoose'
import { Job, Queue } from 'bullmq'
import bs58 from 'bs58'
import { BaseProcessor } from './base.processor'
import { SolanaService } from '../services/solana.service'
import { TransactionParserService } from '../services/transaction-parser.service'
import { TransactionEvent } from '../schemas/transaction-event.schema'
import { QUEUE_NAME, JOB_TYPES } from '../../queue/queue.constant'
import { ParsedInstructionMessage, ParsedTransactionMessage } from '../types/indexer.types'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'
import { EVENT_IDENTIFIER, EVENT_NAMES, INSTRUCTION_NAMES } from '../../../liquidity-book/liquidity-book.constant'
import { splitAt } from '../../../utils/helper'

@Injectable()
export class TransactionProcessor extends BaseProcessor {
  constructor(
    private readonly solanaService: SolanaService,
    private readonly transactionParserService: TransactionParserService,
    @InjectQueue(QUEUE_NAME.SWAP_PROCESSOR) private readonly swapQueue: Queue,
    @InjectQueue(QUEUE_NAME.CREATE_POSITION_PROCESSOR) private readonly createPositionQueue: Queue,
    @InjectQueue(QUEUE_NAME.CLOSE_POSITION_PROCESSOR) private readonly closePositionQueue: Queue,
    @InjectQueue(QUEUE_NAME.COMPOSITION_FEES_PROCESSOR)
    private readonly compositionFeesQueue: Queue,
    @InjectQueue(QUEUE_NAME.INITIALIZE_PAIR_PROCESSOR) private readonly initializePairQueue: Queue,
    @InjectQueue(QUEUE_NAME.INITIALIZE_BIN_STEP_CONFIG_PROCESSOR)
    private readonly initializeBinStepConfigQueue: Queue,
    @InjectQueue(QUEUE_NAME.INITIALIZE_BIN_ARRAY_PROCESSOR)
    private readonly initializeBinArrayQueue: Queue,
    @InjectQueue(QUEUE_NAME.QUOTE_ASSET_PROCESSOR) private readonly quoteAssetQueue: Queue,
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
      // const { signature } = job.data

      // const signature = '5Kna4KKq7KK465mbTaQrngr3zvaXEohzt8edDbyfKTvfSDDgdfPv7pSYofRfp1FvXrVDMpLziwFqKJgaGpB9yyLL' // init config
      // const signature = '4kTqfwmeVAgpSByFCrZGXt6CxezsE4dPS6SBqM3s7o4jn2RSA1K8ejnKgv537Wy1GJ3jDFsKzWFTw4z8HBk8RTkK' // init bin step config
      // const signature = '3fMXMP7fcCG23vLeNCPZrRVNA6nM7GKbC15TGYis5wPPLcwCcUGrbYFZhPfERgw9XuwoJWgjG5gmdng5DxHTTZvR' // init quote asset badge
      // const signature = '22xADbyM1btYSV8qMDr2LKT9MvGmiRtTjunrc5x5fc45AspajtsL6DwZr2dLvAsdhYNo9PhZRRp9vnnw6ntUrJCo' // init pair
      // const signature = '5oFb18Cq7QEmY35A6k3aQkZbBeAgpPrYKXFwv6FPwiMKndzkZU5B1wWAi5Y353w6DW2hTcUey1ADyHfTJdQ4zxL3' // init bin array

      // const signature = '2YoKYjLChSs5jMzZkDXJvgfaAKvdaABBHPW2AnpJVPbdgMTE8RxzB3ompoXUh16hR5iafzutwE8uyB4c97MLWQPP' // init bin step config
      // const signature = 'Y2QvSt2md1XVpFSW1ucodS7FFdUU3nEKUeDFBqrgTHJzPHdoVWZ3ACMVWnkWNZFVmfR7mvn9rDsgLwXF4kpaGhe' // init pair saros-usdc
      const signature = '54LML8qXjJXq4JRbTiGgyJ76NVURWGhZGA9Xnjgo2ucdDtNfY98rXeUPDCyfpjW7FXpv8nAR9XkirTCKjhkxG5ba' // composition fee saros-usdc

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

      // TODO: refactor this logic to handle events and instructions
      // Check if this is an inner instruction with events
      if (instruction.is_inner) {
        console.log(instruction.transaction_signature);
        const eventResult = this.tryHandleEvent(instruction.instruction.data)
        if (eventResult) {
          queueName = eventResult.queueName
          jobType = eventResult.jobType
        } else {
          // If not an event, handle as regular instruction
          const instructionResult = this.handleInstruction(instruction.instruction.data)
          if (!instructionResult) return
          queueName = instructionResult.queueName
          jobType = instructionResult.jobType
        }
      } else {
        // Handle regular (non-inner) instruction
        const instructionResult = this.handleInstruction(instruction.instruction.data)
        if (!instructionResult) return
        queueName = instructionResult.queueName
        jobType = instructionResult.jobType
      }

      // Route to appropriate queue
      await this.routeToQueue(queueName, jobType, instruction)

    } catch (error) {
      this.logger.error(`Error processing transaction ${instruction.transaction_signature}:`, error)

      // Add to DLQ for failed instructions
      await this.dlqQueue.add(JOB_TYPES.PROCESS_DLQ, {
        ...instruction,
        errorMessage: error.message,
      })
    }
  }

  private tryHandleEvent(data: string): { queueName: string; jobType: string } | null {
    try {
      const dataBuffer = Buffer.from(bs58.decode(data))
      const identifier = dataBuffer.subarray(0, 8)

      // Check if this has the event identifier
      if (!identifier.equals(Buffer.from(EVENT_IDENTIFIER))) {
        return null // Not an event
      }

      const eventName = LiquidityBookLibrary.getEventName(data)
      if (!eventName) {
        this.logger.warn(`Could not parse event name from data`)
        return null
      }
      console.log(eventName);

      switch (eventName) {
        case EVENT_NAMES.BIN_SWAP_EVENT:
          return {
            queueName: QUEUE_NAME.SWAP_PROCESSOR,
            jobType: JOB_TYPES.PROCESS_SWAP
          }
        case EVENT_NAMES.COMPOSITION_FEES_EVENT:
          return {
            queueName: QUEUE_NAME.COMPOSITION_FEES_PROCESSOR,
            jobType: JOB_TYPES.PROCESS_COMPOSITION_FEES
          }
        case EVENT_NAMES.QUOTE_ASSET_BADGE_INITIALIZATION_EVENT:
        case EVENT_NAMES.QUOTE_ASSET_BADGE_UPDATE_EVENT:
          return {
            queueName: QUEUE_NAME.QUOTE_ASSET_PROCESSOR,
            jobType: JOB_TYPES.PROCESS_QUOTE_ASSET
          }
        case EVENT_NAMES.POSITION_CREATION_EVENT:
          return {
            queueName: QUEUE_NAME.CREATE_POSITION_PROCESSOR,
            jobType: JOB_TYPES.PROCESS_POSITION_CREATE
          }
        default:
          this.logger.warn(`Unknown event: ${eventName}`)
          return null
      }
    } catch (error) {
      return null
    }
  }

  private handleInstruction(data: string): { queueName: string; jobType: string } | null {
    const instructionName = LiquidityBookLibrary.getInstructionName(data)
    console.log(instructionName);
    switch (instructionName) {
      case INSTRUCTION_NAMES.SWAP:
        return { queueName: QUEUE_NAME.SWAP_PROCESSOR, jobType: JOB_TYPES.PROCESS_SWAP }
      case INSTRUCTION_NAMES.CREATE_POSITION:
        return { queueName: QUEUE_NAME.CREATE_POSITION_PROCESSOR, jobType: JOB_TYPES.PROCESS_POSITION_CREATE }
      // case INSTRUCTION_NAMES.INCREASE_POSITION:
      //   return { queueName: QUEUE_NAME.POSITION_PROCESSOR, jobType: JOB_TYPES.PROCESS_POSITION_INCREASE }
      // case INSTRUCTION_NAMES.DECREASE_POSITION:
      //   return { queueName: QUEUE_NAME.POSITION_PROCESSOR, jobType: JOB_TYPES.PROCESS_POSITION_DECREASE }
      case INSTRUCTION_NAMES.CLOSE_POSITION:
        return { queueName: QUEUE_NAME.CLOSE_POSITION_PROCESSOR, jobType: JOB_TYPES.PROCESS_POSITION_CLOSE }
      case INSTRUCTION_NAMES.COMPOSITION_FEES:
        return { queueName: QUEUE_NAME.COMPOSITION_FEES_PROCESSOR, jobType: JOB_TYPES.PROCESS_COMPOSITION_FEES }
      case INSTRUCTION_NAMES.INITIALIZE_PAIR:
        return { queueName: QUEUE_NAME.INITIALIZE_PAIR_PROCESSOR, jobType: JOB_TYPES.PROCESS_INITIALIZE_PAIR }
      case INSTRUCTION_NAMES.INITIALIZE_BIN_STEP_CONFIG:
        return { queueName: QUEUE_NAME.INITIALIZE_BIN_STEP_CONFIG_PROCESSOR, jobType: JOB_TYPES.PROCESS_INITIALIZE_BIN_STEP_CONFIG }
      case INSTRUCTION_NAMES.INITIALIZE_BIN_ARRAY:
        return { queueName: QUEUE_NAME.INITIALIZE_BIN_ARRAY_PROCESSOR, jobType: JOB_TYPES.PROCESS_INITIALIZE_BIN_ARRAY }
      // case INSTRUCTION_NAMES.INITIALIZE_QUOTE_ASSET_BADGE:
      //   return { queueName: QUEUE_NAME.QUOTE_ASSET_PROCESSOR, jobType: JOB_TYPES.PROCESS_QUOTE_ASSET }
      default:
        this.logger.debug(`Unknown instruction: ${instructionName}`)
        return null
    }
  }

  private async routeToQueue(queueName: string, jobType: string, instruction: ParsedInstructionMessage): Promise<void> {
    let targetQueue: Queue

    switch (queueName) {
      case QUEUE_NAME.SWAP_PROCESSOR:
        targetQueue = this.swapQueue
        break
      case QUEUE_NAME.CREATE_POSITION_PROCESSOR:
        targetQueue = this.createPositionQueue
        break
      case QUEUE_NAME.CLOSE_POSITION_PROCESSOR:
        targetQueue = this.closePositionQueue
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
      case QUEUE_NAME.INITIALIZE_BIN_ARRAY_PROCESSOR:
        targetQueue = this.initializeBinArrayQueue
        break
      case QUEUE_NAME.QUOTE_ASSET_PROCESSOR:
        targetQueue = this.quoteAssetQueue
        break
      default:
        this.logger.warn(`Unknown queue: ${queueName}`)
        return
    }

    await targetQueue.add(jobType, instruction)
  }
}
