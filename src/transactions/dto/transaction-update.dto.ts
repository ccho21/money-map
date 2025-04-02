import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsEnum,
  ValidateIf,
} from 'class-validator';

export class TransactionUpdateDTO {
  @IsOptional()
  @IsEnum(['income', 'expense', 'transfer'])
  type?: 'income' | 'expense' | 'transfer';

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
  @ValidateIf((_, value) => value === null || typeof value === 'string')
  @IsString()
  toAccountId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value === null || typeof value === 'string')
  @IsString()
  linkedTransferId?: string | null;

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
