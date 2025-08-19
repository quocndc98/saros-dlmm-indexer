import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Job } from 'bullmq'
import { PartiallyDecodedInstruction } from '@solana/web3.js'
import { BaseProcessor } from './base.processor'
import { Position } from '../schemas/position.schema'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'
import { SolanaService } from '../services/solana.service'
import { EVENT_DISCRIMINATOR_POSITION_CREATE, EVENT_IDENTIFIER_POSITION_CREATE, INSTRUCTION_IDENTIFIER_POSITION_CREATE, JOB_TYPES, MAX_BIN_PER_POSITION_CREATE } from '../constants/indexer.constants'
import { CreatePositionArgs, CreatePositionDecoded, ParsedInstructionMessage, PositionCreationEvent, PositionCreationEventDecoded } from '../types/indexer.types'
import bs58 from 'bs58'
import { Instruction } from '../schemas/instruction.schema'
import { ProcessorName } from '../types/enums'
import { TokenAccount } from '../schemas/token-account.schema'
import { LiquidityShares } from '../schemas/liquidity-shares.schema'
import { TYPE_NAMES } from '@/liquidity-book/liquidity-book.constant'

@Injectable()
export class CreatePositionProcessor extends BaseProcessor {
  constructor(
    @InjectModel(Position.name)
    private readonly positionModel: Model<Position>,
    @InjectModel(Instruction.name)
    private readonly instructionModel: Model<Instruction>,
    @InjectModel(TokenAccount.name)
    private readonly tokenAccountModel: Model<TokenAccount>,
    @InjectModel(LiquidityShares.name)
    private readonly liquiditySharesModel: Model<LiquidityShares>,
    private readonly solanaService: SolanaService,
  ) {
    super(CreatePositionProcessor.name)
  }

  async process(job: Job): Promise<void> {
    this.logJobStart(job)
    try {
      await this.processCreatePosition(job.data)
      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing position instruction ${job.data.instructionName}`)
    }
  }

  async processCreatePosition(input:  ParsedInstructionMessage ) {
    const { block_number, transaction_signature, instruction, instruction_index, inner_instruction_index, is_inner, block_time } = input
    const decodedData = this.decodeInstructionData(instruction.data)
    if (!decodedData) {
        return false
    }

    const [identifier, instructionData] = this.splitAt(decodedData, 8)
    if (identifier.equals(INSTRUCTION_IDENTIFIER_POSITION_CREATE)) {
      return await this.processInstructionPath(instruction, block_number, instruction_index, inner_instruction_index, transaction_signature, is_inner, block_time)
    }

    if (identifier.equals(EVENT_IDENTIFIER_POSITION_CREATE)) {
      return await this.processEventPath(instructionData, block_number, instruction_index, inner_instruction_index, transaction_signature, is_inner, block_time)
    }

    return false
  }

  private async processInstructionPath(
    instruction: PartiallyDecodedInstruction,
    blockNumber: number,
    instructionIndex: number,
    innerInstructionIndex: number | null,
    txnSignature: string,
    isInner: boolean,
    blockTime: number | null
  ): Promise<boolean> {
    try {
      // Decode instruction (matching Rust decode_instruction)
      const decodedPosition = this.decodeInstruction(instruction)
      if (!decodedPosition) {
        throw new Error('Failed to decode create position instruction')
      }

      // On-chain call to get owner of position (matching Rust logic exactly)
      const positionTokenAccount = await this.solanaService.getTokenAccount(
        decodedPosition.positionTokenAccount
      )

      let positionTokenAccountOwner: string
      if (!positionTokenAccount) {
        const accountCreator = await this.solanaService.getAccountCreator(
          decodedPosition.positionTokenAccount
        )
        if (!accountCreator) {
          throw new Error(
            `Failed to get position account creator ${decodedPosition.positionTokenAccount}`
          )
        }
        positionTokenAccountOwner = accountCreator
      } else {
        positionTokenAccountOwner = positionTokenAccount.owner
      }

      // Check if instruction already processed (matching Rust logic)
      const instructionId = this.getInstructionId(
        blockNumber,
        txnSignature,
        ProcessorName.CreatePositionProcessor,
        instructionIndex,
        innerInstructionIndex
      )

      const existingInstruction = await this.instructionModel.findOne({ id: instructionId })
      if (existingInstruction) {
        return true // Already processed
      }

      // Insert instruction record (matching Rust instruction tracking)
      await this.instructionModel.create({
        id: instructionId,
        processorName: ProcessorName.CreatePositionProcessor,
        signature: txnSignature,
        index: instructionIndex,
        innerIndex: innerInstructionIndex,
        isInner,
        blockNumber,
        blockTime: blockTime ? new Date(blockTime * 1000) : null,
      })

      // Check for existing position token account (matching Rust logic)
      const existingTokenAccount = await this.tokenAccountModel.findOne({
        id: decodedPosition.positionTokenAccount
      })

      if (!existingTokenAccount) {
        await this.tokenAccountModel.create({
          id: decodedPosition.positionTokenAccount,
          ownerId: positionTokenAccountOwner,
          tokenMintId: decodedPosition.positionMint,
          balance: '1', // BigDecimal::from(1) in Rust
        })
      }

      // Check if position already exists and update or insert (matching Rust match statement)
      const existingPosition = await this.positionModel.findOne({
        id: decodedPosition.position
      })

      if (!existingPosition) {
        // Create liquidity shares (matching Rust loop: for liquidity_share_index in 0..=MAX_BIN_PER_POSITION - 1)
        const liquiditySharesData = []
        for (let liquidityShareIndex = 0; liquidityShareIndex < MAX_BIN_PER_POSITION_CREATE; liquidityShareIndex++) {
          liquiditySharesData.push({
            id: `${decodedPosition.position}-${liquidityShareIndex}`,
            positionId: decodedPosition.position,
            index: liquidityShareIndex,
            balance: '0', // BigDecimal::from(0) in Rust
          })
        }
        await this.liquiditySharesModel.insertMany(liquiditySharesData)

        // Create position record (matching Rust position::ActiveModel exactly)
        await this.positionModel.create({
          id: decodedPosition.position,
          pairId: decodedPosition.pair,
          positionMintId: decodedPosition.positionMint,
          ownerId: positionTokenAccountOwner,
          lowerBinLbId: 0, // Set(0) in Rust for instruction path
          upperBinLbId: 0, // Set(0) in Rust for instruction path
        })

        this.logger.log(`Created position: ${decodedPosition.position}`)
      } else {
        // Update existing position (matching Rust update logic)
        await this.positionModel.updateOne(
          { id: decodedPosition.position },
          {
            positionMintId: decodedPosition.positionMint,
            ownerId: positionTokenAccountOwner,
          }
        )

        this.logger.log(`Updated existing position: ${decodedPosition.position}`)
      }

      return true
    } catch (error) {
      this.logger.error('Error processing create position instruction:', error)
      throw error
    }
  }

  private async processEventPath(
    instructionDataBuffer: Buffer<ArrayBufferLike>,
    blockNumber: number,
    instructionIndex: number,
    innerInstructionIndex: number | null,
    txnSignature: string,
    isInner: boolean,
    blockTime: number | null
  ): Promise<boolean> {
    try {
      const [discriminator, eventData] = this.splitAt(instructionDataBuffer, 8)
      if (!discriminator.equals(EVENT_DISCRIMINATOR_POSITION_CREATE)) {
        this.logger.debug('Event discriminator does not match PositionCreationEvent')
        return false
      }

      // Decode position creation event data
      const decodedEvent = this.decodePositionCreationEvent(eventData)
      if (!decodedEvent) {
        throw new Error('Failed to decode PositionCreationEvent')
      }

      this.logger.log(`Processing position creation event for position: ${decodedEvent.position}`)

      // Check if instruction already processed (matching Rust logic)
      const instructionId = this.getInstructionId(
        blockNumber,
        txnSignature,
        ProcessorName.CreatePositionProcessor,
        instructionIndex,
        innerInstructionIndex
      )

      const existingInstruction = await this.instructionModel.findOne({ id: instructionId })
      if (existingInstruction) {
        this.logger.log(`Event already processed: ${instructionId}`)
        return true // Already processed
      }

      // Insert instruction record (matching Rust instruction tracking)
      await this.instructionModel.create({
        id: instructionId,
        processorName: ProcessorName.CreatePositionProcessor,
        signature: txnSignature,
        index: instructionIndex,
        innerIndex: innerInstructionIndex,
        isInner,
        blockNumber,
        blockTime: blockTime ? new Date(blockTime * 1000) : null,
      })

      const positionId = decodedEvent.position

      // Check if position already exists and update or insert (matching Rust match statement)
      const existingPosition = await this.positionModel.findOne({ id: positionId })

      if (!existingPosition) {
        // Create liquidity shares (matching Rust loop)
        const liquiditySharesData = []
        for (let liquidityShareIndex = 0; liquidityShareIndex < MAX_BIN_PER_POSITION_CREATE; liquidityShareIndex++) {
          liquiditySharesData.push({
            id: `${positionId}-${liquidityShareIndex}`,
            positionId: positionId,
            index: liquidityShareIndex,
            balance: '0', // BigDecimal::from(0) in Rust
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }
        await this.liquiditySharesModel.insertMany(liquiditySharesData)
        this.logger.log(`Created ${MAX_BIN_PER_POSITION_CREATE} liquidity shares for position: ${positionId}`)

        // Create position record (matching Rust position::ActiveModel for event)
        await this.positionModel.create({
          id: positionId,
          pairId: decodedEvent.pair,
          positionMintId: decodedEvent.positionMint,
          ownerId: 'dummy-owner-id', // Set("dummy-owner-id") in Rust for event path
          lowerBinLbId: decodedEvent.lowerBinId, // decoded_event.lower_bin_id as i64
          upperBinLbId: decodedEvent.upperBinId, // decoded_event.upper_bin_id as i64
        })

        this.logger.log(`Created position from event: ${positionId}`)
      } else {
        // Update position lower_bin_lb_id, upper_bin_lb_id (matching Rust update logic)
        await this.positionModel.updateOne(
          { id: positionId },
          {
            lowerBinLbId: decodedEvent.lowerBinId,
            upperBinLbId: decodedEvent.upperBinId,
          }
        )

        this.logger.log(`Updated position bin range: ${positionId}`)
      }

      return true
    } catch (error) {
      this.logger.error('Error processing position creation event:', error)
      throw error
    }
  }

  private decodeInstruction(instruction: PartiallyDecodedInstruction): CreatePositionDecoded | null {
    try {
      const { idlIx, decodedIx } = LiquidityBookLibrary.decodeInstruction(instruction.data)
      const accounts = LiquidityBookLibrary.getAccountsByName(
        idlIx,
        instruction.accounts,
        [
          'pair',
          'position',
          'position_mint',
          'position_token_account'
        ],
      )

      const positionArgs = decodedIx.data as CreatePositionArgs
      const dataDecode: CreatePositionDecoded = {
        relativeBinIdLeft: positionArgs.relative_bin_id_left,
        relativeBinIdRight: positionArgs.relative_bin_in_right,
        pair: accounts.pair.toString() || '',
        position: accounts.position.toString() || '',
        positionMint: accounts.position_mint.toString() || '',
        positionTokenAccount: accounts.position_token_account.toString() || '',
      }

      return dataDecode
    } catch (error) {
      this.logger.warn(`Failed to decode CreatePositionArgs: ${error}`)
      return null
    }
  }

  private decodePositionCreationEvent(eventData: Buffer<ArrayBufferLike>): PositionCreationEvent | null {
    try {
      const decoded = LiquidityBookLibrary.decodeType<PositionCreationEventDecoded>(
        TYPE_NAMES.POSITION_CREATION_EVENT,
        eventData,
      )
      
      return {
        pair: decoded.pair?.toString(),
        position: decoded.position?.toString(),
        positionMint: decoded.position_mint?.toString(),
        lowerBinId: decoded.lower_bin_id,
        upperBinId: decoded.upper_bin_id,
      }
    } catch (error) {
      this.logger.warn(`Failed to decode PositionCreationEvent: ${error}`)
      return null
    }
  }

  private decodeInstructionData(data: string): Buffer | null {
    try {
      return Buffer.from(bs58.decode(data))
    } catch (error) {
      this.logger.error('Error decoding instruction data:', error)
      return null
    }
  }

  private splitAt(buffer: Buffer, index: number): [Buffer, Buffer] {
    return [buffer.subarray(0, index), buffer.subarray(index)]
  }
  private getInstructionId(
    blockNumber: number,
    txnSignature: string,
    processorName: string,
    instructionIndex: number,
    innerInstructionIndex: number | null
  ): string {
    const innerIndexStr = innerInstructionIndex ? innerInstructionIndex.toString() : '*'
    return `${blockNumber}-${txnSignature}-${processorName.toLowerCase()}-${instructionIndex}-${innerIndexStr}`
  }
}
