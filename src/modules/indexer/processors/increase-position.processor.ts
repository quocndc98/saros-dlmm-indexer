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
import { InstructionService } from '../services/instruction.service'
import { ProcessorName } from '../types/enums'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'
import base58 from 'bs58'
import { BIN_PER_POSITION } from '../constants/indexer.constants'
import { splitAt } from '../../../utils/helper'
import { EVENT_IDENTIFIER, EVENT_NAMES } from '../../../liquidity-book/liquidity-book.constant'
import { PositionIncreaseEvent } from '../../../liquidity-book/liquidity-book.type'
import { ParsedInstructionMessage } from '../types/indexer.types'

const POSITION_INCREASE_EVENT_DISCRIMINATOR = [247, 40, 58, 113, 28, 175, 60, 174]

interface PositionIncreaseEventDecoded {
  pair: string
  position: string
  bin_ids: number[]
  amounts_x: bigint[]
  amounts_y: bigint[]
  liquidity_minted: bigint[]
}

@Injectable()
export class IncreasePositionProcessor extends BaseProcessor {
  constructor(
    @InjectModel(Position.name) private readonly positionModel: Model<Position>,
    @InjectModel(Pair.name) private readonly pairModel: Model<Pair>,
    @InjectModel(Bin.name) private readonly binModel: Model<Bin>,
    @InjectModel(LiquidityShares.name) private readonly liquiditySharesModel: Model<LiquidityShares>,
    @InjectModel(PositionUpdateEvent.name) private readonly positionUpdateEventModel: Model<PositionUpdateEvent>,
    private readonly instructionService: InstructionService,
  ) {
    super(IncreasePositionProcessor.name)
  }

  async process(job: Job<ParsedInstructionMessage>): Promise<void> {
    this.logJobStart(job)

    try {
      const {
        blockNumber,
        signature,
        instruction,
        instructionIndex,
        innerInstructionIndex,
        isInner,
        blockTime,
      } = job.data

      this.logger.log(`Processing increase position event for signature: ${signature}`)
      this.logger.log(`Block number: ${blockNumber}, Index: ${instructionIndex}, Is inner: ${isInner}`)

      const decoded = this.decodeIncreasePositionEvent(instruction.data)

      if (!decoded) {
        this.logger.warn('Failed to decode increase position event')
        return
      }

      this.logger.log(`Decoded increase position event: ${JSON.stringify({
        pair: decoded.pair,
        position: decoded.position,
        bin_count: decoded.bin_ids.length
      })}`)

      const { isAlreadyProcessed, instruction: instructionCreated } = await this.instructionService.checkAndInsertInstruction({
        blockNumber: blockNumber,
        signature: signature,
        processorName: ProcessorName.IncreasePositionProcessor,
        instructionIndex: instructionIndex,
        innerInstructionIndex: innerInstructionIndex,
        isInner: isInner,
        blockTime: blockTime,
      })

      if (isAlreadyProcessed) {
        this.logger.log(`Increase position event already processed for signature: ${signature}`)
        return
      }

      await this.processIncreasePosition(decoded, signature, instructionCreated.id, instructionIndex, innerInstructionIndex, blockNumber, blockTime)

      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing increase position event`)
    }
  }

  private decodeIncreasePositionEvent(data: string): PositionIncreaseEventDecoded | null {
    try {
      const decodedData = Buffer.from(base58.decode(data))

      const [identifier, remaining] = splitAt(decodedData, 8)
      if (!identifier.equals(Buffer.from(EVENT_IDENTIFIER))) {
        this.logger.debug('Event identifier does not match increase position')
        return null
      }

      const [discriminator, eventData] = splitAt(remaining, 8)
      if (!discriminator.equals(Buffer.from(POSITION_INCREASE_EVENT_DISCRIMINATOR))) {
        this.logger.debug('Event discriminator does not match PositionIncreaseEvent')
        return null
      }

      // Decode event data using LiquidityBookLibrary
      const decodedEvent = LiquidityBookLibrary.decodeType<PositionIncreaseEvent>(EVENT_NAMES.POSITION_INCREASE_EVENT, eventData)
      if (!decodedEvent) {
        this.logger.warn('Failed to decode PositionIncreaseEvent using LiquidityBookLibrary')
        return null
      }

      return {
        pair: decodedEvent.pair.toString(),
        position: decodedEvent.position.toString(),
        bin_ids: decodedEvent.bin_ids,
        amounts_x: decodedEvent.amounts_x.map((amount: any) => BigInt(amount.toString())),
        amounts_y: decodedEvent.amounts_y.map((amount: any) => BigInt(amount.toString())),
        liquidity_minted: decodedEvent.liquidity_minted.map((liquidity: any) => BigInt(liquidity.toString())),
      }
    } catch (error) {
      this.logger.error('Error decoding increase position event:', error)
      return null
    }
  }

  private async processIncreasePosition(
    decoded: PositionIncreaseEventDecoded,
    txnSignature: string,
    instructionId: string,
    instructionIndex: number,
    innerInstructionIndex: number | null,
    blockNumber: number,
    blockTime: number | null,
  ): Promise<void> {
    try {
      this.logger.debug(`Checking if pair ${decoded.pair} exists...`)
      const existingPair = await this.pairModel.findOne({ id: decoded.pair }).lean()
      if (!existingPair) {
        throw new Error(`Processing position increased event for non existent pair: ${decoded.pair}`)
      }

      this.logger.debug(`Checking if position ${decoded.position} exists...`)
      const position = await this.positionModel.findOne({ id: decoded.position }).lean()
      if (!position) {
        throw new Error(`Error indexing increase position for non existent position: ${decoded.position}`)
      }

      // update bin and liquidity_share rows
      const positionLowerBinId = position.lowerBinLbId
      let totalAmountX = BigInt(0)
      let totalAmountY = BigInt(0)

      // Process each bin (matching Rust logic exactly)
      for (let index = 0; index < decoded.bin_ids.length; index++) {
        const lbBinId = decoded.bin_ids[index]
        const liquidityShareIndex = lbBinId - positionLowerBinId

        if (liquidityShareIndex < 0 || liquidityShareIndex >= BIN_PER_POSITION) {
          throw new Error(
            `Error indexing increase position liquidity_share_index out of bounds: ${decoded.position} with index ${liquidityShareIndex}`
          )
        }

        // Update liquidity share (matching Rust liquidity_shares_crud logic)
        const liquidityShareId = `${decoded.position}-${liquidityShareIndex}`
        this.logger.log(`Updating liquidity share: ${liquidityShareId}`)

        const existingLiquidityShare = await this.liquiditySharesModel.findOne({ id: liquidityShareId })
        if (!existingLiquidityShare) {
          throw new Error(
            `Error indexing increase position, non existent liquidity share for position ${decoded.position}`
          )
        }

        const newBalance = BigInt(existingLiquidityShare.balance) + decoded.liquidity_minted[index]
        await this.liquiditySharesModel.updateOne(
          { id: liquidityShareId },
          { balance: newBalance.toString() }
        )

        // Update bin (matching Rust bin_crud logic)
        const binId = `${decoded.pair}-${lbBinId}`
        this.logger.log(`Updating bin: ${binId}`)

        const existingBin = await this.binModel.findOne({ id: binId })
        if (!existingBin) {
          throw new Error(
            `Error indexing increase position, non existent bin for pair ${decoded.pair}`
          )
        }

        const newReserveX = BigInt(existingBin.reserveX) + decoded.amounts_x[index]
        const newReserveY = BigInt(existingBin.reserveY) + decoded.amounts_y[index]
        const newTotalSupply = BigInt(existingBin.totalSupply) + decoded.liquidity_minted[index]

        await this.binModel.updateOne(
          { id: binId },
          {
            reserveX: newReserveX.toString(),
            reserveY: newReserveY.toString(),
            totalSupply: newTotalSupply.toString(),
          }
        )

        totalAmountX += decoded.amounts_x[index]
        totalAmountY += decoded.amounts_y[index]

        const eventId = `${instructionId}-${lbBinId}`
        await this.positionUpdateEventModel.create({
          id: eventId,
          signature: txnSignature,
          pairId: decoded.pair,
          positionId: decoded.position,
          binId: binId,
          lbBinId: lbBinId,
          deltaLiquidityBalance: decoded.liquidity_minted[index].toString(),
          deltaAmountX: decoded.amounts_x[index].toString(),
          deltaAmountY: decoded.amounts_y[index].toString(),
          index: instructionIndex,
          innerIndex: innerInstructionIndex,
          blockNumber: blockNumber,
          blockTime: blockTime ? new Date(blockTime * 1000) : new Date(),
        })
      }

      // Update pair reserves (matching Rust pair update logic)
      this.logger.log(`Updating pair reserves for pair: ${decoded.pair}`)
      const newPairReserveX = BigInt(existingPair.reserveX) + totalAmountX
      const newPairReserveY = BigInt(existingPair.reserveY) + totalAmountY

      await this.pairModel.updateOne(
        { id: decoded.pair },
        {
          reserveX: newPairReserveX.toString(),
          reserveY: newPairReserveY.toString(),
        }
      )

      this.logger.log(`Successfully processed increase position for position: ${decoded.position}`)
    } catch (error) {
      this.logger.error(`Error processing increase position: ${error.message}`)
      throw error
    }
  }
}
