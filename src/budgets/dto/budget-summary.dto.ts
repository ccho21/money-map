import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';
import { BaseGroupItemDTO } from '@/common/dto/base-group-item.dto';

export class BudgetGroupSummaryDTO extends BaseGroupItemDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalBudget: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalSpent: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  rate: number;
}
