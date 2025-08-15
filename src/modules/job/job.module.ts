import { Module } from '@nestjs/common'
import { JobService } from './job.service'

@Module({
  imports: [],
  providers: [JobService],
})
export class JobModule {}
