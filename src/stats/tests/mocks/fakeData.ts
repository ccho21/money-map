// 📄 경로: src/stats/__tests__/__mocks__/fakeData.ts

export const fakeTransactions = [
  { id: 1, amount: 1000, categoryId: 1, createdAt: new Date('2024-01-01') },
];

export const fakeBudgetCategories = [
  { id: 1, categoryId: 1, budgetId: 1, amount: 2000, type: 'expense' },
];

export const fakeBudgets = [
  { id: 1, startDate: new Date('2024-01-01'), endDate: new Date('2024-01-31') },
];

export const fakeCategories = [{ id: 1, name: 'Food', type: 'expense' }];

export const fakeGroupedTransactions = {
  '2024-01-01': [{ amount: 1000, categoryId: 1 }],
};

export const fakeGroupedBudgets = {
  '2024-01-01': [{ amount: 2000, categoryId: 1 }],
};
