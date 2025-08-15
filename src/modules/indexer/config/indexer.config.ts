import { registerAs } from '@nestjs/config'
import { env, envAsBoolean, envOrThrow } from '@/lib'

export type IndexerConfig = {
  enableScanner: boolean
  solanaRpcUrl: string
  liquidityBookProgramAddress: string
  geckoTerminalApiKey: string
  solanaWnativeAddress: string
  solanaUsdtAddress: string
  solanaUsdcAddress: string
  batchSize: number
  maxRetries: number
  retryDelayMs: number
  scannerIntervalMs: number
  bullmq: {
    defaultJobOptions: {
      removeOnComplete: number
      removeOnFail: number
      attempts: number
      backoff: {
        type: string
        delay: number
      }
    }
  }
}

export const indexerConfigKey = 'indexer'

export const indexerConfig = registerAs<IndexerConfig>(indexerConfigKey, () => ({
  enableScanner: envAsBoolean('ENABLE_SCANNER', true),
  solanaRpcUrl: envOrThrow('SOLANA_RPC_URL'),
  liquidityBookProgramAddress: env('LIQUIDITY_BOOK_PROGRAM_ADDRESS'),
  geckoTerminalApiKey: envOrThrow('GECKO_TERMINAL_API_KEY'),
  solanaWnativeAddress: env('SOLANA_WNATIVE_ADDRESS', 'So11111111111111111111111111111111111111112'),
  solanaUsdtAddress: env('SOLANA_USDT_ADDRESS', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
  solanaUsdcAddress: env('SOLANA_USDC_ADDRESS', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  batchSize: parseInt(env('INDEXER_BATCH_SIZE', '100')),
  maxRetries: parseInt(env('INDEXER_MAX_RETRIES', '5')),
  retryDelayMs: parseInt(env('INDEXER_RETRY_DELAY_MS', '1000')),
  scannerIntervalMs: parseInt(env('SCANNER_INTERVAL_MS', '5000')),
  bullmq: {
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  },
}))
