// src/transactions/dto/base-transaction-request.dto.ts
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
} from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TransactionType } from '@prisma/client';

export class BaseTransactionRequestDTO {
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
  @IsString()
  @IsOptional()
  note?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string | null;
}

@ApiExtraModels()
export class TransactionCreateRequestDTO extends BaseTransactionRequestDTO {}

export class TransactionUpdateRequestDTO extends PartialType(
  TransactionCreateRequestDTO,
) {}

export class TransactionTransferRequestDTO extends BaseTransactionRequestDTO {
  @ApiProperty()
  @IsUUID()
  fromAccountId: string;

  @ApiProperty()
  @IsUUID()
  toAccountId: string;
}
