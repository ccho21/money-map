// transactions.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateTransactionDTO } from './dto/transactions/transaction-create.dto';
import { UpdateTransactionDTO } from './dto/transactions/transaction-update.dto';
import { TransactionDetailDTO } from './dto/transactions/transaction-detail.dto';
import { recalculateAccountBalanceInTx } from './utils/recalculateAccountBalanceInTx.util';
import { BudgetAlertService } from './budget-alert.service';
import { convertToTransactionDetailDTO } from './utils/transaction.mapper';
import { RecurringTransaction } from '@prisma/client';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private prisma: PrismaService,
    private budgetAlertService: BudgetAlertService,
  ) {}

  private async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    return user;
  }

  private async validateCategory(categoryId: string | null | undefined) {
    if (!categoryId) throw new BadRequestException('Category ID is required.');
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    return category;
  }

  private async validateAccount(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('계좌를 찾을 수 없습니다.');
    return account;
  }

  async create(userId: string, dto: CreateTransactionDTO) {
    await this.validateUser(userId);
    await this.validateCategory(dto.categoryId);
    await this.validateAccount(dto.accountId);

    let recurring: RecurringTransaction | null = null;

    if (dto.recurring?.frequency && dto.recurring?.startDate) {
      recurring = await this.prisma.recurringTransaction.create({
        data: {
          userId,
          type: dto.type,
          amount: dto.amount,
          categoryId: dto.categoryId,
          accountId: dto.accountId,
          toAccountId: dto.toAccountId ?? null,
          note: dto.note ?? null,
          description: dto.description ?? null,
          frequency: dto.recurring.frequency,
          interval: dto.recurring.interval,
          startDate: new Date(dto.recurring.startDate),
          endDate: dto.recurring.endDate
            ? new Date(dto.recurring.endDate)
            : null,
        },
      });
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          type: dto.type,
          amount: dto.amount,
          categoryId: dto.categoryId,
          accountId: dto.accountId,
          toAccountId: dto.toAccountId ?? null,
          note: dto.note ?? null,
          description: dto.description ?? null,
          date: dto.date,
          userId,
          recurringTransactionId: recurring?.id ?? null,
        },
      });

      await recalculateAccountBalanceInTx(tx, dto.accountId, userId);
      return created;
    });

    if (dto.categoryId && dto.date) {
      await this.budgetAlertService.checkAndEmit(
        userId,
        dto.categoryId,
        new Date(dto.date),
      );
    }

    return transaction;
  }

  async update(userId: string, id: string, dto: UpdateTransactionDTO) {
    const existing = await this.prisma.transaction.findUnique({
      where: { id },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('거래를 찾을 수 없습니다.');
    }
    if (existing.isOpening) {
      throw new BadRequestException('Opening Balance는 삭제할 수 없습니다.');
    }
    await this.validateUser(userId);

    const updatedTransaction = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id },
        data: {
          ...(dto.type && { type: dto.type }),
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.categoryId && { categoryId: dto.categoryId }),
          ...(dto.accountId && { accountId: dto.accountId }),
          ...(dto.date && { date: dto.date }),
          ...(dto.note !== undefined && { note: dto.note }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
        },
      });

      const promises = [
        recalculateAccountBalanceInTx(tx, existing.accountId, userId),
      ];
      if (dto.accountId && dto.accountId !== existing.accountId) {
        promises.push(recalculateAccountBalanceInTx(tx, dto.accountId, userId));
      }
      await Promise.all(promises);
      return updated;
    });

    const existingRecurringId = existing.recurringTransactionId;
    if (!dto.recurring && existingRecurringId) {
      await this.prisma.recurringTransaction.delete({
        where: { id: existingRecurringId },
      });
      await this.prisma.transaction.update({
        where: { id },
        data: { recurringTransactionId: null },
      });
    }

    if (dto.recurring) {
      const recurringData = {
        userId,
        type: dto.type ?? existing.type,
        amount: dto.amount ?? existing.amount,
        categoryId: dto.categoryId ?? existing.categoryId,
        accountId: dto.accountId ?? existing.accountId,
        toAccountId: dto.toAccountId ?? null,
        note: dto.note ?? existing.note,
        description: dto.description ?? existing.description,
        frequency: dto.recurring.frequency,
        interval: dto.recurring.interval,
        startDate: new Date(dto.recurring.startDate),
        endDate: dto.recurring.endDate ? new Date(dto.recurring.endDate) : null,
      };

      if (existingRecurringId) {
        await this.prisma.recurringTransaction.update({
          where: { id: existingRecurringId },
          data: recurringData,
        });
      } else {
        const newRecurring = await this.prisma.recurringTransaction.create({
          data: recurringData,
        });
        await this.prisma.transaction.update({
          where: { id },
          data: { recurringTransactionId: newRecurring.id },
        });
      }
    }

    const categoryId = dto.categoryId ?? existing.categoryId;
    const rawDate = dto.date ?? existing.date;
    if (!categoryId || !rawDate) {
      throw new BadRequestException('카테고리와 날짜는 필수입니다.');
    }
    await this.budgetAlertService.checkAndEmit(
      userId,
      categoryId,
      new Date(rawDate),
    );
    return updatedTransaction;
  }

  async delete(userId: string, id: string): Promise<{ message: string }> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('거래를 찾을 수 없습니다.');
    if (existing.isOpening)
      throw new BadRequestException('Opening Balance는 삭제할 수 없습니다.');

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await recalculateAccountBalanceInTx(tx, existing.accountId, userId);
      if (existing.type === 'transfer' && existing.toAccountId) {
        await recalculateAccountBalanceInTx(tx, existing.toAccountId, userId);
      }
    });

    if (existing.recurringTransactionId) {
      await this.prisma.recurringTransaction.delete({
        where: { id: existing.recurringTransactionId },
      });
    }

    return { message: '삭제 완료' };
  }

  async getTransactionById(
    userId: string,
    transactionId: string,
  ): Promise<TransactionDetailDTO> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { category: true, account: true, toAccount: true },
    });

    if (!tx || tx.deletedAt || tx.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return convertToTransactionDetailDTO(tx);
  }
}
