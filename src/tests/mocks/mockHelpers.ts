import { PrismaService } from '@/prisma/prisma.service';
import { StatsQuery } from '@/stats/dto/stats-query.dto';
import { GroupBy } from '@/common/types/types';
import { AccountType, CategoryType, TransactionType } from '@prisma/client';

export function mockPrismaFactory(): jest.Mocked<PrismaService> {
  return {
    user: { findUnique: jest.fn() },
    category: { findMany: jest.fn() },
    transaction: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    budgetCategory: { findMany: jest.fn() },
  } as unknown as jest.Mocked<PrismaService>;
}

export const mockUser = {
  id: 'user-123',
  name: 'Test User',
  timezone: 'UTC',
  createdAt: new Date('2023-01-01T00:00:00Z'),
  email: 'test@example.com',
  password: 'hashed-password',
  hashedRefreshToken: null,
};

export const mockStatsQuery: StatsQuery = {
  startDate: '2023-01-01',
  endDate: '2023-01-31',
  type: 'expense',
  groupBy: 'monthly' as GroupBy,
};

export const mockCategory = {
  id: 'cat1',
  name: 'Food',
  type: 'expense' as CategoryType,
  icon: '🍔',
  userId: 'user-123',
  color: '#999999',
};

export const mockTransactionGroupByResult = {
  id: 'tx1',
  type: 'expense' as TransactionType,
  userId: 'user-123',
  createdAt: new Date('2023-01-01T00:00:00Z'),
  categoryId: 'cat1',
  accountId: 'acc1',
  toAccountId: null,
  linkedTransferId: null,
  isTransfer: false,
  isOpening: false,
  note: 'Starbucks',
  date: new Date('2023-01-15'),
  description: '',
  dueDate: null,
  paidAt: null,
  amount: 3200,
  _sum: { amount: 3200 },
};

export const mockBudgetCategory = {
  id: 'bud1',
  type: 'expense' as CategoryType,
  startDate: new Date('2023-01-01'),
  endDate: new Date('2023-01-31'),
  amount: 50000,
  categoryId: 'cat1',
  budgetId: 'budget-1',
};

export const mockTransaction = {
  id: 'tx1',
  userId: 'user-123',
  accountId: 'acc1',
  toAccountId: null,
  linkedTransferId: null,
  isTransfer: false,
  isOpening: false,
  description: '',
  dueDate: null,
  paidAt: null,
  amount: 5000,
  type: 'expense' as TransactionType,
  categoryId: 'cat1',
  note: 'Starbucks ☕️',
  date: new Date('2023-01-15'),
  createdAt: new Date('2023-01-14T10:00:00Z'),
  category: {
    id: 'cat1',
    name: 'Coffee',
    icon: '☕️',
    type: 'expense' as CategoryType,
  },
  account: {
    id: 'acc1',
    name: 'Main Account',
    type: 'checking',
    color: '#00AAFF',
  },
};

// ✅ 기존 서비스 유닛 테스트용 객체도 유지
export const mockAccount = {
  id: 'acc-001',
  userId: 'user-123',
  name: 'Main Account',
  type: AccountType.BANK,
  color: null,
  description: null,
  balance: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  settlementDate: null,
  paymentDate: null,
  autoPayment: null,
};

export const mockCreateTransactionDto = {
  amount: 5000,
  type: 'expense' as TransactionType,
  date: new Date().toISOString(),
  accountId: 'acc-001',
  categoryId: 'cat-001',
  description: 'Lunch',
  note: 'Team lunch',
};
