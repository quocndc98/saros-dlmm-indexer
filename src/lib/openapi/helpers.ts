import { HttpStatus } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { Expose } from 'class-transformer'

export class ApiSuccessResponseType<TModel> {
  @ApiProperty({
    description: 'Indicate as success API success call',
  })
  success: true

  @ApiProperty({
    description: 'API response status',
    example: HttpStatus.OK,
  })
  status: HttpStatus

  @ApiProperty({
    description: 'API response at time',
    example: 689187600000,
  })
  timestamp: number

  // No decorate
  data: TModel
}

export class ApiPaginatedResponse<TModel> {
  @ApiProperty({
    description: 'Total records in database',
    example: 100,
  })
  @Expose()
  total: number

  @ApiProperty({
    description: 'Limit records per call',
    example: 10,
  })
  @Expose()
  limit: number

  @ApiProperty({
    description: 'Record offset in current call',
    example: 20,
  })
  @Expose()
  offset: number

  @Expose()
  results: TModel[]
}

export class ApiErrorResponseType {
  @ApiProperty({
    description: 'Indicate as failed API call',
    example: false,
  })
  success: false

  @ApiProperty({
    description: 'API response status',
  })
  status: HttpStatus

  @ApiProperty({
    description: 'API response at time',
    example: 689187600000,
  })
  timestamp: number

  @ApiProperty({
    description: 'Current API path',
  })
  path: string

  @ApiProperty({
    description: 'API errors',
    example: ['Error message will be here'],
  })
  errors: string[]
}
