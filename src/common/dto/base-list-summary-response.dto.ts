import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { GroupBy } from '@/common/types/types';

export class BaseListSummaryResponseDTO<T> {
  @ApiProperty({ type: [Object] }) // 실제 타입은 자식이 명시
  @IsArray()
  data: T[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalIncome?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalExpense?: number;

  @ApiProperty({ enum: GroupBy })
  @IsEnum(GroupBy)
  groupBy: GroupBy;

  @ApiProperty()
  @IsString()
  startDate: string;

  @ApiProperty()
  @IsString()
  endDate: string;
}
