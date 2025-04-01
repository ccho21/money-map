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
        name: 'Cash Wallet',
        type: 'CASH',
        color: '#4CAF50',
        balance: 2_000,
      },
    }),
    prisma.account.create({
      data: {
        userId: user.id,
        name: 'National Credit Card',
        type: 'CARD',
        color: '#2196F3',
        balance: 0,
      },
    }),
    prisma.account.create({
      data: {
        userId: user.id,
        name: 'Shinhan Bank',
        type: 'BANK',
        color: '#FF9800',
        balance: 1_000,
      },
    }),
  ]);

  const categorySeedData: {
    name: string;
    icon: string;
    type: 'income' | 'expense';
    color: string;
  }[] = [
    { name: 'Salary', icon: 'BadgeDollarSign', type: 'income', color: '#3B82F6' },
    { name: 'Interest', icon: 'PiggyBank', type: 'income', color: '#10B981' },
    { name: 'Freelance', icon: 'Briefcase', type: 'income', color: '#8B5CF6' },
    { name: 'Food', icon: 'UtensilsCrossed', type: 'expense', color: '#F59E0B' },
    { name: 'Transport', icon: 'Bus', type: 'expense', color: '#F43F5E' },
    { name: 'Shopping', icon: 'ShoppingCart', type: 'expense', color: '#0EA5E9' },
    { name: 'Leisure', icon: 'Gamepad2', type: 'expense', color: '#A855F7' },
    { name: 'Health', icon: 'Stethoscope', type: 'expense', color: '#14B8A6' },
    { name: 'Cafe', icon: 'Coffee', type: 'expense', color: '#D97706' },
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

  await Promise.all(
    createdCategories.map((cat) =>
      prisma.budgetCategory.create({
        data: {
          budgetId: budget.id,
          categoryId: cat.id,
          amount: 300,
        },
      })
    )
  );

  const getRandomUTCDateInMonth = (year: number, month: number): Date => {
    const day = Math.floor(Math.random() * 28) + 1;
    return new Date(Date.UTC(year, month - 1, day));
  };

  const targetMonths = [
    { year: 2025, month: 2 },
    { year: 2025, month: 3 },
  ];

  const expenseNotes = ['Lunch', 'Bus Fare', 'T-shirt', 'Movie', 'Doctor', 'Latte'];
  const incomeNotes = ['Monthly Salary', 'Freelance Gig', 'Interest Income'];

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
              amount: Math.floor(Math.random() * 50) + 10,
              date: getRandomUTCDateInMonth(year, month),
              note: `${expenseNotes[Math.floor(Math.random() * expenseNotes.length)]}`,
            },
          });
        }
      }
    }
  }

  const incomeMeta = {
    Salary: { amount: 4_000, isFixed: true },
    Interest: { amount: 200, isFixed: false },
    Freelance: { amount: 1_000, isFixed: false },
  };

  for (const cat of createdCategories.filter((c) => c.type === 'income')) {
    const meta = incomeMeta[cat.name as keyof typeof incomeMeta];

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
          note: incomeNotes[Math.floor(Math.random() * incomeNotes.length)],
        },
      });
    }
  }

  console.log('✅ Seed data generated successfully with enhanced variety and styling.');
}

main()
  .catch((e) => {
    console.error('❌ Seed Error:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });