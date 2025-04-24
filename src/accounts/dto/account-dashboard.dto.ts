import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
} from 'class-validator';

export class AccountDashboardItemDTO {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsEnum(AccountType)
  type: AccountType;

  @ApiProperty()
  @IsString()
  financialType: 'ASSET' | 'LIABILITY';

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  balancePayable?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  outstandingBalance?: number | null;

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

export class AccountDashboardDTO {
  @ApiProperty()
  asset: number;

  @ApiProperty()
  liability: number;

  @ApiProperty()
  total: number;

  @ApiProperty({
    type: Object,
    description: '계좌 데이터: CASH, BANK, CARD 배열로 구성',
  })
  data: {
    CASH: AccountDashboardItemDTO[];
    BANK: AccountDashboardItemDTO[];
    CARD: AccountDashboardItemDTO[];
  };
}
