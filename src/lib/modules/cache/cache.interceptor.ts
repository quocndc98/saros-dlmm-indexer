import { CacheInterceptor as NestCacheInterceptor } from '@nestjs/cache-manager'
import { ExecutionContext } from '@nestjs/common'
import * as crypto from 'crypto';

const CACHE_KEY_METADATA = 'cache_module:cache_key'

export class CacheInterceptor extends NestCacheInterceptor {
  protected override isRequestCacheable(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    // By default, Only GET endpoints are cached. We add POST methods to the cacheable methods.
    return ['GET', 'POST'].includes(request.method);
  }

  protected override trackBy(context: ExecutionContext): string | undefined {
    const httpAdapter = this.httpAdapterHost.httpAdapter
    const isHttpApp = httpAdapter && !!httpAdapter.getRequestMethod
    const cacheMetadata = this.reflector.get(CACHE_KEY_METADATA, context.getHandler())

    if (!isHttpApp || cacheMetadata) {
      return cacheMetadata
    }

    if (!this.isRequestCacheable(context)) {
      return undefined
    }

    const request = context.getArgByIndex(0)
    const method = httpAdapter.getRequestMethod(request);
    const url = httpAdapter.getRequestUrl(request);

    // create a unique cache key based on request body for POST requests
    if (method === 'POST') {
      const body = JSON.stringify(request.body || {});
      const bodyHash = crypto.createHash('md5').update(body).digest('hex');
      return `POST:${url}:${bodyHash}`;
    }

    // Cache key for GET requests
    return `GET:${url}`;
  }
}
