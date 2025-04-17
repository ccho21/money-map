// 📁 src/stats/dto/note/group-item.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';
import { StatsNoteGroupPeriodDTO } from './period-item.dto';

export class StatsNoteGroupItemDTO {
  @ApiProperty()
  note: string;

  @ApiProperty({ enum: CategoryType })
  type: CategoryType;

  @ApiProperty()
  count: number;

  @ApiProperty()
  totalIncome: number;

  @ApiProperty()
  totalExpense: number;

  @ApiProperty({ type: [StatsNoteGroupPeriodDTO] })
  data: StatsNoteGroupPeriodDTO[];
}
