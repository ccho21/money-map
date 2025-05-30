import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Query,
  Put,
  Param,
} from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/types/user-payload.type';

import { DateRangeWithGroupQueryDTO } from '@/common/dto/filter/date-range-with-group-query.dto';
import {
  BudgetCategoryCreateRequestDTO,
  BudgetCategoryUpdateRequestDTO,
} from './dto/budget-category-request.dto';
import { BudgetQueryDTO } from './dto/params/budget-query.dto';

@ApiTags('Budgets')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

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
    @Query() query: DateRangeWithGroupQueryDTO,
  ) {
    return this.budgetsService.getSummary(user.id, query);
  }

  @Get('by-category')
  @UseGuards(JwtAuthGuard)
  getByCategory(@GetUser() user: UserPayload, @Query() query: BudgetQueryDTO) {
    return this.budgetsService.getBudgetCategories(user.id, query);
  }

  @Post('by-category')
  @UseGuards(JwtAuthGuard)
  createBudgetCategory(
    @GetUser() user: UserPayload,
    @Body() dto: BudgetCategoryCreateRequestDTO,
  ) {
    return this.budgetsService.createBudgetCategory(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/by-category/:categoryId')
  async getBudgetCategoryByCategoryId(
    @GetUser() user: UserPayload,
    @Param('categoryId') categoryId: string,
    @Query() query: BudgetQueryDTO,
  ) {
    return this.budgetsService.getGroupedBudgetCategories(
      user.id,
      categoryId,
      query,
    );
  }

  @Put('/by-category/:categoryId')
  @UseGuards(JwtAuthGuard)
  updateBudgetCategory(
    @GetUser() user: UserPayload,
    @Param('categoryId') categoryId: string,
    @Body() dto: BudgetCategoryUpdateRequestDTO,
  ) {
    return this.budgetsService.updateBudgetCategory(user.id, categoryId, dto);
  }
}
