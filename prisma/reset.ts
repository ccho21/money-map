import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 순서 주의! 외래키 순서로 삭제해야 함
  await prisma.budgetCategory.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧨 모든 데이터 삭제 완료!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
