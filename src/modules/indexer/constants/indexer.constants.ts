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
export const EVENT_DISCRIMINATOR_POSITION_CREATE = Buffer.from([97, 21, 205, 201, 62, 41, 111, 164])
export const BIN_PER_POSITION = 64
