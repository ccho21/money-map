/*
  Warnings:

  - A unique constraint covering the columns `[categoryId,startDate,endDate]` on the table `BudgetCategory` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `endDate` to the `BudgetCategory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `BudgetCategory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BudgetCategory" ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "BudgetCategory_categoryId_startDate_endDate_key" ON "BudgetCategory"("categoryId", "startDate", "endDate");
