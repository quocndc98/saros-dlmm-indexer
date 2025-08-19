import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Job } from 'bullmq'
import { PartiallyDecodedInstruction, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import { BaseProcessor } from './base.processor'
import { SwapEvent, SwapEventDocument } from '../schemas/swap-event.schema'
import {
  BinSwapEvent as BinSwapEventSchema,
  BinSwapEventDocument,
} from '../schemas/bin-swap-event.schema'
import { Bin, BinDocument } from '../schemas/bin.schema'
import { Pair, PairDocument } from '../schemas/pair.schema'
import { TokenMint, TokenMintDocument } from '../schemas/token-mint.schema'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'
import { splitAt } from '../../../utils/helper'
import { BinMath } from '../../../utils/bin-math'
import {
  EVENT_IDENTIFIER,
  BIN_SWAP_EVENT_DISCRIMINATOR,
} from '../../../liquidity-book/liquidity-book.constant'
import {
  BinSwapEvent as BinSwapEventDecoded,
  SwapArgs,
} from '../../../liquidity-book/liquidity-book.type'
import { TYPE_NAMES } from '../../../liquidity-book/liquidity-book.constant'
import { ProcessorName, SwapType } from '../types/enums'
import { InstructionService } from '../services/instruction.service'

// Constants from Rust
const INSTRUCTION_IDENTIFIER = [248, 198, 158, 145, 225, 117, 135, 200]

interface SwapDecoded {
  amount: number
  other_amount_threshold: number
  swap_for_y: boolean
  swap_type: SwapType
  pair: string
  token_mint_x: string
  token_mint_y: string
  bin_array_lower: string
  bin_array_upper: string
  token_vault_x: string
  token_vault_y: string
  user_vault_x: string
  user_vault_y: string
}

@Injectable()
export class SwapProcessor extends BaseProcessor {
  constructor(
    @InjectModel(SwapEvent.name)
    private readonly swapEventModel: Model<SwapEventDocument>,
    @InjectModel(BinSwapEventSchema.name)
    private readonly binSwapEventModel: Model<BinSwapEventDocument>,
    @InjectModel(Bin.name)
    private readonly binModel: Model<BinDocument>,
    @InjectModel(Pair.name)
    private readonly pairModel: Model<PairDocument>,
    @InjectModel(TokenMint.name)
    private readonly tokenMintModel: Model<TokenMintDocument>,
    private readonly instructionService: InstructionService,
  ) {
    super(SwapProcessor.name)
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

      this.logger.log(`Processing swap instruction for signature: ${transaction_signature}`)

      // Parse instruction data (matching Rust logic)
      const decodedData = Buffer.from(bs58.decode(instruction.data))
      const [identifier, data] = splitAt(decodedData, 8)

      if (Buffer.from(identifier).equals(Buffer.from(INSTRUCTION_IDENTIFIER))) {
        // Handle swap instruction
        await this.processSwapInstruction(
          instruction,
          transaction_signature,
          block_number,
          instruction_index,
          inner_instruction_index,
          is_inner,
          block_time,
        )
      } else if (Buffer.from(identifier).equals(Buffer.from(EVENT_IDENTIFIER))) {
        // Handle swap event
        const [discriminator, eventData] = splitAt(data, 8)
        if (Buffer.from(discriminator).equals(Buffer.from(BIN_SWAP_EVENT_DISCRIMINATOR))) {
          await this.processBinSwapEvent(
            eventData,
            transaction_signature,
            block_number,
            instruction_index,
            inner_instruction_index,
            is_inner,
            block_time,
          )
        }
      }

      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing swap instruction`)
    }
  }

  private async processSwapInstruction(
    instruction: PartiallyDecodedInstruction,
    signature: string,
    blockNumber: number,
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
        processorName: ProcessorName.SwapProcessor,
        instructionIndex,
        innerInstructionIndex,
        isInner,
        blockTime,
      })

      if (isAlreadyProcessed) {
        this.logger.log(`Swap instruction already processed for signature: ${signature}`)
        return
      }

      // Decode swap instruction (matching Rust decode_instruction)
      const decoded = this.decodeSwapInstruction(instruction)
      if (!decoded) {
        this.logger.warn('Failed to decode swap instruction')
        return
      }

      this.logger.debug(`Decoded swap: ${JSON.stringify(decoded)}`)

      // Insert swap event (matching Rust logic)
      const swapEventId = this.getSwapEventId(
        blockNumber,
        signature,
        instructionIndex,
        innerInstructionIndex,
      )
      const swapEventData: SwapEvent = {
        id: swapEventId,
        pairId: decoded.pair,
        signature: signature,
        swapType: decoded.swap_type,
        tokenMintXId: decoded.token_mint_x,
        tokenMintYId: decoded.token_mint_y,
        binArrayLower: decoded.bin_array_lower,
        binArrayUpper: decoded.bin_array_upper,
        tokenVaultX: decoded.token_vault_x,
        tokenVaultY: decoded.token_vault_y,
        userVaultX: decoded.user_vault_x,
        userVaultY: decoded.user_vault_y,
        instructionIndex: instructionIndex,
        innerInstructionIndex: innerInstructionIndex,
        isInner: isInner,
        blockNumber: blockNumber,
        blockTime: blockTime,
      }

      await this.swapEventModel.create(swapEventData)

      // Update bin swap event with vault information (matching Rust update_bin_swap_event)
      const { tokenVaultIn, tokenVaultOut, userVaultIn, userVaultOut } = decoded.swap_for_y
        ? {
            tokenVaultIn: decoded.token_vault_x,
            tokenVaultOut: decoded.token_vault_y,
            userVaultIn: decoded.user_vault_x,
            userVaultOut: decoded.user_vault_y,
          }
        : {
            tokenVaultIn: decoded.token_vault_y,
            tokenVaultOut: decoded.token_vault_x,
            userVaultIn: decoded.user_vault_y,
            userVaultOut: decoded.user_vault_x,
          }

      await this.binSwapEventModel.updateOne(
        {
          pairId: decoded.pair,
          blockNumber: blockNumber,
          signature: signature,
          instructionIndex: instructionIndex,
        },
        {
          pairVaultIn: tokenVaultIn,
          pairVaultOut: tokenVaultOut,
          userVaultIn: userVaultIn,
          userVaultOut: userVaultOut,
        },
      )

      this.logger.log(`Processed swap instruction for pair ${decoded.pair}`)
    } catch (error) {
      this.logger.error(`Error processing swap instruction: ${error.message}`)
      throw error
    }
  }

  private async processBinSwapEvent(
    eventData: Buffer,
    signature: string,
    blockNumber: number,
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
        processorName: ProcessorName.SwapProcessor,
        instructionIndex,
        innerInstructionIndex,
        isInner,
        blockTime,
      })

      if (isAlreadyProcessed) {
        this.logger.log(`Bin swap event already processed for signature: ${signature}`)
        return
      }

      // Decode bin swap event (matching Rust BinSwapEventDecoded::decode)
      const decoded = LiquidityBookLibrary.decodeType<BinSwapEventDecoded>(
        TYPE_NAMES.BIN_SWAP_EVENT,
        eventData,
      )

      if (!decoded) {
        this.logger.warn('Failed to decode bin swap event')
        return
      }

      this.logger.log(`Decoded bin swap event: ${JSON.stringify(decoded)}`)

      // Get pair (matching Rust logic)
      const pair = await this.pairModel.findOne({ id: decoded.pair.toBase58() }).lean()
      if (!pair) {
        throw new Error(
          `Processing bin swap event for non existent pair: ${decoded.pair.toBase58()}`,
        )
      }

      // Get bin (matching Rust logic)
      const binId = `${decoded.pair.toBase58()}-${decoded.bin_id}`
      const bin = await this.binModel.findOne({ id: binId }).lean()
      if (!bin) {
        throw new Error(`Processing bin swap event for non existent bin: ${binId}`)
      }

      // Update bin reserves (matching Rust logic exactly)
      const { updateX, updateY } = decoded.swap_for_y
        ? {
            // update reserve_x with amount_in - protocol_fee, reserve_y with amount_out (negative)
            updateX: (decoded.amount_in - decoded.protocol_fee).toString(),
            updateY: (-BigInt(decoded.amount_out)).toString(),
          }
        : {
            // update reserve_x with amount_out (negative), reserve_y with amount_in - protocol_fee
            updateX: (-BigInt(decoded.amount_out)).toString(),
            updateY: (decoded.amount_in - decoded.protocol_fee).toString(),
          }

      const newReserveX = BinMath.add(bin.reserveX, updateX)
      const newReserveY = BinMath.add(bin.reserveY, updateY)

      await this.binModel.updateOne(
        { id: binId },
        {
          reserveX: newReserveX,
          reserveY: newReserveY,
        },
      )

      // Calculate prices (matching Rust bin_math::get_price_from_id)
      const price = BinMath.getPriceFromId(pair.binStep, decoded.bin_id)

      // Get token mints for price calculations (matching Rust logic)
      const [tokenMintX, tokenMintY] = await Promise.all([
        this.tokenMintModel.findOne({ id: pair.tokenMintXId }),
        this.tokenMintModel.findOne({ id: pair.tokenMintYId }),
      ])

      if (!tokenMintX) {
        throw new Error(`Failed to get token mint ${pair.tokenMintXId}`)
      }
      if (!tokenMintY) {
        throw new Error(`Failed to get token mint ${pair.tokenMintYId}`)
      }

      const priceXY = BinMath.calculatePriceXY(price, tokenMintX.decimals, tokenMintY.decimals)

      // TODO: Implement token price fetching from GeckoTerminal API like in Rust
      // For now, use simplified pricing
      const priceXNative = '1.0'
      const priceXUsd = '1.0'
      const priceYNative = '1.0'
      const priceYUsd = '1.0'

      // Look up swap event to get vault information (matching Rust logic)
      const swapEventId = this.getSwapEventId(blockNumber, signature, instructionIndex, null)
      const swapEvent = await this.swapEventModel.findOne({ id: swapEventId }).lean()

      // Extract vault information from swap event, or use dummy values if not found
      // This matches Rust logic exactly - they also use dummy values when swap event is missing
      const { userVaultIn, userVaultOut, pairVaultIn, pairVaultOut } = swapEvent
        ? decoded.swap_for_y
          ? {
              userVaultIn: swapEvent.userVaultX,
              userVaultOut: swapEvent.userVaultY,
              pairVaultIn: swapEvent.tokenVaultX,
              pairVaultOut: swapEvent.tokenVaultY,
            }
          : {
              userVaultIn: swapEvent.userVaultY,
              userVaultOut: swapEvent.userVaultX,
              pairVaultIn: swapEvent.tokenVaultY,
              pairVaultOut: swapEvent.tokenVaultX,
            }
        : {
            // Use dummy values if swap event not found (matching Rust exactly)
            userVaultIn: 'dummy_user_vault_in',
            userVaultOut: 'dummy_user_vault_out',
            pairVaultIn: 'dummy_pair_vault_in',
            pairVaultOut: 'dummy_pair_vault_out',
          }

      // Calculate normalized amounts and USD/native prices (matching Rust logic)
      const {
        amountInNormalized,
        amountOutNormalized,
        feeNormalized,
        protocolFeeNormalized,
        amountInUsd,
        amountInNative,
        amountOutUsd,
        amountOutNative,
        feeUsd,
        feeNative,
        protocolFeeUsd,
        protocolFeeNative,
      } = this.calculateSwapAmounts({
        decoded,
        tokenMintX,
        tokenMintY,
        priceXUsd,
        priceXNative,
        priceYUsd,
        priceYNative,
      })

      // Create bin swap event record (matching Rust structure exactly)
      const binSwapEventId = this.getBinSwapEventId(
        blockNumber,
        signature,
        instructionIndex,
        innerInstructionIndex,
        binId,
      )

      const binSwapEventData: Partial<BinSwapEventSchema> = {
        id: binSwapEventId,
        signature: signature,
        pairId: decoded.pair.toBase58(),
        binId: binId,
        lbBinId: decoded.bin_id,
        userVaultIn,
        userVaultOut,
        pairVaultIn,
        pairVaultOut,
        swapForY: decoded.swap_for_y,
        // Store only normalized amounts (matching Rust exactly)
        amountIn: amountInNormalized,
        amountInNative,
        amountInUsd,
        amountOut: amountOutNormalized,
        amountOutNative,
        amountOutUsd,
        fees: feeNormalized,
        feesNative: feeNative,
        feesUsd: feeUsd,
        protocolFees: protocolFeeNormalized,
        protocolFeesNative: protocolFeeNative,
        protocolFeesUsd: protocolFeeUsd,
        volatilityAccumulator: decoded.volatility_accumulator,
        index: instructionIndex,
        innerIndex: innerInstructionIndex ?? -1,
        blockNumber: blockNumber,
        blockTime: new Date((blockTime ?? Date.now()) * 1000),
      }

      await this.binSwapEventModel.create(binSwapEventData)

      this.logger.log(
        `Processed bin swap event for pair ${decoded.pair.toBase58()}, bin ${decoded.bin_id}`,
      )
    } catch (error) {
      this.logger.error(`Error processing bin swap event: ${error.message}`)
      throw error
    }
  }

  private decodeSwapInstruction(instruction: PartiallyDecodedInstruction): SwapDecoded | null {
    try {
      const { idlIx, decodedIx } = LiquidityBookLibrary.decodeInstruction(instruction.data)
      const accounts = LiquidityBookLibrary.getAccountsByName(idlIx, instruction.accounts, [
        'pair',
        'token_mint_x',
        'token_mint_y',
        'bin_array_lower',
        'bin_array_upper',
        'token_vault_x',
        'token_vault_y',
        'user_vault_x',
        'user_vault_y',
      ])

      const swapArgs = decodedIx.data as SwapArgs

      return {
        amount: swapArgs.amount,
        other_amount_threshold: swapArgs.other_amount_threshold,
        swap_for_y: swapArgs.swap_for_y,
        swap_type: swapArgs.swap_type.ExactInput ? SwapType.ExactInput : SwapType.ExactOutput,
        pair: accounts.pair.toString(),
        token_mint_x: accounts.token_mint_x.toString(),
        token_mint_y: accounts.token_mint_y.toString(),
        bin_array_lower: accounts.bin_array_lower.toString(),
        bin_array_upper: accounts.bin_array_upper.toString(),
        token_vault_x: accounts.token_vault_x.toString(),
        token_vault_y: accounts.token_vault_y.toString(),
        user_vault_x: accounts.user_vault_x.toString(),
        user_vault_y: accounts.user_vault_y.toString(),
      }
    } catch (error) {
      this.logger.error('Error decoding swap instruction:', error)
      return null
    }
  }

  private getSwapEventId(
    blockNumber: number,
    signature: string,
    instructionIndex: number,
    innerInstructionIndex: number | null,
  ): string {
    const innerIndexStr = innerInstructionIndex ?? '*'
    return `${blockNumber}-${signature}-${instructionIndex}-${innerIndexStr}`
  }

  private getBinSwapEventId(
    blockNumber: number,
    signature: string,
    instructionIndex: number,
    innerInstructionIndex: number | null,
    binId: string,
  ): string {
    const innerIndexStr = innerInstructionIndex ?? '*'
    return `${blockNumber}-${signature}-${instructionIndex}-${innerIndexStr}-${binId}`
  }

  /**
   * Calculate normalized amounts and USD/native prices for swap
   */
  private calculateSwapAmounts(params: {
    decoded: BinSwapEventDecoded
    tokenMintX: TokenMint
    tokenMintY: TokenMint
    priceXUsd: string
    priceXNative: string
    priceYUsd: string
    priceYNative: string
  }): {
    amountInNormalized: string
    amountOutNormalized: string
    feeNormalized: string
    protocolFeeNormalized: string
    amountInUsd: string
    amountInNative: string
    amountOutUsd: string
    amountOutNative: string
    feeUsd: string
    feeNative: string
    protocolFeeUsd: string
    protocolFeeNative: string
  } {
    const { decoded, tokenMintX, tokenMintY, priceXUsd, priceXNative, priceYUsd, priceYNative } = params

    let amountInNormalized: string
    let amountOutNormalized: string
    let feeNormalized: string
    let protocolFeeNormalized: string
    let priceInUsd: string
    let priceInNative: string
    let priceOutUsd: string
    let priceOutNative: string

    if (decoded.swap_for_y) {
      // Swapping X -> Y
      amountInNormalized = BinMath.normalizeAmount(decoded.amount_in.toString(), tokenMintX.decimals)
      amountOutNormalized = BinMath.normalizeAmount(decoded.amount_out.toString(), tokenMintY.decimals)
      feeNormalized = BinMath.normalizeAmount(decoded.fee.toString(), tokenMintX.decimals)
      protocolFeeNormalized = BinMath.normalizeAmount(decoded.protocol_fee.toString(), tokenMintX.decimals)
      priceInUsd = priceXUsd
      priceInNative = priceXNative
      priceOutUsd = priceYUsd
      priceOutNative = priceYNative
    } else {
      // Swapping Y -> X
      amountInNormalized = BinMath.normalizeAmount(decoded.amount_in.toString(), tokenMintY.decimals)
      amountOutNormalized = BinMath.normalizeAmount(decoded.amount_out.toString(), tokenMintX.decimals)
      feeNormalized = BinMath.normalizeAmount(decoded.fee.toString(), tokenMintY.decimals)
      protocolFeeNormalized = BinMath.normalizeAmount(decoded.protocol_fee.toString(), tokenMintY.decimals)
      priceInUsd = priceYUsd
      priceInNative = priceYNative
      priceOutUsd = priceXUsd
      priceOutNative = priceXNative
    }

    // Calculate USD and native amounts using simple multiply
    const amountInUsd = BinMath.multiply(amountInNormalized, priceInUsd)
    const amountInNative = BinMath.multiply(amountInNormalized, priceInNative)
    const amountOutUsd = BinMath.multiply(amountOutNormalized, priceOutUsd)
    const amountOutNative = BinMath.multiply(amountOutNormalized, priceOutNative)
    const feeUsd = BinMath.multiply(feeNormalized, priceInUsd)
    const feeNative = BinMath.multiply(feeNormalized, priceInNative)
    const protocolFeeUsd = BinMath.multiply(protocolFeeNormalized, priceInUsd)
    const protocolFeeNative = BinMath.multiply(protocolFeeNormalized, priceInNative)

    return {
      amountInNormalized,
      amountOutNormalized,
      feeNormalized,
      protocolFeeNormalized,
      amountInUsd,
      amountInNative,
      amountOutUsd,
      amountOutNative,
      feeUsd,
      feeNative,
      protocolFeeUsd,
      protocolFeeNative,
    }
  }
}
