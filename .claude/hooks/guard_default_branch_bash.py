#!/usr/bin/env python3
"""PreToolUse hook — soft reminder when a *mutating* Bash command is
about to run on the default branch of the main worktree.

Registered in `.claude/settings.json` for the `Bash` matcher. Unlike
the Write/Edit guard (which blocks), this guard NEVER blocks: false
positives on Bash command classification are too easy. Instead it
prints a reminder to stdout once per session (which the harness
injects into the model's context) and lets the command through.

Rationale: the existing Write/Edit guard only catches violations at
the very last step — after the model has often spent many tool calls
on read-only analysis from `main`. By the time the block fires, the
model has accumulated sunk-cost context that disincentivises
"throw it away and restart in a worktree". Catching the first
mutating Bash command surfaces the worktree decision earlier, when
restart cost is still low.

The "mutating" classifier is intentionally conservative — it matches
common file-creation / install / git-state-change commands and skips
pure inspection commands (ls, cat, grep, git status, git log, pwd).
Misclassification only injects a (harmless) reminder; it never blocks.

Once-per-session deduplication:
  We touch `.claude/state/main_worktree_bash_warned/<session_id>`
  the first time the reminder fires for a given session_id. Subsequent
  Bash calls for the same session stay silent so the model isn't
  nagged on every command. The state directory is in .gitignore.

  If session_id is missing from the payload (legacy harnesses), we
  fall back to firing every time — verbose but safe.

Policy lives in `_lib/branch_guard.py`. Override with
`BYPASS_DEFAULT_BRANCH_GUARD=1` to silence entirely.
"""

from __future__ import annotations

import json
import os
import re
import sys
import traceback

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, THIS_DIR)

try:
    from _lib.branch_guard import evaluate  # noqa: E402
except Exception:
    traceback.print_exc(file=sys.stderr)
    sys.exit(0)


# Match commands that create/modify state on disk, install dependencies,
# or move git refs. Tight regex — first whitespace-separated token only,
# plus a couple of compound forms (git <subcmd>). Read-only commands
# (ls, cat, grep, find, pwd, git status, git log, git diff, git show)
# are deliberately NOT matched.
_MUTATING = re.compile(
    r"""
    ^\s*(?:
        npm\s+(?:install|test|run|build|i\b|ci\b)
      | yarn\b
      | pnpm\b
      | make\s+\S
      | mkdir\b
      | rm\b
      | mv\b
      | cp\b
      | touch\b
      | sed\s+-i
      | python3?\s+-m\s+pip\b
      | pip3?\s+install
      | git\s+(?:commit|reset|checkout\s+-b|switch\s+-c|branch\s+-[Dd]
              |merge\b|rebase\b|cherry-pick\b|stash\b|am\b
              |worktree\s+remove|push\b|tag\s+-a|tag\s+-s)
    )
    """,
    re.VERBOSE,
)


def _read_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _is_mutating(command: str) -> bool:
    if not command:
        return False
    return bool(_MUTATING.search(command))


def _state_dir() -> str:
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    return os.path.join(project_dir, ".claude", "state", "main_worktree_bash_warned")


def _already_warned(session_id: str | None) -> bool:
    if not session_id:
        return False  # no key — fire every time
    marker = os.path.join(_state_dir(), session_id)
    return os.path.exists(marker)


def _mark_warned(session_id: str | None) -> None:
    if not session_id:
        return
    try:
        d = _state_dir()
        os.makedirs(d, exist_ok=True)
        marker = os.path.join(d, session_id)
        with open(marker, "w") as f:
            f.write("")
    except OSError:
        # Best effort — failure to dedupe is not fatal.
        pass


def main() -> int:
    if os.environ.get("BYPASS_DEFAULT_BRANCH_GUARD") == "1":
        return 0

    try:
        decision = evaluate()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        return 0

    if not decision.blocked:
        return 0  # safe location; stay silent.

    payload = _read_payload()
    tool_input = payload.get("tool_input") or payload.get("input") or {}
    command = tool_input.get("command") or ""

    if not _is_mutating(command):
        return 0  # read-only Bash — don't nag.

    session_id = payload.get("session_id") or payload.get("sessionId")
    if _already_warned(session_id):
        return 0  # already reminded this session.

    reminder = (
        "<system-reminder>\n"
        "⚠️ main 워크트리 default branch 에서 mutating Bash 명령을 실행하려 합니다.\n"
        "이 명령 자체는 차단되지 않지만, 곧 Write/Edit/git commit 단계에서\n"
        "PreToolUse 가드(.claude/hooks/guard_default_branch_edit.py) 와\n"
        "pre-commit 훅이 차단합니다. 누적된 컨텍스트가 낭비되기 전에\n"
        "지금 worktree 를 만드세요.\n"
        "\n"
        "**즉시 실행**:\n"
        "  .claude/tools/ensure-worktree.sh <task_name>\n"
        "  cd <printed path>\n"
        "\n"
        "이 reminder 는 세션당 1회만 표시됩니다.\n"
        "</system-reminder>"
    )
    print(reminder)
    _mark_warned(session_id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
