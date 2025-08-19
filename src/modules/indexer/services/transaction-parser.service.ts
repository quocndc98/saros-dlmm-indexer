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
import { LIQUIDITY_BOOK_PROGRAM_ID } from '../../../liquidity-book/liquidity-book.constant'

@Injectable()
export class TransactionParserService {
  private readonly logger = new Logger(TransactionParserService.name)

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
        blockNumber: slot,
        signature: signature,
        instruction,
        instructionIndex: i,
        innerInstructionIndex: undefined,
        isInner: false,
        blockTime: blockTime,
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
            blockNumber: slot,
            signature: signature,
            instruction: innerInstruction,
            instructionIndex: innerInstructionSet.index,
            innerInstructionIndex: j,
            isInner: true,
            blockTime: blockTime,
          })
        }
      }
    }

    return result
  }
}
