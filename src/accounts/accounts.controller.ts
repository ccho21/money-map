import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt.guard';
import { UserPayload } from 'src/auth/types/user-payload.type';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Accounts')
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(@Body() dto: CreateAccountDto, @GetUser() user: UserPayload) {
    return this.accountsService.create(user.id, dto);
  }

  @Get()
  findAll(@GetUser() user: UserPayload) {
    return this.accountsService.findAll(user.id);
  }

  @Get('summary')
  getSummary(
    @GetUser() user: UserPayload,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const y = year ? parseInt(year) : undefined;
    const m = month ? parseInt(month) : undefined;
    return this.accountsService.getSummary(user.id, y, m);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: UserPayload) {
    return this.accountsService.findOne(user.id, id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetUser() user: UserPayload) {
    return this.accountsService.remove(user.id, id);
  }
}
