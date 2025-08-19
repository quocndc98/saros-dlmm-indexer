import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Job } from 'bullmq'
import { BaseProcessor } from './base.processor'
import { PartiallyDecodedInstruction } from '@solana/web3.js'
import { Position } from '../schemas/position.schema'
import { Instruction } from '../schemas/instruction.schema'
import { LiquidityShares } from '../schemas/liquidity-shares.schema'
import { InstructionService } from '../services/instruction.service'
import { ProcessorName } from '../types/enums'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'

interface ClosePositionDecoded {
  pair: string
  position: string
  position_mint: string
  position_token_account: string
}

@Injectable()
export class ClosePositionProcessor extends BaseProcessor {
  constructor(
    @InjectModel(Position.name) private readonly positionModel: Model<Position>,
    @InjectModel(Instruction.name) private readonly instructionModel: Model<Instruction>,
    @InjectModel(LiquidityShares.name) private readonly liquiditySharesModel: Model<LiquidityShares>,
    private readonly instructionService: InstructionService,
  ) {
    super(ClosePositionProcessor.name)
  }

  async process(job: Job): Promise<void> {
    this.logJobStart(job)

    try {
      const {
        block_number,
        transaction_signature,
        instruction,
        instruction_index,
        inner_instruction_index,
        is_inner,
        block_time,
      } = job.data

      this.logger.log(`Processing close position instruction for signature: ${transaction_signature}`)
      this.logger.log(`Block number: ${block_number}, Index: ${instruction_index}, Is inner: ${is_inner}`)

      // 1. Decode instruction data from raw instruction (matching Rust and InitializePairProcessor approach)
      const decoded = await this.decodeClosePositionInstruction(instruction)

      if (!decoded) {
        this.logger.warn('Failed to decode close position instruction')
        return
      }

      this.logger.log(`Decoded close position: ${JSON.stringify(decoded)}`)

      // 2. Check if instruction already processed (matching Rust instruction deduplication)
      const { isAlreadyProcessed } = await this.instructionService.checkAndInsertInstruction({
        blockNumber: block_number,
        signature: transaction_signature,
        processorName: ProcessorName.ClosePositionProcessor,
        instructionIndex: instruction_index,
        innerInstructionIndex: inner_instruction_index,
        isInner: is_inner,
        blockTime: block_time,
      })

      if (isAlreadyProcessed) {
        this.logger.log(`Close position instruction already processed for signature: ${transaction_signature}`)
        return
      }

      // 3. Process the position closure
      await this.processClosePosition(decoded, transaction_signature, instruction_index, block_number)

      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing close position instruction`)
    }
  }

  private async decodeClosePositionInstruction(
    instruction: PartiallyDecodedInstruction,
  ): Promise<ClosePositionDecoded | null> {
    try {
      const { idlIx } = LiquidityBookLibrary.decodeInstruction(instruction.data)
      const accounts = LiquidityBookLibrary.getAccountsByName(
        idlIx,
        instruction.accounts,
        [
          'pair',
          'position',
          'position_mint',
          'position_token_account',
        ],
      )

      return {
        pair: accounts.pair.toString(),
        position: accounts.position.toString(),
        position_mint: accounts.position_mint.toString(),
        position_token_account: accounts.position_token_account.toString(),
      }
    } catch (error) {
      this.logger.error('Error decoding close position instruction:', error)
      return null
    }
  }

  private async processClosePosition(
    decoded: ClosePositionDecoded,
    txnSignature: string,
    instructionIndex: number,
    blockNumber: number,
  ): Promise<void> {
    try {
      // Check if decrease position event has been indexed (matching Rust logic exactly)
      this.logger.log(`Checking if decrease position instruction exists for txn: ${txnSignature}`)
      const isIndexedDecreasePosition = await this.instructionModel.exists({
        signature: txnSignature,
        processorName: ProcessorName.DecreasePositionProcessor,
        index: instructionIndex,
        blockNumber: blockNumber,
      })

      if (!isIndexedDecreasePosition) {
        throw new Error(
          `Indexing Close Position before Decrease Position event for txn: ${txnSignature}`
        )
      }

      // Check if position exists (matching Rust position_crud::get)
      this.logger.log(`Checking if position ${decoded.position} exists...`)
      const existingPosition = await this.positionModel.findOne({
        id: decoded.position
      }).lean()

      if (!existingPosition) {
        throw new Error('Processing Close Position for non-existent position')
      }

      // Validate pair matches (matching Rust validation exactly)
      if (existingPosition.pairId !== decoded.pair) {
        throw new Error(
          `Processing Close Position for non-matching position ${decoded.position} and pair_id ${decoded.pair}`
        )
      }

      this.logger.log(`Closing position ${decoded.position} for pair ${decoded.pair}`)

      const deletedShares = await this.liquiditySharesModel.deleteMany({
        positionId: decoded.position
      })

      this.logger.log(`Deleted ${deletedShares.deletedCount} liquidity shares for position: ${decoded.position}`)

      const deletedPosition = await this.positionModel.deleteOne({
        id: decoded.position
      })

      if (deletedPosition.deletedCount === 0) {
        throw new Error(`Failed to delete position: ${decoded.position}`)
      }

      this.logger.log(`Successfully closed position: ${decoded.position}`)
    } catch (error) {
      this.logger.error(`Error processing close position: ${error.message}`)
      throw error
    }
  }
}
