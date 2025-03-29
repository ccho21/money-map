import { ApiProperty } from '@nestjs/swagger';
import { CategoryDto } from 'src/categories/dto/create-category.dto';

export class TransactionDto {
  @ApiProperty({ example: 'tx123', description: '거래 ID' })
  id: string;

  @ApiProperty({ enum: ['income', 'expense'], description: '거래 타입' })
  type: 'income' | 'expense';

  @ApiProperty({ example: 15000, description: '금액' })
  amount: number;

  @ApiProperty({ example: 'acc001', description: '계좌 ID' })
  accountId: string;

  @ApiProperty({ type: CategoryDto, description: '카테고리 정보' })
  category: CategoryDto;

  @ApiProperty({
    example: '점심 식사',
    description: '거래 메모 (선택)',
    required: false,
  })
  note?: string | null;

  @ApiProperty({
    example: '2025-03-25T14:48:00.000Z',
    description: '거래 날짜 (ISO 8601)',
  })
  date: string;
}

export class TransactionSummary {
  label: string; // 예: '2025-03-25', '2025-03', '2025'
  rangeStart: string;
  rangeEnd: string;
  incomeTotal: number;
  expenseTotal: number;
  transactions: TransactionDto[]; // ✅ 해당 날짜 or 월 or 연도에 속한 거래 목록
}

export class TransactionSummaryDTO {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
  incomeTotal: number;
  expenseTotal: number;
  data: TransactionSummary[]; // ✅ 날짜/월/연 단위로 그룹된 데이터 목록
}

export interface TransactionCalendarItem {
  date: string;
  income: number;
  expense: number;
}
