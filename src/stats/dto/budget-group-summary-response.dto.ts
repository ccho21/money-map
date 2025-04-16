import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { BudgetGroupSummaryDTO } from './budget-group-summary.dto';
import { BaseListSummaryResponseDTO } from '@/common/dto/base-list-summary-response.dto';

export class BudgetGroupSummaryResponseDTO extends BaseListSummaryResponseDTO<BudgetGroupSummaryDTO> {
  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiProperty()
  @IsString()
  categoryName: string;

  @ApiProperty()
  @IsString()
  color: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalBudget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalRemaining?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOver?: boolean;
}
