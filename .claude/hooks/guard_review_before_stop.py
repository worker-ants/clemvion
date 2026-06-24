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
  2. Otherwise it nudges AT MOST ONCE per (session_id, branch). After firing
     it writes a marker under `.claude/state/review_stop_nudged/` (gitignored);
     the same branch will not be nudged again in this session. Keying on the
     branch (not HEAD) avoids re-arming the nudge on every new commit.

The hard gate remains guard_review_before_push.py: even if the model stops
after this single nudge, it cannot push/ship the branch unreviewed. Override
with `BYPASS_REVIEW_GUARD=1`.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import traceback

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(THIS_DIR, "_lib"))

# Characters allowed verbatim in a marker filename component; everything else
# (`/`, `..`, whitespace, …) is collapsed to `_` so an unexpected session_id /
# branch token can never escape the state dir into another path.
_MARKER_SAFE = re.compile(r"[^A-Za-z0-9._-]")


def _sanitize_component(value: str) -> str:
    return _MARKER_SAFE.sub("_", value)


# Both nudges are imported independently and best-effort: a failure to import one
# must not silence the other (a Stop hook must never wedge a session either way).
try:
    from review_guard import evaluate_review  # noqa: E402
except Exception:
    traceback.print_exc(file=sys.stderr)
    evaluate_review = None  # review nudge disabled; plan nudge still runs.

# Resolution-in-flight suppression + nudge-text branching helpers. Imported
# separately so a failure here only disables the *suppression/branching* (the
# core review nudge still fires), never the other way round.
try:
    from review_guard import (  # noqa: E402
        _resolution_in_flight,
        _repo_root,
        _iter_summaries,
    )
except Exception:
    _resolution_in_flight = None
    _repo_root = None
    _iter_summaries = None

try:
    from plan_guard import evaluate_plan  # noqa: E402
except Exception:
    evaluate_plan = None  # plan nudge disabled; review nudge still runs.


def _read_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _throttle_token() -> str:
    """Per-(session, *branch*) throttle key — NOT per-commit.

    The nudge fires at most once per this token. Keying on the branch (not HEAD
    sha) means a multi-commit session is nudged once, not re-armed on every new
    commit ("commit → block → fix → commit → block …" was the firing amplifier).
    Falls back to the short HEAD sha on a detached HEAD, and to "norepo" when git
    is unavailable."""
    try:
        p = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=5.0,
        )
        if p.returncode == 0:
            ref = p.stdout.strip()
            if ref and ref != "HEAD":
                return ref.replace("/", "-")  # slashes are path separators
        # Detached HEAD (ref == "HEAD") → fall back to the commit sha.
        p = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=5.0,
        )
        if p.returncode == 0 and p.stdout.strip():
            return p.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass
    return "norepo"


def _state_dir() -> str:
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    return os.path.join(project_dir, ".claude", "state", "review_stop_nudged")


def _marker_path(session_id: str | None, token: str, kind: str = "") -> str:
    # A missing session_id must NOT disable the throttle (that would nudge on
    # every stop). Fall back to a stable sentinel so the once-per-branch marker
    # is still written; the worst case is throttling slightly across sessions,
    # which is the safe direction (the push guard is the hard gate). Both
    # components are sanitized — session_id comes from the harness payload and
    # the token from `git`, so neither is trusted to stay inside the state dir.
    # `kind` separates independent nudges (review vs plan-complete) so firing one
    # never throttles the other; empty kind keeps the original review marker name.
    sid = _sanitize_component(session_id or "nosession")
    base = f"{sid}__{_sanitize_component(token)}"
    if kind:
        base += f"__{_sanitize_component(kind)}"
    return os.path.join(_state_dir(), base)


def _already_nudged(marker: str) -> bool:
    return os.path.exists(marker)


def _mark_nudged(marker: str) -> None:
    try:
        os.makedirs(os.path.dirname(marker), exist_ok=True)
        with open(marker, "w") as f:
            f.write("")
    except OSError:
        pass


def _allow() -> int:
    # No decision → the turn is allowed to end.
    return 0


def _block(reason: str) -> int:
    print(json.dumps({"decision": "block", "reason": reason}))
    return 0


def _nudge_once(session_id: str | None, token: str, kind: str, reason: str) -> int | None:
    """Emit a one-shot block nudge keyed by (session, branch, kind).

    Returns the block exit code on the first firing, or None when this nudge has
    already fired (caller should fall through to the next check / allow)."""
    marker = _marker_path(session_id, token, kind)
    if _already_nudged(marker):
        return None
    _mark_nudged(marker)
    return _block(reason)


def _suppress_for_resolution() -> bool:
    """True when a `resolution-applier` fix is in flight → skip the review nudge.

    Stop-only suppression: once `/ai-review` writes SUMMARY.md the applier's
    codebase edits postdate the review and re-arm the gate, but the fix is
    legitimately in progress — nudging then just goads a premature, redundant
    re-review over work the background sub-agent is already doing. The push guard
    still hard-gates (it never consults this). Fail-open: any error → False."""
    if _resolution_in_flight is None or _repo_root is None:
        return False
    try:
        repo_root = _repo_root(os.getcwd())
        return bool(repo_root) and bool(_resolution_in_flight(repo_root))
    except Exception:
        traceback.print_exc(file=sys.stderr)
        return False


def _review_was_performed() -> bool:
    """True when ≥1 review SUMMARY exists (a review ran) — picks the nudge
    wording. Fail-open: any error → False (use the 'run /ai-review' wording)."""
    if _iter_summaries is None or _repo_root is None:
        return False
    try:
        repo_root = _repo_root(os.getcwd())
        return bool(repo_root) and bool(_iter_summaries(repo_root))
    except Exception:
        return False


def _review_nudge_reason(decision_reason: str, review_done: bool) -> str:
    """The Stop nudge body. When a review already ran (`review_done`) we steer
    toward *resolution* (wait for resolution-applier / write RESOLUTION.md)
    instead of re-running `/ai-review` from scratch — that redundant re-review
    over an in-progress fix is the token-waste this whole change targets."""
    if review_done:
        return (
            "구현을 완료하면 test·review·critical/warning fix 는 강제 사항입니다. "
            f"({decision_reason}) 단, 리뷰(SUMMARY)는 이미 수행됐습니다 — 처음부터 "
            "/ai-review 를 다시 돌리지 마세요:\n"
            "  1. resolution-applier 가 진행 중이면 완료(SubagentStop)를 기다리세요.\n"
            "  2. 아니면 SUMMARY 의 Critical/Warning 을 fix + "
            "<session_dir>/RESOLUTION.md 작성(또는 수동 조치).\n"
            "  3. TEST WORKFLOW 재수행.\n"
            "리뷰/fix 를 다음 턴·PR 로 미루지 마세요. (이 nudge 는 현재 branch 기준 "
            "세션당 1회만 표시됩니다.)"
        )
    return (
        "구현을 완료하면 test·review·critical/warning fix 는 강제 사항입니다. "
        f"({decision_reason}) 턴을 끝내기 전에 REVIEW WORKFLOW 를 이행하세요:\n"
        "  1. /ai-review — 변경에 대한 리뷰.\n"
        "  2. SUMMARY 의 Critical/Warning > 0 이면 resolution-applier 로 fix "
        "(또는 수동 조치 + RESOLUTION.md).\n"
        "  3. TEST WORKFLOW 재수행.\n"
        "리뷰를 다음 턴/PR 로 미루지 마세요. 정말 지금 멈춰야 하는 사정이 "
        "있으면 사용자에게 그 사정을 먼저 보고하세요. (이 nudge 는 현재 branch "
        "기준 세션당 1회만 표시됩니다.)"
    )


def main() -> int:
    payload = _read_payload()

    # Hard loop-break: never block a stop that is itself a continuation.
    if payload.get("stop_hook_active"):
        return _allow()

    session_id = payload.get("session_id") or payload.get("sessionId")
    token = _throttle_token()

    # ---- REVIEW nudge (soft counterpart of the push review gate) -----------
    if evaluate_review is not None and os.environ.get("BYPASS_REVIEW_GUARD") != "1":
        try:
            decision = evaluate_review()
        except Exception:
            traceback.print_exc(file=sys.stderr)
            decision = None
        # Suppress while a resolution-applier fix is in flight (Stop only); fall
        # through to the plan nudge rather than returning, so an unrelated
        # plan-complete nudge can still fire.
        if (decision is not None and decision.blocked
                and not _suppress_for_resolution()):
            reason = _review_nudge_reason(decision.reason, _review_was_performed())
            fired = _nudge_once(session_id, token, "", reason)
            if fired is not None:
                return fired

    # ---- PLAN-COMPLETE nudge (move a finished plan to plan/complete/) -------
    if evaluate_plan is not None and os.environ.get("BYPASS_PLAN_GUARD") != "1":
        try:
            plan = evaluate_plan()
        except Exception:
            traceback.print_exc(file=sys.stderr)
            plan = None
        if plan is not None and plan.complete_but_in_progress:
            reason = (
                f"연결된 plan ({plan.plan_path}) 의 체크박스가 모두 완료([x])됐지만 "
                "아직 plan/in-progress/ 에 있습니다. 턴을 끝내기 전에 "
                "plan/complete/ 로 이동을 검토하세요 — 마지막 작업 PR 안에서 "
                "`chore(plan): mark <name> complete` 로 옮깁니다 (plan-lifecycle.md §3, "
                "별도 PR 분리 금지). 이동하면 push gate 의 'plan 미갱신' 차단도 함께 "
                "해소됩니다. 아직 후속 작업이 남았다면 무시해도 됩니다. "
                "(이 nudge 는 현재 branch 기준 세션당 1회만 표시됩니다.)"
            )
            fired = _nudge_once(session_id, token, "plan_complete", reason)
            if fired is not None:
                return fired

    return _allow()


if __name__ == "__main__":
    sys.exit(main())
