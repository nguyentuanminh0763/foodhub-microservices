# Notification Service — Phase 2 (placeholder)

Built in **Phase 2**. Node.js + Firebase. A PURE CONSUMER: it has no API exposed through the
gateway. It only listens to RabbitMQ for `OrderPlaced` and `PaymentConfirmed`, then notifies
the customer and the restaurant.

Do NOT build this yet. When you reach Phase 2, pre-read:
- What does it mean for a service to be event-driven / a pure consumer?
- exchange vs queue vs routing key in RabbitMQ?
- This is the service that makes the async lesson click — building it is the goal of Phase 2.
