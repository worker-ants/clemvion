"""Shared library for the AI-agent orchestrators under `.claude/skills/`.

Public modules:
  - role_instructions: role-specific prompt bodies (reviewers, checkers, analyzers)
  - router_safety: forced-include rules for review-router
  - line_anchors: true-source line anchors for reviewer prompt payloads

Consumers from outside `code-review-agents` import this via:
    sys.path.insert(0, "<repo>/.claude/skills/code-review-agents")
    from lib.role_instructions import CHECKER_INSTRUCTIONS

Why `role_instructions` stays here although two other skills read it (decided
2026-10-10, NERV Task `CLE-T-QY5AZ3`, after PR #1523 review asked):

  - Measured consumers: three orchestrators each import one dict
    (code-review `REVIEWER_INSTRUCTIONS` 14 roles, consistency
    `CHECKER_INSTRUCTIONS` 4, merge `ANALYZER_INSTRUCTIONS` 6), and two tests
    load the file by path (`test_agent_consistency.py`, `test_block_integrity.py`).
    The cross-skill cost is one `sys.path` entry in consistency and merge, and
    both still need `.claude/skills/` on the path for `_lib.project_config`.
  - The path is written down outside this repository's code: the NERV spec
    `CLE-ENG-SPECEVIDENCE` lists it under `## 구현 위치`, and the governance doc
    `.claude/agents/cross-branch-spec-analyzer.md` names it as the source of that
    agent's perspective. A move needs a spec draft that a person approves and a
    project-planner edit, for the sake of that one path entry.
  - It is not a generic helper like `.claude/_shared/*`. It is the registry of
    every role's prompt body, and `test_agent_consistency.py` treats it as the
    source the agent `.md` files must match.

If it does move, it goes to `.claude/_shared/role_instructions.py`, together
with the spec draft and the agent doc. Not `.claude/skills/_lib/`: that package
is named `_lib` like `.claude/hooks/_lib/`, and the tests put the hooks
directory on `sys.path`, which is why `_harness` loads `project_config` by path.

Session directories (`create_session_dir`) moved to `.claude/_shared/session.py`
on 2026-10-10 so every orchestrator reads them the same way.

The `agent_runner` and `summary` modules that previously lived here invoked
`claude -p` directly. They were removed when the pipeline moved to
sub-agent delegation (main Claude session invokes the `Agent` tool). See
`.claude/skills/code-review-agents/SKILL.md` for the new procedure.
"""
