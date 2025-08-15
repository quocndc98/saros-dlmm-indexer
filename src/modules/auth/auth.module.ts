import { Module } from '@nestjs/common'
import { AuthService } from './auth.service'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { authConfig, authConfigKey, AuthConfig } from './auth.config'
import { JWT_STRATEGY_NAME, JwtStrategy } from './strategies/jwt.strategy'

@Module({
  imports: [
    ConfigModule.forRoot({ load: [authConfig] }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const authConfig = configService.getOrThrow<AuthConfig>(authConfigKey)
        return {
          secret: authConfig.secretKey,
          signOptions: {
            expiresIn: authConfig.defaultExpiresIn,
          },
        }
      },
    }),
  ],
  controllers: [],
  providers: [AuthService, { provide: JWT_STRATEGY_NAME, useClass: JwtStrategy }],
  exports: [AuthService],
})
export class AuthModule {}
