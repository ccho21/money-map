import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

export class BaseDateQueryDTO {
  @ApiProperty()
  @IsISO8601()
  date: string;
}
