# Orchestrator → native Workflow tool: migration design (NOT YET EXECUTED)

> Status: **design only.** No orchestrator has been migrated. This doc records
> the analysis, the gating decision, and a safe pilot path so a future focused
> PR can execute it without re-deriving the trade-offs. (Proposal 테마4-②.)

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

**Open question that gates the whole migration:** does the `Workflow` tool's
`agent()` invoke sub-agents through that same sanctioned Agent-tool path (main
Claude as the single model caller, deterministically orchestrated), or through a
separate mechanism? It appears to be the former (Workflow agents are harness
sub-agents, not `claude -p`), which would make migration policy-compliant — but
**this must be confirmed against the current harness/billing rules and recorded
here before any migration**, because if Workflow bypassed the single path, the
migration would itself be a policy violation.

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

## Prerequisites

- [x] Harness test harness exists (`.claude/tests/`).
- [x] Orchestrator state-machine tests (`test_orchestrator_state.py`) — a
      behavioral spec to migrate *against* and diff for regressions.
- [ ] **Billing-path confirmation** (above) — recorded here, signed off.
- [ ] State tests extended to `consistency_orchestrator` / `merge_coordinator`
      before touching those.

## Recommended pilot (when unblocked)

Migrate **one** skill first — `consistency-check` is the simplest: 5 fixed
checkers + 1 summary, **no router, no resolution-applier, no /loop-critical
quota dance**. Steps:

1. Confirm + record the billing-path decision.
2. Write a `Workflow` script reproducing the 5-checker fan-out + summary, gated
   behind an opt-in (env or flag) with fallback to the existing orchestrator.
3. Run both paths on the same input; diff the SUMMARY + state outcomes against
   `test_orchestrator_state.py`-style assertions.
4. Only after the pilot proves equivalent, consider `ai-review` (router +
   resolution-applier raise the bar) and `merge-coordinate` (confirm gates).

## Explicitly out of scope for the current PR

No live rewrite. Bundling a 2,116-LOC orchestration replacement into a cleanup
PR — unverifiable in CI (no full `/ai-review` e2e), billing-policy-critical —
would create exactly the churn/risk this harness-improvement effort set out to
reduce. This doc + the new state tests are the safe, valuable groundwork.
