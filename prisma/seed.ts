// ✅ Updated Prisma Seed File with Card Dashboard Test Data (No Transactions)

import { PrismaClient, Category, User, Account, CategoryType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const hashedPassword = await bcrypt.hash('secure123', 10);

  const user: User = await prisma.user.upsert({
    where: { email: 'seeduser@example.com' },
    update: {},
    create: {
      email: 'seeduser@example.com',
      password: hashedPassword,
      timezone: 'America/Toronto',
    },
  });

  const accounts: Account[] = await Promise.all([
    prisma.account.create({
      data: {
        userId: user.id,
        name: 'Cash',
        type: 'CASH',
        color: '#4CAF50',
        balance: 0,
      },
    }),
    prisma.account.create({
      data: {
        userId: user.id,
        name: 'TD Credit Card',
        type: 'CARD',
        color: '#2196F3',
        balance: 0,
      },
    }),
  ]);

  const categorySeedData = [
    { name: 'Salary', icon: 'BadgeDollarSign', type: CategoryType.income, color: '#3B82F6' },
    { name: 'Food', icon: 'UtensilsCrossed', type: CategoryType.expense, color: '#F59E0B' },
    { name: 'Transport', icon: 'Bus', type: CategoryType.expense, color: '#F43F5E' },
  ];

  const createdCategories: Category[] = [];

  for (const { name, icon, type, color } of categorySeedData) {
    const category = await prisma.category.create({
      data: { name, icon, type, color, userId: user.id },
    });
    createdCategories.push(category);
  }

  const budget = await prisma.budget.create({
    data: { userId: user.id, total: 1_000 },
  });

  const startDate = new Date(Date.UTC(2025, 3, 1)); // April 1st
  const endDate = new Date(Date.UTC(2025, 3, 30)); // April 30th

  await Promise.all(
    createdCategories.map((cat) =>
      prisma.budgetCategory.create({
        data: {
          budgetId: budget.id,
          categoryId: cat.id,
          amount: 300,
          startDate,
          endDate,
        },
      }),
    ),
  );

  // ✅ 카드 계좌 settlement 정보 업데이트
  await prisma.account.updateMany({
    where: { type: 'CARD' },
    data: {
      settlementDate: 3,
      paymentDate: 19,
      autoPayment: false,
    },
  });

  // ✅ BudgetCategory 금액 업데이트 (예시: 각 카테고리마다 다른 예산 적용)
  await Promise.all(
    createdCategories.map((cat, index) =>
      prisma.budgetCategory.updateMany({
        where: {
          budgetId: budget.id,
          categoryId: cat.id,
        },
        data: {
          amount: 100 * (index + 1), // 100, 200, 300 등
        },
      }),
    ),
  );

  console.log('✅ Seed data generated successfully without transactions.');
}

main()
  .catch((e) => {
    console.error('❌ Seed Error:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
