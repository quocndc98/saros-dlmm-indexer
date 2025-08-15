export const LB_INSTRUCTION_NAMES = {
  accept_config_ownership: 'accept_config_ownership',
  close_position: 'close_position',
  create_position: 'create_position',
  decrease_position: 'decrease_position',
  increase_position: 'increase_position',
  initialize_bin_array: 'initialize_bin_array',
  initialize_bin_step_config: 'initialize_bin_step_config',
  initialize_config: 'initialize_config',
  initialize_pair: 'initialize_pair',
  initialize_quote_asset_badge: 'initialize_quote_asset_badge',
  set_hook: 'set_hook',
  swap: 'swap',
  transfer_config_ownership: 'transfer_config_ownership',
  update_bin_step_config: 'update_bin_step_config',
  update_pair_static_fee_parameters: 'update_pair_static_fee_parameters',
  update_quote_asset_badge: 'update_quote_asset_badge',
  withdraw_protocol_fees: 'withdraw_protocol_fees',
}

export const LB_TYPES_NAMES = {
  BinSwapEvent: 'BinSwapEvent',
  PositionDecreaseEvent: 'PositionDecreaseEvent',
}

export const MDMA_HOOK_INSTRUCTION_NAMES = {
  initialize_config: 'initialize_config',
}

export const INSTRUCTION_AFFECTING_PAIR = [
  LB_INSTRUCTION_NAMES.increase_position,
  LB_INSTRUCTION_NAMES.decrease_position,
  LB_INSTRUCTION_NAMES.close_position,
  LB_INSTRUCTION_NAMES.swap,
  LB_INSTRUCTION_NAMES.withdraw_protocol_fees, // change protocol fees
]

export const TRANSACTION_TYPE = {
  CREATE_POOL: 'CREATE_POOL',
  ADD_LIQUIDITY: 'ADD_LIQUIDITY',
  REMOVE_LIQUIDITY: 'REMOVE_LIQUIDITY',
  SWAP: 'SWAP',
}

export const BIN_ARRAY_SIZE = 256

export const MID_ACTIVE_BIN = 8_388_608 // 2^23

// In Python, list(sha256("anchor:event".encode()).digest()[:8])[::-1]
export const EVENT_IDENTIFIER = [228, 69, 165, 46, 81, 203, 154, 29]

// In Python, list(sha256("event:BinSwapEvent".encode()).digest()[:8])
export const BIN_SWAP_EVENT_DISCRIMINATOR = [55, 42, 192, 194, 230, 243, 9, 72]

// In Python, list(sha256("event:PositionDecreaseEvent".encode()).digest()[:8])
export const POSITION_DECREASE_EVENT_DISCRIMINATOR = [200, 116, 151, 126, 182, 237, 245, 254]
