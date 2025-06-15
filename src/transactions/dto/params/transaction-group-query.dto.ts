import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export type Timeframe =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'custom'
  | 'all';
export type GroupBy =
  | 'date'
  | 'category'
  | 'account'
  | 'tag'
  | 'budget'
  | 'note';
export type TransactionType = 'income' | 'expense' | 'transfer';

export class TransactionGroupQueryDTO {
  @IsEnum(['daily', 'weekly', 'monthly', 'yearly', 'custom', 'all'])
  timeframe: Timeframe;

  @IsEnum(['date', 'category', 'account', 'tag', 'budget', 'note'])
  @Transform(({ value }) => (value ?? 'date') as GroupBy)
  groupBy: GroupBy;

  @IsISO8601()
  startDate: string;

  @ValidateIf((o: TransactionGroupQueryDTO) => o.timeframe === 'custom')
  @IsISO8601()
  endDate: string;

  @IsOptional()
  categoryId?: string;

  @IsOptional()
  accountId?: string;

  @IsOptional()
  @IsEnum(['income', 'expense', 'transfer'])
  transactionType?: TransactionType;

  @IsOptional()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  limit?: number;

  @IsOptional()
  note?: string;

  @IsOptional()
  includeBalance?: boolean;
}
