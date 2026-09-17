CREATE TABLE "payments" (
  "id" SERIAL PRIMARY KEY,
  "order_id" INTEGER NOT NULL UNIQUE,
  "user_id" TEXT NOT NULL,
  "amount_vnd" INTEGER NOT NULL CHECK ("amount_vnd" >= 0),
  "status" TEXT NOT NULL CHECK ("status" IN ('SUCCEEDED', 'FAILED')),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "outbox" (
  "id" TEXT PRIMARY KEY,
  "topic" TEXT NOT NULL,
  "aggregate_id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3)
);
CREATE INDEX "outbox_sent_at_created_at_idx" ON "outbox"("sent_at", "created_at");
