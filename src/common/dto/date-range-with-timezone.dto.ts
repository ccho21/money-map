import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { DateQueryDTO } from './date-query.dto';

export class DateRangeWithTimezoneQueryDTO extends DateQueryDTO {
  @ApiProperty({ example: 'Asia/Seoul', required: false })
  @IsOptional()
  timezone: string;
}
