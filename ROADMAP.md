# FoodHub — roadmap at pause

Updated 2026-09-17. This is the reference branch checklist. The learning branch
starts from the original Phase 1 baseline and must not inherit these completion
marks as learning progress.

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

- [ ] Investigate 7 restaurant Jest failures; latest total is 18 passed / 7 failed.
- [ ] Rebuild the final source snapshot and rerun relevant checks.
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
