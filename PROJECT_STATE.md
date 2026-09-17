# FoodHub — Project State

Last updated: **2026-09-17**, paused at the user's request.

## Branch intent

The user wants to implement the project incrementally and consult AI-written code
only when stuck. Preserve the distinction:

- `main`: unchanged baseline commit `c12a2a6bd6ba308dd8eabedffc021555badcae38`.
- `codex/learning`: starts from that baseline; no reference implementation copied.
- `codex/reference-implementation`: saves all current implementation changes,
  including the Dockerfiles/Compose work already present when this session began.

**Do not resume feature development without a new user request.** This snapshot is
a reference, not evidence that the user has completed the learning exercises.

Both `codex/*` branches are pushed. `main` was not moved.

## Implementation inventory

| Component | Present in this branch |
|---|---|
| Gateway | Root and nested proxy routes, demo JWT login, identity replacement, Redis rate limiting, health endpoint |
| Restaurant | Restaurant/dish CRUD, validation, stock reservation snapshots, idempotent release, Postgres constraints |
| Order | Idempotency-Key checkout, authoritative prices over HTTP, RESERVING recovery, ownership checks, PAID/CONFIRMED/READY transitions |
| Payment | Separate Postgres, deterministic success/decline simulation, idempotent processing of order.created |
| Notification | Independent Kafka consumer group, Redis inboxes, atomic event deduplication, 7-day retention and 100-item limit |
| Events | order.created, payment.succeeded, payment.failed, order.confirmed, order.ready, order.cancelled |
| Reliability | Order/payment transactional outboxes; stock release on payment failure; conditional SQL updates prevent overselling |
| Infrastructure | Five Dockerfiles; three Postgres databases; Kafka 3.9.1 KRaft; Redis with AOF; optional Kafka UI profile |
| Tooling | Environment setup script, full HTTP smoke script, Jest tests, Swagger configuration, GitHub Actions workflow |

All service folders have their own package and lockfile. No shared runtime package
and no access to another service's database were introduced.

## What was actually verified

1. The original walking skeleton ran in Docker and both database health endpoints
   answered through the gateway. Original tests passed: gateway 7, restaurant 4,
   order 4.
2. All five services compiled after the main feature implementation.
3. Docker built and ran all five services with Postgres, Kafka, and Redis.
4. `node scripts/smoke.mjs` passed against that Docker build:
   - Real server-side price: 2 x 45,000 + 20,000 = 110,000 VND.
   - Reusing a checkout key returned the same order without reserving twice.
   - A different cart under the same key returned conflict.
   - Spoofed identity/role headers and cross-customer reads were rejected.
   - Simulated payment moved the order to PAID, then admin actions reached READY.
   - The customer received the READY notification.
   - Declined payment cancelled the order and restored stock.
   - 100 concurrent requests for one portion: 1 accepted, 99 conflicts, stock 0.

## Latest Jest run — not all green

| Service | Result |
|---|---|
| Gateway | 10 passed, 2 suites |
| Restaurant | 1 passed, 7 failed, 2 failed suites |
| Order | 4 passed |
| Payment | 2 passed |
| Notification | 1 passed |

Total: **18 passed, 7 failed**. Restaurant failures included Prisma query errors and
a health response of 503. The tests were running concurrently with other service
tests and the Docker smoke check, but a root cause has **not** been established.
Jest reported open handles after the restaurant failures; that process was stopped
when the user paused the work. Do not infer a fix or mark these tests passing.

## Unfinished work

- Investigate the restaurant Jest failures and guarantee cleanup even after a
  failed test. Prefer isolated test databases instead of using the demo database.
- Rebuild and verify the final snapshot. The last successful Docker build predates
  the last proxy path validation, internal-token byte-length check, Swagger plugin,
  documentation access, and CI configuration edits.
- Security audit is unfinished. npm reported 3 high findings in gateway runtime
  dependencies (Multer/Nest dependency chain) and 8 in order (also Prisma CLI
  dependencies including deepmerge-ts and mysql2). No dependency override or
  security fix was applied before the pause. Do not run `audit fix --force`
  blindly; it proposes framework/ORM version changes.
- Run the workflow on GitHub; no remote CI result exists.
- Test two order replicas and consumer-group partition assignment.
- Test broker/consumer failure, outbox replay, process interruption, and rate-limit
  failure paths explicitly. Code presence is not verification.
- Review Swagger rendering and the generated API contract in the final image.
- Prepare the Kafka failure-exercise guide. The user's learning journal remains
  theirs to write.

## Limits of this reference

Payment is a simulation and notifications are API-readable inbox entries, not email
or push delivery. Auth uses environment-configured demo accounts; there is no user
registration or per-restaurant owner account. Refunds, delivery, frontend,
production deployment, and production secret management are outside the snapshot.

Redis is not the inventory source of truth: Postgres performs an atomic conditional
decrement. Kafka delivery is at-least-once; consumers must tolerate duplicates.
Notification deduplication has a finite seven-day window.

## Runtime and data at pause

FoodHub containers were stopped without deleting any volumes. The existing
`foodhub-microservices` Docker project contains expanded schemas, events, and smoke
test audit rows. Git branch switching does not revert those databases, local
`.env` files, node_modules, or build output.

Use a separate Compose project such as `foodhub-learning` for the learning branch.
See [docs/BRANCHES.md](docs/BRANCHES.md). Do not run `down -v` to switch branches.
