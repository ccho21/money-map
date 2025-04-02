import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionFilterDTO {
  @ApiPropertyOptional({
    enum: ['income', 'expense'],
    description: '거래 타입',
  })
  @IsOptional()
  @IsEnum(['income', 'expense'])
  type?: 'income' | 'expense';

  @ApiPropertyOptional({ description: '카테고리 ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: '시작일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '검색어 (메모 등)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['date', 'amount'], default: 'date' })
  @IsOptional()
  @IsEnum(['date', 'amount'])
  sort?: 'date' | 'amount';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class BaseDateQueryDTO {
  @Type(() => Number)
  @IsInt()
  year: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  day?: number;
}
export class DateQueryDTO extends BaseDateQueryDTO {}

export class SummaryRangeQueryDTO {
  @IsEnum(['daily', 'weekly', 'monthly', 'yearly'])
  groupBy: 'daily' | 'weekly' | 'monthly' | 'yearly';

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
