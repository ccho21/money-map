// 📁 src/stats/dto/budget/group-summary.dto.ts
import { BaseListSummaryResponseDTO } from '@/common/dto/base-list-summary-response.dto';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BudgetGroupSummaryItemDTO {
  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiProperty()
  @IsBoolean()
  isCurrent: boolean;

  @ApiProperty()
  @IsInt()
  income: number;

  @ApiProperty()
  @IsInt()
  expense: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  budgetAmount?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  remaining?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isOver?: boolean;
}

export type BudgetGroupSummaryResponseDTO =
  BaseListSummaryResponseDTO<BudgetGroupSummaryItemDTO>;
