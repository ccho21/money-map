import { forwardRef, Module } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BudgetDataService } from './data/BudgetDataService';

@Module({
  imports: [PrismaModule],
  controllers: [BudgetsController],
  providers: [BudgetsService, BudgetDataService],
  exports: [BudgetDataService],
})
export class BudgetsModule {}
