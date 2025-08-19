import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Job } from 'bullmq'
import { BaseProcessor } from './base.processor'
import { PartiallyDecodedInstruction } from '@solana/web3.js'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'
import { BinStepConfig, BinStepConfigDocument } from '../schemas/bin-step-config.schema'
import {
  InitializeBinStepConfigArgs,
  StaticFeeParameters,
} from '../../../liquidity-book/liquidity-book.type'
import { ConfigAvailability, BinStepConfigStatus } from '../types/enums'
import { ParsedInstructionMessage } from '../types/indexer.types'

interface InitializeBinStepConfigDecoded {
  bin_step: number
  availability: ConfigAvailability
  fee_parameters: StaticFeeParameters
  liquidity_book_config: string
  bin_step_config: string
}

@Injectable()
export class InitializeBinStepConfigProcessor extends BaseProcessor {
  constructor(
    @InjectModel(BinStepConfig.name)
    private readonly binStepConfigModel: Model<BinStepConfigDocument>,
  ) {
    super(InitializeBinStepConfigProcessor.name)
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

      this.logger.log(
        `Processing initialize bin step config instruction for signature: ${signature}`,
      )
      this.logger.log(
        `Block number: ${blockNumber}, Index: ${instructionIndex}, Is inner: ${isInner}`,
      )

      // Decode instruction data
      const decoded = await this.decodeInitializeBinStepConfigInstruction(instruction)

      if (!decoded) {
        this.logger.warn('Failed to decode initialize bin step config instruction')
        return
      }

      this.logger.log(`Decoded initialize bin step config: ${JSON.stringify(decoded)}`)

      // Process the bin step config creation
      await this.processInitializeBinStepConfig(decoded)

      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing initialize bin step config instruction`)
    }
  }

  private async decodeInitializeBinStepConfigInstruction(
    instruction: PartiallyDecodedInstruction,
  ): Promise<InitializeBinStepConfigDecoded | null> {
    try {
      const { idlIx, decodedIx } = LiquidityBookLibrary.decodeInstruction(instruction.data)
      const accounts = LiquidityBookLibrary.getAccountsByName(idlIx, instruction.accounts, [
        'liquidity_book_config',
        'bin_step_config',
      ])

      const data = decodedIx.data as InitializeBinStepConfigArgs

      // Convert availability from Rust enum format
      const availability =
        data.availability.Open !== undefined ? ConfigAvailability.Open : ConfigAvailability.Closed

      return {
        bin_step: data.bin_step,
        availability,
        fee_parameters: data.fee_parameters,
        liquidity_book_config: accounts.liquidity_book_config.toString(),
        bin_step_config: accounts.bin_step_config.toString(),
      }
    } catch (error) {
      this.logger.error('Error decoding initialize bin step config instruction:', error)
      return null
    }
  }

  private async processInitializeBinStepConfig(
    decoded: InitializeBinStepConfigDecoded,
  ): Promise<void> {
    this.logger.log(
      `Creating bin step config ${decoded.bin_step_config} with bin_step ${decoded.bin_step}`,
    )

    try {
      // Check if bin step config already exists
      this.logger.log(`Checking if bin step config ${decoded.bin_step_config} already exists...`)
      const existingConfig = await this.binStepConfigModel.findOne({ id: decoded.bin_step_config })

      if (existingConfig) {
        this.logger.log(`Bin step config ${decoded.bin_step_config} already exists, skipping...`)
        return
      }

      // Create bin step config record
      const binStepConfigData: BinStepConfig = {
        id: decoded.bin_step_config,
        liquidityBookConfig: decoded.liquidity_book_config,
        status: BinStepConfigStatus.Active,
        availability: decoded.availability,
        binStep: decoded.bin_step,
        baseFactor: decoded.fee_parameters.base_factor,
        filterPeriod: decoded.fee_parameters.filter_period,
        decayPeriod: decoded.fee_parameters.decay_period,
        reductionFactor: decoded.fee_parameters.reduction_factor,
        variableFeeControl: decoded.fee_parameters.variable_fee_control,
        maxVolatilityAccumulator: decoded.fee_parameters.max_volatility_accumulator,
        protocolShare: decoded.fee_parameters.protocol_share,
      }

      this.logger.log(
        `Creating bin step config with data: ${JSON.stringify(binStepConfigData, null, 2)}`,
      )

      await this.binStepConfigModel.create(binStepConfigData)

      this.logger.log(`Bin step config created successfully: ${decoded.bin_step_config}`)
    } catch (error) {
      this.logger.error(`Error processing initialize bin step config: ${error.message}`)
      throw error
    }
  }
}
