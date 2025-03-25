import { PrismaClient, Category, User, AccountType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // 1. 테스트용 사용자 생성
  const plainPassword = 'secure123';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const user: User = await prisma.user.upsert({
    where: { email: 'seeduser@example.com' },
    update: {},
    create: {
      email: 'seeduser@example.com',
      password: hashedPassword,
    },
  });

  // 2. 테스트용 계좌 생성
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      name: '현금지갑',
      type: 'CASH',
      color: '#4CAF50',
      balance: 500000, // 초기 잔액
    },
  });

  // 3. 카테고리 리스트
  const categories: { name: string; icon: string }[] = [
    { name: '식비', icon: '🍔' },
    { name: '교통', icon: '🚗' },
    { name: '쇼핑', icon: '🛍️' },
    { name: '여가', icon: '🎮' },
  ];

  // 4. 카테고리 생성
  const createdCategories: Category[] = [];
  for (const category of categories) {
    const created = await prisma.category.create({
      data: {
        ...category,
        userId: user.id,
      },
    });
    createdCategories.push(created);
  }

  // 5. 예산 생성
  const budget = await prisma.budget.create({
    data: {
      userId: user.id,
      total: 500000,
    },
  });

  // 6. 카테고리별 예산 연결
  for (const cat of createdCategories) {
    await prisma.budgetCategory.create({
      data: {
        budgetId: budget.id,
        categoryId: cat.id,
        amount: 100000,
      },
    });
  }

  // 7. 트랜잭션 생성 (계좌 연결 포함)
  for (const cat of createdCategories) {
    await prisma.transaction.create({
      data: {
        userId: user.id,
        categoryId: cat.id,
        accountId: account.id, // 계좌 연결
        type: 'expense',
        amount: 30000,
        date: new Date(),
        note: `${cat.name} 테스트 거래`,
      },
    });
  }

  console.log('✅ 유저, 계좌, 카테고리, 예산, 트랜잭션 시드 완료!');
}

main()
  .catch((e: unknown) => {
    console.error('❌ Seed Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
