import { BN } from '@coral-xyz/anchor'
import { IdlInstruction } from '@coral-xyz/anchor/dist/cjs/idl'
import { PublicKey } from '@solana/web3.js'

export type Bin = {
  total_supply: BN
  reserve_x: BN
  reserve_y: BN
}

export type BinArray = {
  pair: PublicKey
  bins: Bin[]
  index: number
  _space: Uint8Array
}

export type Pair = {
  bump: Uint8Array
  liquidity_book_config: PublicKey
  bin_step: number
  bin_step_seed: Uint8Array
  token_mint_x: PublicKey
  token_mint_y: PublicKey
  static_fee_parameters: StaticFeeParameters
  active_id: number
  dynamic_fee_parameters: DynamicFeeParameters
  protocol_fees_x: BN
  protocol_fees_y: BN
  hook: PublicKey | null
}

export type Position = {
  pair: PublicKey
  position_mint: PublicKey
  liquidity_shares: BN[]
  lower_bin_id: number
  upper_bin_id: number
  _space: Uint8Array
}

export type StaticFeeParameters = {
  base_factor: number
  filter_period: number
  decay_period: number
  reduction_factor: number
  variable_fee_control: number
  max_volatility_accumulator: number
  protocol_share: number
  _space: Uint8Array
}

export type DynamicFeeParameters = {
  time_last_updated: bigint
  volatility_accumulator: number
  volatility_reference: number
  id_reference: number
  _space: Uint8Array
}

export type IdlAccountName<T extends IdlInstruction> = T['accounts'][number]['name']

export type BinStepConfig = {
  binStep: number // bin step in basis points (bps)
  baseFactor: number
  baseFeeBps: number // base fee in basis points
  baseFeePercent: number // base fee in percent
}

export type BinSwapEvent = {
  pair: PublicKey
  swap_for_y: boolean
  protocol_fee: BN
  bin_id: number
  amount_in: BN
  amount_out: BN
  volatility_accumulator: number
  fee: BN
}

export type PositionDecreaseEvent = {
  pair: PublicKey
  position: PublicKey
  bin_ids: number[]
  amounts_x: BN[]
  amounts_y: BN[]
  liquidity_burned: BN[]
}
