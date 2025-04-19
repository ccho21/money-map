import { ApiProperty } from '@nestjs/swagger';
import { BudgetCategoryItemDTO } from './budget-category-item.dto';

export class BudgetCategoryListResponseDTO {
  @ApiProperty()
  total: number;

  @ApiProperty({ type: [BudgetCategoryItemDTO] })
  items: BudgetCategoryItemDTO[];
}
