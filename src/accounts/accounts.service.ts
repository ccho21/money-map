import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { endOfMonth, startOfMonth } from 'date-fns';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  // 계좌 생성
  async create(userId: string, dto: CreateAccountDto) {
    return this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        color: dto.color ?? '#2196F3', // 기본 색상
      },
    });
  }

  // 유저의 모든 계좌 조회
  async findAll(userId: string) {
    return this.prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 단일 계좌 조회
  async findOne(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) throw new NotFoundException('Account not found');
    if (account.userId !== userId)
      throw new ForbiddenException('Access denied');

    return account;
  }

  // 계좌 삭제
  async remove(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) throw new NotFoundException('Account not found');
    if (account.userId !== userId)
      throw new ForbiddenException('Access denied');

    return this.prisma.account.delete({
      where: { id: accountId },
    });
  }

  async getSummary(userId: string, year?: number, month?: number) {
    const dateFilter = (() => {
      if (!year || !month) return undefined;
      const start = startOfMonth(new Date(year, month - 1));
      const end = endOfMonth(start);
      return { gte: start, lte: end };
    })();

    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    const summaries = await Promise.all(
      accounts.map(async (account) => {
        const [income, expense] = await Promise.all([
          this.prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
              userId,
              accountId: account.id,
              type: 'income',
              ...(dateFilter && { date: dateFilter }),
            },
          }),
          this.prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
              userId,
              accountId: account.id,
              type: 'expense',
              ...(dateFilter && { date: dateFilter }),
            },
          }),
        ]);

        const totalIncome = income._sum.amount ?? 0;
        const totalExpense = expense._sum.amount ?? 0;
        const balance = totalIncome - totalExpense;

        return {
          accountId: account.id,
          name: account.name,
          type: account.type,
          color: account.color,
          totalIncome,
          totalExpense,
          balance,
        };
      }),
    );

    return summaries;
  }
}
