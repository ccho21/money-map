// 📁 src/stats/dto/base/base-list-summary-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsNumber, IsOptional } from 'class-validator';

export class BaseStatsResponseDTO<T> {
  @ApiProperty({ type: [Object] })
  @IsArray()
  data: T[];

  @ApiProperty()
  @IsInt()
  total: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  rate?: number;
}
