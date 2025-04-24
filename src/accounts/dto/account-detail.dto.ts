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
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  settlementDate?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  paymentDate?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoPayment?: boolean | null;
}
