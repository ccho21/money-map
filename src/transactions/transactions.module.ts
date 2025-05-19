import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EventsModule } from 'src/events/events.module';
import { InsightsModule } from '@/insights/insights.module';

@Module({
  imports: [PrismaModule, EventsModule, InsightsModule],
  providers: [TransactionsService],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
