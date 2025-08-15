import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { ApiSuccessResponseType } from '../openapi'

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiSuccessResponseType<T>> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponseType<T>> {
    return next.handle().pipe(
      map((data) => {
        return {
          data,
          success: true,
          status: HttpStatus.OK,
          timestamp: Date.now(),
        }
      }),
    )
  }
}
