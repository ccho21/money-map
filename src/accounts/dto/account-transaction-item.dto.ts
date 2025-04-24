import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';
import { TransactionDetailDTO } from '@/transactions/dto/transaction-detail.dto';
import { BaseGroupItemDTO } from '@/common/dto/base-group-item.dto';

/**
 * 기간 단위로 묶인 단일 계좌의 거래 요약
 */
export class AccountTransactionItemDTO extends BaseGroupItemDTO {
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
}
