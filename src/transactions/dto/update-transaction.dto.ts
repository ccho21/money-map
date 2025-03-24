import { IsString, IsOptional, IsInt, IsDateString } from 'class-validator';

export class UpdateTransactionDto {
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
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
