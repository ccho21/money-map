import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber } from 'class-validator';
import { TransactionDetailDTO } from './transaction-detail.dto';
import { BaseGroupItemDTO } from '@/common/dto/base-group-item.dto';

/**
 * 날짜 그룹별 수입/지출 합계와 해당 트랜잭션 목록
 */
export class TransactionGroupItemDTO extends BaseGroupItemDTO {
  @ApiProperty()
  @IsNumber()
  totalIncome: number;

  @ApiProperty()
  @IsNumber()
  totalExpense: number;

  @ApiProperty({ type: [TransactionDetailDTO] })
  @IsArray()
  transactions: TransactionDetailDTO[];
}
