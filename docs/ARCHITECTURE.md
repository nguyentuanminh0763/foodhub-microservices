# Architecture

> Read [`BUSINESS_OVERVIEW.md`](./BUSINESS_OVERVIEW.md) first. It describes one concrete order from
> 19:30 to 19:50, and every decision in this document points back at a moment in it.
> **Scope B** — browse, order, pay, restaurant confirms. Delivery is scope C, deferred.

## Method: walking skeleton first

The first milestone is not a feature. It is a request travelling from a client, through the gateway,
into a service in a different container, and back — with **no business logic at all**.

That ordering is deliberate. Wiring problems (container DNS, ports, startup ordering, broker
addressing) are the ones that stop a distributed project dead, and they are far cheaper to solve
when no feature code is obscuring them. A skeleton that walks can be given muscle. A pile of muscle
that has never stood up is expensive to debug.

## Principles

1. **One service = one business responsibility = one database.** No service queries another
   service's database. If order needs restaurant data it calls the API. This is
   *database-per-service*, the single biggest difference from a monolith.
2. **The gateway is the only public door.** Clients never reach a service directly. It routes, and
   from Phase 6 it validates the JWT once at the edge.
3. **Services are independently deployable.** Each has its own `package.json`, its own Dockerfile,
   its own database. There is no shared library — see *Sharing contracts* below.

## Services

### Gateway (:3000)
The only published port. Routes `/api/restaurants/**` and `/api/orders/**`. Later: JWT validation
and Redis-backed rate limiting.

Routing is written by hand rather than delegated to a framework, because the questions it forces —
what status code when a downstream is down, what timeout, which headers to forward, how identity
propagates — are exactly the ones worth being able to answer.

### restaurant-service (:3001) + restaurants-db
Owns restaurants, dishes, prices and availability. Read-heavy. The source of truth for whether a
dish exists and what it costs.

### order-service (:3002) + orders-db
Owns orders. Placing one:
1. calls restaurant-service over HTTP (**sync**) to validate each dish and read the real price;
2. writes the order to its own database;
3. publishes `order.created` to Kafka (**async**) and returns immediately.

### notification-service (:3004) — Phase 3
Pure consumer. Reacts to `order.created` and later `payment.succeeded` and `order.confirmed`. It has
no inbound API from the gateway and owns no database.

### payment-service (:3003) — Phase 4
Charges the customer and owns payment records. It is the **second independent consumer** of
`order.created`, and that is the point of introducing it: two consumer groups reading one topic,
neither aware of the other, is the capability a task queue does not have. Until payment-service
exists there is one consumer, and one consumer is a case RabbitMQ would serve better.

It publishes `payment.succeeded`, which notification-service also consumes — so the same service is
a consumer of two different topics, which is where consumer-group naming starts to matter.

## Two communication styles

**Sync — HTTP.** order → restaurant: *"does this dish exist and what does it cost?"* The caller
cannot proceed without the answer, so it waits. The cost is **temporal coupling**: if
restaurant-service is down, order-service is down too. Timeouts, retries and circuit breakers reduce
the blast radius; they do not remove the dependency.

**Async — Kafka.** order publishes `order.created` and returns. Consumers react later. order does
not know who is listening and does not care if nobody is. The cost is **eventual consistency**: for
a while the order exists and no notification has been sent.

The rule worth remembering: **synchronous when the caller cannot continue without the answer;
asynchronous when the work can happen afterwards.** Price validation is the first. Notifying the
customer, updating analytics, marking stock are the second.

## Decision record: how an order enters the system

**The gateway calls order-service over HTTP. It does not emit into Kafka.** The customer gets `201`
with the real order and total; an out-of-stock dish returns `409` while they are still on the cart
screen.

The rejected alternative is a real and common pattern: the gateway emits `order.created` into Kafka
and returns `202 Accepted`, with order-service as a *consumer* rather than the producer. It survives
flash-sale load — ten thousand simultaneous orders only append to a log — which is why concert ticket
sales are built that way.

Rejected for three reasons:

1. **Where the error lands.** Both paths take about a second. But synchronously the failure arrives
   while the customer can still fix their cart. Asynchronously it arrives as a push notification
   after they have put the phone down, and they re-order from scratch.
2. **FoodHub does not have that load shape.** The contention it genuinely has is five people wanting
   the last portion — a locking problem for Redis in Phase 5, not ten thousand requests a second.
3. **It costs no Kafka learning.** order-service still publishes `order.created` and two consumer
   groups still read it. The async entry would only add WebSocket or push plumbing to return a
   result, which teaches nothing this project is trying to learn.

Full write-up: [`ai-journal/01_order-entry-sync-vs-async.md`](./ai-journal/01_order-entry-sync-vs-async.md).
Reopen it with load numbers, not with a diagram.

**Two rules follow:**

- **The gateway is a dumb proxy.** It routes, forwards, and maps downstream failures to status codes.
  It does not know what an order is.
- **Publish only after the write commits.** `order.created` goes to Kafka *after* the order is in
  Postgres, never before — otherwise payment-service can charge for an order that failed to save.
  That bug only appears when the database misbehaves, which is exactly when nobody is testing.

### Why Kafka is not between gateway and services

"Receive a request, forward it, return the response" is request/response. Kafka is an append-only
log with no notion of a reply. It *can* be forced into request-reply with reply topics and
correlation IDs, and the result is slower, more complex, and teaches a wrong mental model of what
Kafka is for.

## Never trust a client-supplied price

order-service re-reads every price from restaurant-service. This is the entire justification for the
sync call: a client that can name its own price can buy a meal for zero. It is also the cleanest
illustration of why database-per-service costs something — in a monolith this would be a `JOIN`.

## Sharing contracts between services

There is no `shared/` package. Each service owns its own types, and when two services need the same
shape it is **copied**.

This is a real trade, chosen deliberately. A shared library gives compile-time safety and creates a
coupling that must be versioned and deployed in lockstep — at which point the services are not
independently deployable and a large part of the microservices argument evaporates. Copying means
the copies can drift, and detecting drift becomes a runtime and contract-testing problem.

Both answers are defensible. The point of choosing the copy is to *experience* the drift rather than
read about it, then be able to describe what consumer-driven contract testing would have solved.

## Decision record: Kafka over RabbitMQ

**Be honest about this one.** For a notification flow taken in isolation, **RabbitMQ is the better
tool.** "An order happened → notify someone" is a task queue: each message is handled once and then
it is done. That is precisely what RabbitMQ is built for — a smart broker with exchange/binding
routing, per-message acks, and deletion on ack.

Kafka is a partitioned append-only log: dumb broker, consumer tracks its own offset, messages
retained by policy rather than deleted on consume.

Kafka is used here for two reasons, and the first should be stated plainly rather than dressed up:

1. **Learning Kafka is an explicit goal of this project.** Pretending otherwise would produce a
   decision that cannot be defended under questioning.
2. **The order lifecycle is genuinely a stream, not a task.** `PLACED → PAID → PREPARING →
   DELIVERED`, partitioned by `orderId`, is a replayable audit trail. An analytics consumer group
   can read the same stream without touching the business flow — the clearest possible demonstration
   of decoupling. A queue cannot do either.

The interview answer: *"If the only requirement were 'send one notification', I would have used
RabbitMQ, and I can explain why. I chose Kafka because the order lifecycle is a stream I want to
replay and attach independent consumers to — and because I wanted to learn the log model
first-hand."*

For the record, **Redis Pub/Sub is not a substitute for either.** It is fire-and-forget: a message
published while no subscriber is connected is gone forever. Fine for ephemeral signals, unacceptable
for orders.

## Decision record: where Redis fits

Redis arrives in **Phase 5**, answering a problem the project will have actually hit by then:

1. **Contention on the last portion.** Two customers order the final serving simultaneously. Without
   coordination both succeed and the restaurant is oversold. A `DECR`-style atomic operation or a
   short-lived distributed lock is the fix, and the failure is reproducible with 100 concurrent
   requests before the fix is written.
2. **Consumer idempotency.** Kafka delivers *at least once* — a consumer that processes a message
   then dies before committing its offset sees it again. Storing processed message IDs in Redis with
   a TTL makes the consumer idempotent, so a duplicate `order.created` does not send a duplicate
   notification.

Two further uses are legitimate but **deliberately not adopted**:

- **JWT revocation / logout blacklist.** The known weakness of stateless JWT is that a leaked token
  stays valid until expiry. A Redis blacklist keyed by `jti` with TTL = remaining lifetime fixes
  that — at the cost of a Redis lookup per request, giving up part of the statelessness that made
  JWT attractive. Adopt when logout is implemented, and name the trade out loud.
- **Caching the catalog.** Menus are read-heavy and rarely written, which is textbook caching. But
  caching *prices* is dangerous: a 5-minute TTL means a price change can bill the old amount. With
  database-per-service, restaurant does not know what order has cached, so there is no clean
  invalidation path. Adopt only after measuring that the sync call is the bottleneck — and even
  then, cache dish existence and metadata, not price.

Redis here is **cache and coordination, not a database of record**: everything in it can be thrown
away and the system remains correct. That is why a single Redis separated by key prefix
(`order:idem:*`, `stock:lock:*`) does not violate database-per-service. The moment Redis holds
something that cannot be rebuilt, it becomes a database and the rule applies again.

## Startup ordering

`depends_on` alone waits for a container to *start*, not to become *usable* — and Postgres and Kafka
both take far longer to accept connections than a Node process takes to boot. Every dependency uses
`condition: service_healthy` with a real healthcheck.

Worth understanding rather than copying: in a real cluster nothing orders things for you, and
services must tolerate their dependencies being absent at startup and returning later. The
healthcheck hides a problem that Kubernetes will hand back.

## Why microservices here — and when not to

Microservices are justified for this system *as a learning exercise*, and the contexts do genuinely
differ (catalog is read-heavy, orders are write-heavy, notification is a pure consumer).

**But be honest in interviews:** food ordering at this scale does not need microservices. A single
NestJS application with clean module boundaries would ship faster, debug more easily, and avoid
every distributed-systems problem in this document.

The defensible position: *"I built it as microservices to learn the failure modes first-hand — the
network calls, eventual consistency, startup ordering, duplicate delivery. For a product at this
scale I would start with a modular monolith. I now know specifically what I would be giving up and
what it would cost to change my mind later."*

## Request walkthrough: placing an order

1. Client → gateway: `POST /api/orders`
2. Gateway routes to order-service *(from Phase 6, validating the JWT first)*
3. order-service → restaurant-service (**sync HTTP**): do these dishes exist, what do they cost?
4. order-service writes the order to `orders-db` with the prices it just read
5. order-service publishes `order.created` to Kafka and returns `201 Created`
6. notification-service consumes `order.created` and notifies customer and restaurant

Steps 1–5 are synchronous from the customer's point of view. Step 6 happens whenever it happens, and
the customer never waits for it. That gap is eventual consistency, and it is the price of not
blocking the user on a push notification.
