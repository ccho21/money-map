import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { GroupBy } from '../types/types';
import { CategoryType } from '@prisma/client';

export class BaseListSummaryResponseDTO<T> {
  @ApiProperty()
  @IsString()
  startDate: string;

  @ApiProperty()
  @IsString()
  endDate: string;

  @ApiProperty({ enum: CategoryType })
  type?: CategoryType;

  @ApiProperty({ enum: GroupBy })
  groupBy: GroupBy;

  @ApiProperty({ type: Object })
  @IsOptional()
  summary?: T | null;

  @ApiProperty({ type: [Object] })
  items: T[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalIncome?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalExpense?: number | null;
}
