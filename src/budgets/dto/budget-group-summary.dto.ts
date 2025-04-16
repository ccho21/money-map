import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';
import { BaseListSummaryResponseDTO } from '@/common/dto/base-list-summary-response.dto';
import { BudgetGroupItemDTO } from './budget-group-item.dto';

export class BudgetGroupSummaryDTO extends BaseListSummaryResponseDTO<BudgetGroupItemDTO> {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalBudget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  rate?: number;
}
