# How an order enters the system: synchronous HTTP, not a Kafka emit

**Date:** 2026-09-06
**Phase:** 1 — before any service is written
**Status:** ✅ Decided

---

## Context

A NestJS + Kafka architecture diagram was raised showing the **API gateway emitting directly into
Kafka**: gateway → `order-created` topic → Order Service subscribes. That is a real and common
pattern, and it is the opposite of what this project had been assuming.

The two designs disagree about one thing: **is order-service the writer of `order.created`, or a
reader of it?**

This had to be settled before writing the gateway, because it determines what the gateway is
allowed to know and what the client gets back.

## Options

| | Gateway emits to Kafka (`202`) | Gateway calls order-service over HTTP (`201`) |
|---|---|---|
| Client receives | "Accepted, processing…" | The real order: `#123, 110,000đ` |
| order-service is | a **reader** of `order.created` | the **writer** of `order.created` |
| Screen updates | **Twice** — needs WebSocket or push to deliver the result | Once |
| Out of stock | Detected after the user has left the screen. Must arrive as a push: *"cancelled, canh chua sold out"*. User re-orders from scratch | Detected in ~0.4s while the user is still on the cart. `409`, fix the cart, retry |
| 10,000 simultaneous orders | Survives — gateway only appends to a log, order-service drains at its own pace | Struggles — 10,000 concurrent requests reach order-service, restaurant-service and Postgres |
| Extra infrastructure | WebSocket or push notification, just to return a result | None |

**Chosen: HTTP, `201`.**

## Why

**Where the error lands is the real difference, not latency.** Both paths take roughly a second. But
with the synchronous path the failure arrives while the customer is still looking at their cart and
can fix it in five seconds. With the async path it arrives after they have put the phone down.

**FoodHub is not a flash sale.** The high-throughput argument for the async path is real and is why
concert ticket sales and Shopee flash sales use it. Ordering dinner does not have that shape. The
contention this project *does* have — five people wanting the last portion of canh chua — is a
locking problem for Redis in Phase 5, not a 10,000-requests-per-second problem.

**It costs no Kafka learning.** This was the deciding factor. order-service still publishes
`order.created`; notification-service and payment-service still consume it as two independent
consumer groups. Every Kafka capability worth learning — retention, replay, multiple readers,
partition ordering, at-least-once redelivery — is still exercised. The async entry point would only
have added WebSocket plumbing, which teaches nothing this project is trying to learn.

## Consequences

- The gateway stays a **dumb proxy**: route, forward, translate downstream failures into sensible
  status codes. It does not know what an order is.
- **order-service owns validation.** It calls restaurant-service synchronously, computes the total
  from prices it read itself, and can reject with `409` before anything is persisted.
- The client never needs a second channel to learn the outcome of placing an order. Push
  notifications remain for things that genuinely happen later — restaurant confirmed, payment
  succeeded.
- `order.created` is published **after** the order is committed to Postgres, never before. Publishing
  first would let a consumer act on an order that failed to save.

## What would reopen this

Real evidence of a load shape this cannot serve — a promotion where thousands of people order in the
same second. At that point the fix is not necessarily flipping to `202`; a queue in front of
order-service would be the smaller change. Revisit with numbers, not with a diagram.

## Interview answer

*"The gateway calls order-service over HTTP rather than emitting to Kafka, because the customer is
waiting for a total and for stock validation. Kafka has no reply semantics, so an async entry point
would mean returning 202 and delivering the outcome over a second channel — and an out-of-stock
error would arrive after the user had left the screen. The async entry is the right call when the
load shape demands it, like a flash sale. It is not the right call for placing a dinner order, and
it would not have taught me anything more about Kafka, which still sits where the real event is."*
