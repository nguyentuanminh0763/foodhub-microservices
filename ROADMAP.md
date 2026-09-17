# FoodHub — Roadmap

Progress checklist. Why each decision was made: `CLAUDE.md`. Current state: `PROJECT_STATE.md`.

## Working loop — one task per sitting, one commit each

| Step | Who |
|---|---|
| **BRIEF** — options and trade-offs | Claude |
| **DECIDE** — pick one | **User** |
| **SHIP** — write the files, run nothing | Claude |
| **RUN** — type every `docker` / `npm` / `npx` / `curl` / `psql` command, paste output back | **User** |
| **BREAK** — predict the outcome first, then run the failure exercise | **User** |
| **EXPLAIN** — `docs/ai-journal/NN_topic.md` | **User** |
| **COMMIT** | **User** types it, Claude drafts the message |

Claude may read files, grep, and run `git status` / `log` / `diff`. Nothing that shows how the
system behaves at runtime.

---

## Phase 1 — connectivity

Done when `curl localhost:3000/api/restaurants/health` answers through the gateway, from containers.

- [x] 1.1 Git identity — own GPG key, noreply email
- [x] 1.2 Rewrite outer docs for the NestJS stack
- [x] 1.3 Push `legacy/spring`, delete Java/Express from `main`
- [x] 1.4 `docker-compose.yml` — 2 Postgres + healthchecks
- [x] 1.5 `restaurant` — Prisma 7, `restaurants` + `dishes`, `/health` reports real DB state
- [x] 1.6 `order` — Prisma 7, `orders` + `order_items`, `OrderStatus` enum, same `/health`
- [ ] **1.7 Three Dockerfiles, services wired into compose** ← current
- [ ] 1.8 `.github/workflows/ci.yml` — build + test on push

## Phase 2 — real data

Done when order #123 exists with a price read from restaurant-service, not from the client.

- [ ] Swagger, DTOs and Entities appear here — the first endpoints that return rows
- [ ] `restaurant`: `restaurants/` and `dishes/` modules, CRUD
- [ ] `order`: `orders/` module, `POST /orders`
- [ ] order → restaurant over HTTP: does this dish exist, what does it really cost
- [ ] **Break:** downstream hangs 60s, 100 concurrent requests → cascading failure

## Phase 3 — Kafka

Done when all six experiments in `docs/KAFKA.md` have been run.

- [ ] Kafka 3.9 (KRaft) + Kafka UI in compose
- [ ] `order` publishes `order.created` after the write commits
- [ ] `notification-service` (:3004) consumes it
- [ ] **Break:** kill a consumer mid-batch before offset commit → why redelivery, why idempotency
- [ ] **Break:** 3 partitions, 4 consumers in one group → why the 4th sits idle
- [ ] **Break:** replay from offset 0 → why a queue cannot do this

## Phase 4 — the actual reason for Kafka

Done when two independent consumer groups read one topic.

- [ ] `payment-service` (:3003) — second consumer group on `order.created`
- [ ] publishes `payment.succeeded`, notification consumes that too

## Phase 5 — Redis

Done when 100 concurrent requests for one portion produce zero oversell.

- [ ] Redis in compose
- [ ] Atomic stock check on the last portion
- [ ] Consumer idempotency
- [ ] **Break:** 100 concurrent orders, 1 portion — count the oversells without the lock first

## Phase 6 — auth

- [ ] JWT at the gateway, identity propagated downstream
- [ ] Rate limiting
- [ ] Decide and journal: own service, or inside the gateway

## Phase 7 — operations

- [ ] Two `order-service` instances
- [ ] Watch the consumer group split partitions between them

## Later — scope C

Driver assignment, live location, delivery completion, customer rating. Only after the above runs.

---

## Estimate

~4 sittings left in Phase 1, 3–6 per phase after that.
