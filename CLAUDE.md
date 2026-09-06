# CLAUDE.md — FoodHub

Food delivery platform as microservices. Learning project: the goal is to **defend every technical
decision in an interview**, not to ship a product.

Repo: `https://github.com/nguyentuanminh0763/foodhub-microservices`

## Read first

1. [`docs/BUSINESS_OVERVIEW.md`](docs/BUSINESS_OVERVIEW.md) — **what the product actually is**, as one
   concrete order from 19:30 to 19:50. Every technology traces to a line in it. Read this before
   proposing anything architectural
2. [`CLAUDE_RULES.md`](CLAUDE_RULES.md) — rules, real traps, risk threshold
3. [`PROJECT_STATE.md`](PROJECT_STATE.md) — per-service state, open issues
4. [`docs/ai-journal/`](docs/ai-journal/) — past decisions **and rejected options**

**Scope: B** (decided 2026-09-06) — browse, order, pay, restaurant confirms, stops at "food ready".
Delivery and driver tracking are scope C, deferred.

> Migrated from Spring Boot + Express to NestJS on 2026-09-06. The old code is on the
> `legacy/spring` branch, **not** on `main` — do not resurrect it.
> Live infrastructure right now: `restaurants-db` (5433) and `orders-db` (5434), both healthy.
> No services exist yet.

---

## Working agreement — CHANGED 2026-09-06

The old mode (fill-in-the-blank: *the user writes the business logic, Claude does not*) is **dead**.
Evidence and reasoning: [`docs/ai-journal/00_stack-pivot.md`](docs/ai-journal/00_stack-pivot.md).

**Current mode: vibe code.** Claude writes all the code, complete. **No `// FILL:` markers, no
`.todo` files.**

The learning target moved from *business logic* to *infrastructure* — Kafka, Redis, Postgres,
NestJS, CI/CD. None of that lives in typed code. `producer.send()` is three lines; typing it teaches
nothing about Kafka.

### The loop: BRIEF → DECIDE → SHIP → BREAK → EXPLAIN

| Step | Who | What |
|---|---|---|
| **BRIEF** | Claude | Explain what the tool can and cannot do, the options, and the tradeoffs — **before** any architectural choice is made |
| **DECIDE** | **User** | Choose. Claude states a recommendation and its reasoning, then waits |
| **SHIP** | Claude | Write it, run it, verify it |
| **BREAK** | User | Run the phase's mandatory failure exercise |
| **EXPLAIN** | User | Write `docs/ai-journal/<topic>.md`: what broke, what the logs said, why the system behaved that way, how to answer it in an interview |

**BRIEF and DECIDE were added 2026-09-06 after a real failure.** Claude had decided Kafka's phase,
its topics, and its placement, then written all of it into `CLAUDE_RULES.md` as settled law — for a
user who had said outright they did not yet know what Kafka could do. Vibe code had quietly become
"Claude designs the architecture, the user watches."

That breaks the entire point of the project: **you cannot defend a decision in an interview that you
neither understood nor made.**

The rule that follows: **any decision that shapes the architecture gets a BRIEF first, and the user
decides.** Never write an architectural choice into a rules file as if settled. Implementation
details inside an already-made decision do not need this — that is what vibe code is for.

Claude does SHIP and **prepares the script for BREAK** — exact commands, what to watch, what should
happen. EXPLAIN is the user's; it is the one part that cannot be outsourced.

`LEARNING_LOG.md` is retired in favour of `docs/ai-journal/`. It sat empty for three weeks because
it asked the user to invent content; a journal always has a real incident to describe.

### Mandatory breakage exercises

| Tech | Break this | Must be able to answer |
|---|---|---|
| Gateway | `docker compose stop restaurant` then call it | Which status code? How do 500/502/503/504 differ? |
| Postgres | Kill the DB while a service is running | Does the service die or survive? What does the connection pool do? |
| Sync HTTP | Make the downstream hang for 60s | What happens to the gateway under 100 concurrent requests? (cascading failure) |
| Kafka | Kill a consumer mid-batch, before offset commit | Why is the message redelivered? Why is idempotency mandatory? |
| Kafka | 3 partitions, 4 consumers in one group | Why does the 4th sit idle? |
| Kafka | Read from offset 0 after consuming everything | Why can a queue not do this? |
| Redis | 100 concurrent requests for the last portion | How many oversells without Redis? What mechanism stops it? |
| CI/CD | Push a commit that fails a test | Where does the pipeline stop, and how fast do you find out? |

---

## Target architecture

```
                          ┌──────────────┐
        Client  ────────▶ │   Gateway    │  :3000   only public door
                          └──────┬───────┘          JWT + rate limit (Phase 6)
                     HTTP        │        HTTP
             ┌───────────────────┴───────────────────┐
             ▼                                       ▼
   ┌─────────────────────┐               ┌─────────────────────┐
   │ restaurant-service  │               │   order-service     │
   │       :3001         │◀── HTTP ──────│       :3002         │  sync: real dish? real price?
   │   restaurants-db    │               │     orders-db       │
   └─────────────────────┘               └──────────┬──────────┘
                                                    │ publish, AFTER the write commits
                                                    ▼
                                          ┌───────────────────┐
                                          │      Kafka        │  order.created
                                          └────┬─────────┬────┘
                                    consume    │         │    consume
                              ┌────────────────┘         └──────────────┐
                              ▼                                         ▼
                  ┌───────────────────────┐              ┌───────────────────────┐
                  │ notification-service  │  Phase 3     │   payment-service     │  Phase 4
                  │        :3004          │              │        :3003          │
                  └───────────────────────┘              └───────────┬───────────┘
                              ▲                                      │
                              └──── payment.succeeded ───────────────┘
```

**Two independent consumer groups on one topic** is the reason Kafka is here rather than a queue.
Until payment-service exists there is only one consumer, and one consumer is a case RabbitMQ serves
better — say so honestly rather than pretending otherwise.

- **Sync (HTTP)** — order asks restaurant *"does this dish exist, what does it cost?"* and blocks.
  Cost: **temporal coupling** — restaurant down means order down. Timeouts, retries and circuit
  breakers shrink the blast radius; they do not remove the dependency.
- **Async (Kafka)** — order saves, publishes `order.created`, returns. Cost: **eventual consistency**.
- **Never trust a price from the client.** Always re-read it from restaurant-service.

## Stack

| Layer | Choice |
|---|---|
| Gateway / services | NestJS 11, TypeScript |
| ORM | **Prisma** — one `schema.prisma` + one DB per service |
| Database | PostgreSQL 16 — one per service |
| Messaging | Kafka 3.9 (KRaft) via **`kafkajs`** directly |
| Cache / locking | Redis (Phase 5) |
| Validation | `class-validator` + global `ValidationPipe` |
| Infra / CI | Docker Compose, GitHub Actions |

### Four decisions locked in (2026-09-06)

| Decision | Choice | Why |
|---|---|---|
| ORM | **Prisma**, not TypeORM | Real migrations, real type safety, better represented in current Node job ads |
| Repo layout | **One `package.json` per service**, no workspaces | Honest to microservices: independent deploys, simple Dockerfiles. Sharing DTOs is the lesson, not a nuisance to engineer away |
| Auth | **Deferred to Phase 6** | Phases 1–5 work without it. Deciding now is guessing |
| Order entry | **Gateway → HTTP → order-service**, client gets `201` | Rejected: gateway emits to Kafka, client gets `202`. See `docs/ai-journal/01_order-entry-sync-vs-async.md` |
| Legacy code | **Branch `legacy/spring`, then delete from `main`** | Old code stays visible on GitHub, `main` stays clean, and the migration story has evidence |

`kafkajs` directly rather than `@nestjs/microservices`: the Nest wrapper hides topics, partitions,
offsets and consumer groups — the four concepts being learned.

No `shared/` folder. When two services need the same shape, **copy it**, then journal what happens
when the copies drift. That is the distributed-contract lesson, not a design flaw.

---

## Roadmap

| Phase | Goal | Done when |
|---|---|---|
| **0** ✅ | Docs + new working rules | `PROJECT_STATE.md`, `CLAUDE_RULES.md`, journal exist |
| **1** ← **current** | Git identity → rewrite outer docs → delete legacy → compose → 2 services → gateway → minimal CI | `curl localhost:3000/api/restaurants/health` answers through the gateway |
| **2** | Real data: restaurants, dishes, orders + **sync HTTP** order→restaurant | Order #123 exists with a price read from restaurant-service, not from the client |
| **3** | **Kafka**: order publishes `order.created`, notification-service consumes | All six experiments in `docs/KAFKA.md` are run |
| **4** | **payment-service**: second independent consumer of `order.created`, publishes `payment.succeeded` | Two consumer groups on one topic — the actual justification for Kafka |
| **5** | **Redis**: contention on the last portion → atomic ops / locking, consumer idempotency | 100 concurrent requests, one portion, zero oversell |
| **6** | JWT at the gateway, identity propagation, full CI/CD | |
| **7** | Operations: two order-service instances, consumer group splits partitions | |
| *future* | **Scope C** — driver assignment, live location, delivery | Only after the above works |

### Phase 1, broken down

One task per sitting. Commit each one separately.

| # | Task | Done when |
|---|---|---|
| 1.1 | Fix git identity (trap #4) | ✅ Own GPG key `5359A8A8A6C4F69C`, noreply email configured |
| 1.2 | Rewrite outer docs: `README.md`, `docs/ARCHITECTURE.md`, `docs/RUNNING.md` | No mention of Spring / Maven / IntelliJ remains |
| 1.3 | Push `legacy/spring`, delete Java/Express from `main` | `services/` empty, separate `refactor:` commit |
| 1.4 | `docker-compose.yml`: 2 Postgres + healthchecks, **no services yet** | `docker compose up -d` → both DBs healthy |
| 1.5 | `services/restaurant`: NestJS + Prisma + `/health` + Dockerfile | `curl localhost:3001/api/restaurants/health` |
| 1.6 | `services/order`: same | `curl localhost:3002/api/orders/health` |
| 1.7 | `services/gateway`: proxy to both | `curl localhost:3000/api/restaurants/health` ← **Phase 1 done** |
| 1.8 | `.github/workflows/ci.yml`, minimal | Push → CI green |

1.4 is split from 1.5 on purpose: stand up the databases, confirm the healthchecks, *then* plug
services in. When it breaks you know which layer.

### Target layout

```
foodhub-microservices/
├── docker-compose.yml
├── README.md · CLAUDE.md · CLAUDE_RULES.md · PROJECT_STATE.md
├── .github/workflows/ci.yml
├── docs/
│   ├── ARCHITECTURE.md · RUNNING.md
│   ├── KAFKA.md                     ← Phase 3
│   └── ai-journal/
└── services/
    ├── gateway/       :3000
    ├── restaurant/    :3001 + restaurants-db :5433
    └── order/         :3002 + orders-db :5434
```

No `notification/` until **Phase 3**, no `payment/` until **Phase 4**. A folder holding only an empty
README is debt, and it teaches the reader that the folder is decorative.

**Still open:** where auth lives — its own service, or inside the gateway. Decide in Phase 6 and
journal the reason.

### Rule on adding technology

A tool enters only when it answers a problem the project has actually hit. This is the one rule kept
intact from the old agreement, because it is correct. Redis arrives in Phase 5 because that is when
overselling appears. gRPC / GraphQL / Elasticsearch / Kubernetes are out of scope until this roadmap
changes first.

**Claude must push back** on pulling a later phase forward while an earlier one does not run.

---

## Quick reminders

- The user is a working developer — reads diffs and stack traces. Pitch at **patterns and
  tradeoffs**, not basic syntax. **Converse in Vietnamese; write all files in English.**
- **Git Bash, not PowerShell** (trap #5). Git is installed on **D:**.
- One service = one folder = one Dockerfile = one database. Each exposes `/health`.
- **Never commit `.env`.**
- **Never claim "done" without running it.** In a distributed system, "it compiles" says almost nothing.
- High-risk actions (deleting legacy code, `push --force`, `compose down -v`, adding tech outside the
  roadmap, changing project direction) → **propose and wait**. See the risk threshold in
  `CLAUDE_RULES.md`. Routine work: just do it.

## After any change

Run it to verify → update `PROJECT_STATE.md` **in the same change** → add a journal entry if there
was a decision or a bug worth remembering.
