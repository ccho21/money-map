import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { InsightService } from './insights.service';
import { CreateInsightDto } from './dto/create-insight.dto';
import { UpdateInsightDto } from './dto/update-insight.dto';

@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightService) {}


}
