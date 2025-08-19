import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_NAME } from './queue.constant'
import { REDIS_CLIENT } from '@/lib/modules/cache/cache.config'

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redisClient) => ({
        connection: redisClient,
      }),
    }),
    BullModule.registerQueue({
      name: QUEUE_NAME.TRANSACTION_SCANNER,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    }),
    // Indexer queues
    BullModule.registerQueue({
      name: QUEUE_NAME.TRANSACTION_PROCESSOR,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAME.SWAP_PROCESSOR,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAME.POSITION_PROCESSOR,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAME.CLOSE_POSITION_PROCESSOR,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAME.COMPOSITION_FEES_PROCESSOR,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAME.DLQ_PROCESSOR,
      defaultJobOptions: {
        attempts: 1,
        backoff: { type: 'fixed', delay: 5000 },
      },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAME.QUOTE_ASSET_PROCESSOR,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAME.INITIALIZE_PAIR_PROCESSOR,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAME.INITIALIZE_BIN_STEP_CONFIG_PROCESSOR,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAME.INITIALIZE_BIN_ARRAY_PROCESSOR,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }),
  ],
  providers: [],
  exports: [BullModule],
})
export class QueueModule {}
