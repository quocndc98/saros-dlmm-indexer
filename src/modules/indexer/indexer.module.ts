import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ConfigModule } from '@nestjs/config'
import { QueueModule } from '../queue/queue.module'
import { CacheModule } from '@/lib/modules/cache/cache.module'

// Config
import { indexerConfig } from './config/indexer.config'

// Schemas
import { TransactionEvent, TransactionEventSchema } from './schemas/transaction-event.schema'
import { SwapEvent, SwapEventSchema } from './schemas/swap-event.schema'
import { BinSwapEvent, BinSwapEventSchema } from './schemas/bin-swap-event.schema'
import { Position, PositionSchema } from './schemas/position.schema'
import { PositionUpdateEvent, PositionUpdateEventSchema } from './schemas/position-update-event.schema'
import { CompositionFeesEvent, CompositionFeesEventSchema } from './schemas/composition-fees-event.schema'
import { DlqEvent, DlqEventSchema } from './schemas/dlq-event.schema'
import { QuoteAsset, QuoteAssetSchema } from './schemas/quote-asset.schema'
import { Pair, PairSchema } from './schemas/pair.schema'
import { TokenMint, TokenMintSchema } from './schemas/token-mint.schema'
import { BinStepConfig, BinStepConfigSchema } from './schemas/bin-step-config.schema'

// Services
import { SolanaService } from './services/solana.service'
import { TransactionParserService } from './services/transaction-parser.service'

// Scanner
import { ScannerService } from './scanner/scanner.service'

// Processors
import { TransactionProcessor } from './processors/transaction.processor'
import { SwapProcessor } from './processors/swap.processor'
import { PositionProcessor } from './processors/position.processor'
import { CompositionFeesProcessor } from './processors/composition-fees.processor'
import { InitializePairProcessor } from './processors/initialize-pair.processor'
import { InitializeBinStepConfigProcessor } from './processors/initialize-bin-step-config.processor'
import { DlqProcessor } from './processors/dlq.processor'
import { QuoteAssetProcessor } from './processors/quote-asset.processor'

// Consumer
import { ConsumerService } from './consumer/consumer.service'

// Jobs
import { ScannerJobService } from './jobs/scanner-job.service'
import { ConsumerJobService } from './jobs/consumer-job.service'

// Controllers
import { IndexerController } from './controllers/indexer.controller'

@Module({
  imports: [
    ConfigModule.forRoot({ load: [indexerConfig] }),
    CacheModule,
    QueueModule,
    MongooseModule.forFeature([
      { name: TransactionEvent.name, schema: TransactionEventSchema },
      { name: SwapEvent.name, schema: SwapEventSchema },
      { name: BinSwapEvent.name, schema: BinSwapEventSchema },
      { name: Position.name, schema: PositionSchema },
      { name: PositionUpdateEvent.name, schema: PositionUpdateEventSchema },
      { name: CompositionFeesEvent.name, schema: CompositionFeesEventSchema },
      { name: DlqEvent.name, schema: DlqEventSchema },
      { name: QuoteAsset.name, schema: QuoteAssetSchema },
      { name: Pair.name, schema: PairSchema },
      { name: TokenMint.name, schema: TokenMintSchema },
      { name: BinStepConfig.name, schema: BinStepConfigSchema },
    ]),
  ],
  controllers: [IndexerController],
  providers: [
    // Services
    SolanaService,
    TransactionParserService,

    // Scanner
    ScannerService,

    // Processors
    TransactionProcessor,
    SwapProcessor,
    PositionProcessor,
    CompositionFeesProcessor,
    InitializePairProcessor,
    InitializeBinStepConfigProcessor,
    DlqProcessor,
    QuoteAssetProcessor,

    // Consumer
    ConsumerService,

    // Jobs
    ScannerJobService,
    ConsumerJobService,
  ],
  exports: [
    SolanaService,
    ScannerService,
    ConsumerService,
    ScannerJobService,
    ConsumerJobService,
  ],
})
export class IndexerModule {}
