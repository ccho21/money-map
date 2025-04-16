import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsString } from 'class-validator';
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
  incomeTotal: number;

  @ApiProperty()
  @IsNumber()
  expenseTotal: number;

  @ApiProperty({ type: [TransactionDetailDTO] })
  @IsArray()
  transactions?: TransactionDetailDTO[];
}

