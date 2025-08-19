import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Job } from 'bullmq'
import { BaseProcessor } from './base.processor'
import { Pair } from '../schemas/pair.schema'
import { Instruction } from '../schemas/instruction.schema'
import { InstructionService } from '../services/instruction.service'
import { ProcessorName } from '../types/enums'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'
import { StaticFeeParameters, UpdatePairStaticFeeParametersArgs } from '../../../liquidity-book/liquidity-book.type'
import { PartiallyDecodedInstruction } from '@solana/web3.js'

interface UpdatePairStaticFeeParametersDecoded {
  fee_parameters: StaticFeeParameters
  liquidity_book_config: string
  pair: string
}

@Injectable()
export class UpdatePairStaticFeeParametersProcessor extends BaseProcessor {
  constructor(
    @InjectModel(Pair.name) private readonly pairModel: Model<Pair>,
    private readonly instructionService: InstructionService,
  ) {
    super(UpdatePairStaticFeeParametersProcessor.name)
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

      this.logger.log(`Processing update pair static fee parameters instruction for signature: ${transaction_signature}`)
      this.logger.log(`Block number: ${block_number}, Index: ${instruction_index}, Is inner: ${is_inner}`)

      // 1. Decode instruction data (matching Rust and other processors approach)
      const decoded = await this.decodeUpdatePairStaticFeeParametersInstruction(instruction)

      if (!decoded) {
        this.logger.warn('Failed to decode update pair static fee parameters instruction')
        return
      }

      this.logger.log(`Decoded update pair static fee parameters: ${JSON.stringify({
        pair: decoded.pair,
        base_factor: decoded.fee_parameters.base_factor
      })}`)

      // 2. Check if instruction already processed (matching Rust instruction deduplication)
      const { isAlreadyProcessed } = await this.instructionService.checkAndInsertInstruction({
        blockNumber: block_number,
        signature: transaction_signature,
        processorName: ProcessorName.UpdatePairStaticFeeParametersProcessor,
        instructionIndex: instruction_index,
        innerInstructionIndex: inner_instruction_index,
        isInner: is_inner,
        blockTime: block_time,
      })

      if (isAlreadyProcessed) {
        this.logger.log(`Update pair static fee parameters instruction already processed for signature: ${transaction_signature}`)
        return
      }

      // 3. Process the pair fee parameters update
      await this.processUpdatePairStaticFeeParameters(decoded)

      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing update pair static fee parameters instruction`)
    }
  }

  private async decodeUpdatePairStaticFeeParametersInstruction(
    instruction: PartiallyDecodedInstruction,
  ): Promise<UpdatePairStaticFeeParametersDecoded | null> {
    try {
      const { idlIx, decodedIx } = LiquidityBookLibrary.decodeInstruction(instruction.data)

      if (!idlIx || !decodedIx) {
        this.logger.warn('Failed to decode instruction using LiquidityBookLibrary')
        return null
      }

      // Verify instruction name matches update_pair_static_fee_parameters
      if (idlIx.name !== 'update_pair_static_fee_parameters') {
        this.logger.debug(`Instruction name ${idlIx.name} does not match update_pair_static_fee_parameters`)
        return null
      }

      const accounts = LiquidityBookLibrary.getAccountsByName(
        idlIx,
        instruction.accounts,
        [
          'liquidity_book_config',
          'pair',
        ],
      )

      // Validate required accounts exist
      if (!accounts.liquidity_book_config || !accounts.pair) {
        this.logger.warn('Missing required accounts in update pair static fee parameters instruction')
        return null
      }

      // Extract args from decoded instruction
      const args = decodedIx.data as UpdatePairStaticFeeParametersArgs

      return {
        fee_parameters: args.fee_parameters,
        liquidity_book_config: accounts.liquidity_book_config.toString(),
        pair: accounts.pair.toString(),
      }
    } catch (error) {
      this.logger.error('Error decoding update pair static fee parameters instruction:', error)
      return null
    }
  }

  private async processUpdatePairStaticFeeParameters(
    decoded: UpdatePairStaticFeeParametersDecoded,
  ): Promise<void> {
    try {
      // Check if pair exists (matching Rust logic exactly)
      this.logger.log(`Checking if pair ${decoded.pair} exists...`)
      const existingPair = await this.pairModel.findOne({ id: decoded.pair })

      if (!existingPair) {
        throw new Error(`Processing update pair static fee instruction for non existent pair: ${decoded.pair}`)
      }

      this.logger.log(`Updating static fee parameters for pair: ${decoded.pair}`)

      // Update pair static fee parameters (matching Rust logic exactly)
      await this.pairModel.updateOne(
        { id: decoded.pair },
        {
          baseFactor: decoded.fee_parameters.base_factor,
          filterPeriod: decoded.fee_parameters.filter_period,
          decayPeriod: decoded.fee_parameters.decay_period,
          reductionFactor: decoded.fee_parameters.reduction_factor,
          variableFeeControl: decoded.fee_parameters.variable_fee_control,
          maxVolatilityAccumulator: decoded.fee_parameters.max_volatility_accumulator,
          protocolShare: decoded.fee_parameters.protocol_share,
        }
      )

      this.logger.log(`Successfully updated static fee parameters for pair: ${decoded.pair}`)
    } catch (error) {
      this.logger.error(`Error processing update pair static fee parameters: ${error.message}`)
      throw error
    }
  }
}
