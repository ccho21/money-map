import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class AccountDashboardItemDTO {
  @ApiProperty({ description: '계좌 ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: '계좌 이름' })
  @IsString()
  name: string;

  @ApiProperty({ description: '계좌 그룹', enum: ['CASH', 'BANK', 'CARD'] })
  @IsString()
  type: AccountType;

  @ApiProperty({ description: '계좌 성격', enum: ['ASSET', 'LIABILITY'] })
  @IsString()
  financialType: 'ASSET' | 'LIABILITY';

  @ApiProperty({ description: '잔액 (금액)' })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ description: '결제 예정 금액 (CARD 전용)' })
  @IsOptional()
  @IsNumber()
  balancePayable?: number;

  @ApiPropertyOptional({ description: '연체 금액 (CARD 전용)' })
  @IsOptional()
  @IsNumber()
  outstandingBalance?: number;

  @IsOptional()
  @IsInt()
  settlementDate?: number | null;

  @IsOptional()
  @IsInt()
  paymentDate?: number | null;
}

class AccountDashboardDataDTO {
  @ApiProperty({
    type: [AccountDashboardItemDTO],
    description: '현금 계좌 목록',
  })
  CASH: AccountDashboardItemDTO[];

  @ApiProperty({
    type: [AccountDashboardItemDTO],
    description: '은행 계좌 목록',
  })
  BANK: AccountDashboardItemDTO[];

  @ApiProperty({
    type: [AccountDashboardItemDTO],
    description: '카드 계좌 목록',
  })
  CARD: AccountDashboardItemDTO[];
}

export class AccountDashboardResponseDTO {
  @ApiProperty({ description: '전체 자산 합계 (ASSET)', example: 500000 })
  asset: number;

  @ApiProperty({ description: '전체 부채 합계 (LIABILITY)', example: 150000 })
  liability: number;

  @ApiProperty({ description: '순 자산 (asset - liability)', example: 350000 })
  total: number;

  @ApiProperty({
    description: '계좌 목록 (현금, 은행, 카드)',
    type: AccountDashboardDataDTO,
  })
  data: AccountDashboardDataDTO;
}
