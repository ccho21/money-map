import {
  PrismaClient,
  CategoryType,
  TransactionType,
  AccountType,
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('secure123', 10);

  // ✅ 1. Create user
  const user = await prisma.user.upsert({
    where: { email: 'seeduser@example.com' },
    update: {},
    create: {
      email: 'seeduser@example.com',
      password: hashedPassword,
      timezone: 'America/Toronto',
    },
  });

  // ✅ 2. Create accounts
  const [cashAccount, cardAccount] = await Promise.all([
    prisma.account.create({
      data: {
        userId: user.id,
        name: 'Cash',
        type: AccountType.CASH,
        color: '#10B981',
        description: 'Main cash account',
      },
    }),
    prisma.account.create({
      data: {
        userId: user.id,
        name: 'Card',
        type: AccountType.CARD,
        color: '#3B82F6',
        description: 'Visa card',
        settlementDate: 5,
        paymentDate: 25,
        autoPayment: true,
      },
    }),
  ]);

  // ✅ 3. Create categories
  const categoryData = [
    {
      name: 'Pay',
      icon: 'BadgeDollarSign',
      type: CategoryType.income,
      color: '#3B82F6',
    },
    {
      name: 'Food',
      icon: 'Utensils',
      type: CategoryType.expense,
      color: '#F97316',
    },
    { name: 'Ride', icon: 'Car', type: CategoryType.expense, color: '#EF4444' },
  ];

  const categories = await Promise.all(
    categoryData.map((data) =>
      prisma.category.create({
        data: {
          ...data,
          userId: user.id,
        },
      }),
    ),
  );

  // ✅ 4. Create budget
  const budget = await prisma.budget.create({
    data: {
      userId: user.id,
      total: 3000,
    },
  });

  // ✅ 5. Create budget categories (Feb~Apr)
  const months = [
    {
      start: new Date(Date.UTC(2025, 1, 1)),
      end: new Date(Date.UTC(2025, 1, 28)),
    }, // Feb
    {
      start: new Date(Date.UTC(2025, 2, 1)),
      end: new Date(Date.UTC(2025, 2, 31)),
    }, // Mar
    {
      start: new Date(Date.UTC(2025, 3, 1)),
      end: new Date(Date.UTC(2025, 3, 30)),
    }, // Apr
  ];

  for (const month of months) {
    for (const category of categories.filter((c) => c.type === 'expense')) {
      await prisma.budgetCategory.create({
        data: {
          budgetId: budget.id,
          categoryId: category.id,
          amount: 1000,
          startDate: month.start,
          endDate: month.end,
        },
      });
    }
  }

  // ✅ 6. Opening Balance transactions (realistic)
  await prisma.transaction.createMany({
    data: [
      {
        type: TransactionType.income,
        amount: 500,
        userId: user.id,
        accountId: cashAccount.id,
        categoryId: categories.find((c) => c.name === 'Pay')?.id,
        date: new Date(Date.UTC(2025, 1, 1)),
        note: 'Opening Balance',
        isOpening: true,
      },
      {
        type: TransactionType.income,
        amount: 100,
        userId: user.id,
        accountId: cardAccount.id,
        categoryId: categories.find((c) => c.name === 'Pay')?.id,
        date: new Date(Date.UTC(2025, 1, 1)),
        note: 'Opening Balance',
        isOpening: true,
      },
    ],
  });

  // ✅ 7. Random transactions (2월~4월, realistic CAD)
  const notes = [
    'Starbucks coffee',
    'Grocery run',
    'Uber downtown',
    'Dinner out',
    'Gym fee',
    'Transfer to card',
    'Credit card payment',
    'Salary received',
    'Late night snack',
    'Quick taxi ride',
  ];

  function getRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getRandomAmount(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async function generateTransactions(month: number, year: number) {
    const txs: Promise<unknown>[] = [];

    for (let i = 0; i < 10; i++) {
      const date = new Date(
        Date.UTC(year, month, Math.floor(Math.random() * 28) + 1),
      );
      const random = Math.random();

      if (random < 0.6) {
        const cat = getRandom(categories.filter((c) => c.type === 'expense'));
        txs.push(
          prisma.transaction.create({
            data: {
              type: TransactionType.expense,
              amount: getRandomAmount(5, 100),
              userId: user.id,
              accountId: cashAccount.id,
              categoryId: cat.id,
              date,
              note: getRandom(notes),
            },
          }),
        );
      } else if (random < 0.85) {
        const cat = getRandom(categories.filter((c) => c.type === 'income'));
        txs.push(
          prisma.transaction.create({
            data: {
              type: TransactionType.income,
              amount: getRandomAmount(100, 1000),
              userId: user.id,
              accountId: cashAccount.id,
              categoryId: cat.id,
              date,
              note: getRandom(notes),
            },
          }),
        );
      } else {
        txs.push(
          prisma.transaction.create({
            data: {
              type: TransactionType.transfer,
              amount: getRandomAmount(20, 300),
              userId: user.id,
              accountId: cashAccount.id,
              toAccountId: cardAccount.id,
              date,
              note: getRandom(notes),
            },
          }),
        );
      }
    }

    await Promise.all(txs);
  }

  await generateTransactions(1, 2025); // Feb
  await generateTransactions(2, 2025); // Mar
  await generateTransactions(3, 2025); // Apr

  console.log('✅ Seed completed with realistic CAD data!');
}

main()
  .catch((e) => {
    console.error('❌ Seed Error:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
