import { Injectable, Inject } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { Connection, PublicKey, ConfirmedSignatureInfo, ParsedTransactionWithMeta } from '@solana/web3.js'
import { indexerConfig } from '../config/indexer.config'
import { Logger } from '@/lib'
import retry from 'async-retry'

@Injectable()
export class SolanaService {
  private readonly logger = new Logger(SolanaService.name)
  private connection: Connection

  constructor(
    @Inject(indexerConfig.KEY)
    private readonly config: ConfigType<typeof indexerConfig>,
  ) {
    this.connection = new Connection(this.config.solanaRpcUrl, {
      httpHeaders: {
        origin: 'https://dex.saros.xyz'
      },
      commitment: 'confirmed',
    })
  }

  getConnection(): Connection {
    return this.connection
  }

  async getSignaturesForAddress(
    address: PublicKey,
    options?: {
      limit?: number
      before?: string
      until?: string
    },
  ): Promise<ConfirmedSignatureInfo[]> {
    return retry(
      async () => {
        const result = await this.connection.getSignaturesForAddress(address, options, 'finalized')
        if (!result) {
          throw new Error(`No signatures returned for address ${address.toBase58()}`)
        }
        return result
      },
      {
        retries: this.config.maxRetries,
        factor: 2,
        minTimeout: this.config.retryDelayMs,
        onRetry: (error, attempt) => {
          this.logger.warn(
            `Failed to get signatures for ${address.toBase58()}, attempt ${attempt}: ${error.message}`,
          )
        },
      },
    )
  }

  async getParsedTransaction(signature: string): Promise<ParsedTransactionWithMeta | null> {
    return retry(
      async () => {
        return await this.connection.getParsedTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        })
      },
      {
        retries: this.config.maxRetries,
        factor: 2,
        minTimeout: this.config.retryDelayMs,
        onRetry: (error, attempt) => {
          this.logger.warn(
            `Failed to get transaction ${signature}, attempt ${attempt}: ${error.message}`,
          )
        },
      },
    )
  }

  async getMultipleParsedTransactions(signatures: string[]): Promise<(ParsedTransactionWithMeta | null)[]> {
    return retry(
      async () => {
        return await this.connection.getParsedTransactions(signatures, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        })
      },
      {
        retries: this.config.maxRetries,
        factor: 2,
        minTimeout: this.config.retryDelayMs,
        onRetry: (error, attempt) => {
          this.logger.warn(
            `Failed to get multiple transactions, attempt ${attempt}: ${error.message}`,
          )
        },
      },
    )
  }

  async getSlot(): Promise<number> {
    return await this.connection.getSlot('confirmed')
  }

  async getAccountInfo(publicKey: PublicKey) {
    return retry(
      async () => {
        return await this.connection.getAccountInfo(publicKey)
      },
      {
        retries: this.config.maxRetries,
        factor: 2,
        minTimeout: this.config.retryDelayMs,
        onRetry: (error, attempt) => {
          this.logger.warn(
            `Failed to get account info for ${publicKey.toBase58()}, attempt ${attempt}: ${error.message}`,
          )
        },
      },
    )
  }
}
