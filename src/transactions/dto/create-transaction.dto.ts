import {
  IsUUID,
  IsEnum,
  IsInt,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTransactionDto {
  @IsEnum(['income', 'expense'])
  type: 'income' | 'expense';

  @IsInt()
  amount: number;

  @IsUUID()
  categoryId: string;

  @IsUUID()
  accountId: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  note?: string;
}
