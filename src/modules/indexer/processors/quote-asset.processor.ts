import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Job } from 'bullmq'
import bs58 from 'bs58'
import { BaseProcessor } from './base.processor'
import { QuoteAsset } from '../schemas/quote-asset.schema'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'
import { splitAt } from '../../../utils/helper'
import {
  QuoteAssetBadgeInitializationEvent,
  QuoteAssetBadgeStatus,
  QuoteAssetBadgeUpdateEvent,
} from '../../../liquidity-book/liquidity-book.type'
import { ProcessorName, QuoteAssetStatus, QuoteAssetType } from '../types/enums'
import { EVENT_IDENTIFIER, TYPE_NAMES } from '../../../liquidity-book/liquidity-book.constant'
import { InstructionService } from '../services/instruction.service'

// Constants from Rust
const QUOTE_ASSET_INIT_EVENT_DISCRIMINATOR = Buffer.from([202, 110, 93, 186, 165, 96, 200, 27])
const QUOTE_ASSET_UPDATE_EVENT_DISCRIMINATOR = Buffer.from([102, 149, 171, 236, 123, 73, 205, 194])

@Injectable()
export class QuoteAssetProcessor extends BaseProcessor {
  constructor(
    @InjectModel(QuoteAsset.name) private readonly quoteAssetModel: Model<QuoteAsset>,
    private readonly instructionService: InstructionService,
  ) {
    super(QuoteAssetProcessor.name)
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

      // Parse instruction data (matching Rust logic)
      const decodedData = Buffer.from(bs58.decode(instruction.data))
      const [identifier, data] = splitAt(decodedData, 8)

      // Only use event instructions
      if (!identifier.equals(Buffer.from(EVENT_IDENTIFIER))) {
        this.logger.warn('Not an event instruction')
        return
      }

      const [discriminator, eventData] = splitAt(data, 8)

      if (discriminator.equals(QUOTE_ASSET_INIT_EVENT_DISCRIMINATOR)) {
        const decoded = LiquidityBookLibrary.decodeType<QuoteAssetBadgeInitializationEvent>(
          TYPE_NAMES.QUOTE_ASSET_BADGE_INITIALIZATION_EVENT,
          eventData,
        )
        if (decoded) {
          await this.processInitEvent(
            decoded,
            block_number,
            transaction_signature,
            instruction_index,
            inner_instruction_index,
            is_inner,
            block_time,
          )
        }
      } else if (discriminator.equals(QUOTE_ASSET_UPDATE_EVENT_DISCRIMINATOR)) {
        const decoded = LiquidityBookLibrary.decodeType<QuoteAssetBadgeUpdateEvent>(
          TYPE_NAMES.QUOTE_ASSET_BADGE_UPDATE_EVENT,
          eventData,
        )
        if (decoded) {
          await this.processUpdateEvent(
            decoded,
            block_number,
            transaction_signature,
            instruction_index,
            inner_instruction_index,
            is_inner,
            block_time,
          )
        }
      }

      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing quote asset events`)
    }
  }

  private async processInitEvent(
    eventData: QuoteAssetBadgeInitializationEvent,
    blockNumber: number,
    signature: string,
    instructionIndex: number,
    innerInstructionIndex: number | null,
    isInner: boolean,
    blockTime: number | null,
  ): Promise<void> {
    try {
      // Check if instruction already processed (matching Rust instruction deduplication)
      const { isAlreadyProcessed } = await this.instructionService.checkAndInsertInstruction({
        blockNumber,
        signature,
        processorName: ProcessorName.QuoteAssetProcessor,
        instructionIndex,
        innerInstructionIndex,
        isInner,
        blockTime,
      })

      if (isAlreadyProcessed) {
        this.logger.log(`Quote asset init event already processed for signature: ${signature}`)
        return
      }

      // Check if quote asset already exists (matching Rust logic)
      const existing = await this.quoteAssetModel.exists({
        id: eventData.quote_asset_badge.toBase58(),
      })

      if (existing) {
        this.logger.log(
          `Quote asset ${eventData.quote_asset_badge.toBase58()} already exists, skipping...`,
        )
        return
      }

      // Create new quote asset (matching Rust fields exactly)
      const quoteAssetData: QuoteAsset = {
        id: eventData.quote_asset_badge.toBase58(),
        tokenMintId: eventData.token_mint.toBase58(),
        status: QuoteAssetStatus.Enabled,
        assetType: QuoteAssetType.Other, // TODO: Update this logic
      }

      await this.quoteAssetModel.create(quoteAssetData)
      this.logger.log(`Created quote asset: ${eventData.quote_asset_badge.toBase58()}`)
    } catch (error) {
      this.logger.error(`Error processing init event:`, error)
      throw error
    }
  }

  // NOT TEST YET
  private async processUpdateEvent(
    eventData: QuoteAssetBadgeUpdateEvent,
    blockNumber: number,
    signature: string,
    instructionIndex: number,
    innerInstructionIndex: number | null,
    isInner: boolean,
    blockTime: number | null,
  ): Promise<void> {
    try {
      // Check if instruction already processed (matching Rust instruction deduplication)
      const { isAlreadyProcessed } = await this.instructionService.checkAndInsertInstruction({
        blockNumber,
        signature,
        processorName: ProcessorName.QuoteAssetProcessor,
        instructionIndex,
        innerInstructionIndex,
        isInner,
        blockTime,
      })

      if (isAlreadyProcessed) {
        this.logger.log(`Quote asset update event already processed for signature: ${signature}`)
        return
      }

      // Find existing quote asset (matching Rust logic)
      const existing = await this.quoteAssetModel.exists({
        id: eventData.quote_asset_badge.toBase58(),
      })

      if (!existing) {
        throw new Error(
          `Error indexing quote asset update, non existent quote asset ${eventData.quote_asset_badge.toBase58()}`,
        )
      }

      // Update status (matching Rust enum conversion)
      const statusValue =
        eventData.status === QuoteAssetBadgeStatus.Disabled
          ? QuoteAssetStatus.Disabled
          : QuoteAssetStatus.Enabled

      await this.quoteAssetModel.updateOne(
        { id: eventData.quote_asset_badge.toBase58() },
        {
          status: statusValue,
        },
      )

      this.logger.log(
        `Updated quote asset ${eventData.quote_asset_badge.toBase58()} status to ${statusValue}`,
      )
    } catch (error) {
      this.logger.error(`Error processing update event:`, error)
      throw error
    }
  }
}
