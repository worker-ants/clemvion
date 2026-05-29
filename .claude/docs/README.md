# `.claude/docs/` — harness policy references

Long-form policy and contract docs that CLAUDE.md / PROJECT.md / SKILL.md cite
by one-line link instead of inlining (so the rule has a single home and doesn't
drift across copies). Each doc is the **SSOT** for its topic.

| Doc | SSOT for | Primarily read by |
|---|---|---|
| [`worktree-policy.md`](worktree-policy.md) | Worktree-based work rule, naming, the 4-layer default-branch guard, `worktree-*`→`claude/*` normalization | Everyone, before starting any write. CLAUDE.md §0 is the TL;DR; this is the detail. |
| [`subagent-call-contract.md`](subagent-call-contract.md) | How main Claude invokes sub-agents: `prompt_file`/`output_file`/`session_dir` args, the STATUS return line, retry/rate-limit flow, risk grades | Anyone writing or invoking a `.claude/agents/<name>.md`; every reviewer/checker/analyzer cites it. |
| [`plan-lifecycle.md`](plan-lifecycle.md) | `plan/` lifecycle (in-progress ↔ complete), frontmatter schema, move rules, spec-coverage standing-audit placement | `developer` and `project-planner` when creating/moving plans. |
| [`test-wrapper.md`](test-wrapper.md) | The `.claude/tools/run-test.sh` wrapper contract (one-line pass / failure summary), stage definitions | `developer` during TEST WORKFLOW. |
| [`orchestrator-workflow-migration.md`](orchestrator-workflow-migration.md) | **Design only** (not executed): plan + gating billing-path question for migrating the bespoke orchestrators to the native `Workflow` tool | Whoever picks up 테마4-② later. |

## Reading order for a newcomer

1. **CLAUDE.md** (repo root) — generic cross-project rules + §0 worktree TL;DR.
2. **PROJECT.md** (repo root) — this project's stack, build/test commands, the
   co-update matrix.
3. **worktree-policy.md** — the one rule that gates every write.
4. The role you're playing: `.claude/skills/<role>/SKILL.md`, which links back
   into the docs above as needed.

## Related indexes

- Directory taxonomy (`agents/`, `commands/`, `skills/`, `hooks/`): [`../README.md`](../README.md).
- Reviewer/checker catalog: [`../skills/code-review-agents/README.md`](../skills/code-review-agents/README.md).
- Self-tests for the harness Python: [`../tests/README.md`](../tests/README.md).
- Uninstalled optional skills: [`../OPTIONAL_SKILLS.md`](../OPTIONAL_SKILLS.md).
