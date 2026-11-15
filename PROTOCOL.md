# Two-agent protocol

Two Claude Code sessions, **Agent A** and **Agent B**, on different machines, run
by two different people, working at the same time. The repo is the only channel
between them. Neither agent can see the other's terminal or ask it a question.

## File ownership

Conflicts are avoided by ownership, not by locking. Never edit a file you do not
own.

| Owner | Files |
|---|---|
| **A** | `index.html`, `app/shell/*`, `app/map/*`, `app/data/*` |
| **B** | `app/ui/*`, `app/styles/*`, `opt/*`, `data/plans.json` |
| shared | `app/contract.js`, `PROJECT.md`, `BOARD.md` |
| yours alone | `STATUS-A.md` / `REVIEW-A.md` for A, `STATUS-B.md` / `REVIEW-B.md` for B |

`data/` and `pipeline/` are inherited and read-only, except `data/plans.json`
which B generates.

In `BOARD.md`, each agent edits only its own rows.

## Git

- Both agents work on `main`. No branches, no PRs: too slow for a hackathon.
- `git pull --rebase` **before every push**.
- Push **after every finished task**, not at the end of the session.
- Every commit message starts with `[A]` or `[B]`.
- If a rebase conflicts in a file you do not own, take the other agent's version
  (`git checkout --theirs`). Never resolve in favour of your own edit to their file.
- `app/contract.js` is frozen once pushed. If you must change it, do it in a
  commit of its own and write a line flagged `CONTRACT CHANGE` in your STATUS
  file. The other agent reads STATUS before its next commit and adapts.

## Handoff

`STATUS-A.md` and `STATUS-B.md` are the handoff channel. One entry per push:

```
## 2026-11-15 03:14 — A3 done
Touched: app/map/zones.js, app/map/camera.js
For B: zone click now emits `zone:selected` with the full zone object, not the id.
Blocked on: nothing
```

Read the other agent's STATUS at session start and before every checkpoint. If
their last entry says they changed something you depend on, adapt before you
commit.

## Working in parallel

After the repo exists, both agents work on their own tasks and **never wait for
each other**, except at the two checkpoints. B's first task is
`opt/make_plans.py`, so that `data/plans.json` — the only real dependency A has
on B — lands early.

## Checkpoints

**Checkpoint 1** — when A has the 3D map screen working and B has the area panel
working. **Checkpoint 2** — when A has the plan toggle recoloring zones and B has
the plans panel. Both run the same cycle:

1. `git pull --rebase`
2. Run the demo end to end, from the login screen.
3. Review the **other** agent's files against `PROJECT.md`. Look for: screens that
   drift from the spec, numbers that do not match the anchor table, information
   leaking onto the map, dead event wiring, broken contract assumptions.
4. Write your findings in your own REVIEW file: file, what is wrong, what it
   should be. Be specific, no praise, no restating the spec.
5. Push.
6. Read the other agent's review of your work, and fix only the findings that
   fall in files you own. If you disagree, write why in your STATUS file and move
   on. Do not argue across two commits.

## Final integration

A's job: pull, run the whole 7-screen flow, fix only the glue between shell, map
and panels, push, and report what works and what is still rough.

## Decisions

Any design decision, any changed number, goes into `PROJECT.md` in the same
commit as the code. A decision that is only in a commit message does not exist.
