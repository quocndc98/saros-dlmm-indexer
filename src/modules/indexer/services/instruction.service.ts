import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Instruction, InstructionDocument } from '../schemas/instruction.schema'

interface GenerateInstructionIdParams {
  blockNumber: number
  signature: string
  processorName: string
  instructionIndex: number
  innerInstructionIndex: number | null
}

interface InsertInstructionParams {
  instructionId: string
  processorName: string
  signature: string
  instructionIndex: number
  innerInstructionIndex: number | null
  isInner: boolean
  blockNumber: number
  blockTime?: number | null
}

interface CheckAndInsertInstructionParams {
  blockNumber: number
  signature: string
  processorName: string
  instructionIndex: number
  innerInstructionIndex: number | null
  isInner: boolean
  blockTime?: number | null
}

@Injectable()
export class InstructionService {
  constructor(
    @InjectModel(Instruction.name)
    private readonly instructionModel: Model<InstructionDocument>,
  ) {}

  /**
   * Generate instruction ID following Rust format:
   * {blockNumber}-{signature}-{processorName}-{instructionIndex}-{innerIndex}
   */
  private generateInstructionId(params: GenerateInstructionIdParams): string {
    const { blockNumber, signature, processorName, instructionIndex, innerInstructionIndex } =
      params
    const innerIndexStr = innerInstructionIndex ?? '*'
    return `${blockNumber}-${signature}-${processorName.toLowerCase()}-${instructionIndex}-${innerIndexStr}`
  }

  /**
   * Check if instruction has already been processed (for deduplication)
   */
  async isInstructionProcessed(instructionId: string): Promise<boolean> {
    try {
      const instruction = await this.instructionModel.exists({ id: instructionId }).lean()
      return Boolean(instruction)
    } catch (error) {
      throw new Error(`Error checking instruction processed status: ${error.message}`)
    }
  }

  /**
   * Insert instruction record to track processing
   */
  private async insertInstruction(params: InsertInstructionParams): Promise<Instruction> {
    try {
      const {
        instructionId,
        processorName,
        signature,
        instructionIndex,
        innerInstructionIndex,
        isInner,
        blockNumber,
        blockTime,
      } = params

      const instructionData: Instruction = {
        id: instructionId,
        processorName: processorName.toLowerCase(),
        signature,
        index: instructionIndex,
        innerIndex: innerInstructionIndex,
        isInner,
        blockNumber,
        blockTime: blockTime ? new Date(blockTime * 1000) : null,
      }

      return this.instructionModel.create(instructionData)
    } catch (error) {
      throw new Error(`Error inserting instruction: ${error.message}`)
    }
  }

  /**
   * Check and insert instruction in one operation (for atomic processing)
   */
  async checkAndInsertInstruction(
    params: CheckAndInsertInstructionParams,
  ): Promise<{ isAlreadyProcessed: boolean; instruction?: Instruction }> {
    const {
      blockNumber,
      signature,
      processorName,
      instructionIndex,
      innerInstructionIndex,
      isInner,
      blockTime,
    } = params

    const instructionId = this.generateInstructionId({
      blockNumber,
      signature,
      processorName,
      instructionIndex,
      innerInstructionIndex,
    })

    // Check if already processed
    const isProcessed = await this.isInstructionProcessed(instructionId)
    if (isProcessed) {
      return { isAlreadyProcessed: true }
    }

    // Insert instruction record
    const instruction = await this.insertInstruction({
      instructionId,
      processorName,
      signature,
      instructionIndex,
      innerInstructionIndex,
      isInner,
      blockNumber,
      blockTime,
    })

    return { isAlreadyProcessed: false, instruction }
  }
}
