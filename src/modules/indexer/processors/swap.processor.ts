import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Job } from 'bullmq'
import { PublicKey } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { BaseProcessor } from './base.processor'
import { SwapEvent } from '../schemas/swap-event.schema'
import { BinSwapEvent } from '../schemas/bin-swap-event.schema'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'

@Injectable()
export class SwapProcessor extends BaseProcessor {
  constructor(
    @InjectModel(SwapEvent.name)
    private readonly swapEventModel: Model<SwapEvent>,
    @InjectModel(BinSwapEvent.name)
    private readonly binSwapEventModel: Model<BinSwapEvent>,
  ) {
    super(SwapProcessor.name)
  }

  async process(job: Job): Promise<void> {
    this.logJobStart(job)

    try {
      const instruction = job.data
      const { signature, slot, blockTime, instructionData, accounts } = instruction

      // Extract swap data from instruction
      const swapData = await this.extractSwapData(instructionData, accounts)
      if (!swapData) {
        this.logger.warn(`Failed to extract swap data from instruction`)
        return
      }

      // Save swap event
      const swapEvent = new this.swapEventModel({
        signature,
        slot,
        block_time: new Date(blockTime * 1000),
        pair: swapData.pair.toBase58(),
        user: swapData.user.toBase58(),
        swap_for_y: swapData.swapForY,
        bin_id: swapData.binId,
        amount_in: swapData.amountIn,
        amount_out: swapData.amountOut,
        fee: swapData.fee,
        protocol_fee: swapData.protocolFee,
        volatility_accumulator: swapData.volatilityAccumulator,
      })

      await swapEvent.save()

      // Also save as bin swap event if needed
      const binSwapEvent = new this.binSwapEventModel({
        signature,
        slot,
        block_time: new Date(blockTime * 1000),
        pair: swapData.pair.toBase58(),
        swap_for_y: swapData.swapForY,
        bin_id: swapData.binId,
        amount_in: swapData.amountIn,
        amount_out: swapData.amountOut,
        fee: swapData.fee,
        protocol_fee: swapData.protocolFee,
        volatility_accumulator: swapData.volatilityAccumulator,
      })

      await binSwapEvent.save()

      this.logger.log(`Processed swap event for pair ${swapData.pair.toBase58()}`)
      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing swap instruction`)
    }
  }

  private async extractSwapData(instructionData: any, accounts: PublicKey[]): Promise<any | null> {
    try {
      // Extract accounts using the liquidity book library
      const idlIx = LiquidityBookLibrary.getIdlInstructionByName('swap')
      if (!idlIx) {
        this.logger.error('Swap instruction not found in IDL')
        return null
      }

      const accountsMap = LiquidityBookLibrary.getAccountsByName(
        idlIx,
        accounts,
        ['pair', 'user']
      )

      if (!accountsMap.pair || !accountsMap.user) {
        this.logger.error('Required accounts not found for swap instruction')
        return null
      }

      // Extract swap data from instruction data
      // This should match the structure from the Rust implementation
      const swapData = {
        pair: accountsMap.pair,
        user: accountsMap.user,
        swapForY: instructionData.swapForY || false,
        binId: instructionData.binId || 0,
        amountIn: instructionData.amountIn?.toString() || '0',
        amountOut: instructionData.amountOut?.toString() || '0',
        fee: instructionData.fee?.toString() || '0',
        protocolFee: instructionData.protocolFee?.toString() || '0',
        volatilityAccumulator: instructionData.volatilityAccumulator || 0,
      }

      return swapData
    } catch (error) {
      this.logger.error('Error extracting swap data:', error)
      return null
    }
  }
}
