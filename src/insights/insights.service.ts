import { Injectable } from '@nestjs/common';
import { InsightRuleRegistryService } from './InsightRuleRegistryService';
import { InsightContextType } from './types/type';
import { InsightDTO } from './dto/insight.dto';
import { PatternInsightResponseDTO } from './dto/pattern.dto';
import { TransactionDataService } from '@/transactions/data/transaction-data.service';
import { InsightQueryDTO } from './dto/query.dto';
import { BudgetInsightResponseDTO } from './dto/budget.dto';
import { RecurringInsightResponseDTO } from './dto/recurring.dto';
import { RecurringDataService } from '@/recurring/data/RecurringDataService';
import { AlertInsightResponseDTO } from './dto/alert.dto';

@Injectable()
export class InsightsService {
  constructor(
    private readonly registry: InsightRuleRegistryService,
    private transactionDataService: TransactionDataService,
    private recurringDataService: RecurringDataService,
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

  async getRecurringInsights(
    userId: string,
    query: InsightQueryDTO,
  ): Promise<RecurringInsightResponseDTO> {
    const insights = await this.registry.generate(
      userId,
      ['insightRecurring'],
      query,
    );

    const recurringSummary =
      await this.recurringDataService.buildRecurringSummaryFromData(
        userId,
        query,
      );
    const { startDate, endDate, timeframe } = query;

    return {
      insights: insights,
      recurringSummary,
      startDate,
      endDate,
      timeframe,
    };
  }

  async getAlertInsights(
    userId: string,
    query: InsightQueryDTO,
  ): Promise<AlertInsightResponseDTO> {
    const insights = await this.registry.generate(
      userId,
      ['insightAlert'],
      query,
    );

    const filtered = insights.filter((i) =>
      ['warning', 'critical'].includes(i.severity),
    );

    const { startDate, endDate, timeframe } = query;
    return { insights: filtered, startDate, endDate, timeframe };
  }
}
