import { Logger } from '../logger'
import { CacheService } from './cache.service'
import { Global, Module } from '@nestjs/common'
import { redisInsStore } from 'cache-manager-ioredis-yet'
import { Redis, type RedisOptions } from 'ioredis'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import { cacheConfig, cacheConfigKey, CacheConfig, REDIS_CLIENT } from './cache.config'

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ load: [cacheConfig] }),
    NestCacheModule.registerAsync<RedisOptions>({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('CacheModule')
        const cacheConfig = configService.getOrThrow<CacheConfig>(cacheConfigKey)
        const redis = new Redis(cacheConfig.redis.url, {
          retryStrategy: (times) => {
            if (times > 200) {
              logger.error('Cannot reconnect to redis after 200 times.')
              return undefined
            }
            return Math.min(times * 50, 2000)
          },
          tls: cacheConfig.redis.tls,
        })

        redis.on('ready', () => logger.log('✅ Connected to Redis'))
        redis.on('error', (err) => logger.error('❌ Redis connection error: ' + err.message))
        redis.on('reconnecting', () => logger.warn('🔄 Redis reconnecting...'))

        return {
          lazyConnect: true,
          store: (c: any) => redisInsStore(redis, c),
        }
      },
    }),
  ],
  providers: [
    CacheService,
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const cacheConfig = configService.getOrThrow<CacheConfig>(cacheConfigKey)
        return new Redis(cacheConfig.redis.url, {
          maxRetriesPerRequest: null, // BullMQ requires the maxRetriesPerRequest option in the Redis client configuration to be explicitly set to null
        })
      },
    },
  ],
  exports: [CacheService, REDIS_CLIENT],
})
export class CacheModule {}
