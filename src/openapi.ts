import helmet from 'helmet'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { Logger, GlobalExceptionsFilter, TransformInterceptor, buildOpenApiDocument } from '@/lib'

export const bootstrap = async () => {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    cors: {
      origin: '*',
    },
  })
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: {
        policy: 'cross-origin',
      },
    }),
  )
  app.useLogger(app.get(Logger))
  app.useGlobalFilters(new GlobalExceptionsFilter())
  app.useGlobalInterceptors(new TransformInterceptor())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  app.setGlobalPrefix('/api')
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  })

  app.useBodyParser('json', {
    limit: '10mb',
  })

  const document = await buildOpenApiDocument(app, {
    title: 'Saros Aggregator Service API',
    description: 'OpenAPI documentation for Saros Aggregator Service',
    version: '1.0',
    authentication: {
      description: `[just text field] Please enter token in following format: Bearer <JWT>`,
      name: 'Authorization',
      bearerFormat: 'Bearer',
      scheme: 'bearer',
      type: 'http',
      in: 'Header',
    },
  })

  return { app, document }
}
