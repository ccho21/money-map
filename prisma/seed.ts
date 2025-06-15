import {
  PrismaClient,
  AccountType,
  CategoryType,
  TransactionType,
  RecurringFrequency,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
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

  const today = new Date();
  const currentYear = today.getFullYear();
  const mayMonth = 4; // 5월 (0-based)
  // const juneMonth = 5; // 6월

  const allTransactions: NewTransaction[] = [];
  const budgetCategoryData: NewBudgetCategory[] = [];

  const budget = await prisma.budget.create({
    data: {
      userId: user.id,
      total: 4000,
    },
  });

  for (let i = 0; i < 2; i++) {
    const month = mayMonth + i;
    const monthDate = new Date(currentYear, month, 1);

    allTransactions.push(
      {
        userId: user.id,
        accountId: cashAccount.id,
        type: TransactionType.income,
        categoryId: payCategory.id,
        amount: 2500 + i * 100,
        date: set(new Date(currentYear, month, 5), { hours: 12 }),
        description: `Salary for ${monthDate.toLocaleString('default', { month: 'long' })}`,
      },
      {
        userId: user.id,
        accountId: cardAccount.id,
        type: TransactionType.expense,
        categoryId: foodCategory.id,
        amount: 40 + i * 2,
        date: set(new Date(currentYear, month, 10), { hours: 12 }),
        description: `Dinner in ${monthDate.toLocaleString('default', { month: 'long' })}`,
      },
      {
        userId: user.id,
        accountId: cardAccount.id,
        type: TransactionType.expense,
        categoryId: rideCategory.id,
        amount: 18 + i,
        date: set(new Date(currentYear, month, 15), { hours: 12 }),
        description: `Ride in ${monthDate.toLocaleString('default', { month: 'long' })}`,
      },
    );

    const startDate = new Date(currentYear, month, 1);
    const endDate = new Date(currentYear, month + 1, 0);

    budgetCategoryData.push(
      {
        budgetId: budget.id,
        categoryId: foodCategory.id,
        amount: 200 + i * 10,
        startDate,
        endDate,
        type: CategoryType.expense,
      },
      {
        budgetId: budget.id,
        categoryId: rideCategory.id,
        amount: 100 + i * 5,
        startDate,
        endDate,
        type: CategoryType.expense,
      },
    );
  }

  await prisma.transaction.createMany({ data: allTransactions });
  await prisma.budgetCategory.createMany({ data: budgetCategoryData });

  console.log(
    '✅ Seed with May and June transactions & budget categories completed.',
  );

  await prisma.recurringTransaction.createMany({
    data: [
      {
        userId: user.id,
        accountId: cashAccount.id,
        categoryId: payCategory.id,
        type: TransactionType.income,
        amount: 2600,
        startDate: new Date(currentYear, mayMonth, 5),
        frequency: RecurringFrequency.monthly,
        interval: 1,
        anchorDay: 5,
        note: 'Salary',
        description: 'Monthly salary payment',
      },
      {
        userId: user.id,
        accountId: cardAccount.id,
        categoryId: foodCategory.id,
        type: TransactionType.expense,
        amount: 15,
        startDate: new Date(currentYear, mayMonth, 10),
        frequency: RecurringFrequency.monthly,
        interval: 1,
        anchorDay: 10,
        note: 'Netflix',
        description: 'Monthly subscription',
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
