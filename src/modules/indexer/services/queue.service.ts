import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { Queue, Worker, QueueOptions, WorkerOptions, Job } from 'bullmq'
import { indexerConfig } from '../config/indexer.config'
import { QUEUE_NAMES } from '../constants/indexer.constants'
import { Logger, CacheService } from '@/lib'

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name)
  private queues = new Map<string, Queue>()
  private workers = new Map<string, Worker>()

  constructor(
    @Inject(indexerConfig.KEY)
    private readonly config: ConfigType<typeof indexerConfig>,
    private readonly cacheService: CacheService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing queue service...')
    await this.initializeQueues()
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down queue service...')

    // Close all workers
    for (const [name, worker] of this.workers) {
      this.logger.log(`Closing worker: ${name}`)
      await worker.close()
    }

    // Close all queues
    for (const [name, queue] of this.queues) {
      this.logger.log(`Closing queue: ${name}`)
      await queue.close()
    }
  }

  private async initializeQueues() {
    const redis = this.cacheService.getRedisClient()
    const queueOptions: QueueOptions = {
      connection: redis,
      defaultJobOptions: this.config.bullmq.defaultJobOptions,
    }

    // Initialize all queues
    for (const queueName of Object.values(QUEUE_NAMES)) {
      const queue = new Queue(queueName, queueOptions)
      this.queues.set(queueName, queue)
      this.logger.log(`Initialized queue: ${queueName}`)
    }
  }

  getQueue(queueName: string): Queue {
    const queue = this.queues.get(queueName)
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`)
    }
    return queue
  }

  async addJob(queueName: string, jobName: string, data: any, options?: any): Promise<Job> {
    const queue = this.getQueue(queueName)
    return await queue.add(jobName, data, options)
  }

  createWorker(
    queueName: string,
    processor: (job: Job) => Promise<any>,
    options?: Partial<WorkerOptions>,
  ): Worker {
    const redis = this.cacheService.getRedisClient()
    const defaultOptions: WorkerOptions = {
      connection: redis,
      concurrency: 1,
      ...options,
    }

    const worker = new Worker(queueName, processor, defaultOptions)

    worker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} completed in queue ${queueName}`)
    })

    worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed in queue ${queueName}: ${err.message}`)
    })

    worker.on('error', (err) => {
      this.logger.error(`Worker error in queue ${queueName}: ${err.message}`)
    })

    this.workers.set(`${queueName}-worker`, worker)
    this.logger.log(`Created worker for queue: ${queueName}`)

    return worker
  }

  async getQueueStatus(queueName: string) {
    const queue = this.getQueue(queueName)
    return {
      waiting: await queue.getWaiting(),
      active: await queue.getActive(),
      completed: await queue.getCompleted(),
      failed: await queue.getFailed(),
    }
  }

  async clearQueue(queueName: string) {
    const queue = this.getQueue(queueName)
    await queue.obliterate({ force: true })
    this.logger.log(`Cleared queue: ${queueName}`)
  }
}
