import { Injectable } from '@nestjs/common';
import { InsightRuleRegistryService } from './InsightRuleRegistryService';
import { InsightContextType } from './types/type';
import { InsightDTO } from './dto/insight.dto';
import { PatternInsightResponseDTO } from './dto/pattern.dto';
import { TransactionDataService } from '@/transactions/data/transaction-data.service';
import { InsightQueryDTO } from './dto/query.dto';
import { BudgetInsightResponseDTO } from './dto/budget.dto';

@Injectable()
export class InsightService {
  constructor(
    private readonly registry: InsightRuleRegistryService,
    private transactionDataService: TransactionDataService,
  ) {}

  /**
   * Generate all applicable insights for the user, based on context(s).
   * @param userId string
   * @param contexts InsightContextType[] — e.g., ['dashboard'], ['chartBudget'], etc.
   * @returns InsightDTO[]
   */
  async generateInsights(
    userId: string,
    contexts: InsightContextType[],
    query: InsightQueryDTO,
  ): Promise<InsightDTO[]> {
    return await this.registry.generate(userId, contexts, query);
  }

  async getPatternInsights(
    userId: string,
    query: InsightQueryDTO,
  ): Promise<PatternInsightResponseDTO> {
    const { startDate, endDate, timeframe } = query;
    const insights = await this.registry.generate(
      userId,
      ['insightPattern'],
      query,
    );

    const byDay = await this.transactionDataService.getSpendingByDay(
      startDate,
      endDate,
      userId,
    );
    const byTime = await this.transactionDataService.getSpendingByTime(
      startDate,
      endDate,
      userId,
    );

    return {
      insights,
      byDay,
      byTime,
      startDate,
      endDate,
      timeframe,
    };
  }

  async getBudgetInsights(
    userId: string,
    query: InsightQueryDTO,
  ): Promise<BudgetInsightResponseDTO> {
    const insights = await this.registry.generate(
      userId,
      ['insightBudget'],
      query,
    );

    const { startDate, endDate, timeframe } = query;
    const byCategory = await this.transactionDataService.getBudgetByCategory(
      userId,
      startDate,
      endDate,
    );

    return {
      insights,
      byCategory,
      startDate,
      endDate,
      timeframe,
    };
  }
}
