import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class StatsByNote {
  @ApiProperty({ example: '배달', description: '노트 이름 (없으면 공백)' })
  @IsString()
  note: string;

  @ApiProperty({ example: 3, description: '트랜잭션 개수' })
  @IsNumber()
  count: number;

  @ApiProperty({ example: 45000, description: '총 금액' })
  @IsNumber()
  amount: number;
}

export class StatsByNoteDTO {
  @ApiProperty({ type: [StatsByNote], description: '노트별 통계 목록' })
  data: StatsByNote[];

  @ApiProperty({ example: 120000, description: '노트 항목 중 수입 총합' })
  @IsNumber()
  totalIncome: number;

  @ApiProperty({ example: 75000, description: '노트 항목 중 지출 총합' })
  @IsNumber()
  totalExpense: number;
}
