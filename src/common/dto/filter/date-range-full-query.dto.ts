import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { GroupBy } from '../../types/types';
import { DateRangeWithTimezoneQueryDTO } from './date-range-with-timezone-query.dto';

export class DateRangeFullQueryDTO extends DateRangeWithTimezoneQueryDTO {
  @ApiProperty({ enum: GroupBy, required: false })
  @IsOptional()
  @IsEnum(GroupBy)
  groupBy: GroupBy;
}
