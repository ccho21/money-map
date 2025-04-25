// 📁 src/stats/dto/category/group-item.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';
import { BaseGroupItemDTO } from '@/common/dto/base-group-item.dto';

export class StatsCategoryGroupItemDTO extends BaseGroupItemDTO {
  @ApiProperty()
  categoryId: string;

  @ApiProperty()
  categoryName: string;

  @ApiProperty()
  categoryType: CategoryType;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  rate: number;

  @ApiProperty()
  color?: string | null;
}
