import { Injectable } from '@nestjs/common'
import { Job } from 'bullmq'
import { Logger } from '@/lib'

@Injectable()
export abstract class BaseProcessor {
  protected readonly logger: Logger

  constructor(name: string) {
    this.logger = new Logger(name)
  }

  abstract process(job: Job): Promise<any>

  protected async handleError(error: any, context: string): Promise<void> {
    this.logger.error(`Error in ${context}:`, error)
    throw error
  }

  protected logJobStart(job: Job): void {
    this.logger.debug(`Starting job ${job.id} with data: ${JSON.stringify(job.data)}`)
  }

  protected logJobComplete(job: Job): void {
    this.logger.debug(`Completed job ${job.id}`)
  }
}
