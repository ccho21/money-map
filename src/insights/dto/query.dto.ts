import { Timeframe } from "@/transactions/dto/params/transaction-group-query.dto";
import { IsEnum, IsISO8601, ValidateIf } from "class-validator";

export class InsightQueryDTO {
  @IsEnum(['daily', 'weekly', 'monthly', 'yearly', 'custom'])
  timeframe: Timeframe;

  @IsISO8601()
  startDate: string;

  @ValidateIf((o) => o.timeframe === 'custom')
  @IsISO8601()
  endDate: string;
}
