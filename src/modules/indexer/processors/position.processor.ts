import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Job } from 'bullmq'
import { PublicKey } from '@solana/web3.js'
import { BaseProcessor } from './base.processor'
import { Position } from '../schemas/position.schema'
import { PositionUpdateEvent } from '../schemas/position-update-event.schema'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'
import { SolanaService } from '../services/solana.service'

@Injectable()
export class PositionProcessor extends BaseProcessor {
  constructor(
    @InjectModel(Position.name)
    private readonly positionModel: Model<Position>,
    @InjectModel(PositionUpdateEvent.name)
    private readonly positionUpdateEventModel: Model<PositionUpdateEvent>,
    private readonly solanaService: SolanaService,
  ) {
    super('PositionProcessor')
  }

  async process(job: Job): Promise<void> {
    this.logJobStart(job)

    try {
      const instruction = job.data
      const { signature, slot, blockTime, instructionName, instructionData, accounts } = instruction

      switch (instructionName) {
        case 'createPosition':
          await this.processCreatePosition(signature, slot, blockTime, instructionData, accounts)
          break
        case 'increasePosition':
          await this.processIncreasePosition(signature, slot, blockTime, instructionData, accounts)
          break
        case 'decreasePosition':
          await this.processDecreasePosition(signature, slot, blockTime, instructionData, accounts)
          break
        case 'closePosition':
          await this.processClosePosition(signature, slot, blockTime, instructionData, accounts)
          break
        default:
          this.logger.warn(`Unknown position instruction: ${instructionName}`)
      }

      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing position instruction ${job.data.instructionName}`)
    }
  }

  private async processCreatePosition(
    signature: string,
    slot: number,
    blockTime: number,
    instructionData: any,
    accounts: PublicKey[]
  ): Promise<void> {
    try {
      const positionData = await this.extractPositionData('createPosition', instructionData, accounts)
      if (!positionData) return

      // Create new position
      const position = new this.positionModel({
        position_mint: positionData.positionMint.toBase58(),
        pair: positionData.pair.toBase58(),
        owner: positionData.user.toBase58(),
        lower_bin_id: positionData.lowerBinId,
        upper_bin_id: positionData.upperBinId,
        liquidity_shares: positionData.liquidityShares,
      })

      await position.save()

      // Create position update event
      const updateEvent = new this.positionUpdateEventModel({
        signature,
        slot,
        block_time: new Date(blockTime * 1000),
        position_mint: positionData.positionMint.toBase58(),
        pair: positionData.pair.toBase58(),
        user: positionData.user.toBase58(),
        event_type: 'create',
        bin_ids: positionData.binIds,
        amounts_x: positionData.amountsX,
        amounts_y: positionData.amountsY,
        liquidity_shares: positionData.liquidityShares,
      })

      await updateEvent.save()

      this.logger.log(`Created position ${positionData.positionMint.toBase58()}`)
    } catch (error) {
      this.logger.error('Error processing create position:', error)
      throw error
    }
  }

  private async processIncreasePosition(
    signature: string,
    slot: number,
    blockTime: number,
    instructionData: any,
    accounts: PublicKey[]
  ): Promise<void> {
    try {
      const positionData = await this.extractPositionData('increasePosition', instructionData, accounts)
      if (!positionData) return

      // Update existing position
      await this.positionModel.updateOne(
        { position_mint: positionData.positionMint.toBase58() },
        {
          liquidity_shares: positionData.liquidityShares,
          updated_at: new Date(),
        }
      )

      // Create position update event
      const updateEvent = new this.positionUpdateEventModel({
        signature,
        slot,
        block_time: new Date(blockTime * 1000),
        position_mint: positionData.positionMint.toBase58(),
        pair: positionData.pair.toBase58(),
        user: positionData.user.toBase58(),
        event_type: 'increase',
        bin_ids: positionData.binIds,
        amounts_x: positionData.amountsX,
        amounts_y: positionData.amountsY,
        liquidity_shares: positionData.liquidityShares,
      })

      await updateEvent.save()

      this.logger.log(`Increased position ${positionData.positionMint.toBase58()}`)
    } catch (error) {
      this.logger.error('Error processing increase position:', error)
      throw error
    }
  }

  private async processDecreasePosition(
    signature: string,
    slot: number,
    blockTime: number,
    instructionData: any,
    accounts: PublicKey[]
  ): Promise<void> {
    try {
      const positionData = await this.extractPositionData('decreasePosition', instructionData, accounts)
      if (!positionData) return

      // Update existing position
      await this.positionModel.updateOne(
        { position_mint: positionData.positionMint.toBase58() },
        {
          liquidity_shares: positionData.liquidityShares,
          updated_at: new Date(),
        }
      )

      // Create position update event
      const updateEvent = new this.positionUpdateEventModel({
        signature,
        slot,
        block_time: new Date(blockTime * 1000),
        position_mint: positionData.positionMint.toBase58(),
        pair: positionData.pair.toBase58(),
        user: positionData.user.toBase58(),
        event_type: 'decrease',
        bin_ids: positionData.binIds,
        amounts_x: positionData.amountsX,
        amounts_y: positionData.amountsY,
        liquidity_shares: positionData.liquidityShares,
      })

      await updateEvent.save()

      this.logger.log(`Decreased position ${positionData.positionMint.toBase58()}`)
    } catch (error) {
      this.logger.error('Error processing decrease position:', error)
      throw error
    }
  }

  private async processClosePosition(
    signature: string,
    slot: number,
    blockTime: number,
    instructionData: any,
    accounts: PublicKey[]
  ): Promise<void> {
    try {
      const positionData = await this.extractPositionData('closePosition', instructionData, accounts)
      if (!positionData) return

      // Remove position
      await this.positionModel.deleteOne({
        position_mint: positionData.positionMint.toBase58()
      })

      // Create position update event
      const updateEvent = new this.positionUpdateEventModel({
        signature,
        slot,
        block_time: new Date(blockTime * 1000),
        position_mint: positionData.positionMint.toBase58(),
        pair: positionData.pair.toBase58(),
        user: positionData.user.toBase58(),
        event_type: 'close',
        bin_ids: positionData.binIds,
        amounts_x: positionData.amountsX,
        amounts_y: positionData.amountsY,
        liquidity_shares: [],
      })

      await updateEvent.save()

      this.logger.log(`Closed position ${positionData.positionMint.toBase58()}`)
    } catch (error) {
      this.logger.error('Error processing close position:', error)
      throw error
    }
  }

  private async extractPositionData(instructionName: string, instructionData: any, accounts: PublicKey[]): Promise<any | null> {
    try {
      const idlIx = LiquidityBookLibrary.getIdlInstructionByName(instructionName)
      if (!idlIx) {
        this.logger.error(`${instructionName} instruction not found in IDL`)
        return null
      }

      const accountsMap = LiquidityBookLibrary.getAccountsByName(
        idlIx,
        accounts,
        ['pair', 'position', 'user']
      )

      if (!accountsMap.pair || !accountsMap.position || !accountsMap.user) {
        this.logger.error(`Required accounts not found for ${instructionName} instruction`)
        return null
      }

      // Get position account data to extract position mint
      const positionAccountInfo = await this.solanaService.getAccountInfo(accountsMap.position)
      if (!positionAccountInfo?.data) {
        this.logger.error('Position account not found')
        return null
      }

      // Decode position account
      const positionAccount = LiquidityBookLibrary.decodePositionAccount(positionAccountInfo.data)

      return {
        pair: accountsMap.pair,
        positionMint: positionAccount.position_mint,
        user: accountsMap.user,
        lowerBinId: positionAccount.lower_bin_id,
        upperBinId: positionAccount.upper_bin_id,
        liquidityShares: positionAccount.liquidity_shares.map((share: any) => share.toString()),
        binIds: instructionData.binIds || [],
        amountsX: instructionData.amountsX?.map((amount: any) => amount.toString()) || [],
        amountsY: instructionData.amountsY?.map((amount: any) => amount.toString()) || [],
      }
    } catch (error) {
      this.logger.error(`Error extracting ${instructionName} data:`, error)
      return null
    }
  }
}
