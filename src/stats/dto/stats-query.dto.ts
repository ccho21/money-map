import { DateRangeWithGroupQueryDTO } from '@/common/dto/date-range-with-group.dto';
import { CategoryType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class StatsQuery extends DateRangeWithGroupQueryDTO {
  @IsEnum(CategoryType)
  type: CategoryType; // income 또는 expense 구분
}
