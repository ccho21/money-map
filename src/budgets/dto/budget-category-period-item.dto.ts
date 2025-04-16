import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { CategoryType } from '@prisma/client';
import { BaseGroupItemDTO } from '@/common/dto/base-group-item.dto';

export class BudgetCategoryPeriodItemDTO extends BaseGroupItemDTO {
  @ApiProperty()
  @IsInt()
  amount: number;

  @ApiProperty()
  @IsInt()
  used: number;

  @ApiProperty()
  @IsInt()
  remaining: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOver?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty()
  @IsBoolean()
  isCurrent: boolean;

  @ApiProperty()
  @IsString()
  type: CategoryType;
}
