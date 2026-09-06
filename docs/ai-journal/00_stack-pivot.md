# Stack pivot: new technology direction and new learning method

**Date:** 2026-09-06
**Phase:** 0 — before touching any code
**Status:** ✅ Decisions and docs done. The transplant itself has not started.

---

## Context

After ~3 weeks FoodHub still did not run end to end. Re-reading the repo surfaced an uncomfortable
pattern:

| | FoodHub | TicketFlow |
|---|---|---|
| Blocked at | `SecurityConfig.java` | `proxy.controller.ts` |
| Unfilled `FILL` markers | 6 | 5 |
| Compiles? | No | No |
| Commits | 2 | **0** |

Two projects with nothing in common — different language, framework, database, message broker — and
both dead at **the same kind of file**: a fill-in-the-blank file never filled in.

Conclusion: the blocker was not the stack. It was the **method**.

The learning target had also shifted. It started as "understand microservices". It is now specific:
**Kafka, Redis, NestJS, Postgres, CI/CD** — and the user targets Node.js / full-stack JS roles in
6–12 months, not Java roles.

---

## Decisions

### A. Which project?

| Option | Pro | Con | Chosen |
|---|---|---|---|
| Keep FoodHub on Spring | Nothing lost, repo already exists | Matches **1 of 6** target technologies. Does not serve the career goal | ❌ |
| Switch to TicketFlow | Already had **4 of 6**: NestJS, Kafka, Postgres, microservices | **0 commits, no git remote.** CI/CD — one of the six targets — needs a GitHub repo to run on | ❌ |
| Rewrite FoodHub from scratch in NestJS | Clean slate | Throws away working Kafka-in-Docker configuration; twice the work | ❌ |
| **Keep the FoodHub repo, transplant the new stack into it** | Keeps repo, remote, history. Nothing hard is rebuilt. CI/CD has somewhere to run immediately | Domain names must be renamed during the copy | ✅ |

**Reversal, recorded because it matters:** Claude first recommended switching to TicketFlow, based on
technology fit alone. The user pointed at FoodHub's GitHub URL. Checking revealed TicketFlow had
**no remote and no commits**. The recommendation was reversed. Lesson: "which project is further
along" must account for git state, not just code volume.

**Second reversal:** Claude argued the ticket-booking domain was better because of seat contention
(overselling). Wrong — food has the identical problem: last three portions, flash sale on a popular
dish. Same race condition, same Redis solution. The domain barely affects the lesson, so the FoodHub
name was kept to match the repo.

### B. Which learning method?

| Option | Pro | Con | Chosen |
|---|---|---|---|
| Keep fill-in-the-blank | Forces independent thinking at decision-carrying lines | Three weeks of evidence: two projects, both dead at a `FILL` file. 0% completion | ❌ |
| Pure vibe code | Fast, produces a running system | A system that cannot be explained — defeats the interview goal | ❌ |
| **Vibe code + SHIP / BREAK / EXPLAIN** | Fast, and the thinking is preserved — just relocated | Requires the user to actually do BREAK and EXPLAIN rather than skipping them | ✅ |

**Core argument:** fill-in-the-blank was designed to teach *business logic reasoning* — typing
`placeOrder()` teaches the order flow. But Kafka, Redis, Postgres and CI/CD **do not live in typed
code**. `producer.send()` is three lines; typing it teaches nothing about Kafka. Kafka lives in:
when consumer lag climbs, how a message is redelivered after a consumer dies pre-commit, why
partition count caps parallelism.

None of that is learned by typing. It is learned by **having a running system and breaking it**.

So vibe code here is not surrender — it clears the path to where the lesson actually is. The rigor
merely **moves**: from *writing code* to *breaking the system and explaining it*.

### C. Technology ordering

Two earlier decisions (dated 2026-08-16) were reversed:

- **Kafka**: previously "deferred to Phase 6, after the project is complete; a reading track until
  then." → **Reversed.** Kafka is now core, arriving in Phase 3. Reason: the learning target moved
  from "microservices patterns" to "specific infrastructure", and Kafka is in the latter group.
  Cost: the RabbitMQ-vs-Kafka comparison is now book knowledge rather than lived experience.
- **Redis**: previously "Phase 1 gateway rate limiting, Phase 2 consumer idempotency."
  → **Pushed back to Phase 4**, where contention over the last portion appears. The rule
  *technology enters when it answers a problem actually hit* is **unchanged** — Redis's real problem
  simply lives somewhere other than first assumed.

### D. Four technical decisions

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| ORM | **Prisma** | TypeORM, Drizzle | TypeORM is "Nest-standard" and familiar from JPA, but migrations hurt. Drizzle is light and SQL-first but rarer in job ads. Prisma wins on migrations + type safety + market coverage |
| Repo layout | **One `package.json` per service** | npm workspaces | Workspaces hurt less day to day but blur service boundaries. The painful option was chosen because *the pain is the lesson*: no `shared/`, so a shape needed by two services gets copied |
| Auth | **Deferred to Phase 5** | Own service now, in-gateway now | Phases 1–4 run without auth. Deciding now is guessing |
| Legacy code | **Branch `legacy/spring`, then delete from `main`** | Delete outright | One extra push, and the old code stays browsable on GitHub with the migration story evidenced |

---

## Bugs hit

### False belief: "GPG signing is blocking `git commit`"

This claim came from a note dated 2026-08-16 and was **repeated several times this session as
fact**, including while planning Phase 1 ("first task is fixing GPG").

**Cause:** a 21-day-old note used as a data point without verification. "TicketFlow has 0 commits"
was a *correct observation*; "because of GPG" was an *unverified inference*.

**How it was found:** before running `git config commit.gpgsign false`, stopping to read the actual
configuration:

```bash
git config --get user.signingkey && timeout 10 bash -c 'echo test | gpg --batch --clearsign > /dev/null'
```

Signing returned `exit=0` with no passphrase prompt. GPG was blocking nothing.

**But it exposed a real and worse problem:** both commits on `main` were signed by
`Khuong Ngoc Doan <doan@seven365.com.sg>` — a different person. `~/.gnupg` held no key belonging to
the user, only two `@seven*.com.sg` keys. Three emails were in play: commit author
`draculedolar0763@gmail.com`, signing key `doan@seven365.com.sg`, account `minhnt0763@gmail.com`.

**Fix:** generated key `5359A8A8A6C4F69C` for the user and reconfigured git. The GitHub noreply
address was used because *Keep my email addresses private* is ON in the account, so the CLI was
leaking the real gmail into public commit history while the web UI hid it.

**General lesson:** a note saying "X is broken" is a point-in-time observation, not live state.
Verify before acting on it — especially when the action is changing configuration.

### Wrong shell

`gpg --full-generate-key` failed with `'gpg' is not recognized`. Cause: PowerShell. `gpg.exe` ships
with Git for Windows at `D:\Program Files\Git\usr\bin\gpg.exe` and is only on **Git Bash's** PATH.
Recorded as trap #5.

---

## Verification

| Check | Result |
|---|---|
| New code produced | None — matches the agreed scope |
| `main` still in sync with `origin` | ✅ 2 commits, untouched |
| Any `CLAUDE.md` still carrying the old agreement | ✅ Both the repo file and the parent-folder copy handled |
| GPG signing works with the user's own key | ✅ key present, git config confirmed |

Nothing to run yet. The next real milestone is Phase 1:
`curl localhost:3000/api/restaurants/health` answering through the gateway.

---

## Lessons for the next session

1. **Do not reopen the stack/repo question.** Every option and its rejection reason is above.
   Changing direction is the most productive-feeling form of procrastination — new setup always
   feels better than the boring middle.
2. When judging "which project is further along", **check `git remote -v` and the commit count
   first**, not the file count.
3. **Verify notes before acting on them.** The GPG claim cost real time and nearly caused a
   pointless config change.
4. `docs/ARCHITECTURE.md` and `docs/RUNNING.md` still describe the Spring stack. Rewrite them **in
   the same commit** as the transplant. Confidently wrong docs are worse than none.
