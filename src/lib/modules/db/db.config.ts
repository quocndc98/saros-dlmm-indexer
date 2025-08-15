import { registerAs } from '@nestjs/config'
import { envOrThrow } from '../../utils'

export type DbConfig = {
  uri: string
}

export const dbConfigKey = 'database'

export const dbConfig = registerAs<DbConfig>(dbConfigKey, () => ({
  uri: envOrThrow('MONGODB_URI'),
}))
