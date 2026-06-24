# `.claude/tests/` — harness self-tests

Unit tests for the **harness's own Python** (hooks, skill libs, config) — not
the product code under `codebase/`. These guard the automation layer that has
no other coverage: branch guards, branch normalization, and the multi-place
agent registry.

## Run

```bash
python3 -m unittest discover -s .claude/tests -p 'test_*.py'
```

No install step. The suite uses **only the standard library** (`unittest`,
`unittest.mock`), matching the harness convention that its Python carries zero
third-party dependencies — hooks must run on a bare `python3`. Do not introduce
`pytest`/`requirements.txt` here without revisiting that convention.

## What's covered

| File | Guards |
|---|---|
| `test_agent_consistency.py` | Registry drift across the 4 places an agent is declared: `role_instructions.py` (SSOT) ↔ `.claude/agents/<name>.md` ↔ `.claude.project.json` toggles ↔ `README.md` table. Catches add/rename/remove misses; does **not** police prose wording (the `.md` is an intentionally human-edited rendering). |
| `test_branch_guard.py` | `branch_guard.evaluate()` decision table — block only on (main worktree) ∧ (current == origin default); allow otherwise. Default branch is resolved, not hardcoded to `main`. |
| `test_branch_naming.py` | `worktree-*` → `claude/*` normalization: idempotent, skips main worktree / pushed branches / detached HEAD, appends a slug on collision. |
| `test_doc_sync_matrix.py` | PROJECT.md's "변경 유형 → 갱신 위치 매핑" matrix + its JSON SSOT (`.claude/config/doc-sync-matrix.json`): JSON shape, row-count 1:1 binding with the prose table, and every referenced `*.test.ts` / `spec/...md` / trigger-glob base path exists. Reaches into `codebase/` and `spec/` on purpose (the matrix is a harness↔product binding). |
| `test_orchestrator_state.py` | The code-review orchestrator's CLI state machine (`--update` / `--apply-routing` / `--summary-state` / `--resume`): bucket transitions, rate-limit episode/reset-hint tracking, routing selection + forced-agent retention, fallback. Driven via subprocess (the real CLI surface; also avoids the two-`_lib` import collision). |
| `test_review_guard.py` | `review_guard.evaluate_review()` block/allow table + the `SUMMARY.md` / `RESOLUTION.md` resolved-state parser, spec `code:` glob → regex, and the spec-impl `--impl-done` Gate 2. Git/fs helpers are patched (hermetic). |
| `test_review_guard_hardening.py` | The checkout-/rebase-immune freshness rework: porcelain rename parsing, `**/` segment-boundary globbing, the session-dir clock, dirty→mtime vs clean→author-date split, in-flight suppression, and the **rebase author-date** regression (a rebase that only rewrites committer date must not re-arm the gate). Also the **resolution-in-flight** suppression: `_resolution_in_flight` (dispatch marker + applier-started state, both TTL-bound), the `mark_`/`clear_resolution_in_flight` PreToolUse(Agent)/SubagentStop marker hooks, and the Stop guard's suppression + review-done nudge wording. The rebase case uses a **real temp git repo** — see the convention note below. |

## Conventions for new tests

- Patch the git-backed helpers (`_repo_root`, `_run_git`, …), not git itself, so
  tests stay hermetic and fast. **Deliberate exception:** when the behaviour
  under test *is* a git semantic — e.g. that `git rebase` rewrites committer date
  but preserves author date, which `review_guard._newest_commit_time` relies on —
  build a real temp repo (`git init` in a `tempfile.mkdtemp()`, isolated via
  `GIT_CONFIG_GLOBAL=/dev/null`) and set `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE`
  explicitly. Mocking would assert our model of git, not git. Keep these few and
  fast.
- Load harness modules via `_harness.load_module_by_path` when they would
  collide on the shared `_lib` package name (the two `_lib` packages under
  `hooks/` and `skills/`). See `_harness.py`.
- Assert **structural / behavioral invariants**, not prose. The `.md` agent
  definitions and docs are allowed to read differently from their SSOT.
