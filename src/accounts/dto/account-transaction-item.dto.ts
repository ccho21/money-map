import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';
import { BaseGroupItemDTO } from '@/common/dto/base-group-item.dto';
import { TransactionDetailDTO } from '@/transactions/dto/transactions/transaction-detail.dto';

/**
 * 기간 단위로 묶인 단일 계좌의 거래 요약
 */
export class AccountTransactionItemDTO {
  @ApiProperty()
  @IsString()
  accountId: string;

  @ApiProperty()
  @IsString()
  accountName: string;

  @ApiProperty()
  @IsNumber()
  balance: number;

  @ApiProperty()
  @IsNumber()
  totalIncome: number;

  @ApiProperty()
  @IsNumber()
  totalExpense: number;

  @ApiPropertyOptional({ type: [TransactionDetailDTO] })
  @IsOptional()
  @IsArray()
  transactions?: TransactionDetailDTO[] | null;

  @ApiProperty({ example: '2024-04', description: '그룹 레이블 (월/주 등)' })
  @IsString()
  label: string;

  @ApiProperty({ example: '2024-04-01', description: '그룹 시작일' })
  @IsString()
  rangeStart: string;

  @ApiProperty({ example: '2024-04-30', description: '그룹 종료일' })
  @IsString()
  rangeEnd: string;
}
