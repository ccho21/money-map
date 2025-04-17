import { BaseGroupItemDTO } from '@/common/dto/base-group-item.dto';
import { ApiProperty } from '@nestjs/swagger';

export class StatsNoteGroupPeriodDTO extends BaseGroupItemDTO {
  @ApiProperty()
  income: number;

  @ApiProperty()
  expense: number;

  @ApiProperty()
  isCurrent: boolean;
}
