# Running & testing

> **Phase 1 is in progress — the services described here do not exist yet.** This documents the
> intended workflow. Current per-component state: [`PROJECT_STATE.md`](../PROJECT_STATE.md).

The single most important habit on this project: **never write more than ~20 lines without running
something.** Code you have not run is a guess.

There are three feedback loops, fastest to slowest. Use the fastest one that can still answer your
question.

| # | Loop | Time | Answers |
|---|---|---|---|
| 1 | Typecheck / build one service | ~5 s | Does it even build? Types, imports |
| 2 | One service + its database | ~15 s | Does *this* service work? Endpoints, DB, logic |
| 3 | Full `docker compose up` | ~2 min | Do the services talk? Networking, gateway, env wiring |

Loop 3 is for integration checks, **not** day-to-day coding. Rebuilding images on every line change
kills momentum.

---

## Prerequisites

### Use Git Bash, not PowerShell

Every command here is bash. On Windows, open **Git Bash** (Start menu → `Git Bash`), not PowerShell
or CMD. The prompt should end in `$`, not `PS C:\>`.

This matters beyond style: `gpg` ships with Git for Windows and is only on Git Bash's PATH, and
`~/.bashrc`, `$(...)` and `&&` behave differently or not at all elsewhere.

### Node 20 and Docker Desktop

```bash
node --version
```

```bash
docker ps
```

If `docker ps` errors with `open //./pipe/dockerDesktopLinuxEngine`, Docker Desktop is not started —
launch it and wait for the whale icon to settle.

### `.env`

```bash
cp .env.example .env
```

It is gitignored and holds real secrets. Verify compose can read it:

```bash
docker compose config
```

Every `${...}` must be replaced with a real value. Blank values mean `.env` is missing or malformed
— that is a config problem, not a service bug.

---

## Loop 1 — Build one service

From inside a service folder:

```bash
npm run build
```

Green means types and imports are fine. It says nothing about whether the logic is correct — that is
loop 2.

---

## Loop 2 — One service against its real database

This is the loop you will live in.

Start **only** the database:

```bash
docker compose up -d restaurants-db
```

Wait until it reports healthy — the healthcheck takes ~10 s on first run:

```bash
docker compose ps
```

Then run the service from your terminal:

```bash
cd services/restaurant && npm run start:dev
```

No environment setup needed: `.env` defaults point at `localhost:5433`, which is where compose
publishes `restaurants-db`.

Verify it is alive:

```bash
curl http://localhost:3001/api/restaurants/health
```

### Prisma

Apply schema changes to the running database:

```bash
npx prisma migrate dev --name describe_the_change
```

Regenerate the client after editing `schema.prisma`:

```bash
npx prisma generate
```

Inspect the data — never trust a `200` alone, look at the row:

```bash
npx prisma studio
```

Each service has its **own** `schema.prisma` and its **own** database. Running a migration in
`services/order` must never touch `restaurants-db`. If it does, database-per-service has been broken.

---

## Loop 3 — The whole system

```bash
docker compose up --build
```

First build takes a few minutes. Only the gateway is published, on **3000**. Everything else talks
over the internal compose network — that is the point of the gateway pattern.

The command that defines "the environment works":

```bash
curl http://localhost:3000/api/restaurants/health
```

One answer, from a container that is not the gateway, through one door.

Useful while debugging:

```bash
docker compose logs -f order
```

```bash
docker compose ps
```

Tear down:

```bash
docker compose down
```

Add `-v` to also delete the database volumes and start from empty. **That destroys your data** — it
is on the "propose and wait" list in `CLAUDE_RULES.md` for a reason.

---

## Ports

| What | Where |
|---|---|
| Gateway | `localhost:3000` ← the only one a client should touch |
| restaurant-service | `localhost:3001` (direct, debugging only) |
| order-service | `localhost:3002` (direct, debugging only) |
| restaurants-db | `localhost:5433` |
| orders-db | `localhost:5434` |
| Kafka | `localhost:9092` from the host, `kafka:19092` from containers *(Phase 3)* |
| Kafka UI | `localhost:8080` *(Phase 3)* |

Postgres uses 5433/5434 rather than 5432 to avoid colliding with a Postgres you may already have
installed. Inside the compose network services still use 5432.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `'gpg' is not recognized` / bash syntax errors | Wrong shell — you are in PowerShell, not Git Bash |
| Kafka client hangs then times out | `KAFKA_ADVERTISED_LISTENERS` — a container was told `localhost:9092` and looked inside itself. Use `kafka:19092` from containers |
| Service exits at startup with a connection error | `depends_on` without `condition: service_healthy`; Postgres was not accepting connections yet |
| `@All('*')` throws on boot | NestJS 11 runs on Express 5 — wildcards must be named: `':service/*rest'` |
| Compose variables all empty in `docker compose config` | `.env` missing from the repo root |
| `git commit` hangs with no output | gpg waiting for a passphrase with no TTY. `echo 'export GPG_TTY=$(tty)' >> ~/.bashrc`, then open a new terminal |
| Port already in use | Something else is on 3000/3001/3002/5433/5434. `docker compose down` first |

Full explanations of the recurring ones: [`CLAUDE_RULES.md`](../CLAUDE_RULES.md).

---

## The habit to build

After every change, ask: **which loop can disprove this fastest?** Then run that one.

When something breaks, resist changing code immediately. Read the stack trace top to bottom first.
In a distributed system, the ability to locate a failure from a log is worth more than the ability
to write the feature.
