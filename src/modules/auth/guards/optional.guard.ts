import { AuthGuard } from '@nestjs/passport'
import { ExecutionContext, Injectable } from '@nestjs/common'
import { JWT_STRATEGY_NAME } from '../strategies/jwt.strategy'

@Injectable()
export class OptionalAuthGuard extends AuthGuard(JWT_STRATEGY_NAME) {
  async canActivate(context: ExecutionContext) {
    try {
      await super.canActivate(context)
      return true
    } catch (error) {
      return true // Accept the request even if the user is not authenticated
    }
  }
}
