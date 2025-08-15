import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Injectable, Inject } from '@nestjs/common'
import { RedisCache } from 'cache-manager-ioredis-yet'

export type Milliseconds = number

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: RedisCache) {}

  async get<T>(key: string, defaultValue?: T) {
    const data = await this.cacheManager.get<T>(key)
    if (data === undefined) {
      return defaultValue
    }
    return data
  }

  /**
   * Set a value in the cache.
   * @param key The key to set.
   * @param value The value to set.
   * @param ttl The time to live in milliseconds.
   */
  async set(key: string, value: unknown, ttl?: Milliseconds) {
    return this.cacheManager.set(key, value, ttl)
  }

  async del(key: string) {
    return this.cacheManager.del(key)
  }

  /**
   * Delete multiple key
   * @param keys List of key want to delete
   */
  async delAll(keys: string[]) {
    return this.cacheManager.store.mdel(...keys)
  }

  /**
   * Get the time to live for a key in milliseconds
   * @param key The key to get the time to live.
   * @returns The time to live of the key in milliseconds.
   */
  async ttl(key: string): Promise<Milliseconds> {
    return this.cacheManager.store.ttl(key)
  }

  /**
   * Increment the integer value of a key by one
   * @param key - The key to increment.
   * @returns The new value after incrementing.
   */
  async incr(key: string) {
    return this.cacheManager.store.client.incr(key)
  }

  /**
   * Set a key's time to live in milliseconds
   * @param key The key to set the expiration for.
   * @param ttl Time-to-live in milliseconds.
   */
  async pexpire(key: string, ttl: Milliseconds) {
    return this.cacheManager.store.client.pexpire(key, ttl)
  }

  /**
   * Get the Redis client for BullMQ and other direct Redis operations
   */
  getRedisClient() {
    return this.cacheManager.store.client
  }
}
