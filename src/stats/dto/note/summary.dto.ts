import { BaseListSummaryResponseDTO } from '@/common/dto/base-list-summary-response.dto';
import { IsString, IsDateString, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NoteGroupSummaryItemDTO {
  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiProperty()
  @IsBoolean()
  isCurrent: boolean;

  @ApiProperty()
  @IsInt()
  income: number;

  @ApiProperty()
  @IsInt()
  expense: number;
}

export type NoteGroupSummaryResponseDTO =
  BaseListSummaryResponseDTO<NoteGroupSummaryItemDTO>;
