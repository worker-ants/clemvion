"""Shared library for the AI-agent orchestrators under `.claude/skills/`.

Public modules:
  - session: session directory, metadata, debug logger, truncation utilities

Consumers from outside `code-review-agents` import this via:
    sys.path.insert(0, "<repo>/.claude/skills/code-review-agents")
    from lib import session

spec-coverage loads `session.py` by path instead (see that module's docstring).

The `agent_runner` and `summary` modules that previously lived here invoked
`claude -p` directly. They were removed when the pipeline moved to
sub-agent delegation (main Claude session invokes the `Agent` tool). See
`.claude/skills/code-review-agents/SKILL.md` for the new procedure.
"""
