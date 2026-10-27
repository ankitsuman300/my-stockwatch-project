-- CreateTable
CREATE TABLE "StatusChange" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "oldStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "inventory" INTEGER NOT NULL,
    "threshold" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "StatusChange_shop_productId_createdAt_idx" ON "StatusChange"("shop", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "StatusChange_shop_createdAt_idx" ON "StatusChange"("shop", "createdAt");
