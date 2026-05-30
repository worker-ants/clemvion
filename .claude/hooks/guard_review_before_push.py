#!/usr/bin/env python3
"""PreToolUse hook — block `git push` when the branch carries `codebase/**`
changes that have NOT been covered by a *resolved* AI code review.

Registered in `.claude/settings.json` for the `Bash` matcher. This is the hard
gate for the "review/fix 를 PR 로 미룸" failure mode: you cannot ship the branch
(push → PR) while code changes remain unreviewed or while a review left
Critical/Warning items unresolved.

Contract (same as guard_default_branch_edit.py):
  exit 0 → allow the tool call.
  exit 2 → block; stderr is shown to Claude as the refusal reason.
  any other → treated as runtime error; tool call proceeds (fail-open).

Only `git push` commands are inspected; every other Bash command passes
through untouched. The review-coverage judgment lives in
`_lib/review_guard.py`. Override with `BYPASS_REVIEW_GUARD=1` for a conscious
one-off (e.g. a docs/spec-only branch the heuristic misjudged, or pushing a WIP
branch you will review before opening the PR).
"""

from __future__ import annotations

import json
import os
import re
import sys
import traceback

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(THIS_DIR, "_lib"))

try:
    from review_guard import evaluate_review  # noqa: E402
except Exception:
    traceback.print_exc(file=sys.stderr)
    sys.exit(0)


# Match `git push` as the first meaningful git subcommand. Tolerates leading
# env assignments and `git -C <dir> push`, and compound commands where a push
# appears after `&&` / `;` / `|`.
_GIT_PUSH = re.compile(
    r"(?:^|&&|;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\b[^&;|]*\bpush\b"
)


def _read_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _is_git_push(command: str) -> bool:
    if not command or "push" not in command:
        return False
    return bool(_GIT_PUSH.search(command))


def main() -> int:
    if os.environ.get("BYPASS_REVIEW_GUARD") == "1":
        return 0

    payload = _read_payload()
    tool_input = payload.get("tool_input") or payload.get("input") or {}
    command = tool_input.get("command") or ""

    if not _is_git_push(command):
        return 0  # not a push — nothing to enforce.

    try:
        decision = evaluate_review()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        return 0  # fail open on internal error

    if not decision.blocked:
        return 0

    msg = (
        "BLOCKED by .claude/hooks/guard_review_before_push.py\n"
        f"  attempted: git push\n"
        f"  reason:    {decision.reason}\n"
        "\n"
        "구현을 완료하면 test·review·critical/warning fix 는 강제 사항입니다.\n"
        "이 branch 는 codebase/ 변경을 담고 있지만, 그것을 커버하는 *해결된*\n"
        "코드 리뷰가 없습니다. PR 로 미루지 말고 지금 끝내세요:\n"
        "\n"
        "  1. /ai-review  — 변경에 대한 리뷰 (REVIEW WORKFLOW)\n"
        "  2. SUMMARY 의 Critical/Warning > 0 이면 resolution-applier 로 fix\n"
        "     (또는 수동 조치 + review/code/<...>/RESOLUTION.md 기록)\n"
        "  3. TEST WORKFLOW 재수행 후 다시 push\n"
        "\n"
        "리뷰가 깨끗(전체 위험도 NONE/LOW, Critical·Warning 0)하면 SUMMARY.md\n"
        "만으로 통과합니다. Critical/Warning 이 있었다면 같은 세션 디렉토리에\n"
        "RESOLUTION.md 가 있어야 '해결됨' 으로 인정됩니다.\n"
        "\n"
        "의식적 우회 (docs/spec-only branch 오판 등 드문 경우):\n"
        "  BYPASS_REVIEW_GUARD=1\n"
    )
    print(msg, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
