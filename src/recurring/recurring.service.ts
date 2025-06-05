import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { isBefore } from 'date-fns';
import { RecurringTransaction } from '@prisma/client';
import { recalculateAccountBalanceInTx } from '@/transactions/utils/recalculateAccountBalanceInTx.util';

@Injectable()
export class RecurringService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRecurringTransactionDto) {
    return this.prisma.recurringTransaction.create({
      data: {
        userId: userId,
        accountId: dto.accountId,
        toAccountId: dto.toAccountId,
        categoryId: dto.categoryId,
        type: dto.type,
        amount: dto.amount,
        startDate: new Date(dto.startDate).toISOString(),
        frequency: dto.frequency,
        interval: dto.interval ?? 1,
        anchorDay: dto.anchorDay,
        endDate: dto.endDate ? new Date(dto.endDate).toISOString() : null,
        note: dto.note,
        description: dto.description,
      },
    });
  }

  async generateUpcomingTransactions() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const allowDuplicates = true;
    const recurringList = await this.prisma.recurringTransaction.findMany({
      where: {
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
    });

    for (const recurring of recurringList) {
      const match = this.shouldGenerateForToday(recurring, today, {
        allowDuplicates,
      });
      if (!match) continue;

      // 중복 방지: 이미 생성된 트랜잭션이 있는지 확인
      const alreadyExists = await this.prisma.transaction.findFirst({
        where: {
          recurringTransactionId: recurring.id,
          date: {
            gte: new Date(todayStr),
            lt: new Date(todayStr + 'T23:59:59.999Z'),
          },
        },
      });

      if (!allowDuplicates && alreadyExists) continue;

      await this.prisma.transaction.create({
        data: {
          userId: recurring.userId,
          accountId: recurring.accountId,
          toAccountId: recurring.toAccountId,
          categoryId: recurring.categoryId,
          type: recurring.type,
          amount: recurring.amount,
          date: today,
          note: recurring.note,
          description: recurring.description,
          recurringTransactionId: recurring.id,
        },
      });
    }
  }

  shouldGenerateForToday(
    recurring: RecurringTransaction,
    today = new Date(),
    options?: { allowDuplicates?: boolean },
  ): boolean {
    if (options?.allowDuplicates) {
      return true;
    }

    const start = new Date(recurring.startDate);

    const todayUTC = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const startUTC = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    );

    if (isBefore(todayUTC, startUTC)) return false;

    const anchorDay = recurring.anchorDay ?? start.getUTCDate();
    const todayDay = today.getUTCDate();

    return todayDay === anchorDay;
  }
}
