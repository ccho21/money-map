import { forwardRef, Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { InsightsModule } from '@/insights/insights.module';
@Module({
  imports: [PrismaModule, forwardRef(() => InsightsModule)],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
