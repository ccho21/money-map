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
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { JwtGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { UserPayload } from 'src/auth/types/user-payload.type';

@ApiTags('Transactions')
@UseGuards(JwtGuard)
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
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'range',
    required: false,
    enum: ['date', 'week', 'month', 'year'],
  })
  @ApiQuery({ name: 'date', required: false, type: String })
  findAll(
    @GetUser() user: UserPayload,
    @Query('type') type?: 'income' | 'expense',
    @Query('categoryId') categoryId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('range') range?: 'date' | 'week' | 'month' | 'year',
    @Query('date') baseDate?: string, // YYYY-MM-DD
  ) {
    // 📌 range가 존재하면 startDate, endDate 자동 계산
    if (range && baseDate) {
      const dateObj = new Date(baseDate);
      let start: Date, end: Date;

      switch (range) {
        case 'date':
          start = new Date(baseDate + 'T00:00:00.000Z');
          end = new Date(baseDate + 'T23:59:59.999Z');
          break;
        case 'week': {
          const day = dateObj.getUTCDay(); // 일: 0 ~ 토: 6
          const diffToSun = day;
          const diffToSat = 6 - day;
          start = new Date(dateObj);
          start.setUTCDate(dateObj.getUTCDate() - diffToSun);
          start.setUTCHours(0, 0, 0, 0);
          end = new Date(dateObj);
          end.setUTCDate(dateObj.getUTCDate() + diffToSat);
          end.setUTCHours(23, 59, 59, 999);
          break;
        }
        case 'month':
          start = new Date(
            Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), 1),
          );
          end = new Date(
            Date.UTC(
              dateObj.getUTCFullYear(),
              dateObj.getUTCMonth() + 1,
              0,
              23,
              59,
              59,
              999,
            ),
          );
          break;
        case 'year':
          start = new Date(Date.UTC(dateObj.getUTCFullYear(), 0, 1));
          end = new Date(
            Date.UTC(dateObj.getUTCFullYear(), 11, 31, 23, 59, 59, 999),
          );
          break;
        default:
          throw new Error('Invalid range type');
      }

      // 자동 설정된 날짜 범위를 적용
      startDate = start.toISOString();
      endDate = end.toISOString();
    }

    return this.transactionService.findFilteredDetail(user.id, {
      type,
      categoryId,
      startDate,
      endDate,
      search,
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
