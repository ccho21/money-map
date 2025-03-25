import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { UserPayload } from 'src/auth/types/user-payload.type';
import { GroupedResponseDto, GroupQueryDto } from './dto/transaction.dto';

@ApiTags('Transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionService: TransactionsService) {}

  @Post()
  create(@GetUser() user: UserPayload, @Body() dto: CreateTransactionDto) {
    return this.transactionService.create(user.id, dto);
  }

  @Get()
  @ApiQuery({ name: 'type', required: false, enum: ['income', 'expense'] })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'startDate', required: false, type: String }) // ✅ 명시적 필터
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @GetUser() user: UserPayload,
    @Query('type') type?: 'income' | 'expense',
    @Query('categoryId') categoryId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    return this.transactionService.findFiltered(user.id, {
      type,
      categoryId,
      startDate,
      endDate,
      search,
    });
  }

  @Get('grouped')
  @ApiQuery({
    name: 'range',
    enum: ['date', 'week', 'month', 'year'],
    required: true,
  })
  @ApiQuery({ name: 'date', type: String, required: true })
  @ApiQuery({
    name: 'includeEmpty',
    type: Boolean,
    required: false,
    description: '거래가 없는 날짜/월도 포함할지 여부 (기본값: false)',
  })
  getGroupedData(
    @GetUser() user: UserPayload,
    @Query() query: GroupQueryDto,
    @Query('includeEmpty', new DefaultValuePipe(false), ParseBoolPipe)
    includeEmpty: boolean,
  ): Promise<GroupedResponseDto> {
    return this.transactionService.getGroupedTransactionData(user.id, {
      ...query,
      includeEmpty,
    });
  }

  @Get('calendar')
  getCalendarSummary(
    @GetUser('id') user: UserPayload,
    @Query('month') month: string, // e.g., '2025-03'
  ) {
    return this.transactionService.getMonthlySummary(user.id, month);
  }

  @Patch(':id')
  update(
    @GetUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@GetUser() user: UserPayload, @Param('id') id: string) {
    return this.transactionService.remove(user.id, id);
  }
}
