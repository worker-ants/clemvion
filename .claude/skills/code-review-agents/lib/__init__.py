"""Shared library for the AI-agent orchestrators under `.claude/skills/`.

Public modules:
  - role_instructions: role-specific prompt bodies (reviewers, checkers, analyzers)
  - router_safety: forced-include rules for review-router
  - line_anchors: true-source line anchors for reviewer prompt payloads

Consumers from outside `code-review-agents` import this via:
    sys.path.insert(0, "<repo>/.claude/skills/code-review-agents")
    from lib.role_instructions import CHECKER_INSTRUCTIONS

Session directories (`create_session_dir`) moved to `.claude/_shared/session.py`
on 2026-10-10 so every orchestrator reads them the same way.

The `agent_runner` and `summary` modules that previously lived here invoked
`claude -p` directly. They were removed when the pipeline moved to
sub-agent delegation (main Claude session invokes the `Agent` tool). See
`.claude/skills/code-review-agents/SKILL.md` for the new procedure.
"""
