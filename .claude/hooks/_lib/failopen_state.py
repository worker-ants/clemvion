"""Shared fail-open reporting for the review/plan guards.

Extracted verbatim (behaviour-preserving) from `guard_review_before_push.py`,
where this logic landed with PR #999 as harness-guard-followups §E. It moved
here the moment a *second* hook needed it: `guard_review_before_stop.py` has the
same three fail-open paths and was still silent about all of them. Copying ~120
lines of carefully-reasoned reporting into a second file is the duplication
class this repo keeps getting bitten by, and the push hook's 35 subprocess tests
are the safety net that made the move checkable.

Two things differ per hook and are therefore parameters, not assumptions:

* **Which stream the banner goes to.** The push hook picks by exit code — on
  exit 2 the harness reads stderr, on exit 0 it injects stdout. The Stop hook
  cannot do that: its stdout carries the `{"decision": ...}` JSON protocol, so a
  banner there would corrupt the payload. It always reports on stderr.
* **The state file and wording**, so one hook's streak never resets the other's.

Nothing here may ever raise into a guard: observability that breaks the thing it
observes is worse than no observability.
"""

from __future__ import annotations

import json
import os
import sys
import traceback

# Two in a row can still be one bad afternoon (a half-applied edit, a stale
# import). Three consecutive runs with a gate unable to answer is a state
# somebody has been living with, which is the thing worth shouting about.
ESCALATE_AT = 3


class Outcome:
    """What each gate actually did on this run.

    answered — ran and produced a verdict (blocking or not).
    bypassed — deliberately skipped via BYPASS_*; NOT degradation.
    degraded — could NOT answer (import failure, or evaluate_*() raised). The
               distinction from `bypassed` is the whole point: mixing a
               conscious override into the counter buries the real signal.
    """

    def __init__(self) -> None:
        self.answered: list[str] = []
        self.bypassed: list[str] = []
        self.degraded: list[tuple[str, str]] = []


def state_path(state_name: str) -> str:
    """Where a hook's consecutive-fail-open counter lives (gitignored)."""
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    return os.path.join(project_dir, ".claude", "state", state_name)


def read_streak(state_name: str) -> int:
    """Current streak, or 0 if the file is absent/corrupt (self-healing)."""
    try:
        with open(state_path(state_name), encoding="utf-8") as fh:
            value = json.load(fh).get("streak")
        return value if isinstance(value, int) and value > 0 else 0
    except Exception:
        return 0


def write_streak(state_name: str, streak: int, degraded: list) -> None:
    """Persist the streak plus which gates degraded, for the next run to read."""
    path = state_path(state_name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "streak": streak,
                "gates": [{"gate": g, "reason": r} for g, r in degraded],
            },
            fh,
        )


def report(
    outcome: Outcome,
    *,
    state_name: str,
    label: str,
    subject: str,
    all_gates: frozenset,
    stream,
) -> None:
    """Announce (and count) any gate that could not answer.

    Reset rule — the counter measures CONSECUTIVE degradation, so clearing it
    takes positive evidence that EVERY gate is working: a run where all of
    `all_gates` actually answered. Anything less leaves the streak alone.

    This predicate has been wrong twice, both times by accepting weaker
    evidence than "all of them answered":
      * v1 reset whenever `degraded` was empty — so a BYPASS_* skip cleared it.
      * v2 reset whenever *any* gate answered — but a REVIEW block returns
        before the PLAN gate runs at all, so a perfectly ordinary blocked push
        wiped a PLAN streak with no warning (and REVIEW blocking is this hook's
        most common event, so the escalation would essentially never fire).
    Hence the explicit set comparison rather than a truthiness test.

    Known residual (accepted): the read-increment-write of the streak is not
    locked, so two overlapping runs can lose one increment and delay the
    escalation by one. The banner is emitted BEFORE the write precisely so that
    the primary signal cannot be lost to a failed or racing write; only the
    running count can. Not worth `fcntl.flock` for an observability counter.
    """
    try:
        degraded = outcome.degraded
        if not degraded:
            if outcome.bypassed or set(outcome.answered) != all_gates:
                return  # not full proof of health — leave the counter untouched.
            try:
                os.remove(state_path(state_name))
            except FileNotFoundError:
                pass
            return

        streak = read_streak(state_name) + 1

        lines = [
            "",
            f"⚠️  {label}: 게이트가 판정하지 못하고 통과시켰습니다 (fail-open).",
        ]
        for gate, reason in degraded:
            lines.append(f"      {gate} gate — {reason}")
        lines += [
            "",
            f"    {subject} 는 해당 검사를 **받지 않았습니다**. 통과했다는 사실이",
            "    리뷰/plan 이 갖춰졌다는 근거가 되지 못합니다.",
            f"    연속 fail-open: {streak}회",
        ]
        if streak >= ESCALATE_AT:
            lines += [
                "",
                f"    ‼️  {streak}회 연속입니다 — 이 게이트는 사실상 꺼져 있습니다.",
                "        일시적 오류가 아니라 가드 자체를 고쳐야 합니다.",
            ]
        lines.append("")
        print("\n".join(lines), file=stream)

        # Persist LAST. An earlier version wrote first, so when the state
        # directory was unwritable the exception skipped the print entirely and
        # the run went through in total silence — the failure mode this whole
        # mechanism exists to prevent, in the mechanism itself.
        try:
            write_streak(state_name, streak, degraded)
        except Exception:
            traceback.print_exc(file=sys.stderr)
    except Exception:
        # Never let reporting break the guard.
        pass


def import_failure_reason(module: str, symbol: str, error: str) -> str:
    """Why a gate symbol is `None`, said accurately.

    The original text asserted "failed to import" for *any* None symbol. That is
    a guess: a module can import cleanly and still bind the symbol to None (which
    is exactly how tests disable a gate), and the state file then recorded a
    reason that never happened. Reporting it is right — a None gate genuinely did
    not answer — but the reason has to be true, and the real exception text is
    more useful than a generic string.
    """
    if error:
        return f"{module} failed to import — {error}"
    return f"{module} imported but {symbol} is None"
