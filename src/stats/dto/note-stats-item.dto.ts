import { ApiProperty } from '@nestjs/swagger';
import { BaseStatsItemDTO } from './base-stats-item.dto';
import { IsArray, IsInt, IsString } from 'class-validator';
import { NoteSummaryItemNoteDTO } from './note-summary-item-note.dto';

export class NoteStatsItemDTO extends BaseStatsItemDTO {
  @ApiProperty()
  @IsString()
  note: string;

  @ApiProperty()
  @IsInt()
  count: number;

  @ApiProperty()
  @IsInt()
  totalIncome: number;

  @ApiProperty()
  @IsInt()
  totalExpense: number;

  @ApiProperty({ type: [NoteSummaryItemNoteDTO] })
  @IsArray()
  data: NoteSummaryItemNoteDTO[];
}
