#!/usr/bin/env python3
"""Stop hook — block the turn from ending while the branch carries
`codebase/**` changes not yet covered by a *resolved* AI code review.

Registered in `.claude/settings.json` under `Stop`. This is the soft-teeth
counterpart to guard_review_before_push.py: it catches the "review/fix 를
다음 턴으로 미룸" failure mode at turn-end, before the push gate ever comes
into play.

Stop-hook contract (Claude Code):
  stdout JSON `{"decision":"block","reason":"..."}` → block stopping; `reason`
    is shown to the model as the instruction to continue.
  exit 0 with no decision → allow the turn to end.
  Any internal error → allow (fail-open; a guard must never wedge a session).

Anti-wedge: this guard never loops.
  1. If `stop_hook_active` is set (the model is already continuing from a prior
     stop-block), allow immediately — a hard loop-break.
  2. Otherwise it nudges AT MOST ONCE per (session_id, HEAD sha). After firing
     it writes a marker under `.claude/state/review_stop_nudged/` (gitignored);
     the same HEAD will not be blocked again. New commits → new HEAD → re-armed.

The hard gate remains guard_review_before_push.py: even if the model stops
after this single nudge, it cannot push/ship the branch unreviewed. Override
with `BYPASS_REVIEW_GUARD=1`.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import traceback

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(THIS_DIR, "_lib"))

try:
    from review_guard import evaluate_review  # noqa: E402
except Exception:
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


def _head_sha() -> str:
    try:
        p = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=5.0,
        )
        if p.returncode == 0:
            return p.stdout.strip() or "nohead"
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass
    return "nohead"


def _state_dir() -> str:
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    return os.path.join(project_dir, ".claude", "state", "review_stop_nudged")


def _marker_path(session_id: str | None, head: str) -> str | None:
    if not session_id:
        return None
    return os.path.join(_state_dir(), f"{session_id}__{head}")


def _already_nudged(marker: str | None) -> bool:
    return bool(marker) and os.path.exists(marker)  # type: ignore[arg-type]


def _mark_nudged(marker: str | None) -> None:
    if not marker:
        return
    try:
        os.makedirs(os.path.dirname(marker), exist_ok=True)
        with open(marker, "w") as f:
            f.write("")
    except OSError:
        pass


def _allow() -> int:
    # No decision → the turn is allowed to end.
    return 0


def main() -> int:
    if os.environ.get("BYPASS_REVIEW_GUARD") == "1":
        return _allow()

    payload = _read_payload()

    # Hard loop-break: never block a stop that is itself a continuation.
    if payload.get("stop_hook_active"):
        return _allow()

    try:
        decision = evaluate_review()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        return _allow()

    if not decision.blocked:
        return _allow()

    session_id = payload.get("session_id") or payload.get("sessionId")
    marker = _marker_path(session_id, _head_sha())
    if _already_nudged(marker):
        return _allow()  # one nudge per (session, HEAD) — push guard still gates.

    _mark_nudged(marker)

    reason = (
        "구현을 완료하면 test·review·critical/warning fix 는 강제 사항입니다. "
        f"({decision.reason}) 턴을 끝내기 전에 REVIEW WORKFLOW 를 이행하세요:\n"
        "  1. /ai-review — 변경에 대한 리뷰.\n"
        "  2. SUMMARY 의 Critical/Warning > 0 이면 resolution-applier 로 fix "
        "(또는 수동 조치 + RESOLUTION.md).\n"
        "  3. TEST WORKFLOW 재수행.\n"
        "리뷰를 다음 턴/PR 로 미루지 마세요. 정말 지금 멈춰야 하는 사정이 "
        "있으면 사용자에게 그 사정을 먼저 보고하세요. (이 nudge 는 현재 HEAD "
        "기준 1회만 표시됩니다.)"
    )
    print(json.dumps({"decision": "block", "reason": reason}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
