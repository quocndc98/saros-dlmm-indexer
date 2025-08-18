import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TransactionProcessor } from '../processors/transaction.processor'
import { SwapProcessor } from '../processors/swap.processor'
import { PositionProcessor } from '../processors/position.processor'
import { CompositionFeesProcessor } from '../processors/composition-fees.processor'
import { DlqProcessor } from '../processors/dlq.processor'
import { QuoteAssetProcessor } from '../processors/quote-asset.processor'
import { InitializePairProcessor } from '../processors/initialize-pair.processor'
import { InitializeBinStepConfigProcessor } from '../processors/initialize-bin-step-config.processor'
import { InitializeBinArrayProcessor } from '../processors/initialize-bin-array.processor'
import { QUEUE_NAME } from '../../queue/queue.constant'
import { Logger } from '@/lib'
import { Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { cacheConfigKey, CacheConfig } from '@/lib/modules/cache/cache.config'

@Injectable()
export class ConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConsumerService.name)
  private workers: Worker[] = []

  constructor(
    private readonly configService: ConfigService,
    private readonly transactionProcessor: TransactionProcessor,
    private readonly swapProcessor: SwapProcessor,
    private readonly positionProcessor: PositionProcessor,
    private readonly compositionFeesProcessor: CompositionFeesProcessor,
    private readonly initializePairProcessor: InitializePairProcessor,
    private readonly initializeBinStepConfigProcessor: InitializeBinStepConfigProcessor,
    private readonly initializeBinArrayProcessor: InitializeBinArrayProcessor,
    private readonly dlqProcessor: DlqProcessor,
    private readonly quoteAssetProcessor: QuoteAssetProcessor,
  ) {}

  async onModuleInit() {
    this.logger.log('Starting consumer workers...')
    await this.startWorkers()
  }

  async onModuleDestroy() {
    this.logger.log('Stopping consumer workers...')
    await this.stopWorkers()
  }

  private async startWorkers() {
    // Create Redis connection for BullMQ workers with correct config
    const cacheConfig = this.configService.getOrThrow<CacheConfig>(cacheConfigKey)
    const redisConnection = new Redis(cacheConfig.redis.url, {
      maxRetriesPerRequest: null, // Required for BullMQ
      retryStrategy: (times) => Math.min(times * 50, 2000),
      tls: cacheConfig.redis.tls,
    })

    // Transaction processor worker
    const transactionWorker = new Worker(
      QUEUE_NAME.TRANSACTION_PROCESSOR,
      async (job) => await this.transactionProcessor.process(job),
      {
        connection: redisConnection,
        concurrency: 2
      }
    )
    this.workers.push(transactionWorker)

    // Swap processor worker
    const swapWorker = new Worker(
      QUEUE_NAME.SWAP_PROCESSOR,
      async (job) => await this.swapProcessor.process(job),
      {
        connection: redisConnection,
        concurrency: 5
      }
    )
    this.workers.push(swapWorker)

    // Position processor worker
    const positionWorker = new Worker(
      QUEUE_NAME.POSITION_PROCESSOR,
      async (job) => await this.positionProcessor.process(job),
      {
        connection: redisConnection,
        concurrency: 3
      }
    )
    this.workers.push(positionWorker)

    // Composition fees processor worker
    const compositionFeesWorker = new Worker(
      QUEUE_NAME.COMPOSITION_FEES_PROCESSOR,
      async (job) => await this.compositionFeesProcessor.process(job),
      {
        connection: redisConnection,
        concurrency: 3
      }
    )
    this.workers.push(compositionFeesWorker)

    // Initialize pair processor worker
    const initializePairWorker = new Worker(
      QUEUE_NAME.INITIALIZE_PAIR_PROCESSOR,
      async (job) => await this.initializePairProcessor.process(job),
      {
        connection: redisConnection,
        concurrency: 3
      }
    )
    this.workers.push(initializePairWorker)

    // Initialize bin step config processor worker
    const initializeBinStepConfigWorker = new Worker(
      QUEUE_NAME.INITIALIZE_BIN_STEP_CONFIG_PROCESSOR,
      async (job) => await this.initializeBinStepConfigProcessor.process(job),
      {
        connection: redisConnection,
        concurrency: 3
      }
    )
    this.workers.push(initializeBinStepConfigWorker)

    // Initialize bin array processor worker
    const initializeBinArrayWorker = new Worker(
      QUEUE_NAME.INITIALIZE_BIN_ARRAY_PROCESSOR,
      async (job) => await this.initializeBinArrayProcessor.process(job),
      {
        connection: redisConnection,
        concurrency: 2
      }
    )
    this.workers.push(initializeBinArrayWorker)

    // DLQ processor worker
    const dlqWorker = new Worker(
      QUEUE_NAME.DLQ_PROCESSOR,
      async (job) => await this.dlqProcessor.process(job),
      {
        connection: redisConnection,
        concurrency: 1
      }
    )
    this.workers.push(dlqWorker)

    // Quote asset processor worker
    const quoteAssetWorker = new Worker(
      QUEUE_NAME.QUOTE_ASSET_PROCESSOR,
      async (job) => await this.quoteAssetProcessor.process(job),
      {
        connection: redisConnection,
        concurrency: 2
      }
    )
    this.workers.push(quoteAssetWorker)

    this.logger.log(`Started ${this.workers.length} consumer workers`)
  }

  private async stopWorkers() {
    for (const worker of this.workers) {
      try {
        await worker.close()
      } catch (error) {
        this.logger.error('Error stopping worker:', error)
      }
    }
    this.workers = []
  }

  async getStatus() {
    const status = {}
    const queueNames = Object.values(QUEUE_NAME)

    for (const queueName of queueNames) {
      try {
        // Get basic queue stats from workers
        const worker = this.workers.find(w => w.name === queueName)
        if (worker) {
          status[queueName] = {
            name: worker.name,
            concurrency: worker.opts.concurrency || 1,
            running: !worker.closing,
          }
        } else {
          status[queueName] = { error: 'Worker not found' }
        }
      } catch (error) {
        status[queueName] = { error: error.message }
      }
    }

    return {
      workersCount: this.workers.length,
      queues: status,
    }
  }
}
