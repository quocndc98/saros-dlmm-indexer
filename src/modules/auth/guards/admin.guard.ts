import { ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { JWT_STRATEGY_NAME } from '../strategies/jwt.strategy'
import { AuthJwtPayload } from '../types'

@Injectable()
export class AdminAuthGuard extends AuthGuard(JWT_STRATEGY_NAME) {
  async canActivate(context: ExecutionContext) {
    await super.canActivate(context)

    const request = context.switchToHttp().getRequest<Request>()
    const authPayload: AuthJwtPayload = request['user'] ?? null

    if (authPayload.role !== 'admin') {
      throw new ForbiddenException('You are not authorized to access this resource')
    }

    return true
  }
}
