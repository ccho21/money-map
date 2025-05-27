import { Cron } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { RecurringService } from './recurring.service';

@Injectable()
export class RecurringScheduler {
  constructor(private readonly recurringService: RecurringService) {}

  @Cron('0 0 * * *') // 매일 00:00 UTC
  handleDailyGeneration() {
    console.log('⏰ Running recurring transaction generation...');
    return this.recurringService.generateUpcomingTransactions()
  }
}
