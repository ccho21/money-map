-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "autoPayment" BOOLEAN,
ADD COLUMN     "paymentDate" INTEGER,
ADD COLUMN     "settlementDate" INTEGER;
