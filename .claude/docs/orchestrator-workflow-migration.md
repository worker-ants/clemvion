# Orchestrator → native Workflow tool: migration design + pilot

> Status: **consistency-check migrated & validated** (pilot). ai-review /
> merge-coordinate **not** migrated — see §"What does NOT fit Workflow". This
> doc records the analysis, the (resolved) billing gate, the pilot result, and
> the constraints the pilot uncovered. (Proposal 테마4-②.)

## Billing gate — RESOLVED

The `Workflow` tool's `agent()` runs through the **plan-metered** harness
sub-agent path (it counts against plan token usage, unlike `claude -p`), so it
satisfies CLAUDE.md §외부 LLM 호출 정책. Recorded there as a sanctioned path
alongside the `Agent` tool. ✅ migration unblocked.

## Pilot result — consistency-check (validated)

`/consistency-check` now fans out via [`.claude/workflows/consistency-check.js`](../workflows/consistency-check.js):
`--prepare` (unchanged, model-free) → main reads the small `_retry_state.json`
manifest → `Workflow(name="consistency-check", args={invocations, summary})` →
parallel checkers + summary. Smoke-tested end-to-end (1 checker + summary):
checker read its `prompt_file` and wrote its `output_file`; summary aggregated to
a correct `BLOCK: YES`.

### Constraint the pilot uncovered — Workflow sub-agents RETURN, not Write

A Workflow sub-agent that tries to Write a **report file** is guard-blocked
(*"Subagents should return findings as text, not write report files"*). Observed:
the per-checker `output_file` Write **succeeded**, but the terminal summary's
`SUMMARY.md` Write was **blocked**. So the design is:
- checkers Write their `output_file` (permitted — detail stays off main ctx);
- the **summary RETURNS** the SUMMARY markdown; the workflow returns it; **main
  Claude (which has Write) persists `SUMMARY.md`**.

This is the load-bearing nuance for any further migration: Workflow fits
fan-out + return-aggregate, but report files are written by the caller, not the
terminal agent.

## Current architecture

Three orchestrators — `code_review_orchestrator.py` (929 LOC),
`consistency_orchestrator.py` (587), `merge_coordinator_orchestrator.py` (600) —
are **pure-Python state machines**. They never call a model. They:

1. `--prepare` a session dir + `_retry_state.json` (+ per-agent `_prompts/*.md`).
2. Hand control back to **main Claude**, which fans out `Agent` tool calls.
3. Parse each agent's STATUS line and `--update` the state buckets
   (pending/success/fatal), tracking `rate_limit_episodes` / `last_reset_hint_sec`.
4. Retry across turns via `ScheduleWakeup` (`/loop /ai-review --resume <dir>`).
5. `--apply-routing` (review-router) and converge via a summary sub-agent.

The state machine is now covered by [`../tests/test_orchestrator_state.py`](../tests/test_orchestrator_state.py).

## The gating constraint — billing single-path

CLAUDE.md §외부 LLM 호출 정책: **model calls go through exactly one path — main
Claude invoking a sub-agent via the `Agent` tool.** `claude -p` subprocesses and
direct Anthropic SDK calls are banned. The orchestrators' docstrings state this
is *why* they are model-free: the file-based prepare/STATUS contract makes it
structurally impossible for an auxiliary script to call a model.

(Gate resolved — see §"Billing gate" at top. Workflow agents are plan-metered
harness sub-agents, not `claude -p`.)

## What Workflow would replace vs. what it wouldn't

Replace (the win — est. 30–40% LOC + pattern unification):
- manual fan-out + STATUS parsing + `_retry_state.json` bucket bookkeeping →
  `parallel()` / `pipeline()` + structured-output schemas + built-in resume.
- per-orchestrator summary-state plumbing.

Doesn't cleanly map (must be re-expressed or kept):
- **Cross-turn rate-limit recovery** via `ScheduleWakeup` + `/loop`. Workflow has
  `budget`/resume but the bespoke quota-reset wake cycle is load-bearing and
  user-visible (`/loop /ai-review`).
- **router_safety `agents_forced`** whitelist (router can't drop security/etc.).
- **resolution-applier ESCALATE** follow-up flow (`/ai-review` §6).
- **merge-coordinator** user-confirm gates + per-conflict resolver loop.

## What does NOT fit Workflow (keep bespoke)

The pilot's "agents return, caller writes" constraint + Workflow's background,
non-interactive nature draw a clear boundary. Workflow fits **fan-out + return
aggregate**; it does **not** fit:

- **resolution-applier** (`/ai-review` §6) — it is not a reporter: it *edits
  code, commits, runs e2e*. A background workflow agent that returns text cannot
  own those side effects. Keep it as a main-invoked `Agent` after the review.
- **merge-coordinate confirm gates** — Phase 2 needs `AskUserQuestion` mid-flow;
  a background Workflow can't pause for the user. Per-conflict resolver loop is
  interactive too.
- **Cross-turn rate-limit recovery** via `ScheduleWakeup` + `/loop` — the
  quota-reset wake cycle (`/loop /ai-review`) is load-bearing and user-visible.
  Workflow has no equivalent cross-session resume on a 5-hour reset.

## Status & next

- [x] Billing gate resolved + recorded in CLAUDE.md.
- [x] Harness + orchestrator state-machine tests (`test_orchestrator_state.py`).
- [x] **consistency-check migrated** to Workflow + smoke-validated.
- [ ] **ai-review review-portion** (router + 14 reviewers + summary) — *fits*
      the same pattern (reviewers Write outputs, summary returns, main writes
      SUMMARY). Bigger; needs its own smoke test. resolution-applier + `/loop`
      stay bespoke (above). Recommend as the next focused PR, not bundled.
- [ ] merge-coordinate — analyzers fit, but confirm gates keep it mostly
      main-driven. Lowest priority.

Each further migration must be smoke-tested live (no CI e2e for these flows).
