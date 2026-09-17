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
The latest restaurant Jest run failed, dependency audit remediation was unfinished,
and final source edits had not been rebuilt in Docker. See PROJECT_STATE.md for
the exact evidence. The snapshot must not be described as fully complete.
