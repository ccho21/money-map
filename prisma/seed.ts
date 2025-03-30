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
      timezone: 'America/Toronto',
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

  const categorySeedData: {
    name: string;
    icon: string;
    type: 'income' | 'expense';
  }[] = [
    // ✅ 수입 카테고리
    { name: '급여', icon: 'BadgeDollarSign', type: 'income' }, // 실제 수입 느낌
    { name: '이자소득', icon: 'PiggyBank', type: 'income' }, // 저축/이자 이미지
    { name: '프리랜스', icon: 'Briefcase', type: 'income' }, // 일/업무

    // ✅ 지출 카테고리
    { name: '식비', icon: 'UtensilsCrossed', type: 'expense' }, // 식사용
    { name: '교통', icon: 'Bus', type: 'expense' }, // 교통수단
    { name: '쇼핑', icon: 'ShoppingCart', type: 'expense' }, // 장바구니
    { name: '여가', icon: 'Gamepad2', type: 'expense' }, // 게임/취미
    { name: '의료', icon: 'Stethoscope', type: 'expense' }, // 의료용
    { name: '카페', icon: 'Coffee', type: 'expense' }, // 커피 아이콘
  ];

  const createdCategories: Category[] = [];

  for (const { name, icon, type } of categorySeedData) {
    const category = await prisma.category.create({
      data: {
        name,
        icon,
        type,
        userId: user.id,
      },
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

  const getRandomUTCDateInMonth = (year: number, month: number): Date => {
    const day = Math.floor(Math.random() * 28) + 1;
    return new Date(Date.UTC(year, month - 1, day));
  };

  const targetMonths = [
    { year: 2025, month: 2 },
    { year: 2025, month: 3 },
  ];

  // ✅ 지출 트랜잭션 생성
  for (const cat of createdCategories.filter((c) => c.type === 'expense')) {
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

  // ✅ 수입 트랜잭션 생성
  const incomeMeta = {
    급여: { amount: 3_000_000, isFixed: true },
    이자소득: { amount: 200_000, isFixed: false },
    프리랜스: { amount: 500_000, isFixed: false },
  };

  for (const cat of createdCategories.filter((c) => c.type === 'income')) {
    const meta = incomeMeta[cat.name];

    for (const { year, month } of targetMonths) {
      const date = meta.isFixed
        ? new Date(Date.UTC(year, month - 1, 25))
        : getRandomUTCDateInMonth(year, month);

      await prisma.transaction.create({
        data: {
          userId: user.id,
          categoryId: cat.id,
          accountId: accounts[2].id,
          type: 'income',
          amount: meta.amount,
          date,
          note: `${cat.name} 수입`,
        },
      });
    }
  }

  console.log(
    '✅ 전체 시드 데이터 생성 완료 (lucide 아이콘 + 카테고리 타입 포함)',
  );
}

main()
  .catch((e) => {
    console.error('❌ Seed Error:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
