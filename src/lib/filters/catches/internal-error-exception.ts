import { ArgumentsHost, Logger } from '@nestjs/common'
import { Request, Response } from 'express'
import { sendAlert } from './alert'

export const catchInternalErrorException = (error: Error, host: ArgumentsHost) => {
  const ctx = host.switchToHttp()
  const request = ctx.getRequest<Request>()
  const response = ctx.getResponse<Response>()
  const message = 'Critical Server Error'
  const path = request.url
  const success = false
  const status = 500
  const timestamp = Date.now()

  Logger.error(error)
  sendAlert(
    JSON.stringify({
      status,
      path,
      message: error.message,
      stack: error.stack,
    }),
  )

  response.status(status).json({
    errors: [message],
    status,
    success,
    path,
    timestamp,
  })
}
