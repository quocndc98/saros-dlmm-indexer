import { ConfigModule, ConfigService } from '@nestjs/config'
import { DynamicModule, Logger, Module } from '@nestjs/common'
import { DbConfig, dbConfig, dbConfigKey } from './db.config'
import { MongooseModule } from '@nestjs/mongoose'
import { DbService } from './db.service'

export interface DbModuleOptions {
  isGlobal?: boolean
}

@Module({
  imports: [
    ConfigModule.forRoot({ load: [dbConfig] }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const dbConfig = configService.get<DbConfig>(dbConfigKey)
        return { uri: dbConfig.uri, autoIndex: true }
      },
      inject: [ConfigService],
    }),
  ],
  providers: [DbService, Logger],
  exports: [DbService, MongooseModule],
})

export class DbModule {
  static register(options: DbModuleOptions): DynamicModule {
    return {
      module: DbModule,
      global: !!options?.isGlobal,
    }
  }
}
