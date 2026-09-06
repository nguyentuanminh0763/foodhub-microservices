# What FoodHub actually is

A food ordering app. A customer browses nearby restaurants, orders dishes, pays, and the restaurant
is notified and confirms.

This document exists because the architecture was being designed before anyone had described the
product. Every technical decision below traces back to a moment in this story — if a technology
cannot be pointed at a line here, it does not belong in the repo.

**Scope: B** (decided 2026-09-06). Delivery and driver tracking are **deferred** — see the end.

---

## One order, start to finish

Cast: **Minh** (customer), **Cơm Tấm Ba Hưng** (restaurant), and later a driver.

### 19:30 — Minh opens the app, hungry

Nearby restaurants:

> Cơm Tấm Ba Hưng · 4.6★ · 1.2km · ~15 min

He taps it. The menu loads:

> Cơm tấm sườn — 45,000đ
> Cơm tấm bì chả — 40,000đ
> Canh chua — 20,000đ · *3 portions left*

`GET /api/restaurants/12` — **HTTP**. restaurant-service reads `restaurants-db`.

### 19:32 — He picks 2× cơm sườn + 1× canh chua and taps "Order"

The most important moment in the system. Two things must happen before the screen changes:

1. order-service asks restaurant-service: *"do dishes #7 and #12 exist, and what do they really
   cost?"* — **synchronous HTTP, it waits.**
   Why not trust the client? A tampered app can send `price: 1000`.
2. restaurant-service answers: sườn 45,000đ available, canh chua 20,000đ, **3 left**.
3. order-service computes `45,000 × 2 + 20,000 = 110,000đ`, saves order **#123** as `PENDING`.

Minh's screen:

> ✅ Order #123 · 110,000đ · Waiting for restaurant confirmation

### 19:32 — order-service posts `order.created #123` to Kafka

It posts and moves on. It does not wait, and it does not know who reads.

| Reader | Action |
|---|---|
| notification-service | Push to the restaurant: *"New order #123"* |
| payment-service | Charge Minh 110,000đ |
| *(later)* analytics | Add to restaurant #12's revenue |

### 19:33 — payment-service finishes, posts `payment.succeeded #123`

notification-service reads it too and tells Minh: *"Payment successful"*.

### 19:34 — The restaurant taps "Accept order"

→ `order.confirmed #123` → notification-service → Minh sees:

> 🍳 Restaurant accepted, now cooking

### 19:50 — The restaurant taps "Ready"

→ `order.ready #123`. **This is where scope B ends.**

---

## Why each technology is here

Every one of these points at a line above. None is decorative.

| Technology | The moment it answers |
|---|---|
| **Synchronous HTTP** | 19:32 step 1. Minh is staring at a spinner. Without the real price there is no 110,000đ to display. The caller genuinely cannot continue without the answer |
| **Kafka** | 19:32 posting. *One* event, *three* independent readers, and order-service knows none of them. Adding analytics later changes nothing in order-service |
| **Redis** | "canh chua — 3 portions left". At 19:32:01 five people tap Order simultaneously. Without a lock all five succeed and the restaurant is short two portions |
| **Postgres, one per service** | restaurant-service owns dishes and prices; order-service owns orders. order-service must *ask*, not `JOIN`. That constraint is what forces step 1 to exist at all |

## Services in scope B

| Service | Owns | Port |
|---|---|---|
| gateway | Routing, later JWT and rate limiting | 3000 |
| restaurant | Restaurants, dishes, prices, stock | 3001 |
| order | Orders and their lifecycle | 3002 |
| payment | Charging, payment records | 3003 |
| notification | Nothing — pure Kafka consumer | 3004 |

Order lifecycle in scope B:

```
PENDING ──▶ PAID ──▶ CONFIRMED ──▶ READY
   │                     │
   └──▶ CANCELLED ◀──────┘
```

## Explicitly out of scope

**Deferred to C, future:** driver assignment, pickup, live location on a map, delivery completion,
customer rating. The story above stops at "food is ready".

Reason: location tracking is high-throughput and visually impressive but teaches little beyond what
`order.created` already teaches, and it needs a map UI. Scope B already gives Kafka two genuine
independent readers, which is the justification that matters.

**Not planned at all:** restaurant onboarding flows, promotions and vouchers, multi-restaurant carts,
refunds, customer support. All are real features of a real product and none of them teach anything
this project is trying to learn.

---

## The honest version for an interview

*"It is a food ordering system: browse, order, pay, restaurant confirms. I deliberately stopped
before delivery tracking. Every piece of infrastructure in it answers a specific moment in that flow
— the synchronous call exists because the customer is waiting for a total, Kafka exists because
three services react to one order event, Redis exists because five people can want the last portion
at the same time. At this scale a modular monolith would have shipped faster; I built it distributed
to learn the failure modes first-hand."*
