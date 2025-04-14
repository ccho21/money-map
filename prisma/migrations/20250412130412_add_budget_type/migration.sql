/*
  Warnings:

  - Added the required column `type` to the `BudgetCategory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BudgetCategory" ADD COLUMN     "type" "CategoryType" NOT NULL;
