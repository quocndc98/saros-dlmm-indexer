import { Injectable, Inject } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue, Job } from 'bullmq'
import { QUEUE_NAME } from '../../queue/queue.constant'
import { Logger } from '@/lib'

@Injectable()
export class IndexerQueueService {
  private readonly logger = new Logger(IndexerQueueService.name)

  constructor(
    @InjectQueue(QUEUE_NAME.TRANSACTION_PROCESSOR)
    private readonly transactionQueue: Queue,
    @InjectQueue(QUEUE_NAME.SWAP_PROCESSOR)
    private readonly swapQueue: Queue,
    @InjectQueue(QUEUE_NAME.POSITION_PROCESSOR)
    private readonly positionQueue: Queue,
    @InjectQueue(QUEUE_NAME.COMPOSITION_FEES_PROCESSOR)
    private readonly compositionFeesQueue: Queue,
    @InjectQueue(QUEUE_NAME.DLQ_PROCESSOR)
    private readonly dlqQueue: Queue,
    @InjectQueue(QUEUE_NAME.QUOTE_ASSET_PROCESSOR)
    private readonly quoteAssetQueue: Queue,
  ) {}

  getQueue(queueName: string): Queue {
    switch (queueName) {
      case QUEUE_NAME.TRANSACTION_PROCESSOR:
        return this.transactionQueue
      case QUEUE_NAME.SWAP_PROCESSOR:
        return this.swapQueue
      case QUEUE_NAME.POSITION_PROCESSOR:
        return this.positionQueue
      case QUEUE_NAME.COMPOSITION_FEES_PROCESSOR:
        return this.compositionFeesQueue
      case QUEUE_NAME.DLQ_PROCESSOR:
        return this.dlqQueue
      case QUEUE_NAME.QUOTE_ASSET_PROCESSOR:
        return this.quoteAssetQueue
      default:
        throw new Error(`Queue ${queueName} not found`)
    }
  }

  async addJob(queueName: string, jobName: string, data: any, options?: any): Promise<Job> {
    const queue = this.getQueue(queueName)
    return await queue.add(jobName, data, options)
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
