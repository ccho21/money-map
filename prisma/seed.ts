import {
  PrismaClient,
  AccountType,
  CategoryType,
  TransactionType,
  RecurringFrequency,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { set } from 'date-fns';

const prisma = new PrismaClient();

type NewTransaction = {
  userId: string;
  accountId: string;
  type: TransactionType;
  categoryId: string;
  amount: number;
  date: Date;
  description?: string;
};

type NewBudgetCategory = {
  budgetId: string;
  categoryId: string;
  amount: number;
  startDate: Date;
  endDate: Date;
  type: CategoryType;
};

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
        color: '--chart-1',
        description: 'Main cash account',
      },
    }),
    prisma.account.create({
      data: {
        userId: user.id,
        name: 'Card',
        type: AccountType.CARD,
        color: '--chart-2',
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
      color: '--chart-3',
    },
    {
      name: 'Food',
      icon: 'Utensils',
      type: CategoryType.expense,
      color: '--chart-4',
    },
    {
      name: 'Ride',
      icon: 'Car',
      type: CategoryType.expense,
      color: '--chart-5',
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

  const allTransactions: NewTransaction[] = [];
  const budgetCategoryData: NewBudgetCategory[] = [];

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

  await prisma.transaction.createMany({ data: allTransactions });
  await prisma.budgetCategory.createMany({ data: budgetCategoryData });

  console.log('✅ Seed with monthly transactions & budget categories completed.');

  await prisma.recurringTransaction.createMany({
    data: [
      {
        userId: user.id,
        accountId: cashAccount.id,
        categoryId: payCategory.id,
        type: TransactionType.income,
        amount: 2600,
        startDate: new Date(new Date().getFullYear(), 0, 5),
        frequency: RecurringFrequency.monthly,
        interval: 1,
        anchorDay: 5,
        note: '월급',
        description: '정기 급여 지급',
      },
      {
        userId: user.id,
        accountId: cardAccount.id,
        categoryId: foodCategory.id,
        type: TransactionType.expense,
        amount: 15,
        startDate: new Date(new Date().getFullYear(), 0, 10),
        frequency: RecurringFrequency.monthly,
        interval: 1,
        anchorDay: 10,
        note: '넷플릭스',
        description: '정기 구독료',
      },
    ],
  });

  console.log('✅ Seed with recurring transactions completed.');
}

main()
  .catch((e) => {
    console.error('❌ Seed Error:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
