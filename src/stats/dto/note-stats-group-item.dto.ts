import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsString } from 'class-validator';
import { NoteSummaryItemNoteDTO } from './note-summary-item-note.dto';

export class NoteStatsGroupItemDTO {
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
