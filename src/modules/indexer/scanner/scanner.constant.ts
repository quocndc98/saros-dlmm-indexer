// Constants
export const SCAN_LIMITS = {
  BACKWARD: 1000,
  FORWARD: 1000,
} as const

export const DELAYS = {
  INITIALIZATION: 5000,
  BETWEEN_BATCHES: 1000,
  RETRY: 1000,
  QUEUE_PROCESSING: 1000,
} as const
