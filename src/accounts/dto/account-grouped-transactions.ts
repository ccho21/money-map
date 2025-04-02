import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionDTO } from 'src/transactions/dto/transaction.dto';

export class AccountTransactionFilterQueryDto {
  @ApiPropertyOptional({
    example: '2025-01-01',
    description: '시작 날짜 (ISO 형식)',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'startDate는 ISO 형식이어야 합니다 (예: yyyy-MM-dd)' },
  )
  startDate?: string;

  @ApiPropertyOptional({
    example: '2025-01-31',
    description: '끝 날짜 (ISO 형식)',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'endDate는 ISO 형식이어야 합니다 (예: yyyy-MM-dd)' },
  )
  endDate?: string;
}

export class AccountTransactionSummaryDTO {
  accountId: string;
  accountName: string;
  balance: number;
  incomeTotal: number;
  expenseTotal: number;
  transactions: TransactionDTO[];
}
