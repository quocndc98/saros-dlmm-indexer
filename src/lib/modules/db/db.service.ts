import { Injectable } from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { Connection } from 'mongoose'
import { Logger } from '../logger'

@Injectable()
export class DbService {
  private readonly logger: Logger = new Logger(DbService.name)

  constructor(@InjectConnection() private readonly connection: Connection) {
    if (this.connection.readyState === 1) {
      this.logger.log('✅ Already connected to MongoDB')
    } else {
      this.logger.log('⏳ Waiting for MongoDB connection...')
    }

    this.connection.on('connected', () => {
      this.logger.log('✅ Connected to MongoDB')
    })

    this.connection.on('error', (error) => {
      this.logger.error('❌ MongoDB connection error:', error)
    })

    this.connection.on('disconnected', () => {
      this.logger.warn('⚠️ MongoDB disconnected. Retrying...')
    })

    this.connection.on('reconnected', () => {
      this.logger.log('🔄 MongoDB reconnected!')
    })
  }
}
