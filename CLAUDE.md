# CLAUDE.md — FoodHub Microservices (Learning Project)

> Project context and working agreement for Claude Code. Read this first every session.

## 1. What this project is

A **food-ordering / delivery** platform built as a **microservices system**. It is a
**personal learning project** whose primary goal is for me (the developer) to *understand*
microservices and DevOps patterns deeply enough to **defend every decision in a job interview** —
not just to make it run.

Tech I already know and am reusing here: React / React Native, Node.js/Express, Spring Boot/Java,
MongoDB, MySQL, JWT, Google OAuth, Stripe/PayOS, Firebase, WebSocket.

New things I am here to learn: container orchestration (Docker Compose, later Kubernetes),
inter-service communication (sync REST + async messaging), database-per-service, API gateway,
CI/CD, and the *tradeoffs* of microservices vs monolith.

## 2. Working agreement (IMPORTANT — how Claude Code should behave)

I am learning in **hands-on mode**: **I write the core business logic myself. Claude Code does NOT
write it for me.**

Claude Code's role on this project:
- **Scaffold the plumbing fully**: folder skeletons, Dockerfiles, `docker-compose.yml`, dependency
  setup, config files, boilerplate. Go ahead and generate these completely.
- **Act as a senior reviewer** of code *I* wrote. When I paste my code and ask for review, point out
  bugs, non-idiomatic patterns, and what would break in production. Be honest and specific.
- **Explain concepts and give minimal examples** when I'm stuck — a small illustrative snippet, NOT a
  full implementation of the feature.
- **Write tests** for logic I wrote, when I ask.

What Claude Code should NOT do unless I explicitly ask:
- Do NOT write the controllers/route handlers, event publish/consume logic, gateway routing rules, or
  service-to-service calls. Those are mine to write — that's where the learning is.
- When I'm stuck, default to explaining or showing a tiny example, not handing me the finished feature.
- Before writing any code, show your plan and explain *why* first, then wait.

### My learning loop (per concept)
1. **Pre-read** — discuss the pattern in the chat app first (what problem, how it works, likely
   interview questions).
2. **Build** — I write the core logic; Claude Code scaffolds plumbing and reviews.
3. **Reflect** — I add 3–4 lines to `LEARNING_LOG.md`: what I built, why it works, what I'd say in an
   interview, what still confuses me. The "still confuses me" items become the next pre-read.

### Tool split
- **Claude.ai chat** = lecture hall: concepts, architecture decisions, interview prep.
- **Claude Code** = lab: implementation, running, debugging.

### Pace
One service or one pattern per session. Never build a whole phase in one shot.

## 3. Architecture

Polyglot, event-driven. Each service owns its own database (database-per-service — no service reads
another service's DB directly; it must call the API).

```
                         ┌──────────────┐
        Client  ───────▶ │  API Gateway │   routing + JWT auth
     (Mobile/Web)        └──────┬───────┘
                                │  (sync REST through gateway)
        ┌───────────────┬───────┴───────┬────────────────┐
        ▼               ▼               ▼                ▼
   ┌─────────┐    ┌───────────┐   ┌──────────┐    ┌───────────┐
   │  Auth   │    │ Restaurant│   │  Order   │    │  Payment  │
   │ Spring  │    │  Node.js  │   │  Spring  │    │  Spring   │
   │  MySQL  │    │  MongoDB  │   │  MySQL   │    │ Stripe/PayOS
   └─────────┘    └───────────┘   └────┬─────┘    └─────┬─────┘
                                       │ publish        │ publish
                                       ▼                ▼
                                 ┌────────────────────────┐
                                 │       RabbitMQ          │  async event bus
                                 │  (OrderPlaced, Paid)    │
                                 └───────────┬────────────┘
                                             │ consume
                                             ▼
                                    ┌──────────────────┐
                                    │   Notification   │  Node.js + Firebase
                                    │ (notify customer │
                                    │  + restaurant)   │
                                    └──────────────────┘
```

### Services
- **API Gateway** (Spring Cloud Gateway) — single entry point, routes to services, validates JWT.
- **Auth Service** (Spring Boot + MySQL) — register/login, JWT issuance, roles (customer / restaurant / admin).
- **Restaurant Service** (Node.js + MongoDB) — restaurants, menus, dishes, availability. (Catalog analog.)
- **Order Service** (Spring Boot + MySQL) — creates orders, calls Restaurant Service (sync REST) to
  check dish availability/price, then publishes an `OrderPlaced` event.
- **Payment Service** (Spring Boot + Stripe/PayOS) — handles payment, publishes `PaymentConfirmed`.
- **Notification Service** (Node.js + Firebase) — consumes events, notifies customer and restaurant.

### Two communication styles (the core lesson)
- **Sync (REST)**: Order → Restaurant to check availability. Caller waits for the response.
- **Async (RabbitMQ)**: Order finishes and *publishes* `OrderPlaced`, then returns to the user
  immediately. Notification listens and reacts later. Order doesn't know Notification exists.

> Interview north star: be able to whiteboard this from memory AND explain *why each split exists* —
> including when a monolith would have been the better choice.

## 4. Roadmap (phased — each phase is shippable)

- **Phase 1 — Core runs (~1–2 weeks).** Auth + Restaurant + Order + Gateway. All sync REST,
  database-per-service. Everything in `docker-compose.yml`. Goal: `docker compose up` brings the
  whole system up.
- **Phase 2 — Event-driven (~1 week). The real microservices lesson.** Add RabbitMQ + Payment +
  Notification. Order publishes events; Notification consumes them.
- **Phase 3 — CI/CD (~few days).** GitHub Actions: on push, run lint/tests, build a Docker image per
  service, push to a registry (GHCR or Docker Hub).
- **Phase 4 — Real deploy (stretch).** Deploy to a VPS via docker-compose + Nginx reverse proxy. OR
  learn Kubernetes basics (minikube → managed cluster).
- **Phase 5 — Polish (stretch).** Service discovery (Eureka), centralized config (Spring Cloud
  Config), distributed tracing (Zipkin). Optional new service: Delivery/Driver.

## 5. Conventions
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- One service = one folder = its own Dockerfile + own database.
- Each service exposes a `/health` endpoint.
- Keep `LEARNING_LOG.md` updated at the end of every session.
- Current phase: **Phase 1**.
