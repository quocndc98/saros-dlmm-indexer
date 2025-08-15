import { Injectable, Inject } from '@nestjs/common'
import { Logger } from '@/lib'
import { AuthJwtPayload } from './types'
import { JwtService } from '@nestjs/jwt'
import { authConfig } from './auth.config'
import { ConfigType } from '@nestjs/config'

@Injectable()
export class AuthService {
  private readonly logger: Logger = new Logger(AuthService.name)

  constructor(
    private readonly jwtService: JwtService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  issueAccessToken(payload: AuthJwtPayload) {
    const accessToken = this.jwtService.sign(payload)

    return accessToken
  }
}
