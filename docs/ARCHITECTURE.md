# FoodHub architecture — reference snapshot

Paused 2026-09-17. Implementation presence and verification status are tracked
separately in [PROJECT_STATE.md](../PROJECT_STATE.md).

## Boundaries

| Service | Owns | Container port |
|---|---|---|
| gateway | Demo login, JWT validation, rate limiting, HTTP forwarding | 3000 |
| restaurant | Restaurants, dishes, stock, durable reservation snapshots | 3001 |
| order | Orders, item price snapshots, lifecycle, order outbox | 3002 |
| payment | Simulated charges, payment records, payment outbox | 3003 |
| notification | Kafka-driven Redis inboxes and deduplication markers | 3004 |

Restaurant, order and payment each use a separate PostgreSQL database. Services
never read another database. Every service has an independent package and build.

## Checkout

1. Gateway verifies the JWT and supplies trusted user/role headers plus an internal
   token. Client-supplied identity headers are replaced.
2. Order validates the cart and Idempotency-Key and saves a RESERVING order.
3. Order asks restaurant over HTTP to reserve stock under the stable order ID.
4. Restaurant reserves every item in one database transaction. Conditional stock
   updates and database constraints prevent negative stock. A reservation stores
   price/name snapshots, so retries do not reserve twice or change agreed prices.
5. Order saves item snapshots, total, PENDING status and an order.created outbox
   row in one transaction. The client gets a real order response.
6. A publisher sends committed outbox rows to Kafka and marks them sent.
   A crash between send and marking can duplicate an event.
7. Payment and notification consume independently. Payment records and its result
   outbox are written together. The order consumer moves PENDING to PAID or
   CANCELLED. Cancellation tells restaurant to release the reservation once.

An interrupted RESERVING checkout is retried from its persisted request. During a
downstream timeout, callers must retry with the same Idempotency-Key.

Lifecycle: RESERVING -> PENDING -> PAID -> CONFIRMED -> READY.
Invalid checkout or declined payment can end in CANCELLED. Paid-order refunds and
user cancellation workflows are not implemented.

## Event contracts

Envelope: eventId, version (1), type, data. Events use order ID as the Kafka key.
Topics have three partitions and replication factor one for local development.

| Group | Reads |
|---|---|
| payment-processing | order.created |
| notifications | order.created, payment results, confirmed, ready, cancelled |
| order-payments | payment.succeeded, payment.failed |
| restaurant-stock | order.cancelled |

There is no exactly-once claim. Postgres uniqueness/transactions and Redis Lua
deduplication protect the implemented side effects. Malformed events are logged
and skipped; a dead-letter workflow is not implemented.

## Redis and inventory

Postgres is the stock authority. Redis is used for request counters and notification
inboxes. A Redis lock is not needed for the SQL conditional decrement, and adding
one would introduce expiry/fencing problems without improving this invariant.

Notification insertion and deduplication run in one Lua operation. Inboxes retain
up to 100 items for seven days. Redis AOF uses every-second synchronization;
this is a local demo, not a guarantee against all forms of data loss.

## Security and operational limits

JWT uses HS256, issuer/audience verification and one-hour expiry. Demo credentials
come from environment variables. Admin is a global demo operator, not a
per-restaurant ownership model. Internal requests use a shared token and private
Compose networking. Published ports bind to localhost.

Kafka is one plaintext local broker. No TLS, broker ACL deployment, real payment
provider, account registration, email/push integration, or production deployment
is included. Audit findings and outstanding checks are recorded in Project State.

The successful smoke run demonstrates the basic flow, not complete failure-mode
coverage. Two-replica operation and crash/replay experiments remain unverified.
