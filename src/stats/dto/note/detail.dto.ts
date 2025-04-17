import { BaseGroupItemDTO } from '@/common/dto/base-group-item.dto';
import { ApiProperty } from '@nestjs/swagger';

export class StatsNotePeriodDTO extends BaseGroupItemDTO {
  @ApiProperty()
  income: number;

  @ApiProperty()
  expense: number;

  @ApiProperty()
  isCurrent: boolean;
}

export class StatsNoteDetailDTO {
  @ApiProperty()
  note: string;

  @ApiProperty()
  totalIncome: number;

  @ApiProperty()
  totalExpense: number;

  @ApiProperty({ type: [StatsNotePeriodDTO] })
  data: StatsNotePeriodDTO[];
}
