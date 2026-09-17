# FoodHub — Project State

Last updated: **2026-09-17**. Re-verified after the pause; see *Verification rerun*.

## How this branch was produced

One shot. The user asked GPT-Astra to complete the project, starting from the
Phase 1 baseline, and it built everything here in a single run until it ran out of
tokens. The pause is a budget limit, not a failure or a design decision — nothing
was abandoned mid-thought.

That matters when reading the rest of this file: the gaps below are *work not
reached*, not *work attempted and broken*.

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

## Verification rerun — 2026-09-17, after the pause

The earlier report of **18 passed / 7 failed** was an artefact of how the suites were
run, not a defect in the code. No source change was needed to clear it.

| Service | Before | Now | What was actually wrong |
|---|---|---|---|
| Gateway | 10 passed | 10 passed | — |
| Restaurant | 1 passed, 7 failed | **8 passed** | Run concurrently with the Docker smoke test against the same database; the suites fought over rows |
| Order | 4 passed | 4 passed | — |
| Payment | 2 passed | 2 passed | Needed `services/payment/.env` and a running Kafka; `app.init()` waits on the EventBus |
| Notification | 1 passed | 1 passed | Needed `services/notification/.env` for `REDIS_URL` |

Total: **25 passed, 0 failed**, run sequentially with all infrastructure up.

`services/payment/.env` and `services/notification/.env` did not exist. The test
script uses `node --env-file-if-exists=.env`, which silently continues when the file
is missing — so a missing config surfaced several layers down as *"client password
must be a string"* from `pg`. Both files were created from their `.env.example`.

**Snapshot rebuilt and re-verified.** `docker compose up --build -d --wait` brought
all eleven containers to `Healthy`, and `node scripts/smoke.mjs` passed in full:
authoritative pricing, idempotent checkout, permission checks, payment, the READY
notification, decline with stock compensation, and 100 concurrent buyers for one
portion giving 1 accepted / 99 conflicts / zero oversell.

That closes the two largest items previously listed as unfinished.

## Unfinished work

- **Test depth, not test colour.** 25 tests cover 1,253 lines; `notification` has
  one and `payment` has two. Consumer death mid-batch, outbox replay, broker
  outage and rate-limit failure are exercised only incidentally by the smoke run.
- Isolate test databases rather than sharing the demo database — that sharing is
  what produced the phantom restaurant failures above.
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
