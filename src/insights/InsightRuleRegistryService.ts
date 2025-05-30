// insights/InsightRuleRegistryService.ts
import { Injectable } from '@nestjs/common';
import { InsightRuleBase } from './rules/InsightRuleBase';
import { BudgetExceededRule } from './rules/BudgetExceededRule'; // 일단 이거 하나만
import { InsightContextType } from './types/type';
import { WeekendSpendingRule } from './rules/WeekendSpendingRule';
import { LateNightShoppingRule } from './rules/LateNightShoppingRule';
import { CategoryOverspendRule } from './rules/CategoryOverspendRule';
import { NoSavingsRule } from './rules/NoSavingsRule';
import { SameDayMultipleTxRule } from './rules/SameDayMultipleTxRule';
import { IncomeDropRule } from './rules/IncomeDropRule';
import { CardOveruseRule } from './rules/CardOveruseRule';
import { InsightDTO } from './dto/insight.dto';
import { InsightQueryDTO } from './dto/query.dto';
import { RecurringIncreaseRule } from './rules/RecurringIncreaseRule';

@Injectable()
export class InsightRuleRegistryService {
  constructor(
    private readonly budgetExceededRule: BudgetExceededRule,
    private readonly weekendSpendingRule: WeekendSpendingRule,
    private readonly lateNightShoppingRule: LateNightShoppingRule,
    private readonly categoryOverspendRule: CategoryOverspendRule,
    private readonly noSavingsRule: NoSavingsRule,
    private readonly sameDayMultipleTxRule: SameDayMultipleTxRule,
    private readonly incomeDropRule: IncomeDropRule,
    private readonly cardOveruseRule: CardOveruseRule,
    private readonly recurringIncreaseRule: RecurringIncreaseRule,
  ) {}

  private getAllRules(): InsightRuleBase[] {
    return [
      this.budgetExceededRule,
      this.weekendSpendingRule,
      this.lateNightShoppingRule,
      this.categoryOverspendRule,
      this.noSavingsRule,
      this.sameDayMultipleTxRule,
      this.incomeDropRule,
      this.cardOveruseRule,
      this.recurringIncreaseRule,
    ];
  }

  private getRulesForContext(contexts: InsightContextType[]) {
    return this.getAllRules().filter((rule) =>
      rule.getSupportedContexts().some((ctx) => contexts.includes(ctx)),
    );
  }

  async generate(
    userId: string,
    contexts: InsightContextType[],
    query: InsightQueryDTO,
  ): Promise<InsightDTO[]> {
    const rules = this.getRulesForContext(contexts);
    const results = await Promise.all(
      rules.map((r) => r.generate(userId, query)),
    );
    return results.flat();
  }
}
