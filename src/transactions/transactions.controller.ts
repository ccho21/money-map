import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Param,
  Delete,
  Put,
  Patch,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserPayload } from 'src/auth/types/user-payload.type';
import {
  TransactionCreateRequestDTO,
  TransactionUpdateRequestDTO,
  TransactionTransferRequestDTO,
} from '@/transactions/dto/transaction-request.dto';
import { DateRangeWithGroupQueryDTO } from '@/common/dto/filter/date-range-with-group-query.dto';
import { GroupBy } from '@/common/types/types';
import { TransactionGroupSummaryDTO } from './dto/transaction-group-summary.dto';
import { TransactionDetailDTO } from './dto/transaction-detail.dto';

@ApiTags('Transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionService: TransactionsService) {}

  @Post()
  create(
    @GetUser() user: UserPayload,
    @Body() dto: TransactionCreateRequestDTO,
  ) {
    return this.transactionService.create(user.id, dto);
  }

  @Get('summary')
  @ApiQuery({
    name: 'groupBy',
    enum: GroupBy,
    required: true,
  })
  @ApiQuery({ name: 'startDate', type: String, required: true })
  @ApiQuery({ name: 'endDate', type: String, required: true })
  getTransactionSummary(
    @GetUser() user: UserPayload,
    @Query() query: DateRangeWithGroupQueryDTO,
  ): Promise<TransactionGroupSummaryDTO> {
    return this.transactionService.getTransactionSummary(user.id, query);
  }

  @Post('/transfer')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '계좌 간 이체 생성' })
  createTransfer(
    @Body() createTransferDto: TransactionTransferRequestDTO,
    @GetUser() user: UserPayload,
  ) {
    return this.transactionService.createTransfer(user.id, createTransferDto);
  }

  @Get('calendar')
  getCalendarView(
    @GetUser() user: UserPayload,
    @Query() query: DateRangeWithGroupQueryDTO,
  ) {
    return this.transactionService.getTransactionCalendarView(user.id, query);
  }

  @Put('/transfer/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '이체 트랜잭션 수정' })
  updateTransfer(
    @Param('id') id: string,
    @Body() dto: TransactionTransferRequestDTO,
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
    @Body() dto: TransactionUpdateRequestDTO,
  ) {
    return this.transactionService.update(user.id, id, dto);
  }

  @Delete(':id')
  delete(@GetUser() user: UserPayload, @Param('id') id: string) {
    return this.transactionService.delete(user.id, id);
  }
}
