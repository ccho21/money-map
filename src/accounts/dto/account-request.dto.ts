import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
} from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AccountType } from '@prisma/client';

export class BaseAccountRequestDTO {
  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ description: '초기 잔액' })
  @IsNumber()
  @Min(0)
  balance: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  settlementDate?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  paymentDate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  autoPayment?: boolean;
}

@ApiExtraModels()
export class AccountCreateRequestDTO extends BaseAccountRequestDTO {}

export class AccountUpdateRequestDTO extends PartialType(
  AccountCreateRequestDTO,
) {}
