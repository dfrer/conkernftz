# ConkerNFTZ — Planning System (source of truth)

This directory is the **single source of truth** for what we're building, where we are, and what's
next. It supersedes the older scattered planning docs. Read these in order:

| File | Question it answers | Changes |
|------|---------------------|---------|
| **[VISION.md](VISION.md)** | *What* are we building, and why? | Rarely — only on a real scope shift. |
| **[STATUS.md](STATUS.md)** | *Where* are we? (every surface: done / partial / planned) | Often — as work lands. |
| **[PLAN.md](PLAN.md)** | *What's next?* (task board: Now · Next · Later · Icebox) | Often. |
| **[LOG.md](LOG.md)** | *What did the owner decide/request, and when?* | Append-only, dated. |

## How it's maintained (the rules)

- **Owner gives a directive** → append a dated line to `LOG.md` and adjust `PLAN.md`.
- **Work lands** → update `STATUS.md` and tick the task in `PLAN.md`.
- **Scope/priority shifts** → update `VISION.md` (and log it).
- **One place to look:** start here → the four files above. Nothing authoritative lives only in
  the agent's memory anymore; the agent's memory is a thin pointer to this directory.

## Deep reference (detail, not planning)

These stay as reference and are linked from the docs above — they are *not* the plan:

- [`EVM_LAUNCH_SPEC.md`](../EVM_LAUNCH_SPEC.md) — the launch-contract design + threat model.
- [`DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) — the UI design-system reference.
- [`CONFIG_REFERENCE.md`](../CONFIG_REFERENCE.md) / [`CLI_REFERENCE.md`](../CLI_REFERENCE.md) — config + CLI.
- [`TESTING.md`](../TESTING.md) — how we test (note: **no CI budget** — verify locally).
- [`PLATFORM_MASTER_PLAN.md`](../PLATFORM_MASTER_PLAN.md) — **superseded** by `VISION.md`/`PLAN.md`; kept as history.
- `KNOWN_GAPS.md` — **superseded** by `STATUS.md`.
