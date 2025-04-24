import { AccountDetailDTO } from '@/accounts/dto/account-detail.dto';
import { CategoryDetailDTO } from '@/categories/dto/category-detail.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class TransactionDetailDTO {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty()
  @IsInt()
  amount: number;

  @ApiProperty()
  @IsString()
  accountId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkedTransferId?: string | null;

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsDateString()
  createdAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ type: () => AccountDetailDTO })
  account: AccountDetailDTO;

  @ApiPropertyOptional({ type: () => AccountDetailDTO })
  @IsOptional()
  toAccount?: AccountDetailDTO | null;

  @ApiPropertyOptional({ type: () => CategoryDetailDTO })
  @IsOptional()
  category?: CategoryDetailDTO | null;

  @ApiPropertyOptional()
  @IsOptional()
  dueDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  paidAt?: string | null;
}
