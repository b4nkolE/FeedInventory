/*
  Warnings:

  - You are about to drop the column `category` on the `FeedItem` table. All the data in the column will be lost.
  - Added the required column `categoryId` to the `FeedItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FeedItem" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- AddForeignKey
ALTER TABLE "FeedItem" ADD CONSTRAINT "FeedItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
