import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt } from 'class-validator';
import { NoteStatsGroupItemDTO } from './note-stats-group-item.dto';

export class NoteStatsGroupDTO {
  @ApiProperty({ type: [NoteStatsGroupItemDTO] })
  @IsArray()
  data: NoteStatsGroupItemDTO[];

  @ApiProperty()
  @IsInt()
  totalIncome: number;

  @ApiProperty()
  @IsInt()
  totalExpense: number;
}
