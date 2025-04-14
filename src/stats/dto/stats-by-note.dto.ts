import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsString } from 'class-validator';

class NoteGroupSummary {
  @ApiProperty({ example: '2025-04', description: '구간 라벨' })
  @IsString()
  label: string;

  @ApiProperty({ example: '2025-04-01', description: '구간 시작일' })
  @IsString()
  startDate: string;

  @ApiProperty({ example: '2025-04-30', description: '구간 종료일' })
  @IsString()
  endDate: string;

  @ApiProperty({ example: 0, description: '해당 구간의 수입' })
  @IsNumber()
  income: number;

  @ApiProperty({ example: 30000, description: '해당 구간의 지출' })
  @IsNumber()
  expense: number;

  @ApiProperty({ example: true, description: '현재 구간 여부' })
  isCurrent: boolean;
}

export class StatsByNote {
  @ApiProperty({ example: '배달', description: '노트 이름 (없으면 공백)' })
  @IsString()
  note: string;

  @ApiProperty({ example: 3, description: '트랜잭션 개수' })
  @IsNumber()
  count: number; // ✅ 여기 추가됨

  @ApiProperty({ example: 120000, description: '노트 항목 내 총 수입' })
  @IsNumber()
  totalIncome: number;

  @ApiProperty({ example: 75000, description: '노트 항목 내 총 지출' })
  @IsNumber()
  totalExpense: number;

  @ApiProperty({ type: [NoteGroupSummary], description: '구간별 요약 리스트' })
  @IsArray()
  data: NoteGroupSummary[];
}

export class StatsByNoteDTO {
  @ApiProperty({ type: [StatsByNote], description: '노트별 통계 목록' })
  @IsArray()
  data: StatsByNote[];

  @ApiProperty({ example: 120000, description: '전체 수입 총합' })
  @IsNumber()
  totalIncome: number;

  @ApiProperty({ example: 75000, description: '전체 지출 총합' })
  @IsNumber()
  totalExpense: number;
}
