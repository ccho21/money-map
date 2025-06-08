// create-recurring-transaction.dto.ts
import { IsEnum, IsInt, IsOptional, IsString, IsDateString, IsUUID, Min } from 'class-validator'
import { RecurringFrequency, TransactionType } from '@prisma/client'

export class CreateRecurringTransactionDto {
  @IsUUID()
  userId: string

  @IsUUID()
  accountId: string

  @IsUUID()
  @IsOptional()
  toAccountId?: string | null

  @IsUUID()
  @IsOptional()
  categoryId?: string

  @IsEnum(TransactionType)
  type: TransactionType

  @IsInt()
  @Min(1)
  amount: number

  @IsDateString()
  startDate: string

  @IsEnum(RecurringFrequency)
  frequency: RecurringFrequency

  @IsInt()
  @Min(1)
  @IsOptional()
  interval?: number

  @IsInt()
  @IsOptional()
  anchorDay?: number

  @IsDateString()
  @IsOptional()
  endDate?: string

  @IsString()
  @IsOptional()
  note?: string

  @IsString()
  @IsOptional()
  description?: string
}
