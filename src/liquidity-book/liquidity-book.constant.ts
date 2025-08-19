export const INSTRUCTION_NAMES = {
  SWAP: 'swap',
  CREATE_POSITION: 'create_position',
  INCREASE_POSITION: 'increase_position',
  DECREASE_POSITION: 'decrease_position',
  CLOSE_POSITION: 'close_position',
  COMPOSITION_FEES: 'composition_fees',
  INITIALIZE_PAIR: 'initialize_pair',
  INITIALIZE_BIN_STEP_CONFIG: 'initialize_bin_step_config',
  INITIALIZE_BIN_ARRAY: 'initialize_bin_array',
  INITIALIZE_QUOTE_ASSET_BADGE: 'initialize_quote_asset_badge',
  UPDATE_PAIR_STATIC_FEE_PARAMETERS: 'update_pair_static_fee_parameters',
} as const

export const EVENT_NAMES = {
  BIN_SWAP_EVENT: 'BinSwapEvent',
  COMPOSITION_FEES_EVENT: 'CompositionFeesEvent',
  QUOTE_ASSET_BADGE_INITIALIZATION_EVENT: 'QuoteAssetBadgeInitializationEvent',
  QUOTE_ASSET_BADGE_UPDATE_EVENT: 'QuoteAssetBadgeUpdateEvent',
  POSITION_CREATION_EVENT: 'PositionCreationEvent',
  POSITION_INCREASE_EVENT: 'PositionIncreaseEvent',
  POSITION_DECREASE_EVENT: 'PositionDecreaseEvent',
} as const

export const TYPE_NAMES = {
  BIN: 'Bin',
  BIN_ARRAY: 'BinArray',
  BIN_SWAP_EVENT: 'BinSwapEvent',
  BIN_LIQUIDITY_DISTRIBUTION: 'BinLiquidityDistribution',
  COMPOSITION_FEES_EVENT: 'CompositionFeesEvent',
  QUOTE_ASSET_BADGE_INITIALIZATION_EVENT: 'QuoteAssetBadgeInitializationEvent',
  QUOTE_ASSET_BADGE_UPDATE_EVENT: 'QuoteAssetBadgeUpdateEvent',
  POSITION_CREATION_EVENT: 'PositionCreationEvent',
} as const

export const MDMA_HOOK_INSTRUCTION_NAMES = {
  initialize_config: 'initialize_config',
}

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
