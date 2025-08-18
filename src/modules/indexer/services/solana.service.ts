import { Injectable, Inject } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { Connection, PublicKey, ConfirmedSignatureInfo, ParsedTransactionWithMeta, AccountInfo } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, AccountLayout } from '@solana/spl-token'
import { indexerConfig } from '../config/indexer.config'
import { Logger } from '@/lib'
import retry from 'async-retry'
import { UiTokenAccount } from '../types/indexer.types'

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

  /**
   * Get token account information for Position NFT ownership tracking
   * @param pubkey - Token account public key as string
   * @returns UiTokenAccount if it's a valid token account, null otherwise
   */
  async getTokenAccount(pubkey: string): Promise<UiTokenAccount | null> {
    return retry(
      async () => {
        try {
          const publicKey = new PublicKey(pubkey)
          
          // Use getParsedAccountInfo for easier parsing
          const response = await this.connection.getParsedAccountInfo(publicKey)
          
          if (!response.value) {
            this.logger.debug(`Token account not found: ${pubkey}`)
            return null
          }

          const accountInfo = response.value
          
          // Check if it's a token account (owned by TOKEN_PROGRAM_ID)
          if (!accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
            this.logger.debug(`Account is not a token account: ${pubkey}`)
            return null
          }

          // Extract parsed data
          const parsedData = accountInfo.data
          if (typeof parsedData === 'object' && 'parsed' in parsedData) {
            const tokenData = parsedData.parsed.info
            
            const tokenAccount: UiTokenAccount = {
              mint: tokenData.mint,
              owner: tokenData.owner,
              tokenAmount: {
                amount: tokenData.tokenAmount.amount,
                decimals: tokenData.tokenAmount.decimals,
                uiAmount: tokenData.tokenAmount.uiAmount,
                uiAmountString: tokenData.tokenAmount.uiAmountString
              },
              state: tokenData.state,
              isNative: tokenData.isNative || false,
              rentExemptReserve: tokenData.rentExemptReserve
            }

            // Add optional fields
            if (tokenData.delegate) {
              tokenAccount.delegate = tokenData.delegate
            }
            
            if (tokenData.delegatedAmount) {
              tokenAccount.delegatedAmount = tokenData.delegatedAmount
            }
            
            if (tokenData.closeAuthority) {
              tokenAccount.closeAuthority = tokenData.closeAuthority
            }

            this.logger.debug(`Found token account ${pubkey} owned by ${tokenAccount.owner}`)
            return tokenAccount
          }

          // Fallback to manual parsing if parsed data is not available
          if (accountInfo.data instanceof Buffer) {
            return this.parseTokenAccountData({
              ...accountInfo,
              data: accountInfo.data as Buffer
            })
          }
          
          return null
        } catch (error) {
          this.logger.error(`Error getting token account ${pubkey}:`, error)
          throw new Error(`Failed to get token account: ${error.message}`)
        }
      },
      {
        retries: this.config.maxRetries,
        factor: 2,
        minTimeout: this.config.retryDelayMs,
        onRetry: (error, attempt) => {
          this.logger.warn(
            `Failed to get token account ${pubkey}, attempt ${attempt}: ${error.message}`,
          )
        },
      },
    )
  }

  /**
   * Get the creator of an account (fallback when token account doesn't exist)
   * Uses pagination to find the very first transaction that created the account
   * Matches Rust logic exactly with pagination loop
   * @param pubkey - Account public key as string
   * @returns Creator address as string, null if not found
   */
  async getAccountCreator(pubkey: string): Promise<string | null> {
    return retry(
      async () => {
        try {
          const publicKey = new PublicKey(pubkey)
          
          this.logger.debug(`Looking for account creator of: ${pubkey}`)
          
          let before: string | undefined = undefined
          let oldestSignature: ConfirmedSignatureInfo | null = null
          
          // ✅ PAGINATION LOOP như Rust - Keep paginating until we reach the very first transaction
          while (true) {
            const signatures = await this.connection.getSignaturesForAddress(
              publicKey,
              { 
                limit: 1000,
                before: before  // Pagination cursor
              },
              'finalized'
            )

            if (signatures.length === 0) {
              break
            }

            // ✅ Update the oldest signature we've seen (equivalent to signatures.last() trong Rust)
            oldestSignature = signatures[signatures.length - 1]

            this.logger.debug(`Got ${signatures.length} signatures, oldest in batch: ${oldestSignature.signature}`)

            // ✅ If we got fewer than 1000, we've reached the end (match Rust logic)
            if (signatures.length < 1000) {
              this.logger.debug(`Reached end of signatures (${signatures.length} < 1000)`)
              break
            }

            // ✅ Set 'before' to the oldest signature to get the next page (match Rust pagination)
            before = oldestSignature.signature
            
            this.logger.debug(`Continuing pagination with before: ${before}`)
          }

          if (!oldestSignature) {
            this.logger.debug(`No signatures found for account: ${pubkey}`)
            return null
          }

          this.logger.debug(`Found oldest signature after pagination: ${oldestSignature.signature}`)
          
          // ✅ Now get the actual first transaction (match Rust logic)
          const transaction = await this.connection.getTransaction(oldestSignature.signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'finalized'
          })

          if (!transaction || !transaction.meta) {
            this.logger.debug(`Transaction not found for signature: ${oldestSignature.signature}`)
            return null
          }

          // ✅ Extract creator - fee payer (first account) is typically the creator
          const accountKeys = transaction.transaction.message.getAccountKeys()
          
          if (accountKeys.length > 0) {
            const creator = accountKeys.get(0)?.toBase58()
            this.logger.debug(`Found account creator for ${pubkey}: ${creator}`)
            return creator || null
          }

          this.logger.debug(`No account keys found in transaction`)
          return null
          
        } catch (error) {
          this.logger.error(`Error getting account creator for ${pubkey}:`, error)
          throw new Error(`Failed to get account creator: ${error.message}`)
        }
      },
      {
        retries: this.config.maxRetries,
        factor: 2,
        minTimeout: this.config.retryDelayMs,
        onRetry: (error, attempt) => {
          this.logger.warn(
            `Failed to get account creator for ${pubkey}, attempt ${attempt}: ${error.message}`,
          )
        },
      },
    )
  }

  // Helper method to parse token account data manually
  private parseTokenAccountData(accountInfo: AccountInfo<Buffer>): UiTokenAccount | null {
    try {
      // Use SPL Token AccountLayout to decode the account data
      const accountData = AccountLayout.decode(accountInfo.data)
      
      // Convert to UiTokenAccount format
      const tokenAccount: UiTokenAccount = {
        mint: new PublicKey(accountData.mint).toBase58(),
        owner: new PublicKey(accountData.owner).toBase58(),
        tokenAmount: {
          amount: accountData.amount.toString(),
          decimals: 0, // Token decimals are not in the account data
          uiAmount: null,
          uiAmountString: accountData.amount.toString()
        },
        state: this.parseAccountState(accountData.state),
        isNative: accountData.isNative !== 0n,
        rentExemptReserve: accountData.isNative !== 0n ? accountData.isNative.toString() : undefined
      }

      // Add optional fields if they exist
      if (accountData.delegateOption === 1) {
        tokenAccount.delegate = new PublicKey(accountData.delegate).toBase58()
        tokenAccount.delegatedAmount = {
          amount: accountData.delegatedAmount.toString(),
          decimals: 0,
          uiAmount: null,
          uiAmountString: accountData.delegatedAmount.toString()
        }
      }

      if (accountData.closeAuthorityOption === 1) {
        tokenAccount.closeAuthority = new PublicKey(accountData.closeAuthority).toBase58()
      }

      return tokenAccount
    } catch (error) {
      this.logger.error('Error parsing token account data:', error)
      return null
    }
  }

  // Helper method to parse account state
  private parseAccountState(state: number): 'initialized' | 'uninitialized' | 'frozen' {
    switch (state) {
      case 0:
        return 'uninitialized'
      case 1:
        return 'initialized'
      case 2:
        return 'frozen'
      default:
        return 'uninitialized'
    }
  }
}
