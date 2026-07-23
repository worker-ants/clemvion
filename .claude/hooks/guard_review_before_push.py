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
through untouched. Two independent gates run, each with its own override:
  - REVIEW gate (`_lib/review_guard.py`) — unreviewed `codebase/**` changes.
    Override: `BYPASS_REVIEW_GUARD=1`.
  - PLAN gate (`_lib/plan_guard.py`) — the linked in-progress plan was neither
    updated nor moved to plan/complete/ before the push ("PR 전 plan 갱신/이동"
    rule). Override: `BYPASS_PLAN_GUARD=1`.
Each override is a conscious one-off (e.g. a docs/spec-only branch the heuristic
misjudged, or ad-hoc work the plan link mis-resolved).
"""

from __future__ import annotations

import json
import os
import re
import sys
import traceback

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(THIS_DIR, "_lib"))

# Both gates are imported independently and best-effort: a failure to import one
# (e.g. a syntax error introduced in that module) must not silence the other.
try:
    from review_guard import evaluate_review  # noqa: E402
except Exception:
    traceback.print_exc(file=sys.stderr)
    evaluate_review = None  # review gate disabled; plan gate still runs.

try:
    from plan_guard import evaluate_plan  # noqa: E402
except Exception:
    evaluate_plan = None  # plan gate disabled; review gate still runs.


# ---------------------------------------------------------------------------
# Push detection = BLIND first pass + an enumerated allowlist of releases.
#
# FIRST PASS (this regex) is deliberately ignorant: it scans raw text for
# `git … push` in any spelling. That ignorance is the point — it has no false
# NEGATIVES that a shell-aware parser would introduce. A 2026-07-17 rewrite
# that determined the git *subcommand* with shlex was REVERTED after /ai-review
# found a new false-negative class every round (`git $'push'`, `git $"push"`,
# backticks, `bash -c "… && git push"`, quote splitting …): the shell's
# text-transforming features are an UNBOUNDED surface, whereas this regex's
# defect (false POSITIVES) is a finite, enumerable one. Do not "improve" this
# regex into a parser — that trade goes the wrong way.
# SoR: plan/in-progress/harness-push-guard-subcommand-detection.md
#
# DO NOT EDIT this pattern. Releases belong in _redact_inert_text() below, which
# is the bounded half of the design. test_push_guard_allowlist.py pins this
# exact source string as the differential baseline.
_GIT_PUSH = re.compile(
    r"(?:^|&&|;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\b[^&;|]*\bpush\b"
)

# Anything the shell expands makes a text region LIVE: a `push` inside one can
# actually execute. `git commit -m "$(git push)"` really does push (round-2
# regression), so a region containing these is never released.
_LIVE_EXPANSION = ("$(", "`", "${")

# A backslash-escaped pipe is a literal `|` character, never a pipe OPERATOR —
# in or out of quotes. The first pass treats it as a command separator, which is
# what makes `grep -n "a\|git push\|b" f` look like a fresh `git push` segment.
# Matches an ODD run of backslashes before `|` (so `\\|` — an escaped backslash
# followed by a REAL pipe — is left alone).
_ESCAPED_PIPE = re.compile(r"(?<!\\)(\\(?:\\\\)*)\|")

# `<<[-] DELIM` / `<<[-] 'DELIM'`. Body runs to a line that is exactly DELIM.
_HEREDOC_START = re.compile(r"<<-?\s*(?P<q>['\"]?)(?P<delim>[A-Za-z_][A-Za-z0-9_]*)(?P=q)")

# A heredoc body is released only when the command that OWNS the heredoc is
# itself the message-from-stdin idiom `git commit|tag … -F -`.
#
# "Owns" matters, and an earlier draft got it wrong: testing whether the opening
# LINE merely *mentions* `git commit -F -` is fooled by
# `echo "git commit -F -" | bash <<'EOF'` — the text sits in an echo argument
# while `bash` actually runs the body. So we take the LAST segment before `<<`
# and require that segment to BE the command (anchored, env assignments allowed).
_COMMIT_STDIN_CMD = re.compile(
    r"^\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\b[^\n]*\b(?:commit|tag)\b[^\n]*"
    r"(?<![\w-])(?:-F|--file=?)\s*-(?![\w-])[^\n]*$"
)

# Naive separator split. Splitting inside a quoted string can only move the
# boundary LATER — i.e. toward a segment less likely to look like a git commit —
# so naivety errs toward "do not release", the safe direction.
_SEGMENT_SPLIT = re.compile(r"\|\||&&|[|;\n]")


def _owns_heredoc_as_message(prefix: str) -> bool:
    """True when the command immediately before `<<` is `git commit|tag … -F -`."""
    return bool(_COMMIT_STDIN_CMD.match(_SEGMENT_SPLIT.split(prefix)[-1]))

# `-m "…"` / `--message="…"` / `-F "…"` values. The body stops at the first
# unescaped matching quote, so `-m "a" && git push` cannot swallow the push.
_MESSAGE_ARG = re.compile(
    r"(?:(?<=\s)|^)(?:-m|--message=|-F)\s*"
    r"(?P<q>['\"])(?P<body>(?:\\.|(?!(?P=q)).)*)(?P=q)",
    re.S,
)


def _is_inert(region: str) -> bool:
    """True when the shell cannot execute anything inside `region`."""
    return not any(tok in region for tok in _LIVE_EXPANSION)


def _blank(text: str, start: int, end: int) -> str:
    """Replace [start:end) with spaces, preserving length (and thus offsets)."""
    return text[:start] + (" " * (end - start)) + text[end:]


def _redact_inert_text(command: str) -> str:
    """Blank regions that are provably inert TEXT, so the blind pass can be
    re-run without them.

    This is the ENUMERATED half of the design. Each rule releases one proven
    false-positive shape; everything else stays blocked. The safety property
    that makes this bounded: a rule that matches too NARROWLY just leaves the
    command blocked (today's behaviour — safe), so only over-matching is
    dangerous, and every rule below is deliberately narrow and requires the
    region to be inert. A `git push` the shell would really run survives
    redaction and still trips the first pass.
    """
    out = command

    # (1) escaped pipes are literal characters, not separators.
    out = _ESCAPED_PIPE.sub(lambda m: m.group(1) + " ", out)

    # (2) commit-message heredoc bodies.
    out = _blank_commit_heredocs(out)

    # (3) -m / --message= / -F quoted values. Collected in ONE finditer pass and
    # applied afterwards — blanking preserves length, so the offsets stay valid.
    # (A "re-search until nothing changes" loop would not terminate: a blanked
    # body is still a match, and still inert.)
    spans = [
        (m.start("body"), m.end("body"))
        for m in _MESSAGE_ARG.finditer(out)
        if _is_inert(m.group("body"))
    ]
    for start, end in spans:
        out = _blank(out, start, end)

    return out


def _blank_commit_heredocs(text: str) -> str:
    """Blank `git commit`/`git tag` heredoc bodies that contain no expansions."""
    pos = 0
    while True:
        m = _HEREDOC_START.search(text, pos)
        if m is None:
            return text
        line_start = text.rfind("\n", 0, m.start()) + 1
        # Only a commit-message heredoc — never a `bash <<EOF` script body.
        if not _owns_heredoc_as_message(text[line_start:m.start()]):
            pos = m.end()
            continue
        body_start = text.find("\n", m.end())
        if body_start == -1:
            return text
        body_start += 1
        delim = m.group("delim")
        end_re = re.compile(rf"^[ \t]*{re.escape(delim)}[ \t]*$", re.M)
        end = end_re.search(text, body_start)
        body_end = end.start() if end else len(text)
        body = text[body_start:body_end]
        if _is_inert(body):
            text = _blank(text, body_start, body_end)
        # Strictly advance: a zero-length body must not re-scan the same opener.
        pos = max(body_end, m.end())



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
    if not _GIT_PUSH.search(command):
        return False  # blind pass says no — detection is unchanged from legacy.
    # Blind pass says yes. Release ONLY if the match cannot survive removing
    # provably-inert text, i.e. it only ever lived inside a commit message or a
    # grep pattern. Anything else — including anything we failed to prove inert
    # — stays blocked.
    return bool(_GIT_PUSH.search(_redact_inert_text(command)))


_REVIEW_MSG = (
    "BLOCKED by .claude/hooks/guard_review_before_push.py (review gate)\n"
    "  attempted: git push\n"
    "  reason:    {reason}\n"
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

_PLAN_MSG = (
    "BLOCKED by .claude/hooks/guard_review_before_push.py (plan gate)\n"
    "  attempted: git push\n"
    "  reason:    {reason}\n"
    "\n"
    "PR 를 올리기 전에는 처리하던 plan 을 갱신하거나 (모두 완료 시) complete 로\n"
    "이동하는 것이 강제 사항입니다. 다음 중 하나를 하고 다시 push 하세요:\n"
    "\n"
    "  - 진행 중이면:  {plan} 에 진행 메모/체크박스를 갱신\n"
    "  - 완료됐으면:   {plan} 을 plan/complete/ 로 이동\n"
    "                  (마지막 작업 PR 안에서 `chore(plan): mark <name> complete`,\n"
    "                   plan-lifecycle.md §3 — 별도 PR 로 분리 금지)\n"
    "\n"
    "의식적 우회 (이 branch 에 연결된 plan 이 없다고 오판된 드문 경우):\n"
    "  BYPASS_PLAN_GUARD=1\n"
)


def main() -> int:
    payload = _read_payload()
    tool_input = payload.get("tool_input") or payload.get("input") or {}
    command = tool_input.get("command") or ""

    if not _is_git_push(command):
        return 0  # not a push — nothing to enforce.

    # ---- REVIEW gate -------------------------------------------------------
    if evaluate_review is not None and os.environ.get("BYPASS_REVIEW_GUARD") != "1":
        try:
            decision = evaluate_review()
        except Exception:
            traceback.print_exc(file=sys.stderr)
            decision = None  # fail open on internal error
        if decision is not None and decision.blocked:
            print(_REVIEW_MSG.format(reason=decision.reason), file=sys.stderr)
            return 2

    # ---- PLAN gate ---------------------------------------------------------
    if evaluate_plan is not None and os.environ.get("BYPASS_PLAN_GUARD") != "1":
        try:
            plan = evaluate_plan()
        except Exception:
            traceback.print_exc(file=sys.stderr)
            plan = None  # fail open on internal error
        if plan is not None and plan.untouched:
            print(
                _PLAN_MSG.format(reason=plan.reason, plan=plan.plan_path),
                file=sys.stderr,
            )
            return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
