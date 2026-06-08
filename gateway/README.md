# API Gateway (Spring Cloud Gateway)

The single public entry point. Validates JWT and routes to services.

## What's done for you (plumbing)
- Dockerfile, pom.xml, bootstrap class
- One example route (`/api/auth/**` -> auth-service) in `application.yml`

## What YOU code (the learning part)
1. The remaining routes in `application.yml` (restaurant, order) — copy the example shape.
2. A global JWT validation filter (after Auth Service issues tokens).

## Pre-read before coding
- What problem does an API gateway solve? Why not let clients call services directly?
- Where should authentication happen — at the gateway, or inside each service? Trade-offs?

Runs on port **8080** — the only port exposed to the outside.
