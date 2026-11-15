# Read this before doing anything

You are one of two Claude Code sessions working on this repo at the same time,
on different machines, run by two different people. You are either **Agent A**
or **Agent B**. Your starting prompt says which. If it does not, stop and ask.

Startup sequence, every session, in this order:

1. `PROJECT.md` — what the product is and what the demo must do. Authoritative.
2. `PROTOCOL.md` — how the two agents coordinate. Non-negotiable.
3. `BOARD.md` — the task list and who owns what.
4. The *other* agent's `STATUS-*.md` — what they did since you last looked.
5. `app/contract.js` — the shared data shapes and event names you code against.

Hard rules:

- Never edit a file owned by the other agent. Ownership is in `PROTOCOL.md`.
- `git pull --rebase` before every push. Push after every finished task.
- Log every push in your own `STATUS-A.md` or `STATUS-B.md`.
- Prefix every commit message with `[A]` or `[B]`.
- Any design decision, any changed number: update `PROJECT.md` in the same commit.
- This is a hackathon. Act. Do not ask the user for confirmation between tasks.
