"""Shared library for AI-agent orchestrators (code-review-agents, consistency-checker).

Public modules:
  - session: session directory, metadata, debug logger, truncation utilities
  - agent_runner: parallel `claude -p` invocations
  - summary: summary-agent runner

Consumers from outside `code-review-agents` import this via:
    sys.path.insert(0, "<repo>/.claude/skills/code-review-agents")
    from lib import agent_runner, session, summary
"""
