import { BaseListSummaryResponseDTO } from '@/common/dto/base-list-summary-response.dto';
import { BaseGroupItemDTO } from '@/common/dto/base-group-item.dto';
import { ApiProperty } from '@nestjs/swagger';

export class StatsNoteGroupSummaryDTO extends BaseGroupItemDTO {
  @ApiProperty()
  income: number;

  @ApiProperty()
  expense: number;

  @ApiProperty()
  isCurrent: boolean;
}

export class StatsNoteSummaryDTO extends BaseListSummaryResponseDTO<StatsNoteGroupSummaryDTO> {}
