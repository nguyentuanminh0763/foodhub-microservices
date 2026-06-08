# Architecture

## Principles

1. **One service = one business responsibility = one database.** No service queries another
   service's database directly. If Order needs restaurant data, it calls the Restaurant
   Service's API. This is the *database-per-service* pattern and it is the single biggest
   difference from a monolith.
2. **The gateway is the only public door.** Clients never call services directly. The gateway
   routes requests and validates the JWT once, at the edge.
3. **Polyglot on purpose.** Some services are Spring Boot, some are Node.js — to prove that
   services are independent of language, and to practice both stacks.

## Services

### API Gateway (Spring Cloud Gateway)
The single entry point. Responsibilities: route incoming requests to the right service, and
validate the JWT before forwarding. Everything else (business logic) belongs in the services.

### Auth Service (Spring Boot + MySQL)
Owns users and identity. Register, login, issue JWTs, manage roles
(`CUSTOMER`, `RESTAURANT`, `ADMIN`). It is the only service that knows passwords.

### Restaurant Service (Node.js + MongoDB)
Owns the catalog: restaurants, menus, dishes, availability and price. MongoDB fits because the
menu shape is flexible and read-heavy. This is the data Order needs to validate an order.

### Order Service (Spring Boot + MySQL)
Owns orders. When a customer places an order it:
1. Calls the Restaurant Service over REST (**synchronous**) to confirm each dish exists and to
   read its current price — it must not trust prices sent by the client.
2. Persists the order in its own MySQL database.
3. (Phase 2) Publishes an `OrderPlaced` event to RabbitMQ (**asynchronous**) and returns to the
   user immediately — it does not wait for notifications or payment side-effects.

### Payment Service (Spring Boot + Stripe/PayOS) — Phase 2
Isolated on purpose: payment logic and secrets stay in one place. Publishes `PaymentConfirmed`.

### Notification Service (Node.js + Firebase) — Phase 2
Pure consumer. Listens for `OrderPlaced` and `PaymentConfirmed` and notifies the customer and
the restaurant. It has no inbound API from the gateway — it only reacts to events.

## Why microservices here (and when NOT to)

Microservices are justified for this system *as a learning exercise* and because the contexts
genuinely differ (payment isolation, async notifications, independent scaling). **But be honest
in interviews:** for a real product at small scale, a well-structured monolith would ship faster,
be easier to debug, and avoid distributed-system pain (network failures, eventual consistency,
harder local setup). The ability to argue *both sides* is what demonstrates real understanding.

## Request example: placing an order

1. Client → Gateway: `POST /api/orders` with JWT.
2. Gateway validates the JWT, routes to Order Service.
3. Order Service → Restaurant Service (sync REST): "do these dishes exist, what's the price?"
4. Order Service saves the order in its MySQL DB.
5. (Phase 2) Order Service publishes `OrderPlaced` to RabbitMQ and returns `201 Created`.
6. (Phase 2) Notification Service consumes `OrderPlaced` and notifies the customer + restaurant.
