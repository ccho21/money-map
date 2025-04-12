import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 🔥 삭제 순서 중요 (외래키 제약 순서)
  await prisma.budgetCategory.deleteMany(); // 예산-카테고리 중간 테이블
  await prisma.budget.deleteMany(); // 예산
  await prisma.transaction.deleteMany(); // 트랜잭션
  await prisma.account.deleteMany(); // 👈 계좌 추가
  await prisma.category.deleteMany(); // 카테고리
  await prisma.user.deleteMany(); // 사용자

  console.log('🧨 모든 데이터 삭제 완료!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
