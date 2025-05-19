import { AccountCreateRequestDTO } from '@/accounts/dto/account-request.dto';
import { BaseListSummaryResponseDTO } from '@/common/dto/base-list-summary-response.dto';
import { GroupBy } from '@/common/types/types';
import { PrismaService } from '@/prisma/prisma.service';
import { StatsBudgetDetailDTO } from '@/stats/dto/budget/detail.dto';
import { StatsBudgetSummaryDTO } from '@/stats/dto/budget/summary.dto';
import { StatsCategoryDetailDTO } from '@/stats/dto/category/detail.dto';
import { StatsCategoryGroupItemDTO } from '@/stats/dto/category/group-item.dto';
import { StatsCategorySummaryDTO } from '@/stats/dto/category/summary.dto';
import { StatsNoteDetailDTO } from '@/stats/dto/note/detail.dto';
import { StatsNoteGroupItemDTO } from '@/stats/dto/note/group-item.dto';
import { StatsNoteSummaryDTO } from '@/stats/dto/note/summary.dto';
import { StatsQuery } from '@/stats/dto/stats-query.dto';
import { TransactionCalendarDTO } from '@/transactions/dto/transactions/transaction-calendar.dto';
import {
  TransactionCreateRequestDTO,
  TransactionTransferRequestDTO,
  TransactionUpdateRequestDTO,
} from '@/transactions/dto/transaction-request.dto';
import { CategoryType, TransactionType } from '@prisma/client';

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
  userId: mockUser.id,
  name: 'My Card',
  type: 'CARD',
  color: '#2196F3',
  description: 'Primary card',
  balance: 100000,
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

export const mockStatsCategoryDetail: StatsCategoryDetailDTO = {
  categoryId: 'cat1',
  categoryName: 'Food',
  icon: '🍔',
  color: '#FF6600',
  type: 'expense',
  totalIncome: 0,
  totalExpense: 12000,
  items: [
    {
      label: '2024-01',
      rangeStart: '2024-01-01',
      rangeEnd: '2024-01-31',
      groupIncome: 0,
      groupExpense: 12000,
      isCurrent: true,
      transactions: [],
    },
  ],
};

export const mockStatsCategorySummary: StatsCategorySummaryDTO = {
  startDate: '2024-01-01',
  endDate: '2024-03-31',
  groupBy: GroupBy.MONTHLY,
  type: 'expense',
  totalIncome: 0,
  totalExpense: 240000,
  items: [],
};

export const mockCategoryGroupSummary: BaseListSummaryResponseDTO<StatsCategoryGroupItemDTO> =
  {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    groupBy: 'monthly' as GroupBy,
    type: 'expense',
    items: [],
    summary: {
      categoryId: 'summary',
      categoryName: 'Summary',
      categoryType: 'expense',
      amount: 0,
      rate: 100,
      // color: '#3B82F6',
      label: 'Summary',
      rangeStart: '2024-01-01',
      rangeEnd: '2024-01-31',
    },
    totalIncome: 0,
    totalExpense: 0,
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

export const mockStatsBudgetDetail: StatsBudgetDetailDTO = {
  categoryId: 'cat-transport',
  categoryName: 'Transport',
  icon: 'Car',
  color: '#3B82F6',
  type: 'expense',
  totalExpense: 60000,
  totalBudget: 100000,
  totalRemaining: 40000,
  isOver: false,
  items: [],
};

export const mockStatsBudgetSummary: StatsBudgetSummaryDTO = {
  startDate: '2024-04-01',
  endDate: '2024-04-30',
  groupBy: GroupBy.MONTHLY,
  type: 'expense',
  totalIncome: 0,
  totalExpense: 100000,
  items: [],
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

export const mockCreateTransactionDto: TransactionCreateRequestDTO = {
  type: TransactionType.expense,
  amount: 5000,
  date: new Date('2024-04-10').toISOString(),
  accountId: 'acc-001',
  categoryId: 'cat-001',
  note: 'Team lunch',
  description: 'Lunch at cafe',
};

export const mockUpdateTransactionDto: TransactionUpdateRequestDTO = {
  amount: 10000,
  categoryId: 'cat-002',
  note: 'Updated note',
  description: 'Updated description',
  date: new Date('2024-04-11').toISOString(),
};

export const mockTransferTransactionDto: TransactionTransferRequestDTO = {
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
export const mockStatsNoteGroupItem: StatsNoteGroupItemDTO = {
  note: 'Starbucks',
  type: 'expense',
  count: 1,
  label: '2024-01',
  amount: 0,
  rangeStart: '2024-01-01',
  rangeEnd: '2024-01-31',
};

export const mockStatsNoteDetail: StatsNoteDetailDTO = {
  note: 'Starbucks',
  totalIncome: 0,
  totalExpense: 18000,
  items: [],
};

export const mockStatsNoteSummary: StatsNoteSummaryDTO = {
  startDate: '2024-04-01',
  endDate: '2024-04-30',
  groupBy: GroupBy.MONTHLY,
  type: 'expense',
  totalIncome: 0,
  totalExpense: 18000,
  items: [],
};

///////////////
export const statsQuery: StatsQuery = {
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  groupBy: GroupBy.MONTHLY,
  type: CategoryType.expense,
};

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
