import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TransactionDto {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  accountId: string;
  category: {
    id: string;
    name: string;
    icon: string;
  };
  note?: string;
  //   paymentMethod?: string;
  date: string; // ISO 문자열로 반환
}

export class GroupedTransactionSummary {
  label: string; // 예: '2025-03-25', '2025-03', '2025'
  incomeTotal: number;
  expenseTotal: number;
  transactions: TransactionDto[]; // ✅ 해당 날짜 or 월 or 연도에 속한 거래 목록
}

export class GroupedResponseDto {
  type: 'weekly' | 'monthly' | 'yearly';
  date: string;
  incomeTotal: number;
  expenseTotal: number;
  data: GroupedTransactionSummary[]; // ✅ 날짜/월/연 단위로 그룹된 데이터 목록
}

export interface TransactionCalendarItem {
  date: string;
  income: number;
  expense: number;
}

export class BaseDateQueryDto {
  @Type(() => Number)
  @IsInt()
  year: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}
export class DateQueryDto extends BaseDateQueryDto {}

export class GroupQueryDto extends BaseDateQueryDto {
  @IsEnum(['weekly', 'monthly', 'yearly'])
  type: 'weekly' | 'monthly' | 'yearly';
}
