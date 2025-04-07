import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsInt,
  IsBoolean,
} from 'class-validator';
import { AccountType } from '@prisma/client';

export class AccountCreateDTO {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(AccountType)
  type: AccountType;

  @IsNumber()
  @Min(0)
  balance: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  settlementDate?: number;

  @IsOptional()
  @IsInt()
  paymentDate?: number;

  @IsOptional()
  @IsBoolean()
  autoPayment?: boolean;
}
