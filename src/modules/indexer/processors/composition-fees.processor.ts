import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Job } from 'bullmq'
import { PublicKey } from '@solana/web3.js'
import { BaseProcessor } from './base.processor'
import { CompositionFeesEvent } from '../schemas/composition-fees-event.schema'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'

@Injectable()
export class CompositionFeesProcessor extends BaseProcessor {
  constructor(
    @InjectModel(CompositionFeesEvent.name)
    private readonly compositionFeesEventModel: Model<CompositionFeesEvent>,
  ) {
    super('CompositionFeesProcessor')
  }

  async process(job: Job): Promise<void> {
    this.logJobStart(job)

    try {
      const instruction = job.data
      const { signature, slot, blockTime, instructionData, accounts } = instruction

      // Extract composition fees data from instruction
      const feesData = await this.extractCompositionFeesData(instructionData, accounts)
      if (!feesData) {
        this.logger.warn(`Failed to extract composition fees data from instruction`)
        return
      }

      // Save composition fees event
      const feesEvent = new this.compositionFeesEventModel({
        signature,
        slot,
        block_time: new Date(blockTime * 1000),
        pair: feesData.pair.toBase58(),
        user: feesData.user.toBase58(),
        total_fees_x: feesData.totalFeesX,
        total_fees_y: feesData.totalFeesY,
        bin_ids: feesData.binIds,
        fees_x: feesData.feesX,
        fees_y: feesData.feesY,
      })

      await feesEvent.save()

      this.logger.log(`Processed composition fees event for pair ${feesData.pair.toBase58()}`)
      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing composition fees instruction`)
    }
  }

  private async extractCompositionFeesData(instructionData: any, accounts: PublicKey[]): Promise<any | null> {
    try {
      // Extract accounts using the liquidity book library
      const idlIx = LiquidityBookLibrary.getIdlInstructionByName('compositionFees')
      if (!idlIx) {
        this.logger.error('Composition fees instruction not found in IDL')
        return null
      }

      const accountsMap = LiquidityBookLibrary.getAccountsByName(
        idlIx,
        accounts,
        ['pair', 'user']
      )

      if (!accountsMap.pair || !accountsMap.user) {
        this.logger.error('Required accounts not found for composition fees instruction')
        return null
      }

      // Extract fees data from instruction data
      const feesData = {
        pair: accountsMap.pair,
        user: accountsMap.user,
        totalFeesX: instructionData.totalFeesX?.toString() || '0',
        totalFeesY: instructionData.totalFeesY?.toString() || '0',
        binIds: instructionData.binIds || [],
        feesX: instructionData.feesX?.map((fee: any) => fee.toString()) || [],
        feesY: instructionData.feesY?.map((fee: any) => fee.toString()) || [],
      }

      return feesData
    } catch (error) {
      this.logger.error('Error extracting composition fees data:', error)
      return null
    }
  }
}
