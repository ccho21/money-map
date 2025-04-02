import { IsString, IsOptional, IsInt, IsDateString } from 'class-validator';

export class TransactionUpdateDTO {
  @IsOptional()
  @IsString()
  type?: 'income' | 'expense';

  @IsOptional()
  @IsInt()
  amount?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
