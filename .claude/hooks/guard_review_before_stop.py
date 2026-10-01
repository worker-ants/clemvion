#!/usr/bin/env python3
"""Stop hook — nudge once at turn-end when the linked in-progress plan is
fully checked off but still sits in `plan/in-progress/`.

Registered in `.claude/settings.json` under `Stop`.

It used to carry a second nudge — "codebase/ changes not covered by a resolved
review" — read from `review/**` files. NERV cutover stage 2 (NERV Task
`CLE-T-4ABTG7`) removed it: the review record now lives in NERV, the push gate
and the CI backstop read it there (`_lib/review_guard.py`), and the NERV
plugin's own Stop hook already blocks a turn-end once while a claim is open.
Two hooks nudging for the same thing was the double-block the cutover plan
(§5.4) set out to remove. The plan nudge goes with `plan/` in stage 3.

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

Override with `BYPASS_PLAN_GUARD=1`.
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


# Imported best-effort: a Stop hook must never wedge a session.
_PLAN_IMPORT_ERROR = ""

# Same three fail-open paths as the push gate, and until now equally silent.
# Shared with it via _lib so the counting/reset rules cannot drift apart; the
# import is guarded because losing the module must cost the counter, not the
# signal.
try:
    import failopen_state  # noqa: E402
except Exception:  # noqa: BLE001
    failopen_state = None

try:
    from plan_guard import evaluate_plan  # noqa: E402
except Exception as exc:  # noqa: BLE001
    _PLAN_IMPORT_ERROR = f"{type(exc).__name__}: {exc}"
    evaluate_plan = None  # plan nudge disabled — counted as fail-open below.


_FAILOPEN_STATE_NAME = "stop_guard_failopen.json"
_GATE_PLAN = "PLAN"
# Every gate that must answer before the fail-open streak may be cleared. The
# REVIEW gate left with stage 2; keeping it here would make "all answered"
# unreachable and pin the streak forever (failopen_state.report compares sets).
_ALL_GATES = frozenset({_GATE_PLAN})


def _new_outcome():
    if failopen_state is not None:
        return failopen_state.Outcome()

    class _Fallback:
        def __init__(self) -> None:
            self.answered: list = []
            self.bypassed: list = []
            self.degraded: list = []
            # Unused by this hook (its advisories print straight from the
            # decision), but present so every Outcome shape in the tree carries
            # the same fields — the push side already diverged once by having it
            # on only one of its two.
            self.notes: list = []

    return _Fallback()


def _import_reason(module: str, symbol: str, error: str) -> str:
    if failopen_state is not None:
        return failopen_state.import_failure_reason(module, symbol, error)
    return (f"{module} failed to import — {error}" if error
            else f"{module} imported but {symbol} is None")


def _report_fail_open(outcome) -> None:
    """Always stderr, unlike the push gate.

    A Stop hook's STDOUT is its protocol — `{"decision": "block", ...}` — so a
    banner there would corrupt the payload the harness parses. That is why the
    stream is the caller's choice in `failopen_state.report` rather than being
    derived from an exit code inside it.
    """
    if failopen_state is None:
        try:
            if outcome.degraded:
                print("\n⚠️  stop guard: 게이트가 판정하지 못했습니다 (fail-open). "
                      "[_lib/failopen_state.py 부재 — 연속 횟수 미집계]",
                      file=sys.stderr)
                for gate, reason in outcome.degraded:
                    print(f"      {gate} gate — {reason}", file=sys.stderr)
        except Exception:  # noqa: BLE001
            pass
        return
    failopen_state.report(
        outcome,
        state_name=_FAILOPEN_STATE_NAME,
        label="stop guard",
        subject="이 턴",
        all_gates=_ALL_GATES,
        stream=sys.stderr,
    )


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
    # `kind` separates independent nudges so firing one never throttles another.
    # The empty kind was the retired review nudge's marker name; nothing passes it now.
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


def main() -> int:
    # `finally` so the report happens on every exit path, including the one that
    # fires the nudge.
    outcome = _new_outcome()
    try:
        return _run(outcome)
    except Exception as exc:  # noqa: BLE001
        # Fail-open #3: anything unhandled above — payload read, throttle token,
        # marker I/O. The harness treats a non-zero exit as "allow" anyway, so
        # the session was never wedged; what was missing is that nothing
        # recorded the nudge had stopped working. Same outcome, now counted.
        traceback.print_exc(file=sys.stderr)
        outcome.degraded.append(("MAIN", f"{type(exc).__name__}: {exc}"))
        return _allow()
    finally:
        _report_fail_open(outcome)


def _run(outcome) -> int:
    payload = _read_payload()

    # Hard loop-break: never block a stop that is itself a continuation.
    if payload.get("stop_hook_active"):
        return _allow()

    session_id = payload.get("session_id") or payload.get("sessionId")
    token = _throttle_token()

    # ---- PLAN-COMPLETE nudge (move a finished plan to plan/complete/) -------
    if os.environ.get("BYPASS_PLAN_GUARD") == "1":
        outcome.bypassed.append(_GATE_PLAN)
        plan = None
    elif evaluate_plan is None:
        outcome.degraded.append((_GATE_PLAN, _import_reason(
            "_lib/plan_guard.py", "evaluate_plan", _PLAN_IMPORT_ERROR)))
        plan = None
    else:
        try:
            plan = evaluate_plan()
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc(file=sys.stderr)
            outcome.degraded.append((_GATE_PLAN, f"{type(exc).__name__}: {exc}"))
            plan = None
        else:
            outcome.answered.append(_GATE_PLAN)
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
