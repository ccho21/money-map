import { Controller, Post, Body, Get, UseGuards, Query } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/types/user-payload.type';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { CreateBudgetDTO } from './dto/create-budget.dto';

@ApiTags('Budgets')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  create(@GetUser() user: UserPayload, @Body() dto: CreateBudgetDTO) {
    return this.budgetsService.create(user.id, dto);
  }

  @Get()
  findAll(@GetUser() user: UserPayload) {
    return this.budgetsService.findAll(user.id);
  }

  // @Get('alerts')
  // alerts(@GetUser() user: UserPayload): Promise<BudgetAlert[]> {
  //   return this.budgetsService.getBudgetAlerts(user.id);
  // }

  @Get('summary')
  getBudgetSummary(
    @GetUser() user: UserPayload,
    @Query() query: BudgetQueryDto,
  ) {
    return this.budgetsService.getBudgetSummary(user.id, query);
  }
}
