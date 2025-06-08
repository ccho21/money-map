// transfers.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateTransactionDTO } from './dto/transactions/transaction-create.dto';
import { UpdateTransactionDTO } from './dto/transactions/transaction-update.dto';
import { recalculateAccountBalanceInTx } from './utils/recalculateAccountBalanceInTx.util';

@Injectable()
export class TransactionsTransferService {
  private readonly logger = new Logger(TransactionsTransferService.name);

  constructor(private prisma: PrismaService) {}

  private async validateTransferAccounts(
    userId: string,
    fromId: string,
    toId: string,
  ) {
    if (fromId === toId) {
      throw new BadRequestException(
        'fromAccountId and toAccountId cannot be the same',
      );
    }

    const [from, to] = await Promise.all([
      this.prisma.account.findUnique({ where: { id: fromId } }),
      this.prisma.account.findUnique({ where: { id: toId } }),
    ]);

    if (!from || !to) {
      throw new NotFoundException('출금 또는 입금 계좌를 찾을 수 없습니다.');
    }

    if (from.userId !== userId || to.userId !== userId) {
      throw new ForbiddenException('본인의 계좌만 사용할 수 있습니다.');
    }

    return [from, to];
  }

  private async upsertRecurringTransfer(
    userId: string,
    dto: CreateTransactionDTO | UpdateTransactionDTO,
    existingRecurringId?: string | null,
  ) {
    if (!dto.recurring) {
      if (existingRecurringId) {
        await this.prisma.recurringTransaction.delete({
          where: { id: existingRecurringId },
        });
      }
      return null;
    }

    const data = {
      userId,
      type: 'transfer' as const,
      amount: dto.amount!,
      accountId: dto.fromAccountId!,
      toAccountId: dto.toAccountId!,
      note: dto.note ?? null,
      description: dto.description ?? null,
      frequency: dto.recurring.frequency,
      interval: dto.recurring.interval,
      startDate: new Date(dto.recurring.startDate),
      endDate: dto.recurring.endDate ? new Date(dto.recurring.endDate) : null,
    };

    if (existingRecurringId) {
      await this.prisma.recurringTransaction.update({
        where: { id: existingRecurringId },
        data,
      });
      return existingRecurringId;
    } else {
      const created = await this.prisma.recurringTransaction.create({ data });
      return created.id;
    }
  }

  private async createTransferTransactionPair(
    tx,
    {
      userId,
      amount,
      fromAccountId,
      toAccountId,
      date,
      note,
      description,
      recurringTransactionId,
    }: {
      userId: string;
      amount: number;
      fromAccountId: string;
      toAccountId: string;
      date?: string;
      note?: string | null;
      description?: string | null;
      recurringTransactionId?: string | null;
    },
  ) {
    const outTx = await tx.transaction.create({
      data: {
        type: 'transfer',
        amount,
        userId,
        accountId: fromAccountId,
        toAccountId,
        date,
        note,
        description,
        recurringTransactionId: recurringTransactionId ?? null,
      },
    });

    const inTx = await tx.transaction.create({
      data: {
        type: 'transfer',
        amount,
        userId,
        accountId: toAccountId,
        toAccountId: null,
        linkedTransferId: outTx.id,
        date,
        note,
        description,
      },
    });

    await tx.transaction.update({
      where: { id: outTx.id },
      data: { linkedTransferId: inTx.id },
    });

    return { outgoing: outTx, incoming: inTx };
  }

  async createTransfer(userId: string, dto: CreateTransactionDTO) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const { amount, fromAccountId, toAccountId, date, note, description } = dto;
    if (!fromAccountId || !toAccountId) {
      throw new BadRequestException('계좌 정보를 모두 입력하세요.');
    }

    const [fromAccount, toAccount] = await this.validateTransferAccounts(
      userId,
      fromAccountId!,
      toAccountId!,
    );

    if (fromAccount.type !== 'CARD' && fromAccount.balance < amount) {
      throw new BadRequestException('출금 계좌의 잔액이 부족합니다.');
    }

    try {
      const recurringId = await this.upsertRecurringTransfer(userId, dto);

      const result = await this.prisma.$transaction(async (tx) => {
        const transfer = await this.createTransferTransactionPair(tx, {
          userId,
          amount,
          fromAccountId,
          toAccountId,
          date,
          note,
          description,
          recurringTransactionId: recurringId,
        });

        await Promise.all([
          recalculateAccountBalanceInTx(tx, fromAccountId, userId),
          recalculateAccountBalanceInTx(tx, toAccountId, userId),
        ]);

        return transfer;
      });

      return result;
    } catch (err) {
      this.logger.error('❌ createTransfer 실패:', err);
      throw new InternalServerErrorException('이체 중 오류가 발생했습니다.');
    }
  }

  async updateTransfer(userId: string, id: string, dto: UpdateTransactionDTO) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const original = await this.prisma.transaction.findUnique({
      where: { id },
      include: { account: true },
    });

    if (!original || original.userId !== userId) {
      throw new NotFoundException('수정할 트랜잭션을 찾을 수 없습니다.');
    }

    const { amount, fromAccountId, toAccountId, date, note, description } = dto;
    const [fromAccount, toAccount] = await this.validateTransferAccounts(
      userId,
      fromAccountId!,
      toAccountId!,
    );

    if (fromAccount.type !== 'CARD') {
      const simulated = fromAccount.balance + original.amount - (amount ?? 0);
      if (simulated < 0) {
        throw new BadRequestException('출금 계좌의 잔액이 부족합니다.');
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (original.type === 'transfer' && original.linkedTransferId) {
        await tx.transaction.delete({
          where: { id: original.linkedTransferId },
        });
      }

      const incoming = await tx.transaction.create({
        data: {
          type: 'transfer',
          userId,
          amount: amount ?? 0,
          accountId: toAccountId!,
          toAccountId: null,
          linkedTransferId: original.id,
          date: date ?? new Date(),
          note,
          description,
        },
      });

      const outgoing = await tx.transaction.update({
        where: { id },
        data: {
          type: 'transfer',
          amount,
          accountId: fromAccountId!,
          toAccountId: toAccountId!,
          linkedTransferId: incoming.id,
          date,
          note,
          description,
          categoryId: null,
        },
      });

      await Promise.all([
        recalculateAccountBalanceInTx(tx, fromAccountId!, userId),
        recalculateAccountBalanceInTx(tx, toAccountId!, userId),
      ]);

      return { updatedOutgoing: outgoing, updatedIncoming: incoming };
    });

    await this.upsertRecurringTransfer(
      userId,
      dto,
      original.recurringTransactionId,
    );
    return result;
  }

  async deleteTransfer(userId: string, id: string) {
    const outgoing = await this.prisma.transaction.findUnique({
      where: { id },
      include: { account: true },
    });

    if (
      !outgoing ||
      outgoing.deletedAt ||
      outgoing.userId !== userId ||
      outgoing.type !== 'transfer'
    ) {
      throw new NotFoundException('삭제할 트랜잭션을 찾을 수 없습니다.');
    }

    const incoming = await this.prisma.transaction.findUnique({
      where: { id: outgoing.linkedTransferId ?? undefined },
      include: { account: true },
    });

    if (!incoming || incoming.deletedAt) {
      throw new NotFoundException('연결된 입금 트랜잭션을 찾을 수 없습니다.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.updateMany({
        where: { id: { in: [outgoing.id, incoming.id] } },
        data: { deletedAt: new Date() },
      });

      await Promise.all([
        recalculateAccountBalanceInTx(tx, outgoing.accountId, userId),
        recalculateAccountBalanceInTx(tx, incoming.accountId, userId),
      ]);
    });

    if (outgoing.recurringTransactionId) {
      await this.prisma.recurringTransaction.delete({
        where: { id: outgoing.recurringTransactionId },
      });
    }

    return { success: true };
  }
}
