import { Injectable, BadRequestException } from '@nestjs/common'
import { CacheService, Milliseconds } from '@/lib'

@Injectable()
export class RateLimitService {
  constructor(private readonly cacheService: CacheService) {}

  async check({ key, limit, ttl }: { key: string; limit: number; ttl: Milliseconds }) {
    const currentLimit = await this.cacheService.incr(key)
    if (currentLimit === 1) {
      await this.cacheService.pexpire(key, ttl)
    }
    if (currentLimit > limit) {
      throw new BadRequestException(`You have reached the rate limit`)
    }
  }
}
