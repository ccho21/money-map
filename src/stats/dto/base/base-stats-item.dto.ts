// 📁 src/stats/dto/base/base-stats-item.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt } from 'class-validator';

// ✅ base/base-stats-item.dto.ts
export class BaseStatsItemDTO {
  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsInt()
  amount: number;
}
