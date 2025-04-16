import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
} from 'class-validator';

export class AccountDetailDTO {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiProperty()
  @IsNumber()
  balance: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  settlementDate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  paymentDate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoPayment?: boolean;
}