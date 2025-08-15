export const QUEUE_NAME = {
  TRANSACTION_SCANNER: 'transaction-scanner',
  TRANSACTION_PROCESSOR: 'transaction-processor',
  INSTRUCTION_PROCESSOR: 'instruction-processor',
  SWAP_PROCESSOR: 'swap-processor',
  POSITION_PROCESSOR: 'position-processor',
  COMPOSITION_FEES_PROCESSOR: 'composition-fees-processor',
  DLQ_PROCESSOR: 'dlq-processor',
  QUOTE_ASSET_PROCESSOR: 'quote-asset-processor',
}

export const JOB_TYPES = {
  SCAN_TRANSACTIONS: 'scan-transactions',
  PROCESS_TRANSACTION: 'process-transaction',
  PROCESS_INSTRUCTION: 'process-instruction',
  PROCESS_SWAP: 'process-swap',
  PROCESS_POSITION_CREATE: 'process-position-create',
  PROCESS_POSITION_INCREASE: 'process-position-increase',
  PROCESS_POSITION_DECREASE: 'process-position-decrease',
  PROCESS_POSITION_CLOSE: 'process-position-close',
  PROCESS_COMPOSITION_FEES: 'process-composition-fees',
  PROCESS_DLQ: 'process-dlq',
  UPDATE_QUOTE_ASSET: 'update-quote-asset',
} as const

export const INSTRUCTION_NAMES = {
  SWAP: 'swap',
  CREATE_POSITION: 'createPosition',
  INCREASE_POSITION: 'increasePosition',
  DECREASE_POSITION: 'decreasePosition',
  CLOSE_POSITION: 'closePosition',
  COMPOSITION_FEES: 'compositionFees',
} as const
