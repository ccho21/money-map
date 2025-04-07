import { AccountType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class AccountUpdateDTO {
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
