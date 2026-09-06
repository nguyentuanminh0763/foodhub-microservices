# FoodHub — Food Delivery, as Microservices

A food-ordering platform built as **NestJS microservices** with Postgres, Kafka and Redis.

Personal learning project. The goal is to understand microservices and the infrastructure
around them deeply enough to **defend every decision in an interview** — not just to make it run.

> **Status: Phase 1, in progress. Nothing runs end to end yet.**
> Honest per-service state lives in [`PROJECT_STATE.md`](./PROJECT_STATE.md).
> This README describes the **target**; do not assume anything below is working today.

---

## Architecture

```
                          ┌──────────────┐
        Client  ────────▶ │   Gateway    │  :3000   the only public door
                          └──────┬───────┘          JWT + rate limit (Phase 5)
                     HTTP        │        HTTP
             ┌───────────────────┴───────────────────┐
             ▼                                       ▼
   ┌─────────────────────┐               ┌─────────────────────┐
   │ restaurant-service  │               │   order-service     │
   │       :3001         │◀── HTTP ──────│       :3002         │
   │   restaurants-db    │               │     orders-db       │
   └─────────────────────┘               └──────────┬──────────┘
                                                    │ publish
                                                    ▼
                                          ┌───────────────────┐
                                          │      Kafka        │  order.created
                                          └─────────┬─────────┘
                                                    │ consume
                                                    ▼
                                        ┌───────────────────────┐
                                        │ notification-service  │  Phase 3
                                        └───────────────────────┘
```

**Two communication styles, deliberately:**

- **Synchronous (HTTP)** — order asks restaurant *"does this dish exist, what does it cost?"*
  and blocks. There is no way to continue without the answer. The cost is **temporal coupling**:
  if restaurant-service is down, order-service is down too.
- **Asynchronous (Kafka)** — order saves, publishes `order.created`, returns immediately.
  Consumers react later. The publisher does not know who is listening. The cost is
  **eventual consistency**.

**Never trust a price sent by the client.** The order service always re-reads the price from
restaurant-service. This is the reason the sync call exists at all.

Full reasoning, including where each choice is a trade rather than an upgrade:
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Tech stack

| Layer | Technology |
|---|---|
| Gateway | NestJS 11, `@nestjs/axios` |
| Services | NestJS 11, TypeScript |
| ORM | Prisma — one `schema.prisma` and one database per service |
| Database | PostgreSQL 16 — **one per service** |
| Messaging | Kafka 3.9 (KRaft, no ZooKeeper) via `kafkajs` |
| Cache / locking | Redis *(Phase 4)* |
| Validation | `class-validator` + global `ValidationPipe` |
| Infrastructure | Docker Compose |
| CI/CD | GitHub Actions |

Two deliberate choices worth naming:

- **`kafkajs` directly, not `@nestjs/microservices`.** The Nest wrapper hides topics, partitions,
  offsets and consumer groups — which are exactly the four concepts being learned here.
- **No shared package, no `shared/` folder.** Every service has its own `package.json` and is
  independently deployable. When two services need the same shape, it gets copied. The pain of
  keeping two copies in sync *is* the lesson about distributed contracts, not an oversight.

## Ports

| What | Where |
|---|---|
| Gateway | `localhost:3000` ← the only one a client should touch |
| restaurant-service | `localhost:3001` (direct access, debugging only) |
| order-service | `localhost:3002` (direct access, debugging only) |
| restaurants-db | `localhost:5433` |
| orders-db | `localhost:5434` |
| Kafka broker | `localhost:9092` from the host, `kafka:19092` from containers *(Phase 3)* |
| Kafka UI | `localhost:8080` *(Phase 3)* |

## Getting started

```bash
cp .env.example .env
```

```bash
docker compose up --build
```

Then the command that defines "the environment works":

```bash
curl http://localhost:3000/api/restaurants/health
```

One answer, from a container that is not the gateway, through one door. That is Phase 1 done.

Full instructions and troubleshooting: [`docs/RUNNING.md`](./docs/RUNNING.md).

## Roadmap

| Phase | Goal |
|---|---|
| **1** ← current | Walking skeleton — compose up works, gateway forwards to both services, no business logic |
| **2** | Real data — restaurants, dishes, orders, plus the sync HTTP call between services |
| **3** | **Kafka** — publish `order.created`, consume it, then break it on purpose |
| **4** | **Redis** — two customers, one last portion. Atomic ops, distributed locking, consumer idempotency |
| **5** | JWT at the gateway, identity propagation, full CI/CD |
| **6** | Operations — run two order-service instances, watch the consumer group split partitions |

**On adding technology:** a tool enters this repo only when it answers a problem the project has
actually hit. Redis arrives in Phase 4 because that is when overselling shows up, not before.
gRPC, GraphQL, Elasticsearch and Kubernetes are out of scope until the roadmap changes first.

## Repository structure

```
foodhub-microservices/
├── docker-compose.yml
├── .github/workflows/ci.yml
├── docs/
│   ├── ARCHITECTURE.md      # why each split exists, and when a monolith would be better
│   ├── RUNNING.md           # the three feedback loops
│   └── ai-journal/          # decision log — including options that were rejected
└── services/
    ├── gateway/             # :3000
    ├── restaurant/          # :3001 + restaurants-db
    └── order/               # :3002 + orders-db
```

`payment/` and `notification/` are deliberately absent until Phase 3. A folder containing only an
empty README teaches the reader that the folder is decorative.

## A note on history

This project began as Spring Boot + Express with MySQL, MongoDB and RabbitMQ. It was migrated to
NestJS + Postgres + Kafka in September 2026 to match the infrastructure actually worth learning.
The original stack is preserved on the `legacy/spring` branch. The migration reasoning is in
[`docs/ai-journal/00_doi-huong-stack.md`](./docs/ai-journal/00_doi-huong-stack.md).

---

Working agreement for AI-assisted sessions: [`CLAUDE.md`](./CLAUDE.md) ·
Rules and known traps: [`CLAUDE_RULES.md`](./CLAUDE_RULES.md)
