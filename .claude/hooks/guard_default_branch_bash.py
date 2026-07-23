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

It reads the FIRST TOKEN OF EACH SEGMENT: the command is split on
`&&`/`||`/`;`/`|`/`&`/newline and the anchored pattern is applied to
every part, skipping any `VAR=value` prefix. Per-command conservatism
is what makes the classifier safe (a word inside a commit message or a
grep pattern cannot trigger it), but reading only the *whole command's*
first token made `git add -A && git commit -m "x"` — the common shape —
silently invisible, i.e. it missed exactly the moment described above.
The split does not understand quoting; the two false-positive classes
that opens are pinned in `test_guard_default_branch_bash_mutating.py`
and accepted because this hook never blocks.

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
# or move git refs. Tight regex — first whitespace-separated token only
# (optionally after `VAR=value` assignments), plus a couple of compound forms
# (git <subcmd>). Read-only commands (ls, cat, grep, find, pwd, git status,
# git log, git diff, git show) are deliberately NOT matched.
#
# Anchoring to the FIRST token is what keeps this conservative: a word inside a
# commit message or a grep pattern can never trigger it. That is why this hook
# needs none of the false-positive machinery the push guard carries — verified
# against `echo "rm -rf /tmp/x"`, `grep -n "mkdir" f`, `git log --grep=commit`,
# `echo "git commit"`. See harness-guard-followups §C for why the two hooks
# deliberately do NOT share detection code.
#
# The env-assignment value accepts quoted forms because `GIT_SSH_COMMAND="ssh -i
# key" git commit` is an ordinary shape, and a bare `\S+` stops at the space
# inside the quotes — the real command then looks like it starts with `key"` and
# the nudge is silently lost. The three alternatives are kept disjoint on the
# first character (`'`, `"`, neither) so exactly one can ever apply.
#
# That disjointness is clarity, not a measured fix: the ambiguous form was timed
# too, and it is also linear here (`A="a b" ` ×24 + a failing tail: both under a
# microsecond). Unlike the push guard's `_MESSAGE_ARG` ReDoS, every repetition is
# pinned by `^` and a mandatory `IDENT=`, which leaves the engine no partition to
# explore. Said plainly because the opposite claim — "this shape is dangerous" —
# would be the same unmeasured assertion that put item §C on the backlog.
#
# NOTE: `guard_review_before_push.py` carries a near-identical env-prefix group
# in `_GIT_PUSH`/`_SEGMENT_IS_GIT` and still has the `\S+` form — where it
# bypasses a BLOCKING gate rather than losing a nudge. Tracked separately as
# harness-guard-followups §J; keep the two in view when either changes.
_MUTATING = re.compile(
    r"""
    ^\s*(?:[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|"[^"]*"|[^\s'"]\S*)\s+)*(?:
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


# Command separators. The anchored pattern above only ever sees the first token,
# so `git add -A && git commit -m "x"` used to slip past entirely — and chained
# commands are the common shape, which made this hook miss precisely the moment
# it exists to catch ("surface the worktree decision EARLY"). Splitting first
# keeps the per-command conservatism while covering every command in the chain.
#
# The split is naive about quoting, so it opens TWO false-positive classes, both
# pinned in `AcknowledgedFalsePositiveTest`: a quoted separator (`echo "a && rm
# -rf x"`) and a heredoc/multi-line body whose line happens to start with a
# mutating verb (`cat <<'EOF'` … `mkdir the new folder` … `EOF`). Newlines must
# stay separators regardless — multi-line commands are how chained git work is
# actually written here — and both classes are an acceptable trade *here and
# nowhere else*: this hook never blocks, fires at most once per session, and only
# ever while you are already on the default branch, where the reminder is apt
# anyway. `guard_review_before_push.py` splits the same way but for the opposite
# reason (there, a late boundary can only refuse to release — the safe direction).
_SEGMENT_SPLIT = re.compile(r"&&|\|\||[;|&\n]")


def _is_mutating(command: str) -> bool:
    if not command:
        return False
    return any(
        _MUTATING.search(segment) for segment in _SEGMENT_SPLIT.split(command)
    )


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
