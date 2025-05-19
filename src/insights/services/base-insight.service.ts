import { Insight } from '@/insights/types/insight.type';

export interface InsightGenerator<TInput> {
    generateInsights(input: TInput): Insight[];
  }
  