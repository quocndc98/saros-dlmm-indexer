import { registerAs } from '@nestjs/config'
import { envOrThrow } from '@/lib'

const maxExpiresIn = 365 * 24 * 60 * 60 // 1 year
const defaultExpiresIn = 30 * 24 * 60 * 60 // 1 month

export type AuthConfig = {
  secretKey: string
  defaultExpiresIn: number
  maxExpiresIn: number
}

export const authConfigKey = 'auth'

export const authConfig = registerAs<AuthConfig>(authConfigKey, () => ({
  secretKey: envOrThrow('SECRET_KEY'),
  defaultExpiresIn,
  maxExpiresIn,
}))
