"""Does a consistency SUMMARY's `BLOCK:` verdict match what the checkers said?

`consistency-summary.md` §요약 지침 3 forbids downgrading a checker's
`[CRITICAL]` during integration, and §4 says a Critical whose root cause is
outside the caller's authority goes on the §planner 인계 table with `BLOCK: YES`
intact. Until now that rule lived only in the agent's prompt: `review_guard`
parses one `BLOCK:` line and never compares it against the reports beside it, so
a downgrade passed the gate silently — which is what happened in
`review/code/2026/07/25/22_58_00` and prompted the rule.

**Measured before writing this** (732 consistency sessions on `origin/main`):

  일치                        698
  BLOCK: NO 인데 [CRITICAL] 有  24   ← 3.3%
  BLOCK: YES 인데 [CRITICAL] 無  10   ← tagged differently, not a downgrade

The 24 are real, not parser noise. Their summaries say so themselves —
"checker 자동판정 YES 의 Critical 2건은…", "Critical 발견이 있으나 구현 즉시
차단이 아닌…". So this is a recurring practice, and a warning here is worth its
false-positive budget.

**Why it warns instead of blocking.** A summary legitimately merges duplicate
findings and may raise severity; only lowering is forbidden. Turning that into a
hard block would refuse sessions the rule permits, and the failure mode this
addresses is silence, not malice — the discretion was being exercised in the
open, just where nothing read it. Making it visible is the fix.
"""

from __future__ import annotations

import os
import re

# The finding tag every checker is told to emit: `- **[CRITICAL]** 제목` or
# `### [CRITICAL] 제목`. Bare "CRITICAL" is NOT counted: measured across 400
# reports it appears 242 times, nearly all prose ("CRITICAL 없음", the
# NONE/LOW/…/CRITICAL risk scale), against 72 real tags. Counting it would make
# every clean report look like a downgrade, and a backstop that cries wolf is
# one nobody reads.
_CRITICAL_TAG = re.compile(r"\[CRITICAL\]")

_BLOCK_LINE = re.compile(r"BLOCK:\s*(YES|NO)", re.IGNORECASE)

CHECKER_REPORTS = (
    "cross_spec.md",
    "rationale_continuity.md",
    "convention_compliance.md",
    "plan_coherence.md",
    "naming_collision.md",
)


def count_critical_tags(text: str) -> int:
    """How many `[CRITICAL]` finding tags a checker report carries."""
    return len(_CRITICAL_TAG.findall(text))


def _read(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return ""


def summary_block_verdict(summary_text: str) -> str | None:
    """`"YES"` / `"NO"` from the SUMMARY's `BLOCK:` line, or None if absent."""
    m = _BLOCK_LINE.search(summary_text)
    return m.group(1).upper() if m else None


def downgraded_criticals(session_dir: str) -> dict[str, int]:
    """Checkers that tagged a `[CRITICAL]` while the SUMMARY says `BLOCK: NO`.

    Empty when the session agrees, when there is no SUMMARY, or when the SUMMARY
    blocks — all three are "nothing to report", and the caller should not have to
    tell them apart to decide whether to warn.
    """
    summary = _read(os.path.join(session_dir, "SUMMARY.md"))
    if not summary or summary_block_verdict(summary) != "NO":
        return {}
    found = {}
    for name in CHECKER_REPORTS:
        n = count_critical_tags(_read(os.path.join(session_dir, name)))
        if n:
            found[name] = n
    return found


def contradiction_note(session_dir: str) -> str:
    """One-line description of the contradiction, or "" when there is none."""
    found = downgraded_criticals(session_dir)
    if not found:
        return ""
    parts = ", ".join(f"{k.removesuffix('.md')}={v}" for k, v in sorted(found.items()))
    return (
        f"SUMMARY 는 BLOCK: NO 인데 checker 가 [CRITICAL] 을 냈습니다 ({parts}) — "
        "하향은 규약 위반입니다(consistency-summary.md §요약 지침 3). 권한 밖이면 "
        "§planner 인계 표를 채우고 BLOCK: YES 를 유지하세요"
    )
