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
| `test_review_guard.py` | `review_guard.evaluate_review()` block/allow table + the `SUMMARY.md` / `RESOLUTION.md` resolved-state parser, spec `code:` glob → regex, the spec-impl `--impl-done` Gate 2, and the **forced-coverage** gate (`agents_forced` reviewers must each leave a non-empty report, resolved session-relative — never from the manifest's `output_file`, which names a since-deleted worktree). Git/fs helpers are patched (hermetic). |
| `test_consistency_orchestrator_state.py` | The consistency orchestrator's read paths (`--summary-state` / `--resume`) reconciling `_retry_state.json` with reports on disk. Exists because the two orchestrators mirror each other by duplication but only the code-review one had tests — which let a change land where the SKILLs documented self-healing that only half the pair implemented. Subprocess-driven. |
| `test_report_paths_shared.py` | `.claude/_shared/report_paths.py` — the report location/existence rule the push/stop gate and both orchestrator CLIs must answer identically. Pins the two rules (session-relative anchoring; non-empty) plus the directory-basename edge cases (`output_file` ending in `/`, or a bare `.`/`..`) that once let a directory be misjudged a report. `AgreementTest` drives the real gate function and a real `--verify-coverage` subprocess side by side and asserts they agree — the thing that actually matters, since a divergence here was measured in production (2026-07-17) despite a "change both" comment. |
| `test_summary_agent_contract.py` | The three summary agent definitions ↔ what `.claude/workflows/*.js` actually sends them: no file may blame the write block on terminal position (refuted 2026-07-17 — the rule is exact basename), every definition must state the basename rule, take the inlined report bodies as authoritative, persist missing per-agent files, and flag unobtained findings as a false negative. **Prose-checking on purpose** — see the convention note below. |
| `test_workflow_scripts.py` | `.claude/workflows/*.js` syntax (parsed as the harness VM wraps them — `node --check` alone passes even a duplicate `const` on these files) + the `SHARED-BLOCK` mirror of `_lib/agent-return.mjs` staying byte-identical across the three fan-out workflows, since the sandbox forbids `import`. |
| `test_reap_merged_worktrees.py` | `reap-merged-worktrees.sh` end-to-end against a real throwaway git repo with actual worktrees/branches (`gh` stubbed via `REAP_GH_BIN`): removes a worktree only on a `gh`-confirmed merged PR, skips dirty/unmerged/`gh`-unconfirmed ones, and — the incident this covers — never removes a `--keep`-protected worktree even when the shell cwd is a *different* worktree (the state `EnterWorktree` leaves behind), while still reaping everything else. Also exercises `bootstrap-session.sh` driving the reaper end-to-end so a `--keep` the reaper honours but bootstrap never sends cannot slip through unnoticed. |
| `test_review_guard_hardening.py` | The checkout-/rebase-immune freshness rework: porcelain rename parsing, `**/` segment-boundary globbing, the session-dir clock, dirty→mtime vs clean→author-date split, in-flight suppression, and the **rebase author-date** regression (a rebase that only rewrites committer date must not re-arm the gate). Also the **resolution-in-flight** suppression: `_resolution_in_flight` (dispatch marker + applier-started state, both TTL-bound), the `mark_`/`clear_resolution_in_flight` PreToolUse(Agent)/SubagentStop marker hooks, and the Stop guard's suppression + review-done nudge wording. The rebase case uses a **real temp git repo** — see the convention note below. |
| `test_forced_coverage_selection.py` | `_newest_resolved_review_mtime` over **real, non-mocked session dirs** — the load-bearing safety argument for rolling the forced-coverage requirement out to *all* history without a grandfather clause: an under-covered session simply drops out of the "resolved" set, so nothing is retroactively broken, only future reviews are held to the bar. Every prior test of this function mocked it away; real dirs are used because the session clock is the directory name itself, which a mock cannot exercise. |

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
  **Deliberate exception:** where the document *is* the runtime spec rather than a
  rendering of one — a sub-agent definition is the system prompt the model executes —
  its wording is behaviour, and `test_summary_agent_contract.py` pins the load-bearing
  phrases. That exception earned itself: a refuted explanation ("your write is blocked
  because you are the terminal sub-agent") sat in 7 such files while the workflows had
  begun asking those very agents to write per-agent files, and nothing caught the
  contradiction. Keep such checks to phrases that change what the agent *does*.
