import { applyDecorators } from '@nestjs/common'
import { ApiHeader } from '@nestjs/swagger'

export function ApiOnchainAuth() {
  return applyDecorators(
    ApiHeader({
      name: 'x-auth-message',
      description: 'Onchain authentication message',
      required: true,
    }),
    ApiHeader({
      name: 'x-auth-signature',
      description: 'Onchain authentication signature',
      required: true,
    }),
  )
}
