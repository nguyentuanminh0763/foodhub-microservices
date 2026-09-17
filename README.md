# FoodHub — reference implementation

**Paused on 2026-09-17 at the user's request.** This branch is an AI-written reference
for learning, not a finished or production-ready release.

| Branch | Purpose |
|---|---|
| `main` | This implementation, with its known unfinished work |
| `codex/reference-implementation` | Same commit; a named marker of the snapshot |
| `codex/learning` | Phase 1 baseline `c12a2a6`, for user-led learning |

Read [PROJECT_STATE.md](PROJECT_STATE.md) for verified results and unresolved issues.
Read [docs/BRANCHES.md](docs/BRANCHES.md) before switching or starting Docker.

## What is implemented

Scope B: browse restaurants and dishes, create an order, simulate payment, confirm,
and mark food ready. Delivery tracking and a frontend are outside this snapshot.

- Five independently packaged NestJS services: gateway, restaurant, order, payment,
  notification. Prisma/Postgres for restaurant, order, and payment.
- Catalogue CRUD, DTO validation, integer VND prices read from restaurant-service.
- Durable stock reservations, idempotent checkout, and interrupted-checkout recovery.
- Kafka events with transactional outboxes for orders and simulated payments.
- Redis notification inboxes and request rate limiting.
- Gateway JWT login with explicitly local demo customer/admin accounts.
- Docker Compose, healthchecks, SQL migrations, Jest suites, Swagger configuration,
  and a GitHub Actions workflow.

## Verification at pause

The Docker end-to-end smoke test **passed**: checkout to READY, payment decline
and stock compensation, ownership checks, retry handling, and 100 concurrent orders
for one portion (1 accepted, 99 conflicts).

Local Jest: **25 passed, 0 failed** (gateway 10, restaurant 8, order 4, payment 2,
notification 1), run sequentially with the databases, Kafka and Redis up. An earlier
report of 18 passed / 7 failed came from running suites concurrently against one
database and from two missing service `.env` files — not from a defect. The snapshot
was rebuilt afterwards and the full smoke scenario passed again.

Still not complete: test depth is thin (`notification` has one test), CI has never
run on GitHub, dependency audit findings are unresolved, and Phase 7 — two order
replicas sharing a consumer group — is untouched.

## Run the reference

Requires Node 22 and Docker Desktop. From the repository root:

```bash
node scripts/setup-env.mjs
```

```bash
docker compose up --build -d --wait --wait-timeout 240
```

```bash
node scripts/smoke.mjs
```

The gateway is at `http://localhost:3000`. The smoke script creates its own fixtures,
removes its catalogue fixture, and retains order/payment audit records.

Demo login: `POST /api/auth/login` with `username` and `password`. Accounts
`customer` and `customer2` use `DEMO_CUSTOMER_PASSWORD`; `admin` uses
`DEMO_ADMIN_PASSWORD` from the local `.env`. This is a local teaching setup, not
a registration system or a real payment provider.

All published ports bind to loopback. The setup script adds missing settings and
generates signing/internal secrets without overwriting existing credentials.

## Documentation

- [Current state and remaining work](PROJECT_STATE.md)
- [Branch workflow and data isolation](docs/BRANCHES.md)
- [Running and testing](docs/RUNNING.md)
- [Architecture and tradeoffs](docs/ARCHITECTURE.md)
- [Business story](docs/BUSINESS_OVERVIEW.md)
- [Implementation versus learning checklist](ROADMAP.md)

The reference containers were stopped at pause. Existing database, Kafka, and Redis
volumes were preserved. Both `codex/*` branches are on GitHub; `main` still points at
the baseline.
