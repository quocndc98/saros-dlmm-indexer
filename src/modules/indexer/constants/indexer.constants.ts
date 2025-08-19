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


// Position Create
export const INSTRUCTION_IDENTIFIER_POSITION_CREATE = Buffer.from([48, 215, 197, 153, 96, 203, 180, 133]) 
export const EVENT_IDENTIFIER_POSITION_CREATE = Buffer.from([228, 69, 165, 46, 81, 203, 154, 29])
export const EVENT_DISCRIMINATOR_POSITION_CREATE = Buffer.from([97, 21, 205, 201, 62, 41, 111, 164])
export const MAX_BIN_PER_POSITION_CREATE = 64