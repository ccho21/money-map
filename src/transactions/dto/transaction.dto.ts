import { CategoryDto } from '@/categories/dto/category.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class TransactionDTO {
  @ApiProperty({ example: 'tx123', description: '거래 ID' })
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    enum: ['income', 'expense', 'transfer'],
    description: '거래 타입',
  })
  type: 'income' | 'expense' | 'transfer';

  @ApiProperty({ example: 15000, description: '금액' })
  amount: number;

  @ApiProperty({ example: 'acc001', description: '계좌 ID (출금)' })
  accountId: string;

  @ApiProperty({
    example: 'acc002',
    description: '입금 계좌 ID (transfer 타입일 경우만)',
    required: false,
  })
  toAccountId?: string;

  @ApiProperty({
    type: CategoryDto,
    description: '카테고리 정보',
    required: false,
  })
  category?: CategoryDto;

  @ApiProperty({
    example: '점심 식사',
    description: '거래 메모 (선택)',
    required: false,
  })
  note?: string | null;

  @ApiProperty({
    example: '신용카드로 점심 결제',
    description: '추가 설명 (선택)',
    required: false,
  })
  description?: string | null;

  @ApiProperty({
    example: '2025-03-25T14:48:00.000Z',
    description: '거래 날짜 (ISO 8601)',
  })
  date: string;

  @ApiProperty({
    description: '출금 계좌 정보',
    example: {
      id: 'acc001',
      name: '신한카드',
      type: 'CARD',
      color: '#FFAA00',
    },
  })
  account?: {
    id: string;
    name: string;
    type: string;
    color?: string | null;
  };

  @ApiProperty({
    description: '입금 계좌 정보 (transfer 전용)',
    required: false,
    example: {
      id: 'acc002',
      name: '우리은행',
      type: 'BANK',
      color: '#0099FF',
    },
  })
  toAccount?: {
    id: string;
    name: string;
    type: string;
    color?: string | null;
  };

  @ApiProperty({
    description: '쌍방 트랜잭션 ID (transfer 전용)',
    required: false,
    example: 'tx456',
  })
  linkedTransferId?: string;
}

export class TransactionSummary {
  label: string; // 예: '2025-03-25', '2025-03', '2025'
  rangeStart: string;
  rangeEnd: string;
  incomeTotal: number;
  expenseTotal: number;
  transactions: TransactionDTO[]; // ✅ 해당 날짜 or 월 or 연도에 속한 거래 목록
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
