import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Param,
  Delete,
  Patch,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/types/user-payload.type';

import { DateRangeWithGroupQueryDTO } from '@/common/dto/filter/date-range-with-group-query.dto';
import { TransactionGroupQueryDTO } from './dto/params/transaction-group-query.dto';
import { TransactionChartFlowDTO } from './dto/charts/transaction-chart-flow.dto';
import { TransactionChartCategoryDTO } from './dto/charts/transaction-chart-category.dto';
import { TransactionChartBudgetDTO } from './dto/charts/transaction-chart-budget.dto';
import { TransactionChartAccountDTO } from './dto/charts/transaction-chart-account.dto';
import { TransactionDetailDTO } from './dto/transactions/transaction-detail.dto';
import { CreateTransactionDTO } from './dto/transactions/transaction-create.dto';
import { UpdateTransactionDTO } from './dto/transactions/transaction-update.dto';

@ApiTags('Transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionService: TransactionsService) {}

  @Post()
  create(
    @GetUser() user: UserPayload,
    @Body() dto: CreateTransactionDTO,
  ) {
    return this.transactionService.create(user.id, dto);
  }

  @Get('summary')
  getSummary(
    @GetUser() user: UserPayload,
    @Query() query: TransactionGroupQueryDTO,
  ) {
    return this.transactionService.getTransactionSummary(user.id, query);
  }

  @Get('groups')
  getGroupedTransactions(
    @GetUser() user: UserPayload,
    @Query() query: TransactionGroupQueryDTO,
  ) {
    return this.transactionService.getGroupedTransactions(user.id, query);
  }

  @Get('calendar')
  getCalendarView(
    @GetUser() user: UserPayload,
    @Query() query: TransactionGroupQueryDTO,
  ) {
    return this.transactionService.getTransactionCalendarView(user.id, query);
  }


  @Get('keyword/recommendations')
  getKeywords(
    @GetUser() user: UserPayload,
  ) {
    return this.transactionService.getRecommendedKeywords(user.id);
  }

  @Get('charts/flow')
  async getChartFlow(
    @GetUser() user: UserPayload,
    @Query() query: TransactionGroupQueryDTO,
  ): Promise<TransactionChartFlowDTO> {
    return this.transactionService.getChartFlow(user.id, query);
  }

  @Get('charts/category')
  async getChartCategory(
    @GetUser() user: UserPayload,
    @Query() query: TransactionGroupQueryDTO,
  ): Promise<TransactionChartCategoryDTO> {
    return this.transactionService.getChartCategory(user.id, query);
  }

  @Get('charts/account')
  async getChartAccount(
    @GetUser() user: UserPayload,
    @Query() query: TransactionGroupQueryDTO,
  ): Promise<TransactionChartAccountDTO> {
    return this.transactionService.getChartAccount(user.id, query);
  }

  @Get('charts/budget')
  async getChartBudget(
    @GetUser() user: UserPayload,
    @Query() query: TransactionGroupQueryDTO,
  ): Promise<TransactionChartBudgetDTO> {
    return this.transactionService.getChartBudget(user.id, query);
  }

  /////////////////////////////  /////////////////////////////  /////////////////////////////  /////////////////////////////  /////////////////////////////

  // @Get('summary')
  // @ApiQuery({
  //   name: 'groupBy',
  //   enum: GroupBy,
  //   required: true,
  // })
  // @ApiQuery({ name: 'startDate', type: String, required: true })
  // @ApiQuery({ name: 'endDate', type: String, required: true })
  // getTransactionSummary(
  //   @GetUser() user: UserPayload,
  //   @Query() query: DateRangeWithGroupQueryDTO,
  // ): Promise<TransactionGroupSummaryDTO> {
  //   return this.transactionService.getTransactionSummary(user.id, query);
  // }

  // @Get('summary/scroll')
  // @ApiQuery({ name: 'groupBy', enum: GroupBy, required: true })
  // @ApiQuery({ name: 'limit', type: Number, required: true })
  // @ApiQuery({ name: 'cursorDate', type: String, required: true })
  // @ApiQuery({ name: 'cursorId', type: String, required: true })
  // @ApiQuery({ name: 'startDate', type: String, required: false })
  // @ApiQuery({ name: 'endDate', type: String, required: false })
  // getTransactionSummaryByCursor(
  //   @GetUser() user: UserPayload,
  //   @Query() query: TransactionSummaryCursorQueryDTO,
  // ): Promise<TransactionCursorSummaryResponseDTO> {
  //   return this.transactionService.getTransactionSummaryByCursor(
  //     user.id,
  //     query,
  //   );
  // }

  @Post('/transfer')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '계좌 간 이체 생성' })
  createTransfer(
    @Body() createTransferDto: CreateTransactionDTO,
    @GetUser() user: UserPayload,
  ) {
    return this.transactionService.createTransfer(user.id, createTransferDto);
  }

  @Patch('/transfer/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '이체 트랜잭션 수정' })
  updateTransfer(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDTO,
    @GetUser() user: UserPayload,
  ) {
    return this.transactionService.updateTransfer(user.id, id, dto);
  }

  @Delete('/transfer/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '이체 트랜잭션 삭제' })
  deleteTransfer(@Param('id') id: string, @GetUser() user: UserPayload) {
    return this.transactionService.deleteTransfer(user.id, id);
  }

  @Get(':id')
  findOne(
    @GetUser() user: UserPayload,
    @Param('id') id: string,
  ): Promise<TransactionDetailDTO> {
    return this.transactionService.getTransactionById(user.id, id);
  }

  @Patch(':id')
  update(
    @GetUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDTO,
  ) {
    return this.transactionService.update(user.id, id, dto);
  }

  @Delete(':id')
  delete(@GetUser() user: UserPayload, @Param('id') id: string) {
    return this.transactionService.delete(user.id, id);
  }
}
