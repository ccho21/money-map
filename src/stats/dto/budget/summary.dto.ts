// 📁 src/stats/dto/budget/group-summary.dto.ts
import { BaseListSummaryResponseDTO } from '@/common/dto/base-list-summary-response.dto';
import { ApiProperty } from '@nestjs/swagger';
import { BaseGroupItemDTO } from '@/common/dto/base-group-item.dto';
export class StatsBudgetGroupSummaryDTO extends BaseGroupItemDTO {
  @ApiProperty()
  income: number;

  @ApiProperty()
  expense: number;

  @ApiProperty()
  budgetAmount?: number;

  @ApiProperty()
  remaining?: number;

  @ApiProperty()
  isOver?: boolean;

  @ApiProperty()
  isCurrent: boolean;
}

export class StatsBudgetSummaryDTO extends BaseListSummaryResponseDTO<StatsBudgetGroupSummaryDTO> {}
