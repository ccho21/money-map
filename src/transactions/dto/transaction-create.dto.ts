import { TransactionType } from '@prisma/client';
import {
  IsUUID,
  IsEnum,
  IsInt,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class TransactionCreateDTO {
  @IsEnum(['income', 'expense'])
  type: TransactionType;

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

  @IsOptional()
  @IsString()
  description?: string;
}
