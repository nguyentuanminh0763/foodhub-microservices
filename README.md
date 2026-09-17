# FoodHub — reference implementation

**Paused on 2026-09-17 at the user's request.** This branch is an AI-written reference
for learning, not a finished or production-ready release.

| Branch | Purpose |
|---|---|
| `main` | Original baseline, unchanged at `c12a2a6` |
| `codex/learning` | User-led learning, starting from that baseline |
| `codex/reference-implementation` | This implementation and its known unfinished work |

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

The latest local Jest results were **18 passed, 7 failed**. All seven failures
were in restaurant tests; the reason has not been investigated. That Jest process
also left handles open and was stopped. Some final source/config edits were made
after the successful Docker build and have not been checked in a fresh image.
CI has been written but has not run on GitHub. Do not describe the branch as complete.

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
