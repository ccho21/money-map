import { CategoryDTO } from '@/categories/dto/category.dto';
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
  toAccountId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkedTransferId?: string;
  @ApiProperty()
  @IsDateString()
  date: string;
  @ApiProperty()
  @IsDateString()
  createdAt: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
  @ApiPropertyOptional({ type: () => CategoryDTO })
  @IsOptional()
  category?: CategoryDTO;
  @ApiProperty()
  account: {
    id: string;
    name: string;
    type: string;
    color?: string | null;
  };
  @ApiPropertyOptional()
  @IsOptional()
  toAccount?: {
    id: string;
    name: string;
    type: string;
    color?: string | null;
  };
  @ApiPropertyOptional()
  @IsOptional()
  dueDate?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  paidAt?: string | null;
}
