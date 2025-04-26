// import { BaseGroupItemDTO } from '@/common/dto/base-group-item.dto';
import { TransactionGroupItemDTO } from '@/transactions/dto/transaction-group-item.dto';
import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';

// export class StatsBudgetPeriodDTO extends BaseGroupItemDTO {
//   @ApiProperty()
//   income: number;

//   @ApiProperty()
//   expense: number;

//   @ApiProperty()
//   budget: number;

//   @ApiProperty()
//   remaining: number;

//   @ApiProperty()
//   isOver: boolean;

//   @ApiProperty()
//   isCurrent: boolean;
// }

export class StatsBudgetDetailDTO {
  @ApiProperty()
  categoryId: string;

  @ApiProperty()
  categoryName: string;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  color: string;

  @ApiProperty()
  type: CategoryType;

  @ApiProperty()
  totalExpense: number;

  @ApiProperty()
  totalBudget: number;

  @ApiProperty()
  totalRemaining: number;

  @ApiProperty()
  isOver: boolean;

  @ApiProperty({ type: [TransactionGroupItemDTO] })
  items: TransactionGroupItemDTO[];
}
