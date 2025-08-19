import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Job } from 'bullmq'
import { BaseProcessor } from './base.processor'
import { Position } from '../schemas/position.schema'
import { Pair } from '../schemas/pair.schema'
import { Bin } from '../schemas/bin.schema'
import { LiquidityShares } from '../schemas/liquidity-shares.schema'
import { PositionUpdateEvent } from '../schemas/position-update-event.schema'
import { Instruction } from '../schemas/instruction.schema'
import { InstructionService } from '../services/instruction.service'
import { ProcessorName } from '../types/enums'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'
import base58 from 'bs58'
import { EVENT_IDENTIFIER, EVENT_NAMES } from '../../../liquidity-book/liquidity-book.constant'
import { splitAt } from '../../../utils/helper'
import { PositionDecreaseEvent } from '../../../liquidity-book/liquidity-book.type'
import { BN } from '@coral-xyz/anchor'
import { BIN_PER_POSITION } from '../constants/indexer.constants'
import { ParsedInstructionMessage } from '../types/indexer.types'

// Constants from Rust - event discriminator for PositionDecreaseEvent
const POSITION_DECREASE_EVENT_DISCRIMINATOR = [200, 116, 151, 126, 182, 237, 245, 254]

interface PositionDecreaseEventDecoded {
  pair: string
  position: string
  bin_ids: number[]
  amounts_x: bigint[]
  amounts_y: bigint[]
  liquidity_burned: bigint[]
}

@Injectable()
export class DecreasePositionProcessor extends BaseProcessor {
  constructor(
    @InjectModel(Position.name) private readonly positionModel: Model<Position>,
    @InjectModel(Pair.name) private readonly pairModel: Model<Pair>,
    @InjectModel(Bin.name) private readonly binModel: Model<Bin>,
    @InjectModel(LiquidityShares.name)
    private readonly liquiditySharesModel: Model<LiquidityShares>,
    @InjectModel(PositionUpdateEvent.name)
    private readonly positionUpdateEventModel: Model<PositionUpdateEvent>,
    @InjectModel(Instruction.name) private readonly instructionModel: Model<Instruction>,
    private readonly instructionService: InstructionService,
  ) {
    super(DecreasePositionProcessor.name)
  }

  async process(job: Job<ParsedInstructionMessage>): Promise<void> {
    this.logJobStart(job)

    try {
      const {
        blockNumber,
        signature,
        instruction,
        instructionIndex ,
        innerInstructionIndex ,
        isInner ,
        blockTime ,
      } = job.data

      this.logger.log(`Processing decrease position event for signature: ${signature}`)
      this.logger.log(
        `Block number: ${blockNumber}, Index: ${instructionIndex}, Is inner: ${isInner}`,
      )

      // 1. Decode event data from raw instruction (matching Rust approach)
      const decoded = this.decodeDecreasePositionEvent(instruction.data)

      if (!decoded) {
        this.logger.warn('Failed to decode decrease position event')
        return
      }

      this.logger.log(
        `Decoded decrease position event: ${JSON.stringify({
          pair: decoded.pair,
          position: decoded.position,
          bin_count: decoded.bin_ids.length,
        })}`,
      )

      // 2. Check if instruction already processed (matching Rust instruction deduplication)
      const { isAlreadyProcessed, instruction: instructionCreated } = await this.instructionService.checkAndInsertInstruction({
        blockNumber: blockNumber,
        signature: signature,
        processorName: ProcessorName.DecreasePositionProcessor,
        instructionIndex: instructionIndex,
        innerInstructionIndex: innerInstructionIndex,
        isInner: isInner,
        blockTime: blockTime,
      })

      if (isAlreadyProcessed) {
        this.logger.log(
          `Decrease position event already processed for signature: ${signature}`,
        )
        return
      }

      // 3. Process the position decrease
      await this.processDecreasePosition(
        decoded,
        signature,
        instructionCreated.id,
        instructionIndex,
        innerInstructionIndex,
        blockNumber,
        blockTime,
      )

      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing decrease position event`)
    }
  }

  private decodeDecreasePositionEvent(data: string): PositionDecreaseEventDecoded | null {
    try {
      const decodedData = Buffer.from(base58.decode(data))

      // Check event identifier (first 8 bytes)
      const [identifier, remaining] = splitAt(decodedData, 8)
      if (!identifier.equals(Buffer.from(EVENT_IDENTIFIER))) {
        this.logger.debug('Event identifier does not match decrease position')
        return null
      }

      // Check event discriminator (next 8 bytes)
      const [discriminator, eventData] = splitAt(remaining, 8)
      if (!discriminator.equals(Buffer.from(POSITION_DECREASE_EVENT_DISCRIMINATOR))) {
        this.logger.debug('Event discriminator does not match PositionDecreaseEvent')
        return null
      }

      // Decode event data using LiquidityBookLibrary
      const decodedEvent = LiquidityBookLibrary.decodeType<PositionDecreaseEvent>(
        EVENT_NAMES.POSITION_DECREASE_EVENT,
        eventData,
      )

      if (!decodedEvent) {
        this.logger.warn('Failed to decode PositionDecreaseEvent using LiquidityBookLibrary')
        return null
      }

      return {
        pair: decodedEvent.pair.toString(),
        position: decodedEvent.position.toString(),
        bin_ids: decodedEvent.bin_ids,
        amounts_x: decodedEvent.amounts_x.map((amount: BN) => amount.toString()),
        amounts_y: decodedEvent.amounts_y.map((amount: BN) => amount.toString()),
        liquidity_burned: decodedEvent.liquidity_burned.map((liquidity: BN) =>
          liquidity.toString(),
        ),
      }
    } catch (error) {
      this.logger.error('Error decoding decrease position event:', error)
      return null
    }
  }

  private async processDecreasePosition(
    decoded: PositionDecreaseEventDecoded,
    txnSignature: string,
    instructionId: string,
    instructionIndex: number,
    innerInstructionIndex: number | null,
    blockNumber: number,
    blockTime: number | null,
  ): Promise<void> {
    try {
      // Check if pair exists (matching Rust logic exactly)
      this.logger.log(`Checking if pair ${decoded.pair} exists...`)
      const existingPair = await this.pairModel.findOne({ id: decoded.pair }).lean()
      if (!existingPair) {
        throw new Error(
          `Processing position decreased event for non existent pair: ${decoded.pair}`,
        )
      }

      // Check if position exists
      this.logger.log(`Checking if position ${decoded.position} exists...`)
      const existingPosition = await this.positionModel.findOne({ id: decoded.position }).lean()
      if (!existingPosition) {
        throw new Error(
          `Error indexing decrease position for non existent position: ${decoded.position}`,
        )
      }

      const positionLowerBinId = existingPosition.lowerBinLbId
      let totalAmountX = BigInt(0)
      let totalAmountY = BigInt(0)

      // Process each bin
      for (let index = 0; index < decoded.bin_ids.length; index++) {
        const lbBinId = decoded.bin_ids[index]
        const liquidityShareIndex = lbBinId - positionLowerBinId

        if (liquidityShareIndex < 0 || liquidityShareIndex >= BIN_PER_POSITION) {
          throw new Error(
            `Error indexing decrease position liquidity_share_index out of bounds: ${decoded.position} with index ${liquidityShareIndex}`,
          )
        }

        // Update liquidity share
        const liquidityShareId = `${decoded.position}-${liquidityShareIndex}`
        this.logger.log(`Updating liquidity share: ${liquidityShareId}`)

        const existingLiquidityShare = await this.liquiditySharesModel.findOne({
          id: liquidityShareId,
        })
        if (!existingLiquidityShare) {
          throw new Error(
            `Error indexing decrease position, non existent liquidity share for position ${decoded.position}`,
          )
        }

        // Subtract liquidity_burned from balance
        const newBalance = BigInt(existingLiquidityShare.balance) - decoded.liquidity_burned[index]
        await this.liquiditySharesModel.updateOne(
          { id: liquidityShareId },
          { balance: newBalance.toString() },
        )

        // Update bin
        const binId = `${decoded.pair}-${lbBinId}`
        this.logger.log(`Updating bin: ${binId}`)

        const existingBin = await this.binModel.findOne({ id: binId }).lean()
        if (!existingBin) {
          throw new Error(
            `Error indexing decrease position, non existent bin for pair ${decoded.pair}`,
          )
        }

        // Subtract amounts from bin reserves and total supply (matching Rust subtraction logic)
        const newReserveX = BigInt(existingBin.reserveX) - decoded.amounts_x[index]
        const newReserveY = BigInt(existingBin.reserveY) - decoded.amounts_y[index]
        const newTotalSupply = BigInt(existingBin.totalSupply) - decoded.liquidity_burned[index]

        await this.binModel.updateOne(
          { id: binId },
          {
            reserveX: newReserveX.toString(),
            reserveY: newReserveY.toString(),
            totalSupply: newTotalSupply.toString(),
          },
        )

        totalAmountX += decoded.amounts_x[index]
        totalAmountY += decoded.amounts_y[index]

        // Insert position update event with negative values (matching Rust position_update_event_crud logic exactly)
        const eventId = `${instructionId}-${lbBinId}`
        await this.positionUpdateEventModel.create({
          id: eventId,
          signature: txnSignature,
          pairId: decoded.pair,
          positionId: decoded.position,
          binId: binId,
          lbBinId: lbBinId,
          deltaLiquidityBalance: (-decoded.liquidity_burned[index]).toString(), // Negative for decrease
          deltaAmountX: (-decoded.amounts_x[index]).toString(), // Negative for decrease
          deltaAmountY: (-decoded.amounts_y[index]).toString(), // Negative for decrease
          index: instructionIndex,
          innerIndex: innerInstructionIndex,
          blockNumber,
          blockTime: blockTime ? new Date(blockTime * 1000) : new Date(),
        })
      }

      // Update pair reserves by subtracting (matching Rust pair update logic)
      this.logger.log(`Updating pair reserves for pair: ${decoded.pair}`)
      const newPairReserveX = BigInt(existingPair.reserveX) - totalAmountX
      const newPairReserveY = BigInt(existingPair.reserveY) - totalAmountY

      await this.pairModel.updateOne(
        { id: decoded.pair },
        {
          reserveX: newPairReserveX.toString(),
          reserveY: newPairReserveY.toString(),
        },
      )

      this.logger.log(`Successfully processed decrease position for position: ${decoded.position}`)
    } catch (error) {
      this.logger.error(`Error processing decrease position: ${error.message}`)
      throw error
    }
  }
}
