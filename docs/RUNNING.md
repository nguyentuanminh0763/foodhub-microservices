# Running and testing the reference branch

This guide applies to `codex/reference-implementation`. For the original learning
baseline use [BRANCHES.md](BRANCHES.md). Status: paused, with known failed tests.

## Start

Requires Node 22 and Docker Desktop. Commands below use Git Bash.

```bash
node scripts/setup-env.mjs
```

This adds missing .env settings, generates internal/JWT secrets and preserves
existing database credentials. Never commit .env.

```bash
docker compose up --build -d --wait --wait-timeout 240
```

Each database-owning container runs committed Prisma migrations at startup.
Healthy means its configured readiness check passed, not that all features passed.

```bash
node scripts/smoke.mjs
```

The smoke test covers auth, catalogue, price calculation, retry semantics, payment,
READY notifications, stock compensation, and 100 concurrent purchases of one
portion. It removes its catalogue fixture but retains order/payment history.
Repeated smoke runs within one minute may encounter the configured rate limit.

## Stop and inspect

```bash
docker compose ps
```

```bash
docker compose logs --tail=100 order
```

```bash
docker compose stop
```

Stop preserves all data. Do not use down -v when switching branches.

Optional Kafka UI:

```bash
docker compose --profile tools up -d kafka-ui
```

## Ports

| Component | Host address |
|---|---|
| Gateway | localhost:3000 |
| Restaurant database | localhost:5433 |
| Order database | localhost:5434 |
| Payment database | localhost:5435 |
| Kafka | localhost:9092; containers use kafka:19092 |
| Redis | localhost:6379 |
| Optional Kafka UI | localhost:8080 |

Service HTTP ports 3001-3004 are internal. Local Node development needs localhost
database URLs and the same INTERNAL_TOKEN as other services. Set KAFKA_BROKERS
to localhost:9092 and gateway downstream URLs to the local service ports.

## API outline

- POST /api/auth/login: username and password; returns accessToken.
- GET /api/restaurants and /api/restaurants/:id: public catalogue.
- POST/PATCH/DELETE /api/restaurants and nested dishes: admin operations.
- POST /api/orders: customer token, Idempotency-Key, restaurantId, items.
- GET /api/orders and /api/orders/:id: own orders; admin can inspect all.
- PATCH /api/orders/:id/status: admin, CONFIRMED then READY.
- GET /api/payments/:orderId: own payment or admin.
- GET /api/notifications: own inbox or admin inbox.
- GET /api/health and /api/<service>/health: health endpoints.

An order item has dishId and quantity, never a client price.
paymentMethod may be demo_success (default) or demo_failure.
Customer accounts customer/customer2 share DEMO_CUSTOMER_PASSWORD; admin uses
DEMO_ADMIN_PASSWORD. These accounts are for local learning only.

Swagger is configured at /api/restaurants/docs and /api/orders/docs. Final UI and
schema verification was still pending when work paused.

## Tests

Within a service directory, after installing dependencies:

```bash
npm run build
```

```bash
npm test -- --runInBand
```

Database tests require a reachable, migrated Postgres database. Notification tests
require REDIS_URL. Jest sets NODE_ENV=test; Kafka startup is disabled only when
KAFKA_BROKERS is absent. For local tests do not accidentally inherit broker settings
from the running demo.

Use dedicated test databases. The last restaurant suite failed with Prisma errors
and a 503 health response; its reason remains unknown. Do not treat a successful
smoke run as a replacement for those failures.

The CI workflow provisions Postgres/Redis per job and runs an additional full
Compose smoke test. It has not yet been run on GitHub.

## Existing data and dependencies

Branch switches leave .env, node_modules, dist, Docker images, and volumes in place.
Run npm ci and rebuild before using a different branch. Use a separate Compose
project for learning so expanded reference schemas do not become migration drift
in the baseline. Details: [BRANCHES.md](BRANCHES.md).

Dependency audit findings are unresolved; see [Project State](../PROJECT_STATE.md).
