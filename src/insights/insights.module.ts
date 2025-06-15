// insights/insights.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { InsightRuleRegistryService } from './InsightRuleRegistryService';
import { BudgetExceededRule } from './rules/BudgetExceededRule';
import { PrismaService } from '@/prisma/prisma.service';
import { WeekendSpendingRule } from './rules/WeekendSpendingRule';
import { LateNightShoppingRule } from './rules/LateNightShoppingRule';
import { CategoryOverspendRule } from './rules/CategoryOverspendRule';
import { NoSavingsRule } from './rules/NoSavingsRule';
import { SameDayMultipleTxRule } from './rules/SameDayMultipleTxRule';
import { IncomeDropRule } from './rules/IncomeDropRule';
import { CardOveruseRule } from './rules/CardOveruseRule';
import { InsightsController } from './insights.controller';
import { RecurringIncreaseRule } from './rules/RecurringIncreaseRule';
import { AccountsModule } from '@/accounts/accounts.module';
import { BudgetsModule } from '@/budgets/budgets.module';
import { CategoriesModule } from '@/categories/categories.module';
import { TransactionsModule } from '@/transactions/transactions.module';
import { RecurringModule } from '@/recurring/recurring.module';
import { InsightsService } from './insights.service';

@Module({
  imports: [
    forwardRef(() => AccountsModule),
    forwardRef(() => BudgetsModule),
    forwardRef(() => CategoriesModule),
    forwardRef(() => TransactionsModule),
    forwardRef(() => RecurringModule),
  ],
  controllers: [InsightsController],
  providers: [
    InsightsService,
    InsightRuleRegistryService,
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
    RecurringIncreaseRule,
  ],
  exports: [InsightsService],
})
export class InsightsModule {}
