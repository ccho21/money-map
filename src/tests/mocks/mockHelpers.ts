import { AccountCreateRequestDTO } from '@/accounts/dto/account-request.dto';
import { BaseListSummaryResponseDTO } from '@/common/dto/base-list-summary-response.dto';
import { GroupBy } from '@/common/types/types';
import { PrismaService } from '@/prisma/prisma.service';
import { TransactionCalendarDTO } from '@/transactions/dto/transactions/transaction-calendar.dto';
import { CreateTransactionDTO } from '@/transactions/dto/transactions/transaction-create.dto';
import { UpdateTransactionDTO } from '@/transactions/dto/transactions/transaction-update.dto';
import { AccountType, CategoryType, TransactionType } from '@prisma/client';

//
// ========================= 🧑‍💼 COMMON =========================

//
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  password: 'hashed-password',
  timezone: 'UTC',
  createdAt: new Date('2023-01-01T00:00:00Z'),
  hashedRefreshToken: null,
};

//
// ========================= 🔐 AUTH =========================
//
export const mockAuthSession: {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresIn: number;
} = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  userId: 'user-123',
  expiresIn: 3600,
};

//
// ========================= 📁 ACCOUNTS =========================
//
export const mockAccount = {
  id: 'acc-001',
  userId: 'user-001',
  name: 'My Account',
  type: AccountType.CASH, // ✅ 이렇게!
  color: '#ff0000',
  description: 'Mock Account',
  balance: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  settlementDate: null,
  paymentDate: null,
  autoPayment: false,
};

export const mockStatsAccountDetail: {
  accountId: string;
  accountName: string;
  income: number;
  expense: number;
  balance: number;
} = {
  accountId: 'acc-001',
  accountName: 'My Card',
  income: 250000,
  expense: 150000,
  balance: 100000,
};

//
// ========================= 📁 CATEGORY =========================
//
export const mockCategory = {
  id: 'cat1',
  name: 'Food',
  icon: '🍔',
  type: 'expense',
  userId: mockUser.id,
  color: '#ff0000',
};

//
// ========================= 💸 BUDGETS =========================
//
export const mockBudget = {
  id: 'budget-001',
  userId: mockUser.id,
  total: 300000,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockBudgetCategory = {
  id: 'budget-category-001',
  budgetId: mockBudget.id,
  categoryId: 'cat1',
  amount: 150000,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  type: 'expense',
};

//
// ========================= 🧾 TRANSACTIONS =========================
//
export const mockTransaction = {
  id: 'tx-001',
  userId: mockUser.id,
  type: TransactionType.expense,
  amount: 5000,
  date: new Date('2024-04-10'),
  accountId: mockAccount.id,
  categoryId: 'cat-001',
  note: 'Team lunch',
  description: 'Lunch at cafe',
  createdAt: new Date(),
  isOpening: false,
  dueDate: null,
  paidAt: null,
  toAccountId: null,
  linkedTransferId: null,
  account: mockAccount,
  category: null,
};

export const mockCreateTransactionDto: CreateTransactionDTO = {
  type: TransactionType.expense,
  amount: 5000,
  date: new Date('2024-04-10').toISOString(),
  accountId: 'acc-001',
  categoryId: 'cat-001',
  note: 'Team lunch',
  description: 'Lunch at cafe',
};

export const mockUpdateTransactionDto: UpdateTransactionDTO = {
  amount: 10000,
  categoryId: 'cat-002',
  note: 'Updated note',
  description: 'Updated description',
  date: new Date('2024-04-11').toISOString(),
};

export const mockTransferTransactionDto: CreateTransactionDTO = {
  type: TransactionType.transfer,
  amount: 15000,
  date: new Date('2024-04-12').toISOString(),
  fromAccountId: 'acc-001',
  toAccountId: 'acc-002',
  note: 'Transfer to savings',
  description: 'Monthly savings transfer',
  accountId: 'acc-001',
};

//
// ========================= 📆 CALENDAR =========================
//
export const mockTransactionCalendarItem: TransactionCalendarDTO = {
  date: '2024-04-15',
  income: 50000,
  expense: 20000,
};

//
// ========================= 📝 STATS / NOTE =========================
//

export const mockAccountCreateRequest: AccountCreateRequestDTO = {
  name: 'Test Account',
  type: 'CASH',
  balance: 10000,
  color: '#000000',
  description: 'Initial',
};
/////////
//
// ========================= 🧪 Prisma Mock Factory =========================
//
export const mockPrismaFactory = (): jest.Mocked<PrismaService> =>
  ({
    user: { findUnique: jest.fn(), update: jest.fn() },
    account: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    budget: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    budgetCategory: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    category: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  }) as unknown as jest.Mocked<PrismaService>;
