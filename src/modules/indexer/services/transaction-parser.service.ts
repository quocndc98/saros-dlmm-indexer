import { Injectable } from '@nestjs/common'
import {
  PublicKey,
  ParsedTransactionWithMeta,
  CompiledInstruction,
  PartiallyDecodedInstruction,
  ParsedInstruction,
} from '@solana/web3.js'
import { BorshCoder } from '@coral-xyz/anchor'
import bs58 from 'bs58'
import { Logger } from '@/lib'
import { ParsedInstructionMessage } from '../types/indexer.types'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'
import { LIQUIDITY_BOOK_PROGRAM_ID } from '../../../liquidity-book/liquidity-book.constants'

@Injectable()
export class TransactionParserService {
  private readonly logger = new Logger(TransactionParserService.name)

  // parseTransaction(
  //   signature: string,
  //   transaction: ParsedTransactionWithMeta,
  // ): ParsedTransactionMessage | null {
  //   try {
  //     if (!transaction || !transaction.transaction) {
  //       return null
  //     }

  //     const message = transaction.transaction.message
  //     const meta = transaction.meta
  //     const slot = transaction.slot
  //     const blockTime = transaction.blockTime || 0

  //     let result: ParsedTransactionMessage[] = []

  //     // Parse top-level instructions
  //     for (let i = 0; i < message.instructions.length; i++) {
  //       const instruction = message.instructions[i]
  //       if (!('data' in instruction)) continue
  //       const programId = instruction.programId.toBase58()
  //       if (programId !== LIQUIDITY_BOOK_PROGRAM_ID) continue

  //       result.push({
  //         signature,
  //         slot,
  //         blockTime,
  //         index: i,
  //         instruction
  //       })
  //     }

  //     // Parse inner instructions if available
  //     if (meta?.innerInstructions) {
  //       for (const innerInstructionSet of meta.innerInstructions) {
  //         for (const innerInstruction of innerInstructionSet.instructions) {
  //           const parsedInnerInstruction = this.parseInstruction(
  //             signature,
  //             slot,
  //             blockTime,
  //             innerInstructionSet.index,
  //             innerInstruction,
  //             message.accountKeys || [],
  //           )
  //           if (parsedInnerInstruction) {
  //             // Add inner instruction to the corresponding outer instruction
  //             const outerInstructionIndex = innerInstructionSet.index
  //             if (instructions[outerInstructionIndex]) {
  //               if (!instructions[outerInstructionIndex].innerInstructions) {
  //                 instructions[outerInstructionIndex].innerInstructions = []
  //               }
  //               instructions[outerInstructionIndex].innerInstructions!.push(parsedInnerInstruction)
  //             }
  //           }
  //         }
  //       }
  //     }

  //     return {
  //       signature,
  //       slot,
  //       blockTime,
  //       instructions,
  //       isSuccessful: meta?.err === null,
  //       errorMessage: meta?.err,
  //     }
  //   } catch (error) {
  //     this.logger.error(`Failed to parse transaction ${signature}:`, error)
  //     return null
  //   }
  // }

  // private parseInstruction(
  //   signature: string,
  //   slot: number,
  //   blockTime: number,
  //   instructionIndex: number,
  //   instruction: ParsedInstruction | PartiallyDecodedInstruction,
  //   accountKeys: any[],
  // ): ParsedInstructionMessage | null {
  //   try {
  //     // Check if this is a liquidity book program instruction
  //     const programId = instruction.programId.toBase58()

  //     if (programId !== LIQUIDITY_BOOK_PROGRAM_ID) {
  //       return null
  //     }

  //     if (!('data' in instruction)) {
  //       return null
  //     }

  //     // Decode the instruction using the liquidity book library
  //     const decodedInstruction = LiquidityBookLibrary.decodeInstruction(instruction.data)
  //     if (!decodedInstruction) {
  //       return null
  //     }

  //     const accounts = this.getInstructionAccounts(instruction, accountKeys)

  //     return {
  //       signature,
  //       slot,
  //       blockTime,
  //       instructionIndex,
  //       instructionName: decodedInstruction.idlIx.name,
  //       instructionData: decodedInstruction.decodedIx.data,
  //       accounts,
  //     }
  //   } catch (error) {
  //     this.logger.error(`Failed to parse instruction at index ${instructionIndex}:`, error)
  //     return null
  //   }
  // }

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

  // extractLiquidityBookInstructions(parsedTransaction: ParsedTransactionMessage): ParsedInstructionMessage[] {
  //   const liquidityBookInstructions: ParsedInstructionMessage[] = []

  //   for (const instruction of parsedTransaction.instructions) {
  //     liquidityBookInstructions.push(instruction)

  //     // Also include inner instructions
  //     if (instruction.innerInstructions) {
  //       liquidityBookInstructions.push(...instruction.innerInstructions)
  //     }
  //   }

  //   return liquidityBookInstructions
  // }

  extractLiquidityBookInstructions(
    transaction: ParsedTransactionWithMeta,
  ): ParsedInstructionMessage[] {
    let result: ParsedInstructionMessage[] = []

    const instructions = transaction.transaction.message.instructions || []
    const signature = transaction.transaction.signatures[0] || ''
    const slot = transaction.slot
    const blockTime = transaction.blockTime || 0

    // Parse top-level instructions
    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i]
      if (!('data' in instruction)) continue
      const programId = instruction.programId.toBase58()
      if (programId !== LIQUIDITY_BOOK_PROGRAM_ID) continue

      result.push({
        block_number: slot,
        transaction_signature: signature,
        instruction,
        instruction_index: i,
        inner_instruction_index: undefined,
        is_inner: false,
        block_time: blockTime,
      })
    }

    const innerInstructions = transaction.meta?.innerInstructions || []
    // Parse inner instructions if available
    if (innerInstructions) {
      for (const innerInstructionSet of innerInstructions) {
        for (let j = 0; j < innerInstructionSet.instructions.length; j++) {
          const innerInstruction = innerInstructionSet.instructions[j]
          if (!('data' in innerInstruction)) continue

          // Check if it's a liquidity book instruction
          const programId = innerInstruction.programId.toBase58()
          if (programId !== LIQUIDITY_BOOK_PROGRAM_ID) continue

          result.push({
            block_number: slot,
            transaction_signature: signature,
            instruction: innerInstruction,
            instruction_index: innerInstructionSet.index,
            inner_instruction_index: j,
            is_inner: true,
            block_time: blockTime,
          })
        }
      }
    }

    return result
  }
}
