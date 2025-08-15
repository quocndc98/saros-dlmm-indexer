import { PublicKey } from '@solana/web3.js'

export interface ParsedTransactionMessage {
  signature: string
  slot: number
  blockTime: number
  instructions: ParsedInstructionMessage[]
  isSuccessful: boolean
  errorMessage?: any
}

export interface ParsedInstructionMessage {
  signature: string
  slot: number
  blockTime: number
  instructionIndex: number
  instructionName: string
  instructionData: any
  accounts: PublicKey[]
  innerInstructions?: ParsedInstructionMessage[]
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
