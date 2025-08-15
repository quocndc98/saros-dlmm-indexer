import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

export class PaginationDto {
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(10_000)
  @ApiPropertyOptional({ default: 0 })
  @Transform(({ value }) => Number(value))
  offset?: number = 0

  @IsInt()
  @Max(100)
  @IsOptional()
  @ApiPropertyOptional({ default: 20 })
  @Transform(({ value }) => Number(value))
  limit?: number = 20
}
