import { TransactionGroupItemDTO } from '@/transactions/dto/transaction-group-item.dto';
import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';

// export class StatsCategoryPeriodDTO extends BaseGroupItemDTO {
//   @ApiProperty()
//   income: number;

//   @ApiProperty()
//   expense: number;

//   @ApiProperty()
//   isCurrent: boolean;
// }

export class StatsCategoryDetailDTO {
  @ApiProperty()
  categoryId: string;

  @ApiProperty()
  categoryName: string;

  @ApiProperty({ enum: CategoryType })
  type: CategoryType;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  color: string;

  @ApiProperty()
  totalIncome: number;

  @ApiProperty()
  totalExpense: number;

  @ApiProperty({ type: [TransactionGroupItemDTO] })
  items: TransactionGroupItemDTO[];
}
