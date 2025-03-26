// ✅ 파일명: prisma/seed.ts

import { PrismaClient, Category, User, Account } from '@prisma/client';
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
    },
  });

  // 2. 계좌 여러 개 생성
  const accounts: Account[] = await Promise.all([
    prisma.account.create({
      data: {
        userId: user.id,
        name: '현금지갑',
        type: 'CASH',
        color: '#4CAF50',
        balance: 500_000,
      },
    }),
    prisma.account.create({
      data: {
        userId: user.id,
        name: '국민카드',
        type: 'CARD',
        color: '#2196F3',
        balance: 0,
      },
    }),
    prisma.account.create({
      data: {
        userId: user.id,
        name: '신한은행',
        type: 'BANK',
        color: '#FF9800',
        balance: 2_000_000,
      },
    }),
  ]);

  const categoriesData = [
    { name: '식비', icon: '🍔' },
    { name: '교통', icon: '🚗' },
    { name: '쇼핑', icon: '🛍️' },
    { name: '여가', icon: '🎮' },
    { name: '의료', icon: '💊' },
    { name: '카페', icon: '☕️' },
  ];

  const createdCategories: Category[] = [];

  for (const { name, icon } of categoriesData) {
    const category = await prisma.category.create({
      data: { name, icon, userId: user.id },
    });
    createdCategories.push(category);
  }

  const budget = await prisma.budget.create({
    data: {
      userId: user.id,
      total: 1_000_000,
    },
  });

  await Promise.all(
    createdCategories.map((cat) =>
      prisma.budgetCategory.create({
        data: {
          budgetId: budget.id,
          categoryId: cat.id,
          amount: 150_000,
        },
      }),
    ),
  );

  // 5. 여러 계좌에 트랜잭션 생성
  for (const cat of createdCategories) {
    for (const account of accounts) {
      await prisma.transaction.create({
        data: {
          userId: user.id,
          categoryId: cat.id,
          accountId: account.id,
          type: 'expense',
          amount: Math.floor(Math.random() * 50_000) + 10_000,
          date: new Date(),
          note: `${cat.name} - ${account.name} 테스트 거래`,
        },
      });
    }
  }

  console.log('✅ 여러 계좌, 카테고리, 트랜잭션 시드 완료');
}

main()
  .catch((e) => {
    console.error('❌ Seed Error:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
