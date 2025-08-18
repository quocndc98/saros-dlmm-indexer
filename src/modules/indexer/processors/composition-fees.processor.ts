import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Job } from 'bullmq'
import bs58 from 'bs58'
import { BaseProcessor } from './base.processor'
import { CompositionFeesEvent, CompositionFeesEventDocument } from '../schemas/composition-fees-event.schema'
import { Pair, PairDocument } from '../schemas/pair.schema'
import { TokenMint, TokenMintDocument } from '../schemas/token-mint.schema'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'
import { splitAt } from '../../../utils/helper'
import { BinMath } from '../../../utils/bin-math'
import { EVENT_IDENTIFIER } from '../../../liquidity-book/liquidity-book.constant'
import { TYPE_NAMES } from '../../../liquidity-book/liquidity-book.constant'

// Constants from Rust
const COMPOSITION_FEES_EVENT_DISCRIMINATOR = Buffer.from([83, 234, 249, 47, 88, 125, 2, 86])

interface CompositionFeesEventDecoded {
  pair: string
  active_id: number
  composition_fees_x: number
  composition_fees_y: number
  protocol_fees_x: number
  protocol_fees_y: number
}

@Injectable()
export class CompositionFeesProcessor extends BaseProcessor {
  constructor(
    @InjectModel(CompositionFeesEvent.name)
    private readonly compositionFeesEventModel: Model<CompositionFeesEventDocument>,
    @InjectModel(Pair.name)
    private readonly pairModel: Model<PairDocument>,
    @InjectModel(TokenMint.name)
    private readonly tokenMintModel: Model<TokenMintDocument>,
  ) {
    super(CompositionFeesProcessor.name)
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
        block_time
      } = job.data

      this.logger.log(`Processing composition fees event for signature: ${transaction_signature}`)

      // Parse instruction data (matching Rust logic)
      const decodedData = Buffer.from(bs58.decode(instruction.data))
      const [identifier, data] = splitAt(decodedData, 8)

      // Check if this is an event instruction
      if (!identifier.equals(Buffer.from(EVENT_IDENTIFIER))) {
        this.logger.warn('Not an event instruction')
        return
      }

      const [discriminator, eventData] = splitAt(data, 8)

      if (!discriminator.equals(COMPOSITION_FEES_EVENT_DISCRIMINATOR)) {
        this.logger.warn('Not a composition fees event')
        return
      }

      // Decode composition fees event
      const decoded = LiquidityBookLibrary.decodeType<CompositionFeesEventDecoded>(
        TYPE_NAMES.COMPOSITION_FEES_EVENT,
        eventData,
      )

      if (!decoded) {
        this.logger.warn('Failed to decode composition fees event')
        return
      }

      // Process the composition fees event
      await this.processCompositionFeesEvent(decoded, {
        block_number,
        transaction_signature,
        instruction_index,
        inner_instruction_index,
        block_time
      })

      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing composition fees event`)
    }
  }

  /**
   * Process composition fees event
   * Matches Rust implementation exactly:
   * - Finds the pair and validates it exists
   * - Fetches token mints for price calculations
   * - Calculates normalized amounts and USD/native prices
   * - Creates composition fees event record
   * - Updates pair with new active_id and protocol fees
   */
  private async processCompositionFeesEvent(
    decoded: CompositionFeesEventDecoded,
    metadata: {
      block_number: number
      transaction_signature: string
      instruction_index: number
      inner_instruction_index?: number
      block_time?: number
    }
  ): Promise<void> {
    try {
      // 1. Find the pair (matching Rust logic)
      this.logger.log(`Finding pair: ${decoded.pair}`)
      const pair = await this.pairModel.findOne({ id: decoded.pair }).lean()

      if (!pair) {
        throw new Error(`Processing composition fees event for non existent pair: ${decoded.pair}`)
      }

      // 2. Get token mints for price calculations (matching Rust logic)
      const [tokenMintX, tokenMintY] = await Promise.all([
        this.tokenMintModel.findOne({ id: pair.tokenMintXId }).lean(),
        this.tokenMintModel.findOne({ id: pair.tokenMintYId }).lean(),
      ])

      if (!tokenMintX) {
        throw new Error(`Failed to get token mint ${pair.tokenMintXId}`)
      }
      if (!tokenMintY) {
        throw new Error(`Failed to get token mint ${pair.tokenMintYId}`)
      }

      // 3. Calculate price from active_id (matching Rust bin_math::get_price_from_id)
      const price = BinMath.getPriceFromId(pair.binStep, decoded.active_id)
      const priceXY = BinMath.calculatePriceXY(price, tokenMintX.decimals, tokenMintY.decimals)

      this.logger.log(`Calculated price X/Y: ${priceXY} for active_id: ${decoded.active_id}`)

      // 4. Calculate normalized amounts (matching Rust bin_math::normalize_amount)
      const compositionFeesXNormalized = BinMath.normalizeAmount(
        decoded.composition_fees_x.toString(),
        tokenMintX.decimals
      )
      const compositionFeesYNormalized = BinMath.normalizeAmount(
        decoded.composition_fees_y.toString(),
        tokenMintY.decimals
      )
      const protocolFeesXNormalized = BinMath.normalizeAmount(
        decoded.protocol_fees_x.toString(),
        tokenMintX.decimals
      )
      const protocolFeesYNormalized = BinMath.normalizeAmount(
        decoded.protocol_fees_y.toString(),
        tokenMintY.decimals
      )

      // 5. For now, use simplified price calculations (in production, implement full token price fetching)
      // Rust fetches real-time prices from GeckoTerminal API
      // TODO: Implement real-time price fetching from an API
      const priceXNative = '1.0' // Simplified - assume 1:1 with native token
      const priceXUsd = '1.0' // Simplified - should fetch from price API
      const priceYNative = '1.0'
      const priceYUsd = '1.0'

      const compositionFeesXNative = BinMath.multiply(compositionFeesXNormalized, priceXNative)
      const compositionFeesXUsd = BinMath.multiply(compositionFeesXNormalized, priceXUsd)
      const compositionFeesYNative = BinMath.multiply(compositionFeesYNormalized, priceYNative)
      const compositionFeesYUsd = BinMath.multiply(compositionFeesYNormalized, priceYUsd)

      const protocolFeesXNative = BinMath.multiply(protocolFeesXNormalized, priceXNative)
      const protocolFeesXUsd = BinMath.multiply(protocolFeesXNormalized, priceXUsd)
      const protocolFeesYNative = BinMath.multiply(protocolFeesYNormalized, priceYNative)
      const protocolFeesYUsd = BinMath.multiply(protocolFeesYNormalized, priceYUsd)

      // 6. Create event ID (matching Rust get_composition_fees_event_id)
      const binId = `${decoded.pair}-${decoded.active_id}`
      const eventId = this.getCompositionFeesEventId(
        metadata.block_number,
        metadata.transaction_signature,
        metadata.instruction_index,
        metadata.inner_instruction_index ?? null,
        binId
      )

      // 7. Insert composition fees event (matching Rust logic)
      const eventData: CompositionFeesEvent = {
        id: eventId,
        signature: metadata.transaction_signature,
        pairId: pair.id,
        binId,
        lbBinId: decoded.active_id,
        compositionFeesX: decoded.composition_fees_x.toString(),
        compositionFeesXNative,
        compositionFeesXUsd,
        compositionFeesY: decoded.composition_fees_y.toString(),
        compositionFeesYNative,
        compositionFeesYUsd,
        protocolFeesX: decoded.protocol_fees_x.toString(),
        protocolFeesXNative,
        protocolFeesXUsd,
        protocolFeesY: decoded.protocol_fees_y.toString(),
        protocolFeesYNative,
        protocolFeesYUsd,
        blockNumber: metadata.block_number,
        blockTime: metadata.block_time,
        instructionIndex: metadata.instruction_index,
        innerInstructionIndex: metadata.inner_instruction_index,
      }

      this.logger.log(`Creating composition fees event: ${eventId}`)
      await this.compositionFeesEventModel.create(eventData)

      // 8. Update pair with new active_id and protocol fees (matching Rust logic)
      const currentProtocolFeesX = parseFloat(pair.protocolFeesX || '0')
      const currentProtocolFeesY = parseFloat(pair.protocolFeesY || '0')

      const newProtocolFeesX = (currentProtocolFeesX + decoded.protocol_fees_x).toString()
      const newProtocolFeesY = (currentProtocolFeesY + decoded.protocol_fees_y).toString()

      await this.pairModel.updateOne(
        { id: decoded.pair },
        {
          activeId: decoded.active_id,
          protocolFeesX: newProtocolFeesX,
          protocolFeesY: newProtocolFeesY,
          updatedAt: new Date(),
        }
      )

      this.logger.log(`Updated pair ${decoded.pair} with active_id: ${decoded.active_id}`)
      this.logger.log(`Composition fees event processed successfully: ${eventId}`)

    } catch (error) {
      this.logger.error(`Error processing composition fees event: ${error.message}`)
      throw error
    }
  }

  private getCompositionFeesEventId(
    blockNumber: number,
    signature: string,
    instructionIndex: number,
    innerInstructionIndex: number | null,
    binId: string
  ): string {
    const innerIndexStr = innerInstructionIndex !== null ? innerInstructionIndex.toString() : '*'
    return `${blockNumber}-${signature}-${instructionIndex}-${innerIndexStr}-${binId}`
  }
}
