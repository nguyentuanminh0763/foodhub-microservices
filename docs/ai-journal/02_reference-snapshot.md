# Reference snapshot and learning split — 2026-09-17

This note was written by the assistant to preserve implementation context. It is
not the user's learning journal or evidence that the user has understood these
decisions.

An initial request to complete FoodHub led to a scope B backend reference: five
services, stock reservations, Kafka outboxes, simulated payments, Redis inboxes,
demo authentication, Compose and CI configuration. The user then paused the work
and asked to keep that code on a separate branch so they can learn from old main.

The original main commit is c12a2a6bd6ba308dd8eabedffc021555badcae38. All implementation
work is saved on codex/reference-implementation. codex/learning starts from original
main and contains no copied reference feature implementation.

Implementation choices worth reviewing while learning:

- Stock is protected with conditional Postgres updates in one transaction. Redis
  is used for rate limits and inbox deduplication rather than as a stock authority.
- A persistent reservation key makes timed-out HTTP retries safe; RESERVING orders
  can be recovered after an interrupted checkout.
- Outboxes close the database-commit/event-publication gap. Delivery can duplicate,
  so payment processing and stock release remain idempotent.
- Kafka has separate payment, notification, order-payment and stock groups.
- Demo auth lives in the gateway with environment-defined accounts; it is not a
  production user service. Payment is deliberately simulated.

The Docker smoke scenario passed, including 100 concurrent buyers for one portion.

Re-verified later the same day: the restaurant Jest failures were not defects. The
suites had been running concurrently against the same database as the Docker smoke
check, and `services/payment/.env` and `services/notification/.env` did not exist —
`--env-file-if-exists` continues silently, so a missing config surfaced as a `pg`
password error. Run sequentially with infrastructure up: 25 passed, 0 failed. The
snapshot was rebuilt and the smoke scenario passed again.

Still open: thin test depth, no remote CI run, unresolved dependency audit findings,
and Phase 7 untouched. The snapshot must not be described as fully complete.
