import { Injectable, ExecutionContext } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

@Injectable()
export class ApiRateLimitGuard extends ThrottlerGuard {
  // Override the default tracking logic
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Use the user's ID for tracking if authenticated, else use the IP
    return req.user?.walletAddress || req.ip
  }

  // Customize the rate-limit based on user roles
  protected getLimit(context: ExecutionContext): number {
    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (user?.role === 'admin') {
      return 10 // Admins can make 10 requests in the TTL window
    } else {
      return 5 // Regular users get 5 requests
    }
  }
}
