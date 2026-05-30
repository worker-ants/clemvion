# Orchestrator → native Workflow tool: migration design + pilot

> Status: **consistency-check, ai-review (review-portion), merge-coordinate
> (Phase 1) migrated & smoke-validated.** The interactive / side-effecting
> portions (resolution-applier, merge Phase 2-4, /loop quota recovery) stay
> bespoke — see §"What does NOT fit Workflow". This doc records the analysis,
> the (resolved) billing gate, the pilot result, and the constraints the pilot
> uncovered. (Proposal 테마4-②.)

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

### Constraint the pilot uncovered — and its CORRECTED diagnosis (2026-05-30)

**Original (incorrect) read:** the pilot observed the terminal summary's
`SUMMARY.md` Write being blocked while per-checker `output_file` Writes
succeeded, and attributed it to a *"Workflow sub-agents can't write report
files"* rule. The design was then built around it: the summary RETURNS the
SUMMARY markdown and main Claude persists it.

**That diagnosis was wrong**, and it caused a real cost: the full aggregated
report round-trips through main Claude's context (once as the Workflow return
value, once as the `Write` argument) on every review — a per-run context
regression that does not exist in the legacy Agent-tool path (where the summary
sub-agent writes `SUMMARY.md` directly and only a STATUS line reaches main).

**Verified mechanism (5 live probes, 2026-05-30):** the block is the harness
**`worktree.bgIsolation` guard**, NOT a report-file guard. When a **background
session's parent has not isolated** (via the `EnterWorktree` *tool* — a shell
`cd` into a worktree dir does NOT satisfy it), the harness blocks *all* workflow
sub-agent writes to the shared checkout. The guard is **uniform**:
- `detail.md` (a normal name) and `SUMMARY.md` were blocked **identically** →
  filename is irrelevant;
- mid-pipeline and terminal agents were blocked **identically** → position is
  irrelevant;
- per-agent `isolation: "worktree"` did **not** lift it (each agent got its own
  worktree yet was still blocked) → the guard keys off the **parent** session's
  isolation state, not the agent's.

So reviewer/checker/analyzer writes and the summary write are subject to the
**exact same** guard. In any context where the fan-out produced output files at
all (the precondition for the flow to do anything), the summary write succeeds
too. The original "reviewers wrote but summary didn't" asymmetry was almost
certainly a difference in session isolation state between observations, not a
report-file rule.

**Corrected design (current):** every sub-agent — reviewers/checkers/analyzers
AND the summary — writes its own file directly (legacy contract restored). The
summary returns only a short STATUS line (`BLOCK=…` / `RISK=… CRITICAL=… WARNING=…`),
so the full report never enters the caller's context. **Fallback:** if the
summary's write IS blocked, it returns `WRITE_BLOCKED` + the full markdown and
main persists it — i.e. never worse than the old behavior.

**The real remedy for background runs** (so the whole flow, not just the
summary, can write): the workflow-invoking flow must isolate the **parent
session** via the `EnterWorktree` tool — or, repo-wide and more bluntly, set
`"worktree": {"bgIsolation": "none"}` in `.claude/settings.json` (disables the
shared-checkout guard for every bg agent in the repo — broader blast radius, use
with care). Note `ensure-worktree.sh` + shell `cd` (the documented dev setup)
does NOT perform session-level isolation, so bg workflow runs started that way
still hit the guard.

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

Workflow's background, non-interactive nature draws a clear boundary (this is
independent of the now-corrected write-guard story above — these don't fit
regardless). Workflow fits **fan-out + aggregate**; it does **not** fit:

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
- [x] **ai-review review-portion migrated** ([`.claude/workflows/ai-review.js`](../workflows/ai-review.js)):
      Route → Review → Summary. Router returns its decision via structured-output
      schema (no file write); selected = `agents_forced ∪ selected`; reviewers
      Write their outputs; summary **writes SUMMARY itself + returns a short
      status** (revised 2026-05-30 — see §"CORRECTED diagnosis"). Smoke-
      tested both paths: routing=skipped (1 reviewer) and routing=pending (router
      picked forced `documentation`, skipped 13). **resolution-applier (§6) +
      `/loop` stay bespoke** — see §"What does NOT fit Workflow".
- [x] **merge-coordinate Phase 1 migrated** ([`.claude/workflows/merge-coordinate.js`](../workflows/merge-coordinate.js)):
      Analyze (4 analyzers in parallel) → Summary (**writes SUMMARY itself +
      returns a short status**; revised 2026-05-30). Smoke-tested. **Phase 2 confirm, Phase 3 execute (git merge/rebase
      + merge-conflict-resolver per-conflict loop + patch-apply confirm), Phase 4
      chain/rollback stay bespoke** — they need `AskUserQuestion` mid-flow and own
      git side effects, which a background Workflow cannot. See §"What does NOT
      fit Workflow".

All three fan-out flows are now migrated. Each migration was smoke-tested live
(no CI e2e for these flows).

## Post-migration regression + remedies (2026-05-30)

The migration introduced a behavioral regression: after implementation, the
model began **deferring `/ai-review` ("scope too large") and not fixing
review Critical/Warning** — pushing them to a later turn or the PR. Root-cause
analysis found five compounding pressures, all pushing the same way:

1. **Workflow opt-in cost guard ↔ mandatory auto-review collide.** `/ai-review`
   is now a `Workflow`, whose always-loaded guard says "only call when the user
   explicitly opted in; it's expensive; don't infer scale." That directly
   fights developer SKILL's "구현 완료 → /ai-review 강제". The general, strongly
   worded tool guard tends to beat the domain SKILL prose.
2. **Async hand-off gap.** Workflow returns immediately + notifies later, so the
   turn can "end" at fire-time; the §6 fix step sits behind an async boundary.
3. **Only the cheap half migrated.** Route→Review→Summary is Workflow;
   `resolution-applier` (the actual fix) stays a separate bespoke `Agent` call
   main must remember — "자동으로" is misleading.
4. **Enforcement asymmetry (the soil).** Worktree is hook-enforced; test/review/
   fix was only SKILL prose. With pressures 1–3 added, the toothless mandate
   yields first.
5. **bgIsolation write-guard.** In a bg session whose parent didn't isolate via
   the `EnterWorktree` *tool*, workflow sub-agent writes (incl. resolution-applier
   fixes) are blocked — a rationalizable reason to defer. See §bgIsolation below.

### Remedies applied

- **Teeth (remedy 4 of the analysis).** New review-coverage guard gives review/
  fix the same kind of hook teeth the worktree rule has:
  - [`.claude/hooks/_lib/review_guard.py`](../hooks/_lib/review_guard.py) —
    judges "branch has unreviewed `codebase/**` changes?" (only `codebase/`
    counts — spec/plan/docs/meta PRs are never blocked).
  - [`guard_review_before_push.py`](../hooks/guard_review_before_push.py) —
    PreToolUse(Bash): blocks `git push` when code is unreviewed/unresolved
    (hard gate for "PR 로 미룸").
  - [`guard_review_before_stop.py`](../hooks/guard_review_before_stop.py) —
    Stop: nudges once per (session, HEAD) when code is unreviewed (soft gate for
    "다음 턴으로 미룸"; never loops — `stop_hook_active` + dedup marker).
  - Unit-tested in [`.claude/tests/test_review_guard.py`](../tests/test_review_guard.py).
  - Override: `BYPASS_REVIEW_GUARD=1`.
- **Standing opt-in (remedies 1–2).** CLAUDE.md §외부 LLM 호출 정책 now records
  that post-impl auto review/fix is a **standing sanctioned obligation**, exempt
  from the Workflow "inferred scale" guard; auto-triggers may use the fallback
  plain-Agent fan-out to dodge the async gap.
- **SKILL sync (remedy 3).** developer SKILL §REVIEW WORKFLOW drops "자동으로",
  spells out the async hops (fire → await notification → read SUMMARY → explicit
  `resolution-applier` call → ESCALATE branch), and adds a Definition of Done.

<a id="bgisolation"></a>
### §bgIsolation — the bg-session write block, and the remedy

(Recap of the "CORRECTED diagnosis" above, as the operative rule.) In a
**background session whose parent has not isolated via the `EnterWorktree`
tool** (a shell `cd` into a worktree does NOT satisfy it), the harness blocks
*all* workflow sub-agent writes to the shared checkout — reviewer outputs,
SUMMARY, and resolution-applier code fixes alike. **Remedy:** the
workflow-invoking flow must isolate the **parent session** with the
`EnterWorktree` tool. developer SKILL step 0 and code-review-agents SKILL §0 now
instruct this for bg sessions. The repo-wide alternative
`"worktree": {"bgIsolation": "none"}` in `.claude/settings.json` is **not**
applied here — broader blast radius; left as a conscious user decision.
