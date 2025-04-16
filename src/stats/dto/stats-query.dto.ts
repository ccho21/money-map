import { DateRangeWithGroupQueryDTO } from '@/common/dto/filter/date-range-with-group-query.dto';
import { CategoryType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class StatsQuery extends DateRangeWithGroupQueryDTO {
  @IsEnum(CategoryType)
  type: CategoryType; // income 또는 expense 구분
}
