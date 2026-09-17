ALTER TYPE "OrderStatus" ADD VALUE 'RESERVING';
ALTER TABLE "orders"
  ADD COLUMN "user_id" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "restaurant_id" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "request_key" TEXT,
  ADD COLUMN "request" JSONB,
  ADD COLUMN "failure" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "orders_user_id_request_key_key" ON "orders"("user_id", "request_key");
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");
CREATE TABLE "outbox" (
  "id" TEXT PRIMARY KEY,
  "topic" TEXT NOT NULL,
  "aggregate_id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3)
);
CREATE INDEX "outbox_sent_at_created_at_idx" ON "outbox"("sent_at", "created_at");
