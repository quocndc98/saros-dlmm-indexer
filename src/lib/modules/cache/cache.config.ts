import { registerAs } from '@nestjs/config'
import { env, envAsBoolean } from '@/lib'

export type CacheConfig = {
  redis: {
    url: string
    tls?: any
  }
}

export const cacheConfigKey = 'cache'

export const cacheConfig = registerAs<CacheConfig>(cacheConfigKey, () => ({
  redis: {
    url: env('REDIS_URL', 'redis://127.0.0.1:6379'),
    tls: envAsBoolean('REDIS_TLS', true) ? {} : undefined,
  },
}))

export const REDIS_CLIENT = 'REDIS_CLIENT'
