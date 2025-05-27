// insights/insights.module.ts
import { Module } from '@nestjs/common';
import { InsightRuleRegistryService } from './InsightRuleRegistryService';
import { BudgetExceededRule } from './rules/BudgetExceededRule';
import { PrismaService } from '@/prisma/prisma.service';
import { InsightService } from './insights.service';
import { BudgetDataService } from '@/budgets/data/BudgetDataService';
import { TransactionDataService } from '@/transactions/data/transaction-data.service';
import { WeekendSpendingRule } from './rules/WeekendSpendingRule';
import { LateNightShoppingRule } from './rules/LateNightShoppingRule';
import { CategoryDataService } from '@/categories/data/CategoryDataService';
import { CategoryOverspendRule } from './rules/CategoryOverspendRule';
import { NoSavingsRule } from './rules/NoSavingsRule';
import { SameDayMultipleTxRule } from './rules/SameDayMultipleTxRule';
import { IncomeDropRule } from './rules/IncomeDropRule';
import { CardOveruseRule } from './rules/CardOveruseRule';
import { InsightsController } from './insights.controller';

@Module({
  controllers: [InsightsController],
  providers: [
    InsightService,
    InsightRuleRegistryService,
    BudgetDataService,
    TransactionDataService,
    CategoryDataService,
    PrismaService,
    // RULES
    BudgetExceededRule,
    WeekendSpendingRule,
    LateNightShoppingRule,
    CategoryOverspendRule,
    NoSavingsRule,
    SameDayMultipleTxRule,
    IncomeDropRule,
    CardOveruseRule,
  ],
  exports: [InsightService],
})
export class InsightsModule {}
