#!/usr/bin/env python3
"""PreToolUse hook — block file edits on the default branch of the main worktree.

Registered in `.claude/settings.json` for the matchers
`Write|Edit|MultiEdit|NotebookEdit`. The harness pipes a JSON payload on
stdin describing the pending tool call and watches the script's exit
code:

  exit 0 → allow the tool call.
  exit 2 → block; stderr is shown to Claude as the refusal reason.
  any other → treated as a runtime error; tool call proceeds (we want
              guards to fail-open rather than break the session).

Policy lives in `_lib/branch_guard.py` — see that module's docstring.
Override with `BYPASS_DEFAULT_BRANCH_GUARD=1` for one-off cases such as
release-prep edits the user has consciously decided to make on the
default branch.
"""

from __future__ import annotations

import json
import os
import sys
import traceback

# Add sibling `_lib` to import path so this script works whether the
# harness invokes it from the repo root or elsewhere.
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, THIS_DIR)

try:
    from _lib.branch_guard import evaluate  # noqa: E402
except Exception:
    # Import failure must not break the session — fail open.
    traceback.print_exc(file=sys.stderr)
    sys.exit(0)


def _read_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _describe_target(payload: dict) -> str:
    """Best-effort 'what was being edited' for the refusal message."""
    tool = payload.get("tool_name") or payload.get("tool") or "(unknown tool)"
    tool_input = payload.get("tool_input") or payload.get("input") or {}
    target = (
        tool_input.get("file_path")
        or tool_input.get("path")
        or tool_input.get("notebook_path")
        or "(target unknown)"
    )
    return f"{tool} on {target}"


def main() -> int:
    if os.environ.get("BYPASS_DEFAULT_BRANCH_GUARD") == "1":
        return 0

    try:
        decision = evaluate()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        return 0  # fail open on internal error

    if not decision.blocked:
        return 0

    payload = _read_payload()
    target = _describe_target(payload)

    msg = (
        "BLOCKED by .claude/hooks/guard_default_branch_edit.py\n"
        f"  attempted: {target}\n"
        f"  reason:    {decision.reason}\n"
        "\n"
        "Default branch on the main worktree must stay merge-only.\n"
        "\n"
        "COMMON MISCONCEPTION (this is NOT how to bypass):\n"
        "  Writing to a file_path under .claude/worktrees/<name>/ does NOT bypass\n"
        "  this guard. The guard inspects your current working directory (CWD),\n"
        "  not the target file path. The worktree must actually exist on disk\n"
        "  AND your CWD must be inside it (linked worktree, where top-level .git\n"
        "  is a file rather than a directory).\n"
        "\n"
        "TO PROCEED, run in the Bash tool (no manual slug needed):\n"
        "  .claude/tools/ensure-worktree.sh <task_name>\n"
        "  cd <printed path>\n"
        "Then retry the same Write/Edit call — the file path resolves correctly\n"
        "from the new CWD.\n"
        "\n"
        "Equivalent native flow:\n"
        "  TASK=<task>; SLUG=$(openssl rand -hex 3)\n"
        "  git worktree add \".claude/worktrees/${TASK}-${SLUG}\" \\\n"
        "                    -b \"claude/${TASK}-${SLUG}\"\n"
        "  cd \".claude/worktrees/${TASK}-${SLUG}\"\n"
        "\n"
        "One-off override (rare — release tag, conscious hotfix-on-main):\n"
        "  BYPASS_DEFAULT_BRANCH_GUARD=1\n"
    )
    print(msg, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
