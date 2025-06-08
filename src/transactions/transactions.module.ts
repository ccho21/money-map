import { forwardRef, Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EventsModule } from 'src/events/events.module';
import { InsightsModule } from '@/insights/insights.module';
import { TransactionDataService } from './data/transaction-data.service';
import { TransactionsAnalysisService } from './analysis.service';
import { TransactionsTransferService } from './transfer.service';
import { DateRangeService } from './date-range.service';
import { BudgetAlertService } from './budget-alert.service';

@Module({
  imports: [PrismaModule, EventsModule, forwardRef(() => InsightsModule)],
  providers: [
    TransactionsService,
    TransactionDataService,
    TransactionsAnalysisService,
    TransactionsTransferService,
    DateRangeService,
    BudgetAlertService,
  ],
  controllers: [TransactionsController],
  exports: [TransactionDataService],
})
export class TransactionsModule {}
