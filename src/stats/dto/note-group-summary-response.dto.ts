import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';
import { NoteGroupSummaryDTO } from './note-group-summary.dto';
import { BaseListSummaryResponseDTO } from '@/common/dto/base-list-summary-response.dto';

export class NoteGroupSummaryResponseDTO extends BaseListSummaryResponseDTO<NoteGroupSummaryDTO> {
  @ApiProperty()
  note: string | null;
}
