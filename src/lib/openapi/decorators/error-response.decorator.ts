import { applyDecorators } from '@nestjs/common'
import { ApiBadRequestResponse, ApiInternalServerErrorResponse } from '@nestjs/swagger'
import { ApiErrorResponseType } from '../helpers'

export const ApiValidationErrorResponse = () => {
  return applyDecorators(
    ApiBadRequestResponse({
      type: ApiErrorResponseType,
    }),
  )
}

export const ApiServerErrorResponse = () => {
  return applyDecorators(
    ApiInternalServerErrorResponse({
      type: ApiErrorResponseType,
    }),
  )
}
