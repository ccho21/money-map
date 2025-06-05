import { IsEnum, IsISO8601 } from 'class-validator';
import { Timeframe } from '@/transactions/dto/params/transaction-group-query.dto';
export class AccountQueryDTO {
  @IsEnum(['daily', 'weekly', 'monthly', 'yearly', 'custom'])
  timeframe: Timeframe;

  @IsISO8601()
  startDate: string;

  @IsISO8601()
  endDate: string;
}
