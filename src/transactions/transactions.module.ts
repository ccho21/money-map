import { forwardRef, Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EventsModule } from 'src/events/events.module';
import { InsightsModule } from '@/insights/insights.module';
import { TransactionDataService } from './data/transaction-data.service';

@Module({
  imports: [PrismaModule, EventsModule, forwardRef(() => InsightsModule)],
  providers: [TransactionsService, TransactionDataService],
  controllers: [TransactionsController],
  exports: [TransactionDataService],
})
export class TransactionsModule {}
