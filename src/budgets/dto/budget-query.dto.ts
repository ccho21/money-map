import { IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BudgetQueryDto {
  @ApiPropertyOptional({ description: '시작일 (YYYY-MM-DD)' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: '종료일 (YYYY-MM-DD)' })
  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly', 'yearly'])
  groupBy?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}
