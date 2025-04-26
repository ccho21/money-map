// 📁 src/stats/dto/note/group-item.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';
import { BaseGroupItemDTO } from '@/common/dto/base-group-item.dto';

export class StatsNoteGroupItemDTO extends BaseGroupItemDTO {
  @ApiProperty()
  note: string;

  @ApiProperty({ enum: CategoryType })
  type: CategoryType;

  @ApiProperty()
  count: number;

  @ApiProperty()
  amount: number;
}
