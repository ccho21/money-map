import {
  PrismaClient,
  AccountType,
  CategoryType,
  TransactionType,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { set } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('secure123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'seeduser@example.com' },
    update: {},
    create: {
      email: 'seeduser@example.com',
      password: hashedPassword,
      timezone: 'America/Toronto',
    },
  });

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
    {
      name: 'Ride',
      icon: 'Car',
      type: CategoryType.expense,
      color: '#EF4444',
    },
  ];

  const categories = await Promise.all(
    categoryData.map((cat) =>
      prisma.category.create({
        data: {
          ...cat,
          userId: user.id,
        },
      }),
    ),
  );

  const [payCategory, foodCategory, rideCategory] = categories;

  const makeDate = (month: number, day: number) =>
    set(new Date(), { month: month - 1, date: day, hours: 12 });

  const allTransactions: {
    userId: string;
    accountId: string;
    type: TransactionType;
    amount: number;
    date: Date;
    description?: string;
    categoryId?: string;
  }[] = [];

  const budgetCategoryData: {
    budgetId: string;
    categoryId: string;
    amount: number;
    startDate: Date;
    endDate: Date;
    type: CategoryType;
  }[] = [];

  const budget = await prisma.budget.create({
    data: {
      userId: user.id,
      total: 4000,
    },
  });

  for (let month = 1; month <= 4; month++) {
    allTransactions.push(
      {
        userId: user.id,
        accountId: cashAccount.id,
        type: TransactionType.income,
        categoryId: payCategory.id,
        amount: 2500 + month * 100,
        date: makeDate(month, 5),
        description: `Salary for month ${month}`,
      },
      {
        userId: user.id,
        accountId: cardAccount.id,
        type: TransactionType.expense,
        categoryId: foodCategory.id,
        amount: 40 + month * 2,
        date: makeDate(month, 10),
        description: `Dinner in month ${month}`,
      },
      {
        userId: user.id,
        accountId: cardAccount.id,
        type: TransactionType.expense,
        categoryId: rideCategory.id,
        amount: 18 + month,
        date: makeDate(month, 15),
        description: `Ride in month ${month}`,
      },
    );

    const startDate = new Date(new Date().getFullYear(), month - 1, 1);
    const endDate = new Date(new Date().getFullYear(), month, 0);

    budgetCategoryData.push(
      {
        budgetId: budget.id,
        categoryId: foodCategory.id,
        amount: 200 + month * 10,
        startDate,
        endDate,
        type: CategoryType.expense,
      },
      {
        budgetId: budget.id,
        categoryId: rideCategory.id,
        amount: 100 + month * 5,
        startDate,
        endDate,
        type: CategoryType.expense,
      },
    );
  }

  // await prisma.transaction.createMany({ data: allTransactions });
  // await prisma.budgetCategory.createMany({ data: budgetCategoryData });

  console.log(
    '✅ Seed with monthly transactions & budget categories completed.',
  );
}

main()
  .catch((e) => {
    console.error('❌ Seed Error:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
