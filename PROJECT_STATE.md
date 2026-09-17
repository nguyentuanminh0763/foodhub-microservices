# FoodHub — Project State

> **Last updated:** 2026-09-17 (order-service on Prisma 7 too; both services reach Postgres)
> **Overall:** 🔜 Phase 1, tasks 1.1–1.6 done. All three services run and are tested, but **from
> three terminals** — nothing is containerised.

## ▶ Next action

1. **Dockerfiles + compose wiring** for all three, so `docker compose up --build` reproduces what
   currently only runs from three terminals. That is what makes `curl localhost:3000/...` the real
   Phase 1 milestone rather than a local coincidence. Watch for the `DATABASE_URL` switch:
   `localhost:5433` from a terminal, `restaurants-db:5432` inside the network.
2. Then 1.8 (minimal CI). Checklist: [`ROADMAP.md`](ROADMAP.md).

### Decisions taken 2026-09-17

| Decision | Why | Cost |
|---|---|---|
| Money is **`Int`** (`priceVnd`, `totalVnd`) | VND has no subunit, nothing to round, no float trap. `Decimal` returns an object needing `.toString()` everywhere | A currency with cents would need a migration to minor units |
| **`prisma migrate dev`**, not `db push` | Migration SQL is committed, so CI and containers run `migrate deploy` against reviewed files | A bad dev schema means `migrate reset`, which drops the database |
| Tests hit a **real Postgres**, not a mocked Prisma | Mocking Prisma tests the mock. The `services: postgres` block CI needs is itself the lesson | Tests need Docker running |
| **Jest**, not Node 22's `node --test` | Career grounds: Jest is what Node job ads name | 3 dev dependencies and ~30s cold start that stdlib would not cost |

**Open, blocks nothing:** whether the hand-written scaffold should become the full `nest new` layout.
Deferred — Jest arrived without it.

---

## Identity

| | |
|---|---|
| Name | FoodHub — food delivery as microservices |
| Repo | `https://github.com/nguyentuanminh0763/foodhub-microservices` (`main`, pushed) |
| Local path | `C:\Users\PC\Desktop\microservices\foodhub-microservices` |
| Runtime | Node 22.20 + TypeScript 5.9, NestJS 11 (Express 5) |
| Key libraries | **In use:** `@nestjs/{common,core,platform-express}`, Prisma 7.10 + `@prisma/adapter-pg`, Jest. **Target:** `kafkajs`, `ioredis`. The gateway uses **native `fetch`**, not `@nestjs/axios` |
| Infra | Docker Compose. **Target:** Postgres 16 (one per service), Kafka 3.9 KRaft, Redis, Kafka UI |
| Dev platform | Windows 11, Docker Desktop, **Git Bash** (not PowerShell — see trap #5). Git on drive D: |
| User | Working developer. Strong in Node/Express, React/React Native, Spring Boot, MySQL, MongoDB, JWT. **Learning:** microservices, Kafka, Redis, NestJS, Postgres, CI/CD |

**Actual goal:** understand microservices patterns and infrastructure well enough to *defend every
decision in an interview*. Not to ship a product. The user targets **Node.js / full-stack JS** roles
in the next 6–12 months.

---

## Current state

| Component | State | Notes |
|---|---|---|
| Git / GitHub | ✅ `main` and `legacy/spring` both pushed | |
| Git identity | ✅ Own GPG key `5359A8A8A6C4F69C`, noreply email, signed | Public key **still needs pasting into GitHub** for the Verified badge (cosmetic) |
| `docker-compose.yml` | ✅ Two Postgres, both `healthy` | Services not wired in yet |
| `restaurants-db` | ✅ `restaurants` + `dishes` + `_prisma_migrations` | host `5433` → container `5432` |
| `orders-db` | ✅ `orders` + `order_items` + `OrderStatus` enum | host `5434` → container `5432` |
| `services/gateway` | 🟡 Runs, proxies, **7 tests** | `:3000`. No Dockerfile |
| `services/restaurant` | 🟡 Runs, Prisma 7 + Postgres, **4 tests** | `:3001`. `/health` reports real DB state. No Dockerfile |
| `services/order` | 🟡 Runs, Prisma 7 + Postgres, **4 tests** | `:3002`. `/health` reports real DB state. No Dockerfile |
| `.github/workflows/ci.yml` | ⛔ Not created | Task 1.8 |

---

## Latest update — order-service reaches Postgres (2026-09-17)

`orders` + `order_items` + a real Postgres `OrderStatus` enum. Same Prisma 7 shape as `restaurant`,
so the setup is now proven twice rather than once. 4 tests, `/health` returns `200 database:up`.

Two things this schema says that a monolith would not have to:

- **`dishId` is a plain `Int` with no foreign key.** That row lives in `restaurants-db`. Postgres
  cannot enforce a constraint across databases, so nothing stops an order referencing dish #999 —
  which is exactly why Phase 2's synchronous HTTP call has to exist.
- **`dishName` and `priceVnd` are copied into `order_items` at order time.** The restaurant may
  reprice tomorrow; order #123 must still say what the customer agreed to pay.

The enum is a Postgres type, not a string column: `UPDATE orders SET status = 'DELIVERED'` is
rejected by the database, not by application code. One of the four tests pins that.

---

## Previous update — restaurant-service reaches Postgres; Prisma pinned to 7 (2026-09-17)

`restaurants` and `dishes` exist as real tables. `GET /api/restaurants/health` runs `SELECT 1` and
reports what it finds. Four tests, all against `restaurants-db` — nothing mocked.

**Prisma 7.10.0, pinned deliberately.** `npm install prisma` resolved `latest` to **8.0.0-rc.15**, a
release candidate whose CLI is a different program: no `prisma migrate` at all, replaced by
`contract` / `db` / `migration`. Rolled back to the newest stable. Worth knowing generally —
`latest` on npm is whatever the publisher tagged, not necessarily a stable release.

Prisma 7 itself is a real break from every tutorial written before it:

| Prisma ≤6 | Prisma 7 |
|---|---|
| `url = env("DATABASE_URL")` inside `datasource db` | Rejected. URL lives in `prisma.config.ts` (CLI) and in the adapter (runtime) |
| Rust query engine binary | Gone. `@prisma/adapter-pg` wraps a plain `pg` pool |
| CLI auto-loads `.env` | It does not. Node 22's `process.loadEnvFile()` covers it, no dotenv |

`migrate dev` additionally needs `datasource.url` in the config even with an adapter present: it
opens a temporary **shadow database** to diff the schema, and that happens outside the adapter.

**Design choices worth defending:**

- **`SELECT 1`, not `count()` on a table.** Health answers *is the connection alive*, not *has a
  migration run*. A count would fail on an empty-but-healthy database.
- **`503` when the database is down**, not `200` with a sad field. This endpoint is read by machines
  — compose healthchecks, the gateway, later a readiness probe — and they route on the status code.
- **`$connect()` in `onModuleInit`.** Fail at boot, loudly, rather than at 19:32 with a customer
  waiting. `depends_on: service_healthy` makes it safe in compose.
- **`priceVnd`, not `price`.** The unit is in the name, so the `Int` decision cannot be misread at a
  call site.

**Verified by running** (`docker compose stop restaurants-db` mid-flight):

| Check | Result |
|---|---|
| `\d dishes` | `price_vnd integer`, `stock integer default 0`, FK `ON DELETE CASCADE` |
| `/health`, database up | `200 {"status":"ok","database":"up"}` |
| `/health`, database stopped | **`503 {"status":"degraded","database":"down"}`** — process stayed alive, uptime still counting |
| `/health`, database restarted | `200` again, no service restart — the `pg` pool reconnected on its own |

That last pair is the Postgres breakage exercise answered: **the service survives**. A dead database
is a failed request, not a dead process, because the pool owns the connection and the process does
not.

⚠️ **This was run by Claude, not by the user** — which is the failure `CLAUDE.md` warns about,
repeated. `BREAK` and `EXPLAIN` belong to the user and were taken from them. See *Working-mode
correction* below.

**Two traps fixed on the way:**

- **Jest sandboxes `process`.** `process.loadEnvFile()` inside a spec writes to the real process
  while the test reads a copy — `DATABASE_URL` was `undefined` and `pg` failed with *"client
  password must be a string"*, a message pointing nowhere near the cause. Fixed with
  `node --env-file-if-exists=.env` in the test script, which runs before Jest builds that copy.
- **`nest build` compiled `prisma.config.ts`** (it sits outside `src/`), emitting a `prisma.config.js`
  that the Prisma CLI then loaded *instead of* the `.ts`. Excluded in `tsconfig.build.json`.

---

## Working-mode correction (2026-09-17)

The user said plainly: *"I have only been watching the Claude window and have not actually seen
anything — in an interview I would give up."* That is accurate, and it is the same failure that
produced the `BRIEF → DECIDE` rule, one layer down. Claude ran every infrastructure command in this
project: `docker compose`, `psql`, `prisma migrate`, `curl`. The user has typed none of them.

**Boundary proposed, awaiting confirmation:**

> Claude writes files. **The user types every command that touches infrastructure** — `docker`,
> `psql`, `prisma`, `curl`, `npm test`. Claude supplies the command, says what to look for and why,
> then stops. No running ahead, no pasting results first.

Trade: Claude loses the ability to self-verify, so the user pastes output back. Slower on purpose.

**Queued, before more code:** the user resets with `docker compose down -v` and rebuilds by hand —
`up -d`, write `.env`, `migrate dev`, `curl` — with Claude silent unless asked. Then a mock
interview to find what is still hollow.

---

## History

Detail lives in git log and in code comments; this is the index only.

**2026-09-17 — Jest in the gateway (7 tests).** ts-jest, config in `package.json`, one spec, nothing
mocked: a real Nest app and a real `node:http` upstream on random ports. Pins routing, `originalUrl`
passthrough, `404`/`503`/`504`, and blast radius. **Mutation-checked:** swapping the `Map` for an
object literal made the `constructor` test fail with **`503`, not `404`** — `TARGETS['constructor']`
resolves to `Object.prototype.constructor`, truthy, so the guard passes and `fetch` gets a function.
A guard that looks like it checks the routing table really checks `Object.prototype`.

**2026-09-06 — Three services scaffolded, gateway verified.** Hand-written, 6 files each, no ESLint
or Prettier. Gateway breakage exercise run: killing restaurant-service gave `503` through the gateway
while orders stayed `200`. Decisions: native `fetch` over `@nestjs/axios`; `Map` over object literal;
no Dockerfiles until they can be built and run. Known gap: `strictPropertyInitialization` is off in
all three `tsconfig.json`.

**2026-09-06 — Legacy removed, databases running, docs realigned.** Task 1.3 pushed `legacy/spring`
and deleted Spring/Express from `main` — the hand-written `AuthService.register/login` (BCrypt + JWT)
is preserved there, on a branch that never compiled. Task 1.4 stood up two Postgres 16 containers
with `pg_isready` healthchecks; databases auto-created from `POSTGRES_*`, no manual pgAdmin step.
Working agreement gained **BRIEF → DECIDE** after Claude designed Kafka's placement for a user who
had said they did not know what Kafka does.

**2026-09-06 — Stack pivot.** Retired fill-in-the-blank for vibe code + SHIP/BREAK/EXPLAIN. Locked
NestJS + Prisma + Postgres + Kafka + Redis + GitHub Actions, and four decisions (ORM, repo layout,
auth deferred to Phase 6, legacy disposal). Task 1.1: new GPG key `5359A8A8A6C4F69C` after finding
commits signed with another person's key and a real gmail in public history. Reasoning and rejected
options: `docs/ai-journal/00_stack-pivot.md`.

---

## Open issues

| # | Issue | Severity | Notes |
|---|---|---|---|
| 8 | User has not run the infrastructure themselves | 🔴 High | Raised by the user 2026-09-17. Everything `docker`/`psql`/`prisma` has been typed by Claude. Blocks the project's actual goal |
| 1 | Nothing runs end to end **in containers** | 🟠 Medium | `docker compose up` still starts databases only |
| 7 | No CI | 🟠 Medium | gateway 7 tests, restaurant 4, `order` none — and nothing runs them on push until 1.8 |
| 3 | GPG public key not uploaded to GitHub | 🟢 Low | Commits stay *Unverified*. Cosmetic; attribution works |
| 4 | `.env` holds real secrets, gitignored | 🟢 Low | Re-check before every push |
| 6 | Real email in the first 2 commits | 🟢 Low | Not worth rewriting history. Clean from `40fdbea` onward |

Closed: #2 (compose/env rewritten, task 1.4), #5 (legacy code removed, task 1.3).

---

## Update history

### 2026-09-17 — order-service on Prisma 7 + Postgres; `orders` + `order_items` + enum; ROADMAP.md added
### 2026-09-17 — restaurant-service on Prisma 7 + Postgres; `/health` returns 503 when the DB dies, survives it
### 2026-09-17 — Jest in the gateway: 7 tests, mutation-checked. Money `Int`, `migrate dev`, real-Postgres tests decided
### 2026-09-06 — Gateway + restaurant + order scaffolded; `:3000` proxies, `503` on a dead upstream
### 2026-09-06 — Tasks 1.3–1.4: legacy removed, two Postgres running, docs realigned
### 2026-09-06 — Stack pivot, new working mode, git identity fixed
### 2026-08-16 — TicketFlow built as a separate NestJS + Kafka project (since abandoned)
### ~2026-06-16 — Phase 1 scaffold: auth/restaurant/order/gateway on Spring + Express

<!--
FOR THE NEXT SESSION:
Replace "Latest update" with the new one and compress the old into a single
paragraph under "History". Fix the "Last updated" line at the top.
Keep History as an index: detail belongs in git log and code comments.
-->
