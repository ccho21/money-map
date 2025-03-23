import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { JwtGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Analysis')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get('summary')
  @ApiQuery({ name: 'range', enum: ['weekly', 'monthly', 'yearly'] })
  getSummary(
    @GetUser() user,
    @Query('range') range: 'weekly' | 'monthly' | 'yearly' = 'monthly',
  ) {
    return this.analysisService.getSummary(user.sub, range);
  }

  @Get('by-category')
  @ApiQuery({ name: 'categoryId', required: true })
  getByCategory(@GetUser() user, @Query('categoryId') categoryId: string) {
    return this.analysisService.getByCategory(user.sub, categoryId);
  }

  @Get('ranking')
  getTopSpendingPeriods(@GetUser() user) {
    return this.analysisService.getTopSpendingPeriods(user.sub);
  }

  @Get('yoy')
  getYoY(@GetUser() user) {
    return this.analysisService.getYoYComparison(user.sub);
  }

  @Get('mom')
  getMoM(@GetUser() user) {
    return this.analysisService.getMoMComparison(user.sub);
  }
}
