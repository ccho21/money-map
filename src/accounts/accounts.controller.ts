import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
  Patch,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from 'src/common/guards/jwt.guard';
import { UserPayload } from 'src/auth/types/user-payload.type';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AccountTransactionSummaryDTO } from './dto/account-transaction-summary.dto';
import { AccountDashboardDTO } from './dto/account-dashboard.dto';
import {
  AccountCreateRequestDTO,
  AccountUpdateRequestDTO,
} from './dto/account-request.dto';
import { AccountQueryDTO } from './dto/query/account-query.dto';

@ApiTags('Accounts')
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(@Body() dto: AccountCreateRequestDTO, @GetUser() user: UserPayload) {
    return this.accountsService.create(user.id, dto);
  }

  @Get()
  findAll(@GetUser() user: UserPayload) {
    return this.accountsService.findAll(user.id);
  }

  @Get('grouped-transactions')
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getGroupedTransactions(
    @GetUser() user: UserPayload,
    @Query() query: AccountQueryDTO,
  ): Promise<AccountTransactionSummaryDTO> {
    return this.accountsService.getGroupedTransactions(user.id, query);
  }

  @Get('dashboard')
  @ApiOkResponse({ type: [AccountDashboardDTO] })
  getAccountsDashboard(
    @GetUser() user: UserPayload,
  ): Promise<AccountDashboardDTO> {
    return this.accountsService.getAccountsDashboard(user.id);
  }

  @Get('summary')
  getSummary(@GetUser() user: UserPayload, @Query() filter: AccountQueryDTO) {
    return this.accountsService.getSummary(user.id, filter);
  }

  // @Get(':accountId/summary')
  // async getAccountSummary(
  //   @Param('accountId') accountId: string,
  //   @Query() filter: DateRangeWithGroupQueryDTO,
  //   @GetUser() user: UserPayload,
  // ): Promise<TransactionGroupSummaryDTO> {
  //   return this.accountsService.getAccountSummary(accountId, user.id, filter);
  // }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: UserPayload) {
    return this.accountsService.findOne(user.id, id);
  }

  @Patch(':id')
  update(
    @GetUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: AccountUpdateRequestDTO,
  ) {
    return this.accountsService.update(user.id, id, dto);
  }

  @Delete(':id')
  async remove(@GetUser() user: UserPayload, @Param('id') id: string) {
    await this.accountsService.remove(user.id, id);
    return { success: true };
  }
}
