import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class TransactionDto {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: {
    id: string;
    name: string;
    icon: string;
  };
  note?: string;
  //   paymentMethod?: string;
  date: string; // ISO 문자열로 반환
}

export class GroupQueryDto {
  @IsEnum(['date', 'week', 'month', 'year'])
  range: 'date' | 'week' | 'month' | 'year';

  @IsString()
  @Transform(({ value }) => value.trim())
  date: string; // '2025' or '2025-03' or '2025-03-25'

  @IsOptional() includeEmpty: boolean
}

export class GroupedTransactionSummary {
  label: string; // 예: '2025-03-25', '2025-03', '2025'
  incomeTotal: number;
  expenseTotal: number;
  transactions: TransactionDto[]; // ✅ 해당 날짜 or 월 or 연도에 속한 거래 목록
}

export class GroupedResponseDto {
  range: 'date' | 'week' | 'month' | 'year';
  baseDate: string;
  incomeTotal: number;
  expenseTotal: number;
  data: GroupedTransactionSummary[]; // ✅ 날짜/월/연 단위로 그룹된 데이터 목록
}