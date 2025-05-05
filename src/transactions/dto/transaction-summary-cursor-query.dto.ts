// dto/transaction-summary-cursor-query.dto.ts
import { BaseListSummaryResponseDTO } from '@/common/dto/base-list-summary-response.dto';
import { DateRangeWithGroupQueryDTO } from '@/common/dto/filter/date-range-with-group-query.dto';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { TransactionGroupItemDTO } from './transaction-group-item.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { GroupBy } from '@/common/types/types';

export class TransactionSummaryCursorQueryDTO {
  @IsEnum(GroupBy)
  groupBy: GroupBy;

  @IsNumber()
  limit: number;

  @IsString()
  cursorDate: string;

  @IsString()
  cursorId: string;

  // 💡 필터 확장 시에만 사용
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class TransactionCursorSummaryResponseDTO {
  @ApiProperty({ type: [TransactionGroupItemDTO] })
  items: TransactionGroupItemDTO[];

  @ApiProperty({ type: Object, nullable: true })
  nextCursor: { date: string; id: string } | null;
}
