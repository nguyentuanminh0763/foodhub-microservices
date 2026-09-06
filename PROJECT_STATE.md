# FoodHub — Project State

> **Last updated:** 2026-09-06 (stack pivot + git identity fixed + outer docs rewritten)
> **Overall:** ⛔ Nothing runs end to end. Repo is mid-migration: Spring Boot + Express being
> replaced by NestJS + Postgres + Kafka + Redis.

---

## Identity

| | |
|---|---|
| Name | FoodHub — food delivery as microservices |
| Repo | `https://github.com/nguyentuanminh0763/foodhub-microservices` (`main`, pushed) |
| Local path | `C:\Users\PC\Desktop\microservices\foodhub-microservices` |
| Runtime | **Now:** Java 21 (Spring Boot 3.3) + Node 20 (Express). **Target:** TypeScript / Node 20 (NestJS 11) |
| Key libraries | **Target:** NestJS, Prisma, `kafkajs`, `ioredis`, `@nestjs/axios` |
| Infra | Docker Compose. **Target:** Postgres 16 (one per service), Kafka 3.9 KRaft, Redis, Kafka UI |
| Dev platform | Windows 11, Docker Desktop, **Git Bash** (not PowerShell — see trap #5). Git on drive D: |
| User | Working developer. Strong in Node/Express, React/React Native, Spring Boot, MySQL, MongoDB, JWT. **Learning:** microservices, Kafka, Redis, NestJS, Postgres, CI/CD |

**Actual goal:** understand microservices patterns and infrastructure well enough to *defend every
decision in an interview*. Not to ship a product. The user targets **Node.js / full-stack JS** roles
in the next 6–12 months.

---

## Current state

`main` now holds **documentation only**. All application code was removed in task 1.3 and lives on
the `legacy/spring` branch.

| Component | State | Notes |
|---|---|---|
| Git / GitHub | ✅ `main` and `legacy/spring` both pushed | |
| Git identity | ✅ Fixed 2026-09-06 | Own GPG key `5359A8A8A6C4F69C`, noreply email, commits signed. Public key **still needs pasting into GitHub** for the Verified badge (cosmetic) |
| Documentation | ✅ Rewritten for the target stack, all English | README, ARCHITECTURE, RUNNING, CLAUDE*, PROJECT_STATE, ai-journal |
| `docker-compose.yml` | ✅ Two Postgres, both verified `healthy` | Task 1.4 done 2026-09-06 |
| `restaurants-db` | ✅ Running, `foodhub_restaurants` auto-created, no tables yet | host `5433` → container `5432` |
| `orders-db` | ✅ Running, `foodhub_orders` auto-created, no tables yet | host `5434` → container `5432` |
| `.env` / `.env.example` | ✅ Rewritten for Postgres + Prisma | |
| `services/gateway` | ⛔ Not created | Task 1.7 |
| `services/restaurant` | ⛔ Not created | Task 1.5 |
| `services/order` | ⛔ Not created | Task 1.6 |
| `.github/workflows/ci.yml` | ⛔ Not created | Task 1.8 |

### On the `legacy/spring` branch

Preserved, not lost: the hand-written `AuthService.register/login` (BCrypt + JWT, logic correct),
the `SecurityConfig` scaffold with 6 unfilled `// FILL:` markers, empty Order/Restaurant skeletons,
and the Spring Cloud Gateway with one example route. That branch never compiled — `SecurityConfig`
was deliberately left incomplete under the retired working mode.

---

## Latest update — Stack pivot, new working mode, git identity (2026-09-06)

**Created:** `PROJECT_STATE.md`, `CLAUDE_RULES.md`, `docs/ai-journal/00_stack-pivot.md`
**Rewritten:** `CLAUDE.md`, `README.md`, `../CLAUDE.md` (reduced to a stub)

**Done:**
- Retired **fill-in-the-blank**; switched to **vibe code + SHIP/BREAK/EXPLAIN**
- Locked the target stack: NestJS + Prisma + Postgres + Kafka + Redis + GitHub Actions
- Kept the `foodhub-microservices` repo and the food domain rather than switching projects
- Locked four technical decisions (ORM, repo layout, auth placement, legacy code disposal)
- **Task 1.1 complete** — generated a GPG key for the user, reconfigured git identity
- All documentation switched to **English** for token efficiency
- Full reasoning and rejected options: `docs/ai-journal/00_stack-pivot.md`

**Bugs found and fixed:**

| Bug | Cause | Fix |
|---|---|---|
| Belief that "GPG blocks `git commit`" | A 21-day-old note treated as fact without verification | Tested signing directly — works, exit 0. Note corrected and deleted |
| Commits signed as `Khuong Ngoc Doan` | Leftover `user.signingkey` on this machine pointing at another person's key | New key `5359A8A8A6C4F69C` generated, git reconfigured |
| Real gmail exposed in public commit history | *Keep my email addresses private* ON in GitHub, but git CLI pushed the real address | `user.email` switched to the GitHub noreply address |

**Verification:** GPG signing tested (`exit 0`), key present in `~/.gnupg`, git config confirmed.
No code was produced this session — deliberate. The next real verification is the Phase 1 milestone:
`curl localhost:3000/api/restaurants/health` answering through the gateway.

---

## Open issues

| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | Nothing runs end to end after ~3 weeks | 🔴 High | Root cause was the old working mode; addressed this session |
| 2 | `docker-compose.yml` and `.env.example` still hold legacy config | 🟠 Medium | Task 1.4 rewrites both. Until then `docker compose up` refers to services that no longer exist |
| 3 | GPG public key not yet uploaded to GitHub | 🟢 Low | Until then commits stay *Unverified*. Cosmetic only — attribution already works |
| 4 | `.env` holds real secrets, gitignored | 🟢 Low | Re-check before every push |
| 5 | ~~Legacy Java/Express code on `main`~~ | ✅ Done | Task 1.3 — preserved on `legacy/spring`, removed from `main` |
| 6 | Real email exposed in the first 2 commits | 🟢 Low | Not worth rewriting history. Clean from commit `40fdbea` onward |

---

## Update history

### 2026-09-06 — Stack pivot, new working mode, git identity fixed
### 2026-08-16 — TicketFlow built as a separate NestJS + Kafka project (since abandoned)
### ~2026-06-16 — Phase 1 scaffold: auth/restaurant/order/gateway on Spring + Express

<!--
FOR THE NEXT SESSION:
Insert a new section directly under "Latest update", rename the old one to "Previous update",
add a line to Update history, and fix the "Last updated" line at the top.
-->
