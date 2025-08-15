import { Injectable } from '@nestjs/common'
import { PublicKey, ParsedTransactionWithMeta, CompiledInstruction } from '@solana/web3.js'
import { BorshCoder } from '@coral-xyz/anchor'
import bs58 from 'bs58'
import { Logger } from '@/lib'
import { ParsedTransactionMessage, ParsedInstructionMessage } from '../types/indexer.types'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'
import { LIQUIDITY_BOOK_PROGRAM_ID } from '../../../liquidity-book/liquidity-book.constants'

@Injectable()
export class TransactionParserService {
  private readonly logger = new Logger(TransactionParserService.name)

  parseTransaction(
    signature: string,
    transaction: ParsedTransactionWithMeta,
  ): ParsedTransactionMessage | null {
    try {
      if (!transaction || !transaction.transaction) {
        return null
      }

      const message = transaction.transaction.message
      const meta = transaction.meta
      const slot = transaction.slot
      const blockTime = transaction.blockTime || 0

      const instructions: ParsedInstructionMessage[] = []

      // Parse top-level instructions
      if (message.instructions) {
        for (let i = 0; i < message.instructions.length; i++) {
          const instruction = message.instructions[i]
          const parsedInstruction = this.parseInstruction(
            signature,
            slot,
            blockTime,
            i,
            instruction,
            message.accountKeys || [],
          )
          if (parsedInstruction) {
            instructions.push(parsedInstruction)
          }
        }
      }

      // Parse inner instructions if available
      if (meta?.innerInstructions) {
        for (const innerInstructionSet of meta.innerInstructions) {
          for (const innerInstruction of innerInstructionSet.instructions) {
            const parsedInnerInstruction = this.parseInstruction(
              signature,
              slot,
              blockTime,
              innerInstructionSet.index,
              innerInstruction,
              message.accountKeys || [],
            )
            if (parsedInnerInstruction) {
              // Add inner instruction to the corresponding outer instruction
              const outerInstructionIndex = innerInstructionSet.index
              if (instructions[outerInstructionIndex]) {
                if (!instructions[outerInstructionIndex].innerInstructions) {
                  instructions[outerInstructionIndex].innerInstructions = []
                }
                instructions[outerInstructionIndex].innerInstructions!.push(parsedInnerInstruction)
              }
            }
          }
        }
      }

      return {
        signature,
        slot,
        blockTime,
        instructions,
        isSuccessful: meta?.err === null,
        errorMessage: meta?.err,
      }
    } catch (error) {
      this.logger.error(`Failed to parse transaction ${signature}:`, error)
      return null
    }
  }

  private parseInstruction(
    signature: string,
    slot: number,
    blockTime: number,
    instructionIndex: number,
    instruction: any,
    accountKeys: any[],
  ): ParsedInstructionMessage | null {
    try {
      // Check if this is a liquidity book program instruction
      const programId = this.getInstructionProgramId(instruction, accountKeys)

      if (programId !== LIQUIDITY_BOOK_PROGRAM_ID) {
        return null
      }

      const instructionData = this.getInstructionData(instruction)
      if (!instructionData) {
        return null
      }

      // Decode the instruction using the liquidity book library
      const decodedInstruction = LiquidityBookLibrary.decodeInstruction(instructionData)
      if (!decodedInstruction) {
        return null
      }

      const accounts = this.getInstructionAccounts(instruction, accountKeys)

      return {
        signature,
        slot,
        blockTime,
        instructionIndex,
        instructionName: decodedInstruction.idlIx.name,
        instructionData: decodedInstruction.decodedIx.data,
        accounts,
      }
    } catch (error) {
      this.logger.error(`Failed to parse instruction at index ${instructionIndex}:`, error)
      return null
    }
  }

  private getInstructionProgramId(instruction: any, accountKeys: any[]): string | null {
    try {
      if (instruction.programId) {
        return instruction.programId
      }

      if (instruction.programIdIndex !== undefined && accountKeys[instruction.programIdIndex]) {
        return accountKeys[instruction.programIdIndex].pubkey || accountKeys[instruction.programIdIndex]
      }

      return null
    } catch (error) {
      return null
    }
  }

  private getInstructionData(instruction: any): string | null {
    try {
      if (instruction.data) {
        return instruction.data
      }
      return null
    } catch (error) {
      return null
    }
  }

  private getInstructionAccounts(instruction: any, accountKeys: any[]): PublicKey[] {
    try {
      const accounts: PublicKey[] = []

      if (instruction.accounts) {
        for (const accountIndex of instruction.accounts) {
          const accountKey = accountKeys[accountIndex]
          if (accountKey) {
            const pubkeyString = accountKey.pubkey || accountKey
            accounts.push(new PublicKey(pubkeyString))
          }
        }
      }

      return accounts
    } catch (error) {
      this.logger.error('Failed to get instruction accounts:', error)
      return []
    }
  }

  extractLiquidityBookInstructions(parsedTransaction: ParsedTransactionMessage): ParsedInstructionMessage[] {
    const liquidityBookInstructions: ParsedInstructionMessage[] = []

    for (const instruction of parsedTransaction.instructions) {
      liquidityBookInstructions.push(instruction)

      // Also include inner instructions
      if (instruction.innerInstructions) {
        liquidityBookInstructions.push(...instruction.innerInstructions)
      }
    }

    return liquidityBookInstructions
  }
}
