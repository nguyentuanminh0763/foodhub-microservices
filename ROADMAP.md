# FoodHub — roadmap at pause

Updated 2026-09-17. This is the reference branch checklist. The learning branch
starts from the original Phase 1 baseline and must not inherit these completion
marks as learning progress.

Everything under *Implementation present* was produced by GPT-Astra in a single
run from the Phase 1 baseline, which stopped when it ran out of tokens.

## Implementation present

- [x] Dockerfiles, Compose service wiring, healthchecks, startup migrations.
- [x] Restaurant and dish CRUD; strict DTO validation.
- [x] Synchronous checkout with authoritative pricing and durable idempotency.
- [x] Kafka and two independent readers of order.created.
- [x] Simulated payment success/failure and payment records.
- [x] Transactional outboxes and stock compensation on payment failure.
- [x] Redis notification deduplication and rate limiting.
- [x] Demo JWT auth, forwarded identity, customer/admin access checks.
- [x] GitHub Actions workflow written.
- [x] Full Docker HTTP smoke scenario passed, including 100 buyers / one portion.

## Verification still required

- [x] ~~Investigate 7 restaurant Jest failures~~ — not defects. Concurrent suites on
      one database, plus two missing service `.env` files. **25 passed / 0 failed**
      when run sequentially with infrastructure up.
- [x] ~~Rebuild the final source snapshot and rerun relevant checks~~ — eleven
      containers `Healthy`, full smoke scenario passed, 2026-09-17.
- [ ] Deepen the suites: `notification` has 1 test, `payment` 2. Isolate test
      databases instead of sharing the demo one.
- [ ] Resolve dependency audit findings without an unreviewed major upgrade.
- [ ] Run GitHub Actions remotely.
- [ ] Validate Swagger UI and generated schemas.
- [ ] Test interrupted checkout and broker outage/recovery.
- [ ] Test consumer crash/redelivery and replay from the beginning.
- [ ] Run two order instances and inspect partition assignment.
- [ ] Verify Redis outage/rate-limit behavior.

## Learning exercises

These remain user work, irrespective of how much reference code exists:

- [ ] Explain Docker images, containers, networks, volumes and healthchecks.
- [ ] Explain database-per-service and price snapshots.
- [ ] Reproduce and explain downstream timeouts.
- [ ] Explain topics, partitions, offsets and independent consumer groups.
- [ ] Explain at-least-once delivery, idempotency and outboxes.
- [ ] Explain why conditional SQL updates prevent overselling.
- [ ] Explain JWT trust boundaries and Redis atomic operations.
- [ ] Inspect a failing CI run and understand the failure.
- [ ] Write the incident/decision journal in the user's own words.

Scope C (delivery and driver tracking) remains deferred. Work is paused; do not
continue building features until the user asks.
