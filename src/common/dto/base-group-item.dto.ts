import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * 모든 group summary 항목들의 공통 구조: label + 기간 범위
 * - 예: "2024-04", "2024-W12" 등
 */
export abstract class BaseGroupItemDTO {
  @ApiProperty({ example: '2024-04', description: '그룹 레이블 (월/주 등)' })
  @IsString()
  label: string;

  @ApiProperty({ example: '2024-04-01', description: '그룹 시작일' })
  @IsString()
  rangeStart: string;

  @ApiProperty({ example: '2024-04-30', description: '그룹 종료일' })
  @IsString()
  rangeEnd: string;
}
