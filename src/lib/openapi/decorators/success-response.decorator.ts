import { Type, applyDecorators } from '@nestjs/common'
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger'
import { ApiPaginatedResponse, ApiSuccessResponseType } from '../helpers'

export const ApiSuccessResponse = <TModel extends Type<unknown>>(model: TModel) => {
  return applyDecorators(
    ApiExtraModels(ApiSuccessResponseType),
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiSuccessResponseType) },
          {
            properties: {
              data: { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  )
}

export const ApiPaginatedSuccessResponse = <TModel extends Type<unknown>>(model: TModel) => {
  return applyDecorators(
    ApiExtraModels(ApiSuccessResponseType),
    ApiExtraModels(ApiPaginatedResponse),
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiSuccessResponseType) },
          {
            properties: {
              data: {
                allOf: [
                  { $ref: getSchemaPath(ApiPaginatedResponse) },
                  {
                    properties: {
                      results: {
                        type: 'array',
                        items: { $ref: getSchemaPath(model) },
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    }),
  )
}
