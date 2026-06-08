# Order Service (Spring Boot + MySQL)

Owns orders. Demonstrates BOTH communication styles:
- **sync** REST call to Restaurant Service (verify dish + price) — `client/RestaurantClient.java`
- **async** event publish to RabbitMQ (Phase 2) — `event/OrderEventPublisher.java`

## Done for you (plumbing)
- Dockerfile, pom.xml, application.yml, bootstrap, `/api/orders/health`

## What YOU code (look for `TODO (YOU CODE THIS)`)
- `model/Order.java` — the Order entity
- `client/RestaurantClient.java` — **sync** inter-service call (key lesson)
- `service/OrderService.java` — placeOrder logic + an `OrderRepository`
- `controller/OrderController.java` — endpoints
- `event/OrderEventPublisher.java` — **async** publish (Phase 2)

## Pre-read
- Sync vs async: why is "check the price" sync but "send a notification" async?
- What happens when a downstream service is down? (timeout, retry, circuit breaker)

Runs on port **8082**.
