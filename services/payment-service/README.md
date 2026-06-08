# Payment Service — Phase 2 (placeholder)

Built in **Phase 2**. Spring Boot + Stripe/PayOS. Isolated so payment logic and secrets live
in one place. Consumes/handles payment, then publishes a `PaymentConfirmed` event to RabbitMQ.

Do NOT build this yet — finish Phase 1 (Auth + Restaurant + Order + Gateway, all sync) first.
When you reach Phase 2, scaffold this like the other Spring Boot services and pre-read:
- How does a payment webhook work, and why is it asynchronous?
- Why keep payment in its own isolated service?
