import { Injectable, Inject } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Job } from 'bullmq'
import { ConfigType } from '@nestjs/config'
import { PublicKey } from '@solana/web3.js'
import { getAccount, getMint } from '@solana/spl-token'
import { BaseProcessor } from './base.processor'
import { QuoteAsset } from '../schemas/quote-asset.schema'
import { SolanaService } from '../services/solana.service'
import { indexerConfig } from '../config/indexer.config'

interface TokenMetadata {
  symbol: string
  name: string
  decimals: number
}

@Injectable()
export class QuoteAssetProcessor extends BaseProcessor {
  constructor(
    @InjectModel(QuoteAsset.name)
    private readonly quoteAssetModel: Model<QuoteAsset>,
    private readonly solanaService: SolanaService,
    @Inject(indexerConfig.KEY)
    private readonly config: ConfigType<typeof indexerConfig>,
  ) {
    super('QuoteAssetProcessor')
  }

  async process(job: Job): Promise<void> {
    this.logJobStart(job)

    try {
      const { mintAddress } = job.data

      if (!mintAddress) {
        this.logger.warn('No mint address provided')
        return
      }

      const mint = new PublicKey(mintAddress)

      // Check if quote asset already exists
      const existingAsset = await this.quoteAssetModel.findOne({ mint: mint.toBase58() })
      if (existingAsset) {
        this.logger.debug(`Quote asset ${mint.toBase58()} already exists`)
        return
      }

      // Get token metadata
      const tokenMetadata = await this.getTokenMetadata(mint)
      if (!tokenMetadata) {
        this.logger.warn(`Failed to get metadata for token ${mint.toBase58()}`)
        return
      }

      // Get USD price from Gecko Terminal
      const priceUsd = await this.getTokenPrice(mint.toBase58())

      // Save quote asset
      const quoteAsset = new this.quoteAssetModel({
        mint: mint.toBase58(),
        symbol: tokenMetadata.symbol,
        name: tokenMetadata.name,
        decimals: tokenMetadata.decimals,
        price_usd: priceUsd || 0,
      })

      await quoteAsset.save()

      this.logger.log(`Added quote asset: ${tokenMetadata.symbol} (${mint.toBase58()})`)
      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing quote asset`)
    }
  }

  private async getTokenMetadata(mint: PublicKey): Promise<TokenMetadata | null> {
    try {
      const connection = this.solanaService.getConnection()

      // Get mint info
      const mintInfo = await getMint(connection, mint)

      // For known tokens, use hardcoded metadata
      const knownTokens = this.getKnownTokens()
      const known = knownTokens[mint.toBase58()]
      if (known) {
        return {
          symbol: known.symbol,
          name: known.name,
          decimals: mintInfo.decimals,
        }
      }

      // Try to get metadata from token metadata program
      // This is a simplified version - in production you'd want more robust metadata fetching
      return {
        symbol: mint.toBase58().slice(0, 8).toUpperCase(),
        name: `Token ${mint.toBase58().slice(0, 8)}`,
        decimals: mintInfo.decimals,
      }
    } catch (error) {
      this.logger.error(`Error getting token metadata for ${mint.toBase58()}:`, error)
      return null
    }
  }

  private async getTokenPrice(mintAddress: string): Promise<number | null> {
    try {
      // Use Gecko Terminal API to get token price
      const response = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mintAddress}`,
        {
          headers: {
            'Accept': 'application/json',
            'X-API-KEY': this.config.geckoTerminalApiKey,
          },
        }
      )

      if (!response.ok) {
        this.logger.warn(`Failed to get price for ${mintAddress}: ${response.status}`)
        return null
      }

      const data = await response.json()
      const priceUsd = data?.data?.attributes?.price_usd

      return priceUsd ? parseFloat(priceUsd) : null
    } catch (error) {
      this.logger.error(`Error getting token price for ${mintAddress}:`, error)
      return null
    }
  }

  private getKnownTokens(): Record<string, { symbol: string; name: string }> {
    return {
      [this.config.solanaWnativeAddress]: {
        symbol: 'SOL',
        name: 'Wrapped SOL',
      },
      [this.config.solanaUsdcAddress]: {
        symbol: 'USDC',
        name: 'USD Coin',
      },
      [this.config.solanaUsdtAddress]: {
        symbol: 'USDT',
        name: 'Tether USD',
      },
    }
  }
}
