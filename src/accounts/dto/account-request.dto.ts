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
  IsBoolean,
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
  @IsOptional()
  @IsString()
  color?: string | null;

  @ApiProperty({ description: '초기 잔액' })
  @IsNumber()
  @Min(0)
  balance: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

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

@ApiExtraModels()
export class AccountCreateRequestDTO extends BaseAccountRequestDTO {}

export class AccountUpdateRequestDTO extends PartialType(
  AccountCreateRequestDTO,
) {}
