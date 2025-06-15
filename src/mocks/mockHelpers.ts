import { AccountCreateRequestDTO } from '@/accounts/dto/account-request.dto';
import { TransactionCalendarDTO } from '@/transactions/dto/transactions/transaction-calendar.dto';
import { CreateTransactionDTO } from '@/transactions/dto/transactions/transaction-create.dto';
import { UpdateTransactionDTO } from '@/transactions/dto/transactions/transaction-update.dto';
import { UserPayload } from '@/auth/types/user-payload.type';
import {
  AccountType,
  TransactionType,
  CategoryType,
  User,
  Account,
  Budget,
  BudgetCategory,
  Category,
  Transaction,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export type BudgetDetail = Budget & {
  categories: (BudgetCategory & {
    category: Category;
  })[];
};

export type BudgetCategoryDetail = BudgetCategory & {
  category: Category;
  budget?: Pick<Budget, 'id' | 'total' | 'userId'>;
};

export type TransactionDetail = Transaction & {
  account?: { name: string } | null;
  toAccount?: { name: string } | null;
  category?: Category | null;
};
export const mockUser: User = {
  id: 'user-id-123',
  email: 'test@example.com',
  password: 'hashed-password',
  timezone: 'Asia/Seoul',
  createdAt: new Date(),
  hashedRefreshToken: null,
};

export const mockUserPayload: UserPayload = {
  id: mockUser.id,
  email: mockUser.email,
  timezone: mockUser.timezone,
};

export const mockAuthSession = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  userId: 'user-123',
  expiresIn: 3600,
};

export const mockAccount: Account = {
  id: 'acc-001',
  userId: mockUser.id,
  name: 'My Account',
  type: AccountType.CASH,
  color: '#ff0000',
  description: 'Mock Account',
  balance: 100000,
  createdAt: new Date(),
  updatedAt: new Date(),
  settlementDate: null,
  paymentDate: null,
  autoPayment: false,
};

export const mockAccount2: Account = {
  id: 'acc-002',
  userId: mockUser.id,
  name: 'Second Account',
  type: AccountType.CASH,
  color: '#00ff00',
  description: 'Mock Account 2',
  balance: 50000,
  createdAt: new Date(),
  updatedAt: new Date(),
  settlementDate: null,
  paymentDate: null,
  autoPayment: false,
};

export const mockStatsAccountDetail = {
  accountId: 'acc-001',
  accountName: 'My Card',
  income: 250000,
  expense: 150000,
  balance: 100000,
};

export const mockCategory: Category = {
  id: 'cat1',
  name: 'Food',
  icon: '🍔',
  type: CategoryType.expense,
  userId: mockUser.id,
  color: '#ff0000',
};

export const mockCategory2: Category = {
  ...mockCategory,
  id: 'cat-002',
  name: 'Transport',
  icon: '🚗',
  color: '#0000ff',
};

export const mockBudget: Budget = {
  id: 'budget-001',
  userId: mockUser.id,
  total: 300000,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockBudgetCategory: BudgetCategory = {
  id: 'budget-category-001',
  budgetId: mockBudget.id,
  categoryId: mockCategory.id,
  amount: 150000,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  type: CategoryType.expense,
};

export type TransactionWithCategory = Omit<Transaction, 'categoryId'> & {
  categoryId: string;
  category: { name: string; color: string };
};

export const mockTransaction: Transaction = {
  id: 'tx-001',
  userId: mockUser.id,
  type: TransactionType.expense,
  amount: 5000,
  date: new Date('2024-04-10'),
  accountId: mockAccount.id,
  categoryId: mockCategory.id,
  note: 'Team lunch',
  description: 'Lunch at cafe',
  createdAt: new Date(),
  isOpening: false,
  dueDate: null,
  paidAt: null,
  toAccountId: null,
  linkedTransferId: null,
  recurringTransactionId: null,
  deletedAt: null,
};

export const mockTransaction2: Transaction = {
  ...mockTransaction,
  id: 'tx-002',
  amount: 20000,
  type: TransactionType.income,
  note: 'Bonus',
  description: 'Monthly bonus',
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

export const mockTransactionCalendarItem: TransactionCalendarDTO = {
  date: '2024-04-15',
  income: 50000,
  expense: 20000,
};

export const mockAccountCreateRequest: AccountCreateRequestDTO = {
  name: 'Test Account',
  type: 'CASH',
  balance: 10000,
  color: '#000000',
  description: 'Initial',
};

export function mockPrismaFactory(): jest.Mocked<PrismaService> {
  return {
    transaction: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    recurringTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    account: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    category: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    budgetCategory: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    budget: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;
}
