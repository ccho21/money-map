// src/transactions/dto/create-transaction.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '@prisma/client';

// Recurring DTO
export class RecurringTransactionDTO {
  @ApiProperty({ enum: ['daily', 'weekly', 'monthly', 'yearly'] })
  @IsEnum(['daily', 'weekly', 'monthly', 'yearly'], {
    message: 'frequency must be one of daily, weekly, monthly, yearly',
  })
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';

  @ApiProperty()
  @IsInt()
  interval: number;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string | null;
}

// Unified Transaction DTO
export class CreateTransactionDTO {
  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty()
  @IsInt()
  amount: number;

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  toAccountId?: string | null;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  fromAccountId?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ type: () => RecurringTransactionDTO })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecurringTransactionDTO)
  recurring?: RecurringTransactionDTO | null;
}
