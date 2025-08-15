import { Catch, ArgumentsHost, HttpException, ExceptionFilter } from '@nestjs/common'
import { catchHttpException } from './catches/http-exception'
import { catchInternalErrorException } from './catches'

@Catch()
export class GlobalExceptionsFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      return catchHttpException(exception, host)
    }
    return catchInternalErrorException(exception, host)
  }
}
