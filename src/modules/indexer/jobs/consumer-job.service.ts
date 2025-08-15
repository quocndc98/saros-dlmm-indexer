import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { ConsumerService } from '../consumer/consumer.service'
import { Logger } from '@/lib'

@Injectable()
export class ConsumerJobService {
  private readonly logger: Logger = new Logger(ConsumerJobService.name)

  constructor(private readonly consumerService: ConsumerService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async healthCheck() {
    this.logger.debug('Consumer health check')
    // Add any health check logic here if needed
    // The consumer service is already running workers automatically
  }

  async getStatus() {
    return await this.consumerService.getStatus()
  }
}
