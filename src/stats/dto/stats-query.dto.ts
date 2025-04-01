import { IsISO8601, IsEnum } from 'class-validator';

export enum CategoryType {
  income = 'income',
  expense = 'expense',
  all = 'all',
}

export class StatsQuery {
  @IsISO8601()
  startDate: string;

  @IsISO8601()
  endDate: string;

  @IsEnum(CategoryType)
  type: CategoryType; // income 또는 expense 구분
}
