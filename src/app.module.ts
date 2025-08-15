import { Module } from '@nestjs/common'
import { DbModule, LoggerModule } from '@/lib'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { HealthModule } from '@/modules/health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { IndexerModule } from './modules/indexer/indexer.module'
import { ScheduleModule } from '@nestjs/schedule'
import { APP_GUARD } from '@nestjs/core'

@Module({
  imports: [
    DbModule,
    LoggerModule,
    AuthModule,
    IndexerModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1_000,
        limit: 3, // 3 requests per second
      },
      {
        name: 'medium',
        ttl: 10_000,
        limit: 20, // 20 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60_000,
        limit: 100, // 100 requests per minute
      },
    ]),
    HealthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
