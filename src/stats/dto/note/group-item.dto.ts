// 📁 src/stats/dto/note/group-item.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsString,
} from 'class-validator';
import { CategoryType } from '@prisma/client';
import { BaseStatsItemDTO } from '../base/base-stats-item.dto';

export class NoteStatsGroupItemDTO extends BaseStatsItemDTO {}

export class NoteStatsItemDTO {
  @ApiProperty()
  @IsString()
  note: string;

  @ApiProperty()
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiProperty()
  @IsArray()
  data: NoteSummaryItemNoteDTO[];

  @ApiProperty()
  @IsInt()
  count: number;

  @ApiProperty()
  @IsInt()
  totalIncome: number;

  @ApiProperty()
  @IsInt()
  totalExpense: number;
}

export class NoteSummaryItemNoteDTO {
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
  @IsInt()
  income: number;

  @ApiProperty()
  @IsInt()
  expense: number;

  @ApiProperty()
  @IsBoolean()
  isCurrent: boolean;
}
