import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class BudgetGroupSummaryDTO {
  @ApiProperty()
  @IsString()
  label: string;
  @ApiProperty()
  @IsString()
  startDate: string;
  @ApiProperty()
  @IsString()
  endDate: string;
  @ApiProperty()
  @IsNumber()
  income: number;
  @ApiProperty()
  @IsNumber()
  expense: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  budgetAmount?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  remaining?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOver?: boolean;
  @ApiProperty()
  @IsBoolean()
  isCurrent: boolean;
}
