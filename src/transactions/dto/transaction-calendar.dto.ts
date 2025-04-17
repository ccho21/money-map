import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class TransactionCalendarDTO {
  @ApiProperty()
  @IsString()
  date: string;
  @ApiProperty()
  @IsNumber()
  income: number;
  @ApiProperty()
  @IsNumber()
  expense: number;
}
