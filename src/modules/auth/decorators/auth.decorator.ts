import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { AuthJwtPayload, AuthOnchainPayload } from '../types'

export const CurrentAuth = createParamDecorator((_data, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<Request>()
  const data: AuthJwtPayload | AuthOnchainPayload = request['user'] ?? null

  return data
})
