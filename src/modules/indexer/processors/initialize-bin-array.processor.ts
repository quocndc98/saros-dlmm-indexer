import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Job } from 'bullmq'
import { BaseProcessor } from './base.processor'
import { PartiallyDecodedInstruction } from '@solana/web3.js'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'
import { Bin, BinDocument } from '../schemas/bin.schema'
import { InitializeBinArrayArgs } from '../../../liquidity-book/liquidity-book.type'

// Constants from Rust - identifier for initialize_bin_array instruction
const INITIALIZE_BIN_ARRAY_IDENTIFIER = [35, 86, 19, 185, 78, 212, 75, 211]
const BIN_ARRAY_SIZE = 256

interface InitializeBinArrayDecoded {
  index: number
  pair: string
  bin_array: string
}

@Injectable()
export class InitializeBinArrayProcessor extends BaseProcessor {
  constructor(
    @InjectModel(Bin.name) private readonly binModel: Model<BinDocument>,
  ) {
    super(InitializeBinArrayProcessor.name)
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

      this.logger.log(`Processing initialize bin array instruction for signature: ${transaction_signature}`)
      this.logger.log(`Block number: ${block_number}, Index: ${instruction_index}, Is inner: ${is_inner}`)

      // 1. Decode instruction data from raw instruction (matching Rust approach)
      const decoded = await this.decodeInitializeBinArrayInstruction(instruction)

      if (!decoded) {
        this.logger.warn('Failed to decode initialize bin array instruction')
        return
      }

      this.logger.log(`Decoded initialize bin array: ${JSON.stringify(decoded)}`)

      // 2. Process the bin array creation
      await this.processInitializeBinArray(decoded)

      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing initialize bin array instruction`)
    }
  }

  private async decodeInitializeBinArrayInstruction(
    instruction: PartiallyDecodedInstruction,
  ): Promise<InitializeBinArrayDecoded | null> {
    try {
      const { idlIx, decodedIx } = LiquidityBookLibrary.decodeInstruction(instruction.data)
      const accounts = LiquidityBookLibrary.getAccountsByName(
        idlIx,
        instruction.accounts,
        ['pair', 'bin_array']
      )

      // Add type assertion for decodedIx.data
      const data = decodedIx.data as InitializeBinArrayArgs

      return {
        index: data.id,
        pair: accounts.pair.toString(),
        bin_array: accounts.bin_array.toString(),
      }
    } catch (error) {
      this.logger.error('Error decoding initialize bin array instruction:', error)
      return null
    }
  }

  /**
   * Process initialize bin array instruction
   * Matches Rust implementation exactly:
   * - Checks if first bin in array already exists, returns early if found
   * - Creates 256 bins in the array (BIN_ARRAY_SIZE)
   * - Each bin has a unique ID: {pair}-{bin_id}
   * - All bins start with zero reserves and total supply
   */
  private async processInitializeBinArray(decoded: InitializeBinArrayDecoded): Promise<void> {
    this.logger.log(`Creating bin array for pair ${decoded.pair} at index ${decoded.index}`)

    try {
      // 1. Check if bins already exist (just check the first one, matching Rust logic)
      const firstBinId = decoded.index * BIN_ARRAY_SIZE
      const firstBinDocumentId = `${decoded.pair}-${firstBinId}`

      this.logger.log(`Checking if first bin ${firstBinDocumentId} already exists...`)
      const existingBin = await this.binModel.exists({ id: firstBinDocumentId }).lean()

      if (existingBin) {
        this.logger.log(`Bin array already exists for pair ${decoded.pair} at index ${decoded.index}, skipping...`)
        return // Return true in Rust
      }

      // 2. Create all 256 bins in the array (matching Rust loop: 0..=(BIN_ARRAY_SIZE - 1))
      const binDocuments = []

      for (let binIndex = 0; binIndex < BIN_ARRAY_SIZE; binIndex++) {
        const lbBinId = decoded.index * BIN_ARRAY_SIZE + binIndex
        const binDocumentId = `${decoded.pair}-${lbBinId}`

        const binData: Bin = {
          id: binDocumentId,
          lbBinId: lbBinId,
          binArrayId: decoded.bin_array,
          pairId: decoded.pair,
          binArrayIndex: decoded.index,
          totalSupply: '0',
          reserveX: '0',
          reserveY: '0',
        }

        binDocuments.push(binData)
      }

      this.logger.log(`Creating ${binDocuments.length} bins for bin array ${decoded.bin_array}`)

      // Insert all bins in batch for better performance
      await this.binModel.insertMany(binDocuments)

      this.logger.log(`Bin array created successfully: ${decoded.bin_array} with ${binDocuments.length} bins`)
      this.logger.log(`First bin ID: ${firstBinDocumentId}, Last bin ID: ${binDocuments[binDocuments.length - 1].id}`)

    } catch (error) {
      this.logger.error(`Error processing initialize bin array: ${error.message}`)
      throw error
    }
  }
}
