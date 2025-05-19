import { Module } from '@nestjs/common';
import { InsightsController } from './insights.controller';
import { ChartFlowInsightService } from './services/chart-flow-insight.service';
import { InsightService } from './insights.service';

@Module({
  controllers: [InsightsController],
  providers: [InsightService, ChartFlowInsightService],
  exports: [ChartFlowInsightService, InsightService],
})
export class InsightsModule {}
