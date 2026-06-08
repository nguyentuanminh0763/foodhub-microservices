# FoodHub — Microservices Learning Project

A **food-ordering / delivery** platform built with a **microservices architecture**.
This is a personal learning project: the goal is to understand microservices and DevOps
patterns deeply enough to **explain and defend every decision in a job interview** — not
just to make it run.

> Working method, pacing, and the rule that *I write the core logic myself* live in
> [`CLAUDE.md`](./CLAUDE.md). Read that first.

---

## Description

FoodHub lets a customer browse restaurants, place an order, pay, and get notified about the
order status. Behind the scenes the system is split into independent services that each own
one business responsibility and one database, communicating over a mix of synchronous REST
and asynchronous messaging.

This domain is a good microservices teaching case because the split has *real* justification:
payment must be isolated, notifications are naturally asynchronous, and the catalog (restaurants)
and orders scale differently.

## Architecture (overview)

```
                         +--------------+
        Client  ───────▶ |  API Gateway |   routing + JWT auth
     (Mobile/Web)        +------+-------+
                                | sync REST (through gateway)
        +---------------+-------+-------+----------------+
        ▼               ▼               ▼                ▼
   +---------+    +-----------+   +----------+    +-----------+
   |  Auth   |    |Restaurant |   |  Order   |    |  Payment  |
   | Spring  |    |  Node.js  |   |  Spring  |    |  Spring   |
   |  MySQL  |    |  MongoDB  |   |  MySQL   |    |Stripe/PayOS
   +---------+    +-----------+   +----+-----+    +-----+-----+
                                      | publish        | publish
                                      ▼                ▼
                                +--------------------------+
                                |        RabbitMQ          |  async event bus
                                |  OrderPlaced / Paid      |
                                +-----------+--------------+
                                            | consume
                                            ▼
                                   +------------------+
                                   |   Notification   |  Node.js + Firebase
                                   +------------------+
```

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full explanation of each service
and the two communication styles.

## Tech stack

| Layer            | Technology                                              |
|------------------|---------------------------------------------------------|
| API Gateway      | Spring Cloud Gateway                                    |
| Auth service     | Spring Boot, Spring Security, JWT, MySQL                |
| Restaurant svc   | Node.js, Express, MongoDB (Mongoose)                    |
| Order service    | Spring Boot, MySQL, RestTemplate/WebClient (sync calls) |
| Payment service  | Spring Boot, Stripe / PayOS  *(Phase 2)*                |
| Notification svc | Node.js, Express, Firebase  *(Phase 2)*                 |
| Messaging        | RabbitMQ  *(Phase 2)*                                   |
| Containerization | Docker, Docker Compose                                  |
| CI/CD            | GitHub Actions  *(Phase 3)*                             |
| Deploy           | VPS + Nginx, or Kubernetes  *(Phase 4)*                 |

## Communication styles (the core lesson)

- **Synchronous (REST):** Order calls Restaurant to verify a dish exists and get its price.
  The caller blocks and waits for the response. Use when you need an answer *now*.
- **Asynchronous (RabbitMQ):** Order finishes, publishes an `OrderPlaced` event, and returns to
  the user immediately. Notification listens and reacts later. The publisher does not know who
  consumes. Use for side effects that can happen *after* and must not block the user.

## Roadmap

| Phase | Goal | Outcome |
|-------|------|---------|
| **1** | Core services run | Auth + Restaurant + Order + Gateway, all sync REST, DB-per-service, one `docker compose up` brings everything up |
| **2** | Event-driven | Add RabbitMQ + Payment + Notification; Order publishes events, Notification consumes |
| **3** | CI/CD | GitHub Actions: lint/test, build a Docker image per service, push to registry |
| **4** | Real deploy | VPS + docker-compose + Nginx, or Kubernetes basics |
| **5** | Polish | Service discovery (Eureka), central config, distributed tracing (Zipkin) |

## Repository structure

```
foodhub-microservices/
├── README.md                 # this file
├── CLAUDE.md                 # working agreement for Claude Code (read first)
├── LEARNING_LOG.md           # session-by-session learning notes
├── docker-compose.yml        # Phase 1 orchestration (Phase 2 services commented)
├── .env.example              # copy to .env and fill in
├── docs/
│   └── ARCHITECTURE.md       # detailed architecture + decisions
├── gateway/                  # Spring Cloud Gateway
└── services/
    ├── auth-service/         # Spring Boot + MySQL
    ├── restaurant-service/   # Node.js + MongoDB
    ├── order-service/        # Spring Boot + MySQL
    ├── payment-service/      # Phase 2
    └── notification-service/ # Phase 2
```

## Getting started (Phase 1)

1. `cp .env.example .env` and fill in the values.
2. Implement the Phase 1 services one at a time (see each service's `README.md` and the
   `TODO (YOU CODE THIS)` markers in the source — that's where you write the logic).
3. `docker compose up --build` to bring the system up.
4. Verify each service's `GET /health` endpoint responds, then test through the gateway.

> Each `TODO (YOU CODE THIS)` block is a spot where *you* write the core logic. Plumbing
> (Dockerfiles, build config, bootstrap) is already filled in.
