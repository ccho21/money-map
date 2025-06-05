import { AccountTransactionItemDTO } from './account-transaction-item.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { CategoryType } from '@prisma/client';
import { Timeframe } from '@/transactions/dto/params/transaction-group-query.dto';

/**
 * 계좌별 그룹 요약 응답 (기간별)
 */
export class AccountTransactionSummaryDTO {
  @ApiProperty()
  @IsString()
  startDate: string;

  @ApiProperty()
  @IsString()
  endDate: string;

  @ApiProperty({ enum: CategoryType })
  type?: CategoryType;

  //   @ApiProperty({ enum: Timeframe })
  timeframe: Timeframe;

  @ApiProperty({ type: [Object] })
  items: AccountTransactionItemDTO[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalIncome?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalExpense?: number | null;
}
