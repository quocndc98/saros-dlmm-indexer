import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Logger } from '@/lib'

@Injectable()
export class JobService {
  private readonly logger: Logger = new Logger(JobService.name)

  constructor() {}

  @Cron(CronExpression.EVERY_HOUR)
  async demoJob() {
    this.logger.log('Run demo job')
  }
}
