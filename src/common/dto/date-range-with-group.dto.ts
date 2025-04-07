import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { GroupBy } from '../types/types';
import { DateQueryDTO } from './date-query.dto';

export class DateRangeWithGroupQueryDTO extends DateQueryDTO {
  @ApiProperty({ enum: GroupBy, required: false })
  @IsOptional()
  @IsEnum(GroupBy)
  groupBy: GroupBy;
}
