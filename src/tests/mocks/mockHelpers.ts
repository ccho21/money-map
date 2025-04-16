import { PrismaService } from '@/prisma/prisma.service';
import {
  TransactionCreateRequestDTO,
  TransactionUpdateRequestDTO,
  TransactionTransferRequestDTO,
} from '@/transactions/dto/transaction-request.dto';
import { Account, TransactionType } from '@prisma/client';

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
// ========================= 📂 ACCOUNTS =========================
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

//
// ========================= 🧾 TRANSACTIONS =========================
//

// ✅ 실 트랜잭션 mock (서비스 반환용)
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

// ✅ 트랜잭션 생성 DTO
export const mockCreateTransactionDto: TransactionCreateRequestDTO = {
  type: TransactionType.expense,
  amount: 5000,
  date: new Date('2024-04-10').toISOString(),
  accountId: 'acc-001',
  categoryId: 'cat-001',
  note: 'Team lunch',
  description: 'Lunch at cafe',
};

// ✅ 트랜잭션 수정 DTO
export const mockUpdateTransactionDto: TransactionUpdateRequestDTO = {
  amount: 10000,
  categoryId: 'cat-002',
  note: 'Updated note',
  description: 'Updated description',
  date: new Date('2024-04-11').toISOString(),
};

// ✅ 이체용 DTO (Transfer)
export const mockTransferTransactionDto: TransactionTransferRequestDTO = {
  type: TransactionType.transfer,
  amount: 15000,
  date: new Date('2024-04-12').toISOString(),
  fromAccountId: 'acc-001',
  toAccountId: 'acc-002',
  note: 'Transfer to savings',
  description: 'Monthly savings transfer',
  accountId: 'acc-001', // Base DTO 필수
};

// ✅ 이체 쌍으로 연결된 트랜잭션 mock
export const linkedTransaction = {
  ...mockTransaction,
  id: 'tx1',
  linkedTransferId: 'tx2',
  type: 'transfer',
  accountId: mockAccount.id,
  account: mockAccount,
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
// ========================= 📊 STATS =========================
//
export const mockCategoryStatsItem = {
  categoryId: 'cat1',
  categoryName: 'Food',
  categoryType: 'expense',
  amount: 50000,
};

export const mockNoteSummaryItem = {
  note: 'Starbucks',
  amount: 18000,
};

//
// ========================= 🧪 Prisma Mock Factory =========================
//
export const mockPrismaFactory = (): jest.Mocked<PrismaService> =>
  ({
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
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
