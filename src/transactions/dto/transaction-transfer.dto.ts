import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsInt,
  Min,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class TransactionTransferDTO {
  @ApiProperty({ description: '이체 금액' })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ description: '출금 계좌 ID' })
  @IsUUID()
  fromAccountId: string;

  @ApiProperty({ description: '입금 계좌 ID' })
  @IsUUID()
  toAccountId: string;

  @ApiProperty({ description: '이체 일자 (ISO 문자열)' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: '비고', required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ description: '설명', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
