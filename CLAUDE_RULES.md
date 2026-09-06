# CLAUDE RULES — FoodHub

> Durable working rules. Read before changing anything. Last updated 2026-09-06.

---

## Core principles

- **Never rewrite from scratch.** This repo has a GitHub remote, commit history, and is the only
  thing that exists publicly. The move to NestJS is a transplant *into this repo*, not a new one.
  The project has already changed direction twice; a third time kills it.

- **Brief before deciding. Never write an architectural choice here as settled law.**
  Added 2026-09-06 after doing exactly that: Kafka's phase, topics and placement were decided by
  Claude and written into this file as rules, for a user who had said they did not yet know what
  Kafka could do. See the BRIEF → DECIDE steps in `CLAUDE.md`. A decision the user did not make is a
  decision they cannot defend in an interview, which is the whole point of the project.

- **Kafka has no reply semantics** — that part is fact, not preference. It is an append-only log.
  Anything that needs an answer *now* is HTTP. Forcing request/reply onto Kafka (reply topics,
  correlation IDs) is slower and teaches the wrong mental model.

  **Still open (user's call):** whether the gateway fire-and-forgets into Kafka (client gets `202`,
  cannot be rejected synchronously) or calls order-service over HTTP (client gets `201` with the real
  order). `docs/BUSINESS_OVERVIEW.md` is written assuming the second — confirm before building it.

- **Database per service.** No service reads another's database — it calls the API. This is the
  biggest difference from a monolith and the source of most of the pain worth understanding.

- **Technology enters only when it answers a problem actually hit.** The one rule kept intact from
  the old working agreement. Redis in Phase 4, when overselling appears — not before. gRPC,
  GraphQL, Elasticsearch, Kubernetes: out of scope until the roadmap in `CLAUDE.md` changes first.

---

## User context

- **A working developer.** Reads diffs and stack traces. Knows Node/Express, React, Spring Boot,
  MySQL, MongoDB, JWT. Explain at the level of **patterns and tradeoffs**, not basic syntax.
- **Conversation in Vietnamese. All files in English** — including internal docs. Chosen 2026-09-06
  for token efficiency: Vietnamese diacritics tokenize poorly. This is deliberate, not an accident.
- Commit messages: English, Conventional Commits.
- When giving shell commands: one command per ```bash block, no `$` prefix, no output inside the fence.

---

## Risk threshold — act vs ask

The user explicitly chose **vibe code** (2026-09-06). Do not ask permission for ordinary work.

**Just do it:** write features and services, edit compose, add dependencies already in the roadmap,
write tests, write docs, refactor within scope.

**Propose and wait:**
- Deleting the legacy Java/Express code (git keeps history, but the user must know when it goes)
- `git push --force`, rewriting history, deleting or renaming branches
- `docker compose down -v` (drops volumes = data loss)
- Adding technology not in the roadmap
- Changing project direction again — **especially this**; see `docs/ai-journal/00_stack-pivot.md`

---

## Mandatory technical rules

> Every entry below traces to one real failure. If nobody can name the bug it prevents, it is
> guesswork and should be deleted.

### 1. Kafka in Docker — one broker, two addresses

A client connects to the broker, and the broker replies with the addresses in
`KAFKA_ADVERTISED_LISTENERS`, telling the client where to actually go. A container told to go to
`localhost:9092` looks inside *itself* and finds nothing.

- From the **host**: `localhost:9092`
- From **another container**: `kafka:19092`

Symptom: **a hang, then a timeout** — not a clear error. This is the most common Kafka-in-Docker
failure and the most expensive to diagnose blind.

### 2. NestJS 11 runs on Express 5 — wildcards must be named

`@All('*')` **throws**. Express 5 requires a named wildcard:

```
@All(':service/*rest')     ← correct
@All('*')                  ← error
```

Hit for real while writing the gateway proxy controller.

### 3. `depends_on` is not enough — use `condition: service_healthy`

Bare `depends_on` waits for the **container to start**, not for the service to **accept
connections**. Postgres and Kafka take far longer to become usable than a Node process takes to
boot, so the service dies at startup with a connection error.

Every dependency needs `condition: service_healthy` plus a real healthcheck.

Worth understanding rather than copying: in a real cluster nothing orders things for you, and
services **must tolerate** dependencies being absent at startup and returning later. The healthcheck
hides a problem Kubernetes will hand back.

### 4. Commits were signed with someone else's GPG key — FIXED 2026-09-06

Verified: **GPG never blocked commits.** Signing worked, no passphrase prompt. An older note
claiming "GPG blocks `git commit`" was **wrong** — do not repeat it.

The real problem was identity. Both commits on `main` were signed by
`Khuong Ngoc Doan <doan@seven365.com.sg>` — a different person, left over on this machine. GitHub
showed *Unverified*.

Fixed: a new key was generated for the user and git reconfigured globally.

| Setting | Value |
|---|---|
| `user.name` | `nguyentuanminh0763` |
| `user.email` | `144188010+nguyentuanminh0763@users.noreply.github.com` |
| `user.signingkey` | `5359A8A8A6C4F69C` (expires 2028-09-05) |

The noreply address is used because *Keep my email addresses private* is ON in the GitHub account;
attribution still resolves to the profile. Two `@seven*.com.sg` keys remain in `~/.gnupg` — do not
pick those by mistake.

**Still pending:** the public key must be pasted into `github.com/settings/gpg/new`, otherwise the
Verified badge will not appear. The two pre-existing commits keep the old signature and the exposed
gmail address; not worth rewriting history for code about to be deleted.

### 5. Use Git Bash, NOT PowerShell

Windows 11. `gpg.exe` ships with Git for Windows at `D:\Program Files\Git\usr\bin\gpg.exe` and is
**only on Git Bash's PATH**. In PowerShell:

```
gpg : The term 'gpg' is not recognized as the name of a cmdlet...
```

That is the wrong shell, not a missing install. Every command in these docs is bash
(`~/.bashrc`, `$(...)`, `&&`) and will misbehave in PowerShell.

Note: **Git is installed on drive D:**, not C:.

Also set once, or `git commit` hangs silently while gpg waits for a passphrase:

```bash
echo 'export GPG_TTY=$(tty)' >> ~/.bashrc
```

### 6. `.env` must exist for compose to substitute variables

Compose reads `.env` at the repo root. It is gitignored and holds real secrets. Check before
debugging anything else:

```bash
docker compose config
```

Every `${...}` must be a real value. Empty values mean `.env` is missing or malformed — not a
service bug.

### 7. (Legacy Java — delete this entry once Spring is gone)

Spring Boot 3.3 does **not** run on JDK 25; Byte Buddy / Hibernate cannot read Java 25 class files.
Exact error: `Java 25 (69) is not supported`. The project targeted Java 21.

Also legacy: MySQL JDBC needs `?allowPublicKeyRetrieval=true&useSSL=false`, and `@CreatedDate`
requires `@EnableJpaAuditing` somewhere or `createdAt` is always NULL.

---

## Commit convention

Conventional Commits, English:

```
feat(order): publish order.created to Kafka
fix(gateway): return 503 when downstream is unreachable
chore(compose): add redis with healthcheck
docs: rewrite README for the NestJS stack
refactor: remove Spring Boot services
```

Bad: `update code`, `fix bug`, `feat: added stuff`.

One large change = one commit. Do not fold legacy deletion into a feature commit.

---

## Process for significant changes

**Before:** read `PROJECT_STATE.md` → identify affected files and risk → if it touches the
"propose and wait" list above, present a plan and wait for agreement.

**After:**
1. **Run it for real** — not "it has no syntax errors"
2. Update `PROJECT_STATE.md` **in the same change**, not later
3. Add `docs/ai-journal/<topic>.md` if there was a decision or a bug worth remembering

---

## Never

- ❌ Claim "done" without running it. In a distributed system, "it compiles" says almost nothing.
- ❌ Leave `// FILL:` markers or `.todo` files for the user. **That mode was retired 2026-09-06** —
  it is why the project sat still for three weeks. Write complete code.
- ❌ Propose changing stack, repo, or project again. Read `docs/ai-journal/00_stack-pivot.md` first.
- ❌ Pull a later phase forward while an earlier one does not run.
- ❌ Commit `.env` or any secret.
