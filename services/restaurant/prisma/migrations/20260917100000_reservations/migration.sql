CREATE TABLE "reservations" (
  "id" TEXT PRIMARY KEY,
  "restaurant_id" INTEGER NOT NULL,
  "request" JSONB NOT NULL,
  "items" JSONB NOT NULL,
  "released" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_nonnegative_stock" CHECK ("stock" >= 0);
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_nonnegative_price" CHECK ("price_vnd" >= 0);
