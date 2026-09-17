# Learning and reference branches

Created at the user's request on 2026-09-17. Feature work is paused.

| Branch | Purpose |
|---|---|
| `main` | The reference implementation. Fast-forwarded to it on 2026-09-17 |
| `codex/reference-implementation` | Same commit as `main`; kept as a named marker of the snapshot |
| `codex/learning` | The Phase 1 baseline; user implements one task at a time |

The learning branch may contain orientation/status documentation added after the
baseline. It does not include the reference feature code.

**The baseline is still reachable** — it is commit
`c12a2a6bd6ba308dd8eabedffc021555badcae38`, and `codex/learning` points at it. Since
`main` moved forward, the learning branch now sits *behind* `main` rather than
branching from its tip. That is intentional: learning restarts from Phase 1 task 1.7
regardless of what `main` contains.

All three branches are pushed to GitHub.

## Use the reference selectively

Work on the learning branch:

```bash
git switch codex/learning
```

Read the reference state without switching:

```bash
git show codex/reference-implementation:PROJECT_STATE.md
```

Inspect one implementation when stuck:

```bash
git show codex/reference-implementation:services/order/src/orders.service.ts
```

Review changes for one area:

```bash
git diff main..codex/reference-implementation -- services/restaurant
```

Switch to the complete reference snapshot only with a clean working tree:

```bash
git switch codex/reference-implementation
```

Commit unfinished learning work on its own branch before switching. Do not merge
the entire reference branch into learning just to inspect a file. The reference
has known failed tests and unfinished verification; it is a source to question,
not an answer key guaranteed to be correct.

## Docker data is not versioned by Git

The original `foodhub-microservices` Docker project now holds the reference's
expanded database schemas and smoke-test records. Its containers were stopped
at pause; its volumes were preserved.

On `codex/learning`, use a different Compose project from the beginning:

```bash
docker compose -p foodhub-learning up -d restaurants-db orders-db
```

The `-p` name creates separate database volumes. Use the same name on subsequent
learning commands:

```bash
docker compose -p foodhub-learning stop
```

This gives the baseline fresh databases; apply the baseline Prisma migrations
before running its health/schema tests. On the reference branch, use the ordinary
`docker compose` commands documented in RUNNING.md to reach the existing reference
volumes. Do not run both projects at once because they publish the same host ports.
Do not delete volumes or reset a database merely to switch branches.

Local `.env`, installed `node_modules` and `dist` also survive a branch switch.
Reinstall from the branch's lockfiles and rebuild before running it. The root .env
received additional reference settings, but existing credentials were preserved.
Extra reference variables are not a reason to overwrite the learning credentials.

## Learning workflow

Start at Phase 1 task 1.7: Dockerfiles and Compose service wiring. The baseline
already has the gateway and two Prisma-backed health services. Choose one small
task, make a prediction, implement it, run it, break it deliberately, and explain
the result. Consult only the relevant reference files when needed.

The user owns the pace and implementation. Future assistance should explain,
review and debug the selected task; do not automatically port the full reference.
