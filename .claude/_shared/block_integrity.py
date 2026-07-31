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

# The verdict, anchored — and order-independent.
#
# A plain first-match search is wrong here and was: summaries routinely narrate a
# *previous* session's verdict in prose, so `search()` returns whatever the
# retrospective mentions first. Measured over 732 committed summaries, four
# disagreed with their own template line — e.g.
# `review/consistency/2026/07/05/19_27_28` reads `BLOCK: YES` from
# "…(직전 19_19_53 BLOCK: YES 정정 후)" while its verdict is `## BLOCK: NO`.
#
# Two shapes carry a real verdict and prose carries neither:
#   * the template puts it at the START of a line — `**BLOCK: NO** — …`, `## BLOCK: NO`
#   * a human override banner puts it at the END — `> ## ✅ 최종 판정 (…): **BLOCK: NO**`
#   * prose mentions sit between other words, so neither anchor matches them
#
# The banner wins when both exist, *whichever comes first in the file*. Taking
# the leftmost anchored match instead read a superseded template line as the
# verdict whenever the banner sat below it — reproduced:
# `"**BLOCK: YES**(초기)\n\n> 최종 판정: **BLOCK: NO**\n"` returned YES.
# `[ \t…]`, NOT `[\s…]`. `\s` matches newlines, so with `re.MULTILINE` the class
# could run past the end of its own line and the engine retried that walk from
# every subsequent line start — quadratic. Measured on `("> " * 3 + "\n") * n`,
# which has no `BLOCK:` anywhere so every start position fails:
#
#     n_lines     1000     2000     4000     8000    16000
#     `\s`      0.027s   0.085s   0.331s   1.333s   5.375s   (×4 per doubling)
#     ` \t`     0.000s   0.000s   0.000s   0.001s   0.001s
#
# It matters because this runs on every push and every turn-end, over every
# session on disk, and a SUMMARY is LLM-written markdown with no enforced size.
# A length cap is deliberately NOT the fix: it cannot bound a quadratic pattern
# (256KB is still catastrophic), and this repo's own `_MAX_REDACTION_INPUT` note
# warns that a cap must never gate detection. The linear pattern is the fix; the
# regression test pins it.
#
# Behaviour is unchanged — `^` already anchors at the start of the line holding
# the verdict, so the class never needed to cross one. Verified against all 1,506
# committed SUMMARY files: 0 verdicts differ.
#
# The gap between "BLOCK:" and the verdict is ONE quantifier, `[ \t*]*`, and not
# the `\s*\**\s*` it used to be. That earlier form is a second, independent
# quadratic: two unbounded quantifiers separated only by a usually-empty one, so
# when the alternation never succeeds the engine re-splits the same run between
# them. It survived the fix above because that fix targeted the leading class,
# and it survived the regression test because that test used input with no
# `BLOCK:` in it at all — so the scan never reached this part of the pattern.
# Measured after the leading-class fix, on `"BLOCK:" + " " * n` (one line, no
# newlines anywhere, which is also why "it's a MULTILINE problem" missed it):
#
#     n           400      800     1600     3200     6400    12800
#     `\s*\**\s*`  0.002s  0.009s   0.037s   0.147s   0.589s   2.354s   (×4)
#     `[ \t*]*`    0.000s  0.000s   0.000s   0.000s   0.000s   0.000s
#
# `[ \t*]*` also drops newlines from the gap, which only tightens it: a verdict
# and its `BLOCK:` belong on one line. Verified across all 1,507 committed
# SUMMARY files: 0 verdicts differ.
_BLOCK_AT_LINE_START = re.compile(
    r"^[ \t>#*_`-]*BLOCK:[ \t*]*(YES|NO)", re.IGNORECASE | re.MULTILINE
)
_BLOCK_AT_LINE_END = re.compile(
    r"BLOCK:[ \t*]*(YES|NO)[ \t*]*$", re.IGNORECASE | re.MULTILINE
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

    What actually separates a real verdict from a superseded one is the **end
    anchor**, not position: the observed override case
    (`review/consistency/2026/07/17/00_17_40`) puts its final verdict at the
    *top*, on a decorated line ending in the verdict, while the stale template
    line below it trails explanatory text and so fails the anchor.

    Among several *equally* end-anchored verdicts the anchor cannot choose, and
    there the **last** wins — later text supersedes earlier. That tiebreak is a
    judgement call, not something the corpus demonstrates. What the corpus does
    show, measured across all 1,504 committed SUMMARY files before the change:
    2 documents carry more than one end-anchored verdict and neither flips. So
    this removes an ambiguity rather than changing any real verdict.
    """
    matches = list(_BLOCK_AT_LINE_END.finditer(summary_text))
    if not matches:
        matches = list(_BLOCK_AT_LINE_START.finditer(summary_text))
    return matches[-1].group(1).upper() if matches else None


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
    # Not `removesuffix`: it needs Python 3.9 and would be this tree's first use,
    # silently raising the harness's minimum. On an older `python3` the
    # AttributeError does not merely drop this advisory — the caller's broad
    # `except Exception` fails the REVIEW gate open for that push entirely.
    parts = ", ".join(
        f"{k[:-3] if k.endswith('.md') else k}={v}" for k, v in sorted(found.items())
    )
    return (
        f"SUMMARY 는 BLOCK: NO 인데 checker 가 [CRITICAL] 을 냈습니다 ({parts}) — "
        "하향은 규약 위반입니다(consistency-summary.md §요약 지침 3). 권한 밖이면 "
        "§planner 인계 표를 채우고 BLOCK: YES 를 유지하세요"
    )
