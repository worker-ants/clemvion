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

# The verdict, anchored. A plain first-match search is wrong here and was:
# summaries routinely narrate a *previous* session's verdict in prose, so
# `search()` returns whatever the retrospective mentions first. Measured over
# 732 committed summaries, four disagreed with their own template line — e.g.
# `review/consistency/2026/07/05/19_27_28` reads `BLOCK: YES` from
# "…(직전 19_19_53 BLOCK: YES 정정 후)" while its actual verdict is `## BLOCK: NO`.
#
# The template puts the verdict at the START of its line (`**BLOCK: NO** — …`,
# `## BLOCK: NO`); a human override banner puts it at the END
# (`> ## ✅ 최종 판정 (…): **BLOCK: NO**`). Prose mentions sit mid-line, between
# other words. Accepting only line-start or line-end classifies all four
# correctly — line-start alone got three right and made the fourth worse.
_BLOCK_LINE = re.compile(
    r"^[\s>#*_`-]*BLOCK:\s*\**\s*(YES|NO)"      # template: line start
    r"|BLOCK:\s*\**\s*(YES|NO)\**\s*$",          # override banner: line end
    re.IGNORECASE | re.MULTILINE,
)

# The canonical checker list. It lives here rather than in the orchestrator
# because this module is the one that must never miss a checker: a name added
# there and forgotten here would let that checker's downgrade pass unnoticed —
# the exact failure this file exists to catch, reproduced one level up. The
# orchestrator derives `ALL_CHECKERS` from it, so there is one place to edit.
ALL_CHECKERS = (
    "cross_spec",
    "rationale_continuity",
    "convention_compliance",
    "plan_coherence",
    "naming_collision",
)

CHECKER_REPORTS = tuple(f"{name}.md" for name in ALL_CHECKERS)


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
    """`"YES"` / `"NO"` from the SUMMARY's verdict line, or None if absent.

    The single parser for this question — `review_guard._summary_block_is_no`
    delegates here. Two copies of a `BLOCK:` regex is the "Change both" shape
    this branch is elsewhere removing, and it would have been created in the
    same diff.
    """
    m = _BLOCK_LINE.search(summary_text)
    if not m:
        return None
    return (m.group(1) or m.group(2)).upper()


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
