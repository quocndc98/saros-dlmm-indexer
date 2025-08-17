import { PartiallyDecodedInstruction, PublicKey } from '@solana/web3.js'

export interface ParsedInstructionMessage {
  block_number: number // slot
  transaction_signature: string
  instruction: PartiallyDecodedInstruction
  instruction_index: number
  inner_instruction_index?: number
  is_inner: boolean
  block_time?: number
}

export interface ParsedTransactionMessage {
  signature: string
  slot: number
  blockTime: number
  instructions: ParsedInstructionMessage[]
  isSuccessful: boolean
  errorMessage?: any
}

export interface SwapEventData {
  pair: PublicKey
  user: PublicKey
  swapForY: boolean
  binId: number
  amountIn: string
  amountOut: string
  fee: string
  protocolFee: string
  volatilityAccumulator: number
}

export interface PositionEventData {
  pair: PublicKey
  positionMint: PublicKey
  user: PublicKey
  binIds: number[]
  amountsX: string[]
  amountsY: string[]
  liquidityShares: string[]
}

export interface CompositionFeesEventData {
  pair: PublicKey
  user: PublicKey
  totalFeesX: string
  totalFeesY: string
  binIds: number[]
  feesX: string[]
  feesY: string[]
}

export interface QuoteAssetData {
  mint: string
  symbol: string
  name: string
  decimals: number
  priceUsd?: number
}

export interface SolanaTransactionData {
  signature: string
  slot: number
  blockTime: number | null
  transaction: any
  meta: any
}
