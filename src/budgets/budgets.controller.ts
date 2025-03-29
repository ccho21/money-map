import { Controller, Post, Body, Get, UseGuards, Query } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/types/user-payload.type';
import { BudgetAlert } from './types/budgets.types';
import { BudgetUsageQueryDto } from './types/budget-usage-query.dto';

@ApiTags('Budgets')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  create(@GetUser() user: UserPayload, @Body() dto: CreateBudgetDto) {
    return this.budgetsService.create(user.id, dto);
  }

  @Get()
  findAll(@GetUser() user: UserPayload) {
    return this.budgetsService.findAllByUser(user.id);
  }

  @Get('alerts')
  alerts(@GetUser() user: UserPayload): Promise<BudgetAlert[]> {
    return this.budgetsService.getBudgetAlerts(user.id);
  }
  
  @Get('usage')
  getBudgetUsage(
    @GetUser() user: UserPayload,
    @Query() query: BudgetUsageQueryDto,
  ) {
    return this.budgetsService.getBudgetUsage(user.id, query);
  }
}
