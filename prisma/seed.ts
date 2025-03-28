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

  const incomeCategoriesData = [
    { name: '급여', icon: '💰' },
    { name: '이자소득', icon: '🏦' },
    { name: '프리랜스', icon: '🧑‍💻' },
  ];

  const expenseCategoriesData = [
    { name: '식비', icon: '🍔' },
    { name: '교통', icon: '🚗' },
    { name: '쇼핑', icon: '🛍️' },
    { name: '여가', icon: '🎮' },
    { name: '의료', icon: '💊' },
    { name: '카페', icon: '☕️' },
  ];

  const createdCategories: Category[] = [];

  for (const { name, icon } of [
    ...incomeCategoriesData,
    ...expenseCategoriesData,
  ]) {
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

  // 🔧 UTC 날짜 유틸
  const getRandomUTCDateInMonth = (year: number, month: number): Date => {
    const day = Math.floor(Math.random() * 28) + 1;
    return new Date(Date.UTC(year, month - 1, day));
  };

  const targetMonths = [
    { year: 2025, month: 2 },
    { year: 2025, month: 3 },
  ];

  // ✅ 지출 트랜잭션 (랜덤, UTC)
  for (const cat of createdCategories.filter((c) =>
    expenseCategoriesData.map((e) => e.name).includes(c.name),
  )) {
    for (const account of accounts) {
      for (const { year, month } of targetMonths) {
        const txCount = Math.floor(Math.random() * 3) + 2;
        for (let i = 0; i < txCount; i++) {
          await prisma.transaction.create({
            data: {
              userId: user.id,
              categoryId: cat.id,
              accountId: account.id,
              type: 'expense',
              amount: Math.floor(Math.random() * 50_000) + 10_000,
              date: getRandomUTCDateInMonth(year, month),
              note: `${cat.name} - ${account.name} 테스트 지출`,
            },
          });
        }
      }
    }
  }

  // ✅ 수입 트랜잭션 (고정 + 랜덤, 모두 UTC)
  const incomeMeta = {
    급여: {
      amount: 3_000_000,
      isFixed: true,
    },
    이자소득: {
      amount: 200_000,
      isFixed: false,
    },
    프리랜스: {
      amount: 500_000,
      isFixed: false,
    },
  };

  for (const cat of createdCategories.filter((c) =>
    incomeCategoriesData.map((i) => i.name).includes(c.name),
  )) {
    const meta = incomeMeta[cat.name];

    for (const { year, month } of targetMonths) {
      const date = meta.isFixed
        ? new Date(Date.UTC(year, month - 1, 25)) // 고정 날짜도 UTC로 생성
        : getRandomUTCDateInMonth(year, month);

      await prisma.transaction.create({
        data: {
          userId: user.id,
          categoryId: cat.id,
          accountId: accounts[2].id, // 신한은행
          type: 'income',
          amount: meta.amount,
          date,
          note: `${cat.name} 수입`,
        },
      });
    }
  }

  console.log('✅ 전체 시드 데이터 생성 완료 (UTC 기준 수입 + 지출)');
}

main()
  .catch((e) => {
    console.error('❌ Seed Error:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
