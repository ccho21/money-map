import { PrismaClient, Category, User } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // 1. 테스트용 사용자 생성 (암호화 포함)
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

  // 2. 카테고리 생성 리스트
  const categories: { name: string; icon: string }[] = [
    { name: '식비', icon: '🍔' },
    { name: '교통', icon: '🚗' },
    { name: '쇼핑', icon: '🛍️' },
    { name: '여가', icon: '🎮' },
  ];

  // 3. 카테고리 생성 및 저장
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

  // 4. 예산 생성
  const budget = await prisma.budget.create({
    data: {
      userId: user.id,
      total: 500000,
    },
  });

  // 5. 카테고리별 예산 연결
  for (const cat of createdCategories) {
    await prisma.budgetCategory.create({
      data: {
        budgetId: budget.id,
        categoryId: cat.id,
        amount: 100000,
      },
    });
  }

  // 6. 트랜잭션 생성 (각 카테고리에 1건씩)
  for (const cat of createdCategories) {
    await prisma.transaction.create({
      data: {
        userId: user.id,
        categoryId: cat.id,
        type: 'expense',
        amount: 30000,
        date: new Date(),
        note: `${cat.name} 테스트 거래`,
      },
    });
  }

  console.log('✅ 유저, 카테고리, 예산, 트랜잭션 시드 완료!');
}

main()
  .catch((e: unknown) => {
    console.error('❌ Seed Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
