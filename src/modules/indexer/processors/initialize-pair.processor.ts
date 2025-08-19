import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Job } from 'bullmq'
import { BaseProcessor } from './base.processor'
import { SolanaService } from '../services/solana.service'
import { PartiallyDecodedInstruction, PublicKey } from '@solana/web3.js'
import { LiquidityBookLibrary } from '../../../liquidity-book/liquidity-book.library'
import { Pair, PairDocument } from '../schemas/pair.schema'
import { TokenMint, TokenMintDocument } from '../schemas/token-mint.schema'
import { BinStepConfig, BinStepConfigDocument } from '../schemas/bin-step-config.schema'
import { Metaplex } from '@metaplex-foundation/js'
import base58 from 'bs58'
import { InitializePairArgs } from '../../../liquidity-book/liquidity-book.type'
import { ParsedInstructionMessage } from '../types/indexer.types'

// Constants from Rust - identifier for initialize_pair instruction
const INITIALIZE_PAIR_IDENTIFIER = [177, 114, 226, 34, 186, 150, 5, 245]

interface InitializePairDecoded {
  active_id: number
  liquidity_book_config: string
  token_mint_x: string
  token_mint_y: string
  bin_step_config: string
  quote_asset_badge: string
  pair: string
}

@Injectable()
export class InitializePairProcessor extends BaseProcessor {
  private metaplex: Metaplex

  constructor(
    private readonly solanaService: SolanaService,
    @InjectModel(Pair.name) private readonly pairModel: Model<PairDocument>,
    @InjectModel(TokenMint.name) private readonly tokenMintModel: Model<TokenMintDocument>,
    @InjectModel(BinStepConfig.name)
    private readonly binStepConfigModel: Model<BinStepConfigDocument>,
  ) {
    super(InitializePairProcessor.name)

    // Initialize Metaplex for token metadata fetching
    this.metaplex = Metaplex.make(this.solanaService.getConnection())
  }

  async process(job: Job<ParsedInstructionMessage>): Promise<void> {
    this.logJobStart(job)

    try {
      const {
        blockNumber,
        signature,
        instruction,
        instructionIndex,
        innerInstructionIndex,
        isInner,
        blockTime,
      } = job.data

      this.logger.log(`Processing initialize pair instruction for signature: ${signature}`)
      this.logger.log(
        `Block number: ${blockNumber}, Index: ${instructionIndex}, Is inner: ${isInner}`,
      )

      // 1. Decode instruction data from raw instruction (matching Rust approach)
      const decoded = await this.decodeInitializePairInstruction(instruction)

      if (!decoded) {
        this.logger.warn('Failed to decode initialize pair instruction')
        return
      }

      this.logger.log(`Decoded initialize pair: ${JSON.stringify(decoded)}`)

      // 2. Process the pair creation
      await this.processInitializePair(decoded)

      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing initialize pair instruction`)
    }
  }

  private async decodeInitializePairInstruction(
    instruction: PartiallyDecodedInstruction,
  ): Promise<InitializePairDecoded | null> {
    try {
      const { idlIx, decodedIx } = LiquidityBookLibrary.decodeInstruction(instruction.data)
      const accounts = LiquidityBookLibrary.getAccountsByName(idlIx, instruction.accounts, [
        'liquidity_book_config',
        'token_mint_x',
        'token_mint_y',
        'bin_step_config',
        'quote_asset_badge',
        'pair',
      ])

      // Add type assertion for decodedIx.data
      const data = decodedIx.data as InitializePairArgs

      return {
        active_id: data.active_id,
        liquidity_book_config: accounts.liquidity_book_config.toString(),
        token_mint_x: accounts.token_mint_x.toString(),
        token_mint_y: accounts.token_mint_y.toString(),
        bin_step_config: accounts.bin_step_config.toString(),
        quote_asset_badge: accounts.quote_asset_badge.toString(),
        pair: accounts.pair.toString(),
      }
    } catch (error) {
      this.logger.error('Error decoding initialize pair instruction:', error)
      return null
    }
  }

  /**
   * Process initialize pair instruction
   * Matches Rust implementation exactly:
   * - Checks for existing pair, returns early if found
   * - Fetches bin step config, throws error if not found (no mock fallback)
   * - Fetches/creates token mints with onchain metadata
   * - Creates pair with all bin step config values copied over
   * - All operations should be wrapped in DB transaction for production
   */
  private async processInitializePair(decoded: InitializePairDecoded): Promise<void> {
    this.logger.log(`Creating pair ${decoded.pair} with active_id ${decoded.active_id}`)

    try {
      // TODO: Add MongoDB transaction back when ready for production
      // For now, do direct DB operations without transaction for quick testing
      // const session = await this.pairModel.db.startSession()
      //
      // await session.withTransaction(async () => {

      // 1. Check if pair already exists
      this.logger.log(`Checking if pair ${decoded.pair} already exists...`)
      const existingPair = await this.pairModel.findOne({ id: decoded.pair })

      if (existingPair) {
        this.logger.log(`Pair ${decoded.pair} already exists, skipping...`)
        return // Return true in Rust
      }

      // 2. Get bin step config - throw error if not found (matching Rust logic)
      this.logger.log(`Retrieving bin step config: ${decoded.bin_step_config}`)
      const binStepConfigs = await this.binStepConfigModel.find().lean()
      const binStepConfig = await this.binStepConfigModel
        .findOne({ id: decoded.bin_step_config })
        .lean()

      if (!binStepConfig) {
        throw new Error(`Bin step config doesn't exist for pair ${decoded.pair}`)
      }

      // 3. Handle token mint X
      const tokenMintX = await this.handleTokenMint(decoded.token_mint_x, 'X', null)

      // 4. Handle token mint Y
      const tokenMintY = await this.handleTokenMint(decoded.token_mint_y, 'Y', null)

      // 5. Create pair record with all data from bin step config (matching Rust)
      const pairData: Pair = {
        id: decoded.pair,
        binStep: binStepConfig.binStep,
        activeId: decoded.active_id,
        liquidityBookConfig: decoded.liquidity_book_config,
        binStepConfigId: decoded.bin_step_config,
        tokenMintXId: decoded.token_mint_x,
        tokenMintYId: decoded.token_mint_y,
        quoteAssetId: decoded.quote_asset_badge,
        name: `${tokenMintX.name}-${tokenMintY.name}`,
        symbol: `${tokenMintX.symbol}-${tokenMintY.symbol}`,
        // Copy bin step config values (matching Rust)
        baseFactor: binStepConfig.baseFactor,
        filterPeriod: binStepConfig.filterPeriod,
        decayPeriod: binStepConfig.decayPeriod,
        reductionFactor: binStepConfig.reductionFactor,
        variableFeeControl: binStepConfig.variableFeeControl,
        maxVolatilityAccumulator: binStepConfig.maxVolatilityAccumulator,
        protocolShare: binStepConfig.protocolShare,
        // Initialize with default values (matching Rust)
        volatilityAccumulator: 0,
        volatilityReference: 0,
        idReference: 0,
        timeLastUpdated: 0,
        protocolFeesX: '0',
        protocolFeesY: '0',
        reserveX: '0',
        reserveY: '0',
      }

      this.logger.log(`Creating pair with data: ${JSON.stringify(pairData, null, 2)}`)

      // Insert pair (without transaction for quick testing)
      await this.pairModel.create(pairData)

      this.logger.log(`Pair created successfully: ${decoded.pair}`)
      this.logger.log(`Pair processing completed for: ${decoded.pair}`)
    } catch (error) {
      this.logger.error(`Error processing initialize pair: ${error.message}`)
      throw error
    }
  }

  private async handleTokenMint(
    tokenMintId: string,
    label: string,
    session: any,
  ): Promise<TokenMintDocument | any> {
    this.logger.log(`Handling token mint ${label}: ${tokenMintId}`)

    try {
      // Check if token mint exists (matching Rust logic)
      let existingTokenMint = await this.tokenMintModel.findOne({ id: tokenMintId })

      if (existingTokenMint) {
        this.logger.log(`Token mint ${label} already exists: ${tokenMintId}`)
        return existingTokenMint
      }

      // Insert new token mint if doesn't exist (matching Rust)
      this.logger.log(`Token mint ${label} doesn't exist, creating new one: ${tokenMintId}`)
      const newTokenMint = await this.insertNewTokenMint(tokenMintId, session)

      return newTokenMint
    } catch (error) {
      this.logger.error(`Error handling token mint ${label} (${tokenMintId}): ${error.message}`)
      throw error
    }
  }

  private async fetchTokenInfo(tokenMintId: string): Promise<any> {
    try {
      // Fetch token account data from Solana
      const connection = this.solanaService.getConnection()
      const mintPubkey = new PublicKey(tokenMintId)

      // Get mint account data
      const mintInfo = await connection.getParsedAccountInfo(mintPubkey)

      if (!mintInfo.value) {
        throw new Error(`Token mint account not found: ${tokenMintId}`)
      }

      const mintData = mintInfo.value.data
      if ('parsed' in mintData) {
        const parsed = mintData.parsed
        return {
          decimals: parsed.info.decimals,
          supply: parsed.info.supply,
          mintAuthority: parsed.info.mintAuthority,
          freezeAuthority: parsed.info.freezeAuthority,
        }
      }

      return { raw: 'Unable to parse mint data' }
    } catch (error) {
      this.logger.error(`Error fetching token info for ${tokenMintId}: ${error.message}`)
      return { error: error.message }
    }
  }

  private async insertNewTokenMint(
    tokenMintId: string,
    session: any,
  ): Promise<TokenMintDocument | any> {
    this.logger.log(`Creating new token mint: ${tokenMintId}`)

    try {
      // Fetch token info from Solana (matching Rust get_account_data + get_token_mint_data)
      const tokenInfo = await this.fetchTokenInfo(tokenMintId)

      if (tokenInfo.error) {
        throw new Error(`Failed to get token mint data: ${tokenInfo.error}`)
      }

      // Fetch token metadata for name and symbol (matching Rust get_token_name_and_symbol_with_retry)
      const tokenMetadata = await this.fetchTokenMetadata(tokenMintId)

      const tokenMintData = {
        id: tokenMintId,
        chain: 'solana',
        supply: tokenInfo.supply?.toString() || '0',
        decimals: tokenInfo.decimals || 0,
        // Clean up null characters (matching Rust trim_end_matches('\0'))
        name: (tokenMetadata.name || 'Unknown').replace(/\0/g, ''),
        symbol: (tokenMetadata.symbol || 'UNKNOWN').replace(/\0/g, ''),
      }

      this.logger.log(`Creating token mint with data: ${JSON.stringify(tokenMintData)}`)

      // Insert token mint (without session for quick testing)
      const createdTokenMint = await this.tokenMintModel.create(tokenMintData)

      this.logger.log(`Token mint created: ${tokenMintId}`)
      return createdTokenMint
    } catch (error) {
      this.logger.error(`Error inserting token mint ${tokenMintId}: ${error.message}`)
      throw error
    }
  }

  private async fetchTokenMetadata(
    tokenMintId: string,
  ): Promise<{ name?: string; symbol?: string }> {
    try {
      this.logger.log(`Fetching metadata for token: ${tokenMintId}`)

      // Use Metaplex SDK to get token metadata (cleaner approach)
      const metadata = await this.metaplex.nfts().findByMint({
        mintAddress: new PublicKey(tokenMintId),
      })

      return {
        name: metadata.name || `Token ${tokenMintId.slice(0, 8)}`,
        symbol: metadata.symbol || `TK${tokenMintId.slice(0, 4)}`,
      }
    } catch (error) {
      this.logger.error(`Error fetching token metadata for ${tokenMintId}: ${error.message}`)

      // Fallback to basic metadata parsing if Metaplex fails
      try {
        return await this.fetchTokenMetadataFallback(tokenMintId)
      } catch (fallbackError) {
        this.logger.error(
          `Fallback metadata fetch also failed for ${tokenMintId}: ${fallbackError.message}`,
        )
        return {
          name: 'Unknown',
          symbol: 'UNKNOWN',
        }
      }
    }
  }

  private async fetchTokenMetadataFallback(
    tokenMintId: string,
  ): Promise<{ name?: string; symbol?: string }> {
    // Fallback method using raw account data parsing
    const connection = this.solanaService.getConnection()
    const mintPubkey = new PublicKey(tokenMintId)

    // Get metadata PDA
    const metadataProgram = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), metadataProgram.toBuffer(), mintPubkey.toBuffer()],
      metadataProgram,
    )

    // Fetch metadata account
    const metadataAccount = await connection.getAccountInfo(metadataPDA)

    if (!metadataAccount) {
      return {
        name: `Token ${tokenMintId.slice(0, 8)}`,
        symbol: `TK${tokenMintId.slice(0, 4)}`,
      }
    }

    // Parse metadata using basic parsing
    const metadata = this.parseTokenMetadata(metadataAccount.data)

    return {
      name: metadata.name || `Token ${tokenMintId.slice(0, 8)}`,
      symbol: metadata.symbol || `TK${tokenMintId.slice(0, 4)}`,
    }
  }

  private parseTokenMetadata(data: Buffer): { name?: string; symbol?: string } {
    try {
      // Basic metadata parsing (simplified version)
      // In production, you might want to use @metaplex-foundation/js for proper parsing

      // Skip discriminator and other fields to get to name/symbol
      // This is a simplified parser - the actual Metaplex format is more complex
      const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength)

      // Try to find readable strings that look like name/symbol
      const dataStr = data.toString('utf8', 0, Math.min(data.length, 500))

      // Extract potential name and symbol using regex
      const nameMatch = dataStr.match(/[A-Za-z][A-Za-z0-9\s]{2,31}/)
      const symbolMatch = dataStr.match(/[A-Z]{2,10}/)

      return {
        name: nameMatch ? nameMatch[0].trim() : undefined,
        symbol: symbolMatch ? symbolMatch[0].trim() : undefined,
      }
    } catch (error) {
      this.logger.error(`Error parsing token metadata: ${error.message}`)
      return {}
    }
  }
}
