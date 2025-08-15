export const LIQUIDITY_BOOK_PROGRAM_ID = 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD'

// Re-export from queue module
export { QUEUE_NAME as QUEUE_NAMES, JOB_TYPES } from '../../queue/queue.constant'

export const INSTRUCTION_NAMES = {
  SWAP: 'swap',
  CREATE_POSITION: 'createPosition',
  INCREASE_POSITION: 'increasePosition',
  DECREASE_POSITION: 'decreasePosition',
  CLOSE_POSITION: 'closePosition',
  COMPOSITION_FEES: 'compositionFees',
  INITIALIZE_PAIR: 'initializePair',
  INITIALIZE_BIN_ARRAY: 'initializeBinArray',
  INITIALIZE_BIN_STEP_CONFIG: 'initializeBinStepConfig',
  UPDATE_BIN_STEP_CONFIG: 'updateBinStepConfig',
} as const
