# spec-coverage — quick start

Standing audit that finds gaps between what a spec **promises in prose** (UI /
API / e2e surfaces) and what its `## 구현 위치` section actually points at.
Targets are the NERV mirror docs (`spec/<KEY>.md`, `spec/<영역 키>/<KEY>.md`)
that have that section; the catalog areas are not mirrored.
Full procedure: [`SKILL.md`](SKILL.md). This README is the operator's one-pager.

## When to run it

- Periodic grooming of the spec mirror — not per-PR. It walks **current `main`** in
  full, not a diff.
- After a batch of spec/impl work, to surface surfaces that were promised but
  never wired up (the generalization of the "Telegram chat-channel UI silently
  missing" case).

## When NOT to run it

- As a CI gate. It is **report-only** by design — NLP heuristics carry real
  false-positive rates, so it never blocks a merge. (Rationale: SKILL.md §R-1.)
- To validate a draft / PR diff. That's [`/consistency-check`](../consistency-checker/SKILL.md)
  (PR-diff, 4 parallel checkers, Critical-blocking) — a different operating
  model. spec-coverage is a single sub-agent doing a full-corpus sweep.

## Run

```bash
# /spec-coverage  (main Claude follows SKILL.md)
python3 .claude/skills/spec-coverage/scripts/spec_coverage_orchestrator.py
# → last stdout line = session dir; then invoke spec-impl-coverage-auditor on it
```

Output: `.review/spec-coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md` (gitignored, not committed),
findings classified **high / medium / low** confidence.

## Reading the report — false positives are expected

The three heuristics (SKILL.md §검출 heuristic) trade precision for recall:

- **high** — UI keyword in prose + no `codebase/frontend/` path in `## 구현 위치`.
  Most trustworthy.
- **medium** — `POST/GET /api/...` spec'd + no matching backend route. Regex
  matching can miss aliased routes.
- **low** — free-text e2e scenario + no e2e spec file. Highest false-positive
  rate.

Treat findings as **candidates to triage**, not defects. Pick the real ones and
file them as NERV Tasks (`nerv_task_create`). Tune noise with
`SPEC_COVERAGE_CONFIDENCE_FLOOR=medium|high` and `SPEC_COVERAGE_MAX_FINDINGS`.

## SoT

Evidence model (`## 구현 위치` in each mirror doc, rules 19 · 20):
[`spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md`](../../../spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md).
The build guard `spec-impl-locations` checks that those paths exist. This audit
covers the prose surfaces that the guard can't.
