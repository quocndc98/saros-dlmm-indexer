import {
  SecuritySchemeObject,
  ServerVariableObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

export type OpenApiSwaggerConfig = {
  title?: string
  description?: string
  version?: string
  authentication?: SecuritySchemeObject
  servers?: {
    url: string
    description?: string
    variables?: Record<string, ServerVariableObject>
  }[]
  useGlobalPrefix?: string
  path?: string
}

export const buildOpenApiDocument = async (
  app: INestApplication,
  openApiConfig: OpenApiSwaggerConfig,
) => {
  const configBuilder = new DocumentBuilder()
  if (openApiConfig.title) {
    configBuilder.setTitle(openApiConfig.title)
  }
  if (openApiConfig.description) {
    configBuilder.setDescription(openApiConfig.description)
  }
  if (openApiConfig.version) {
    configBuilder.setVersion(openApiConfig.version)
  }
  if (openApiConfig.authentication) {
    if (openApiConfig.authentication.type === 'apiKey') {
      configBuilder.addApiKey(openApiConfig.authentication)
    }
    if (
      openApiConfig.authentication.type === 'http' &&
      openApiConfig.authentication?.scheme === 'bearer'
    ) {
      configBuilder.addBearerAuth(openApiConfig.authentication)
    }
  }
  if (openApiConfig.servers?.length > 0) {
    for (const server of openApiConfig.servers) {
      configBuilder.addServer(server.url, server.description, server.variables)
    }
  }

  const useGlobalPrefix = openApiConfig.useGlobalPrefix ?? true
  const path = openApiConfig.path ?? 'docs'

  const document = SwaggerModule.createDocument(app, configBuilder.build())
  SwaggerModule.setup(path, app, document, {
    useGlobalPrefix: !!useGlobalPrefix,
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.css',
    ],
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.js',
    ],
  })

  return document
}
