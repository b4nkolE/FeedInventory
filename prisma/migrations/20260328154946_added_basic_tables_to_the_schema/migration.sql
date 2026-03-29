-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "FeedCategory" AS ENUM ('PULLET_RATION', 'BROILER_RATION', 'CONCENTRATE', 'PREMIUM_BROILER', 'BROILER_PLUS_PRO', 'FISH_FEED', 'OMEGA_FISH_FEED');

-- CreateTable
CREATE TABLE "FeedItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "FeedCategory" NOT NULL,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "pricePerUnit" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "feedItemId" TEXT NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedItem_name_key" ON "FeedItem"("name");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "FeedItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
