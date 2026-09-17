# FoodHub — Project State

> **Last updated:** 2026-09-17 (restaurant-service on Prisma 7 + Postgres, 4 tests, `/health` real)
> **Overall:** 🔜 Phase 1. Tasks 1.1–1.4 done. The **application skeleton** of 1.5–1.7 answers
> `200` through the gateway — from three terminal processes, with **no database and no containers**
> behind it yet. The gateway's routing and failure mapping are now pinned by tests.

## ▶ Next action

Two pieces are still missing before 1.5–1.7 can be called done:

1. ~~**Prisma in `services/restaurant`**~~ ✅ done 2026-09-17 — `\dt` lists `restaurants`, `dishes`
   and `_prisma_migrations`. **Same for `services/order`** next: an `orders` table with the
   `PENDING → PAID → CONFIRMED → READY` lifecycle from `BUSINESS_OVERVIEW.md`, `totalVnd Int`.
   Copy the Prisma 7 setup from `restaurant` — it is four files and two of them are config.
2. **Dockerfiles + compose wiring** for all three, so `docker compose up --build` reproduces what
   currently only runs from three terminals. That is what makes `curl localhost:3000/...` the real
   Phase 1 milestone rather than a local coincidence.

**Money is `Int` — decided 2026-09-17.** VND has no subunit, so there is nothing to round; `Int`
has no float trap; Prisma's `Decimal` returns an object that needs `.toString()` at every boundary.
Cost: a currency with cents would need a migration to minor units. Acceptable — this is a VND-only
learning project.

**`prisma migrate dev`, not `db push` — decided 2026-09-17.** Migration SQL is committed, so CI and
containers run `migrate deploy` against reviewed files instead of letting a tool infer the change.
Cost: a bad dev schema means `migrate reset`, which drops the database.

**Tests use a real Postgres, not a mocked Prisma — decided 2026-09-17.** Mocking Prisma would only
test the mock, and the `services: postgres` block CI needs is itself the lesson. Cost: tests need
Docker running. Jest was chosen over Node 22's built-in `node --test` on career grounds — it is what
Node job ads name.

One decision remains **open, and blocks nothing**: whether the hand-written scaffold should be
replaced by the full `nest new` layout. Deferred — Jest arrived without it.

Then 1.8 (minimal CI). Full task table: `CLAUDE.md` → Phase 1, broken down.

---

## Identity

| | |
|---|---|
| Name | FoodHub — food delivery as microservices |
| Repo | `https://github.com/nguyentuanminh0763/foodhub-microservices` (`main`, pushed) |
| Local path | `C:\Users\PC\Desktop\microservices\foodhub-microservices` |
| Runtime | Node 22.20 + TypeScript 5.9, NestJS 11 (Express 5). No Java or Express-only code left on `main` |
| Key libraries | **In use:** `@nestjs/{common,core,platform-express}`. **Target:** Prisma, `kafkajs`, `ioredis`. The gateway uses **native `fetch`**, not `@nestjs/axios` |
| Infra | Docker Compose. **Target:** Postgres 16 (one per service), Kafka 3.9 KRaft, Redis, Kafka UI |
| Dev platform | Windows 11, Docker Desktop, **Git Bash** (not PowerShell — see trap #5). Git on drive D: |
| User | Working developer. Strong in Node/Express, React/React Native, Spring Boot, MySQL, MongoDB, JWT. **Learning:** microservices, Kafka, Redis, NestJS, Postgres, CI/CD |

**Actual goal:** understand microservices patterns and infrastructure well enough to *defend every
decision in an interview*. Not to ship a product. The user targets **Node.js / full-stack JS** roles
in the next 6–12 months.

---

## Current state

`main` holds documentation plus three NestJS services that boot and answer `/health`. The Spring and
Express code was removed in task 1.3 and lives on the `legacy/spring` branch. Nothing on `main`
touches a database yet.

| Component | State | Notes |
|---|---|---|
| Git / GitHub | ✅ `main` and `legacy/spring` both pushed | |
| Git identity | ✅ Fixed 2026-09-06 | Own GPG key `5359A8A8A6C4F69C`, noreply email, commits signed. Public key **still needs pasting into GitHub** for the Verified badge (cosmetic) |
| Documentation | ✅ Rewritten for the target stack, all English | README, ARCHITECTURE, RUNNING, CLAUDE*, PROJECT_STATE, ai-journal |
| `docker-compose.yml` | ✅ Two Postgres, both verified `healthy` | Task 1.4 done 2026-09-06 |
| `restaurants-db` | ✅ Running, `restaurants` + `dishes` + `_prisma_migrations` created | host `5433` → container `5432` |
| `orders-db` | ✅ Running, `foodhub_orders` auto-created, no tables yet | host `5434` → container `5432` |
| `.env` / `.env.example` | ✅ Rewritten for Postgres + Prisma | |
| `services/gateway` | 🟡 Runs, proxies, **7 tests passing** | `:3000`, forwards `/api/<service>/*`. No Dockerfile |
| `services/restaurant` | 🟡 Runs, Prisma 7 + Postgres, **4 tests passing** | `:3001`. `/health` reports real DB state. **No Dockerfile** |
| `services/order` | 🟡 Runs, `/health` only | `:3002`. Same gaps |
| `.github/workflows/ci.yml` | ⛔ Not created | Task 1.8 |

### On the `legacy/spring` branch

Preserved, not lost: the hand-written `AuthService.register/login` (BCrypt + JWT, logic correct),
the `SecurityConfig` scaffold with 6 unfilled `// FILL:` markers, empty Order/Restaurant skeletons,
and the Spring Cloud Gateway with one example route. That branch never compiled — `SecurityConfig`
was deliberately left incomplete under the retired working mode.

---

## Latest update — restaurant-service reaches Postgres; Prisma pinned to 7 (2026-09-17)

`restaurants` and `dishes` exist as real tables. `GET /api/restaurants/health` runs `SELECT 1` and
reports what it finds. Four tests, all against `restaurants-db` — nothing mocked.

**Prisma 7.10.0, pinned deliberately.** `npm install prisma` resolved `latest` to **8.0.0-rc.15**, a
release candidate whose CLI is a different program: no `prisma migrate` at all, replaced by
`contract` / `db` / `migration`. That got rolled back to the newest stable. Worth knowing generally —
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

**Verified by running, not by building** (`docker compose stop restaurants-db` mid-flight):

| Check | Result |
|---|---|
| `\dt` in `restaurants-db` | `restaurants`, `dishes`, `_prisma_migrations` |
| `\d dishes` | `price_vnd integer`, `stock integer default 0`, FK `ON DELETE CASCADE` |
| `/health`, database up | `200 {"status":"ok","database":"up"}` |
| `/health`, database stopped | **`503 {"status":"degraded","database":"down"}`** — and the process stayed alive, uptime still counting |
| `/health`, database restarted | `200` again, no restart of the service — the `pg` pool reconnected on its own |

That last pair is the Postgres breakage exercise answered: **the service survives**. A dead database
is a failed request, not a dead process, because the pool owns the connection and the process does
not. Re-run it yourself and write the journal entry — the `EXPLAIN` step is the one part that cannot
be outsourced.

**Two traps fixed on the way:**

- **Jest sandboxes `process`.** `process.loadEnvFile()` inside a spec writes to the real process,
  while the test reads a copy — so `DATABASE_URL` was `undefined` and `pg` failed with
  *"client password must be a string"*. Fixed with `node --env-file-if-exists=.env` in the test
  script, which runs before Jest builds that copy. `--if-exists` keeps CI working with no `.env`.
- **`nest build` compiled `prisma.config.ts`** (it sits outside `src/`), emitting a `prisma.config.js`
  that the Prisma CLI then loaded *instead of* the `.ts` and failed to parse. Excluded in
  `tsconfig.build.json`.

---

## Previous update — Gateway under test; the Map decision is now enforced (2026-09-17)

Jest + ts-jest in `services/gateway` only — 3 dev dependencies, config inside `package.json`, one
spec file. `tsconfig.build.json` keeps specs out of `dist/`. No ESLint, no Prettier, no `nest new`
rewrite.

Nothing is mocked. The spec starts a real Nest app on a random port and a real `node:http` upstream
on another, because what is under test *is* network behaviour — a mocked `fetch` would only prove
the mock matched the test's expectations.

| Test | Pins |
|---|---|
| Known service forwards, path + query intact | `originalUrl`, not the matched route |
| Unknown service → `404` | The routing table is a whitelist |
| `constructor` → `404` | The `Map`-not-object-literal decision |
| POST method + body forwarded | Write path works, not just reads |
| Dead upstream → `503` | Nobody answered |
| Slow upstream → `504` | Answered too late — different cause, different code |
| One route down, the other `200` | Blast radius |

**The suite was mutation-checked, not just run.** Swapping the `Map` for an object literal made the
`constructor` test fail — and it failed with **`503`, not `500`**: `TARGETS['constructor']` resolves
up the prototype chain to `Object.prototype.constructor`, which is truthy, so the `if (!target)`
guard passes and `fetch` is handed a function where a URL belongs. The failure surfaces as an
unreachable upstream. A guard that looks like it is checking the routing table is really checking
`Object.prototype`. Reverted; 7/7 green.

Two env-time traps the spec had to work around, both worth remembering:

- **`TARGETS` is built at import time.** The spec sets `process.env` *then* `await import`s
  `AppModule`. A normal top-level import would freeze `localhost:3001` into the table.
- **`setGlobalPrefix('api')` lives in `main.ts`**, which tests never load. Without repeating it in
  the spec, every path 404s and the suite looks broken for the wrong reason.

Timing: ~36s cold (ts-jest compiling), ~7s warm.

---

## Earlier — Three NestJS services scaffolded, gateway verified (2026-09-06)

`main` now holds code again. Three services, hand-written rather than generated by `nest new`: no
ESLint, Prettier or Jest until something needs them.

| Service | Port | Files | What it does |
|---|---|---|---|
| `gateway` | 3000 | 6 | `@All(':service/*rest')` → `fetch` → downstream. Maps failures to status codes |
| `restaurant` | 3001 | 6 | `GET /api/restaurants/health` |
| `order` | 3002 | 6 | `GET /api/orders/health` |

**Verified against running processes**, not just a build:

| Check | Result |
|---|---|
| `curl :3001/api/restaurants/health` | `200 {"service":"restaurant","status":"ok",...}` |
| `curl :3002/api/orders/health` | `200 {"service":"order",...}` |
| `curl :3000/api/restaurants/health` | `200`, body produced by restaurant-service — **the Phase 1 shape** |
| `curl :3000/api/orders/health` | `200` |
| `curl :3000/api/drivers/health` | `404 Unknown service 'drivers'` — the gateway routing table, not a downstream error |
| Kill restaurant-service, retry through the gateway | **`503 Upstream unreachable`**, while `/api/orders/health` still returned `200` |

That last row is the gateway breakage exercise from `CLAUDE.md`, run early because the code claimed
a status code that had never been executed. `503` — not `500` — because the gateway itself is
healthy and the failure is downstream; a timeout would have produced `504` (5s, `AbortSignal.timeout`).
The blast radius stopped at one route: orders was unaffected.

**Decisions taken while writing this, all reversible:**

- **Native `fetch`, not `@nestjs/axios`.** Node 22 ships it; two dependencies removed. Error
  mapping stays explicit and visible, which a proxy library would hide — and the mapping is the
  point of the exercise.
- **`Map`, not an object literal, for the routing table.** `TARGETS['constructor']` on an object
  literal resolves to `Object.prototype.constructor` and would have produced garbage instead of a
  `404`.
- **No Dockerfiles yet.** An unbuilt Dockerfile is an untested claim. They arrive together with the
  compose wiring, in one change that can actually be run.

**Fixed on the way:** deleted the last Spring leftovers (`services/auth-service/.idea` and
`target/`, both untracked), dropped the Java section from `.gitignore`, removed trap #7 from
`CLAUDE_RULES.md`, and corrected a README link pointing at `00_doi-huong-stack.md` — a filename that
never existed on `main`.

**Known gap:** `strict: true` is on in all three `tsconfig.json`, but `strictPropertyInitialization`
is off. That is for the Prisma/DI code that comes next; revisit it if it starts hiding real bugs.

---

## Earlier — Legacy removed, databases running, docs realigned (2026-09-06)

**Task 1.3** — pushed branch `legacy/spring`, deleted all Spring/Express code from `main`. The
hand-written `AuthService.register/login` is preserved on that branch, not lost.

**Task 1.4** — `docker-compose.yml` rewritten: two Postgres 16 containers, `pg_isready`
healthchecks, no services yet. **Verified against a running daemon**, not just parsed:

| Check | Result |
|---|---|
| `docker compose up -d` | Pulled `postgres:16`, created network, 2 volumes, 2 containers |
| `docker compose ps` | Both `Up (healthy)` after ~26s |
| `\l` inside `restaurants-db` | `foodhub_restaurants` auto-created from `POSTGRES_*` env vars — no manual pgAdmin step |
| `\dt` | `Did not find any relations` — empty, as intended. Prisma creates tables in 1.5 |

**Docs realigned.** Scope B, the synchronous order-entry decision, and the corrected skill profile
all landed *after* README and ARCHITECTURE were written, leaving them wrong. Fixed 10 stale phase
numbers, added payment-service to both diagrams, linked `BUSINESS_OVERVIEW.md`, and removed a
`CLAUDE.md` warning about Java code that task 1.3 had already deleted.

**Two working-agreement changes**, both from user pushback and both recorded so they persist:
- **BRIEF → DECIDE** added to the loop. Claude had been deciding architecture the user had no basis
  to evaluate — see `CLAUDE.md`.
- **Skill profile corrected**: strong in application code, **beginner in infrastructure**. The two do
  not follow from each other.
- **Doc-sync rule expanded** beyond `PROJECT_STATE.md` to cover README, ARCHITECTURE and RUNNING,
  with a grep-based check. See `CLAUDE_RULES.md` → *Doc sync*.

---

## Earlier — Stack pivot, new working mode, git identity (2026-09-06)

**Created:** `PROJECT_STATE.md`, `CLAUDE_RULES.md`, `docs/ai-journal/00_stack-pivot.md`
**Rewritten:** `CLAUDE.md`, `README.md`, `../CLAUDE.md` (reduced to a stub)

**Done:**
- Retired **fill-in-the-blank**; switched to **vibe code + SHIP/BREAK/EXPLAIN**
- Locked the target stack: NestJS + Prisma + Postgres + Kafka + Redis + GitHub Actions
- Kept the `foodhub-microservices` repo and the food domain rather than switching projects
- Locked four technical decisions (ORM, repo layout, auth placement, legacy code disposal)
- **Task 1.1 complete** — generated a GPG key for the user, reconfigured git identity
- All documentation switched to **English** for token efficiency
- Full reasoning and rejected options: `docs/ai-journal/00_stack-pivot.md`

**Bugs found and fixed:**

| Bug | Cause | Fix |
|---|---|---|
| Belief that "GPG blocks `git commit`" | A 21-day-old note treated as fact without verification | Tested signing directly — works, exit 0. Note corrected and deleted |
| Commits signed as `Khuong Ngoc Doan` | Leftover `user.signingkey` on this machine pointing at another person's key | New key `5359A8A8A6C4F69C` generated, git reconfigured |
| Real gmail exposed in public commit history | *Keep my email addresses private* ON in GitHub, but git CLI pushed the real address | `user.email` switched to the GitHub noreply address |

**Verification:** GPG signing tested (`exit 0`), key present in `~/.gnupg`, git config confirmed.
No code was produced this session — deliberate. The next real verification is the Phase 1 milestone:
`curl localhost:3000/api/restaurants/health` answering through the gateway.

---

## Open issues

| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | Nothing ran end to end after ~3 weeks | 🟠 Medium | Downgraded: three services now answer through the gateway. Still true *in containers* — `docker compose up` starts databases only |
| 2 | ~~`docker-compose.yml` and `.env.example` hold legacy config~~ | ✅ Done | Task 1.4 rewrote both |
| 7 | No CI — nothing runs the tests on push | 🟠 Medium | Downgraded: the gateway has 7 tests as of 2026-09-17. `restaurant` and `order` still have none, and nothing runs any of them automatically until task 1.8 |
| 3 | GPG public key not yet uploaded to GitHub | 🟢 Low | Until then commits stay *Unverified*. Cosmetic only — attribution already works |
| 4 | `.env` holds real secrets, gitignored | 🟢 Low | Re-check before every push |
| 5 | ~~Legacy Java/Express code on `main`~~ | ✅ Done | Task 1.3 — preserved on `legacy/spring`, removed from `main` |
| 6 | Real email exposed in the first 2 commits | 🟢 Low | Not worth rewriting history. Clean from commit `40fdbea` onward |

---

## Update history

### 2026-09-17 — restaurant-service on Prisma 7 + Postgres; `/health` returns 503 when the DB dies, survives it
### 2026-09-17 — Jest in the gateway: 7 tests, mutation-checked. Money `Int`, `migrate dev`, real-Postgres tests decided
### 2026-09-06 — Gateway + restaurant + order scaffolded; `:3000` proxies, `503` on a dead upstream
### 2026-09-06 — Tasks 1.3–1.4: legacy removed, two Postgres running, docs realigned
### 2026-09-06 — Stack pivot, new working mode, git identity fixed
### 2026-08-16 — TicketFlow built as a separate NestJS + Kafka project (since abandoned)
### ~2026-06-16 — Phase 1 scaffold: auth/restaurant/order/gateway on Spring + Express

<!--
FOR THE NEXT SESSION:
Insert a new section directly under "Latest update", rename the old one to "Previous update",
add a line to Update history, and fix the "Last updated" line at the top.
-->
