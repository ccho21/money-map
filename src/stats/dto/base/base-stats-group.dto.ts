// 📁 src/stats/dto/base/base-stats-group.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsString } from 'class-validator';
import { CategoryType } from '@prisma/client';

export class BaseStatsGroupDTO<T> {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty({ enum: CategoryType })
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiProperty({ type: [Object] })
  @IsArray()
  items: T[];
}
