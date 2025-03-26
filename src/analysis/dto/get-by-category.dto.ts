import { IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export class GetByCategoryDto {
  @IsEnum(TransactionType)
  type: TransactionType;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  month: number;
}
