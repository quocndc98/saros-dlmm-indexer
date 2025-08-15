import { ArgumentsHost, HttpException, Logger } from '@nestjs/common'
import { isArray } from 'class-validator'
import { Request, Response } from 'express'
import { sendAlert } from './alert'

export const catchHttpException = (exception: HttpException, host: ArgumentsHost) => {
  const ctx = host.switchToHttp()
  const request = ctx.getRequest<Request>()
  const response = ctx.getResponse<Response>()
  const status = exception.getStatus()
  const exResponse = exception.getResponse()
  let message = exception.message
  if (typeof exResponse === 'object') {
    message = exResponse['message'] ?? exResponse
  }
  const path = request.url
  const body = request.body
  const success = false
  const timestamp = Date.now()

  if (status >= 500) {
    Logger.error(exception)
    sendAlert(
      JSON.stringify({
        status,
        path,
        body,
        message: exception.message,
        stack: exception.stack,
      }),
    )
  }

  response.status(status).json({
    errors: isArray(message) ? message : [message],
    status,
    success,
    path,
    timestamp,
  })
}
