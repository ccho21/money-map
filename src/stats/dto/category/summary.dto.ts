import { BaseListSummaryResponseDTO } from '@/common/dto/base-list-summary-response.dto';
import { ApiProperty } from '@nestjs/swagger';
import { BaseGroupItemDTO } from '@/common/dto/base-group-item.dto';

export class StatsCategoryGroupSummaryDTO extends BaseGroupItemDTO {
  @ApiProperty()
  income: number;

  @ApiProperty()
  expense: number;

  @ApiProperty()
  isCurrent: boolean;
}

export class StatsCategorySummaryDTO extends BaseListSummaryResponseDTO<StatsCategoryGroupSummaryDTO> {}
