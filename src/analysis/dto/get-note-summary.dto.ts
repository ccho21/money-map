import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetNoteSummaryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  month!: number;
}
