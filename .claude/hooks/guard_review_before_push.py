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
import shlex
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


# Fallback only — used when the command cannot be tokenized (see _is_git_push).
# Kept deliberately over-eager: it allows an unbounded distance between `git`
# and `push`, so it also matches a `push` that is merely *mentioned* downstream
# (e.g. in a heredoc commit message). That over-blocking is the safe direction
# for an unparseable command, but it is why it is no longer the primary test.
_GIT_PUSH_FALLBACK = re.compile(
    r"(?:^|&&|;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\b[^&;|]*\bpush\b"
)

# `git` global options that take a *separate* value token. The token after each
# is that value, so it can never be the subcommand: `git -C <dir> push`.
_GIT_OPTS_WITH_VALUE = frozenset(
    {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path",
     "--config-env", "--super-prefix"}
)

# Shell operators that terminate a command segment. With punctuation_chars=True
# shlex returns each of these as a token of its own.
_SEGMENT_SEPARATORS = frozenset({"&&", "||", ";", ";;", "|", "|&", "&", "(", ")"})

_ENV_ASSIGN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")


def _read_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _tokenize(command: str) -> list[str]:
    """Shell-aware tokens, with operators emitted as tokens of their own.

    `shlex.split` splits on whitespace only, so `git add -A;git push` tokenizes
    as [..., '-A;git', 'push'] — no `;` token, so the push hides in a segment
    that looks like `git add`. punctuation_chars=True makes shlex emit
    `;` / `&&` / `|` separately instead. Quoted runs stay single tokens, so a
    `|` *inside* quotes is not read as a pipe.

    `commenters` must be cleared: shlex.shlex() (unlike shlex.split()) treats
    `#` as starting a comment, which would swallow `… && git push` after an
    unquoted `#` — a false negative.
    """
    lexer = shlex.shlex(command, posix=True, punctuation_chars=True)
    lexer.whitespace_split = True
    lexer.commenters = ""
    return list(lexer)


def _git_subcommand(segment: list[str]) -> str | None:
    """The git subcommand this segment invokes, or None if it does not run git."""
    i = 0
    while i < len(segment) and _ENV_ASSIGN.match(segment[i]):
        i += 1  # leading `FOO=1 git …` env assignments
    # basename so an absolute/relative path to git (`/usr/bin/git`) still counts.
    if i >= len(segment) or os.path.basename(segment[i]) != "git":
        return None
    i += 1
    while i < len(segment):
        token = segment[i]
        if token in _GIT_OPTS_WITH_VALUE:
            i += 2  # skip the option *and* its value
            continue
        if token.startswith("-"):
            i += 1  # `--git-dir=x`, `-p`, `--no-pager`, … carry their own value
            continue
        return token  # first non-flag token is the subcommand
    return None


def _is_git_push(command: str) -> bool:
    """True when the command actually *runs* `git push` in some segment.

    Decides on the parsed git subcommand, not on the presence of the word
    "push" somewhere after a `git`. The latter blocked `git commit` whenever
    the commit message mentioned push, and blocked `grep "…\\|git push\\|…"`
    because the quoted `\\|` was read as a pipe.
    """
    if not command or "push" not in command:
        return False
    try:
        tokens = _tokenize(command)
    except ValueError:
        # Unbalanced quotes and the like. A guard must not turn permissive when
        # it cannot parse, so fall back to the over-eager regex and block.
        return bool(_GIT_PUSH_FALLBACK.search(command))

    segment: list[str] = []
    for token in tokens:
        if token in _SEGMENT_SEPARATORS:
            if _git_subcommand(segment) == "push":
                return True
            segment = []
            continue
        segment.append(token)
    return _git_subcommand(segment) == "push"


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
