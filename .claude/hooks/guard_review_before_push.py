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
# This is a closed *known-safe-to-skip-two* list, not a closed "every option
# git has" list — an option missing from here does not fall through to
# "treat as a bare flag" (that was Critical #4: `--attr-source` was missing,
# so its value `main` was misread as the subcommand and the real `push` after
# it went unexamined). See `_git_subcommand`'s fail-closed branch instead.
_GIT_OPTS_WITH_VALUE = frozenset(
    {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path",
     "--config-env", "--super-prefix", "--attr-source"}
)

# Individual characters that make up shell command-boundary operators
# (`&&`, `||`, `;`, `;;`, `|`, `|&`, `&`, `(`, `)`) plus the newline this
# module treats as a boundary in its own right (see _tokenize). Deliberately
# characters, not whole tokens: with punctuation_chars enabled, shlex merges
# *adjacent* punctuation into one token, so `git add -A &&\ngit push`
# tokenizes `&&` and the following newline as a single "&&\n" token — no
# exact-string set (the old `_SEGMENT_SEPARATORS`) would ever match that,
# which was Critical #1. A token is a boundary iff every one of its
# characters is drawn from this set.
# `<`/`>` are deliberately excluded — those are redirection, not a command
# separator, and must stay inside whatever segment they appear in.
_SEGMENT_SEPARATOR_CHARS = frozenset("&|;()\n")

_ENV_ASSIGN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")


def _is_segment_boundary(token: str) -> bool:
    """True when `token` is made up entirely of separator characters.

    Catches the operator runs that exact-token matching missed — `&&\\n`,
    `;(` — which was Critical #1.

    It does NOT distinguish a real operator from a *quoted* string that
    happens to be pure punctuation: posix shlex strips the quotes, so
    `git commit -m "&&"` yields a bare `&&` token here and is read as a
    boundary (measured — do not "fix" the docstring back to claiming quoting
    protects it). That is harmless in the safe direction: splitting only ever
    makes segments shorter, and a shorter segment cannot acquire a `push`
    subcommand it did not already have. The `git commit -m "&&"` above still
    resolves to subcommand `commit`, i.e. allowed. A mixed-content quoted
    token (`"a|b"`) does stay one word, which is what keeps the quoted-grep
    case working.
    """
    return bool(token) and all(ch in _SEGMENT_SEPARATOR_CHARS for ch in token)


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
    that looks like `git add`. punctuation_chars makes shlex emit `;` / `&&` /
    `|` separately instead. Quoted runs stay single tokens, so a `|` *inside*
    quotes is not read as a pipe.

    Newline is deliberately in `punctuation_chars` (default `True` would use
    `();<>|&`, which omits it) and removed from `whitespace`: a bare `\\n` is
    the *only* separator between two commands typed on consecutive lines or in
    a heredoc-then-push Bash call — with `\\n` left as ordinary whitespace
    (shlex's default), `"git add -A\\ngit push"` collapses into one segment
    and the trailing `git push` is never seen (Critical #1). `<`/`>` stay in
    `punctuation_chars` (redirection tokens), but they are NOT segment
    separators — see `_SEGMENT_SEPARATOR_CHARS`.

    `commenters` must be cleared: shlex.shlex() (unlike shlex.split()) treats
    `#` as starting a comment, which would swallow `… && git push` after an
    unquoted `#` — a false negative.
    """
    lexer = shlex.shlex(command, posix=True, punctuation_chars="();<>|&\n")
    lexer.whitespace = lexer.whitespace.replace("\n", "")
    lexer.whitespace_split = True
    lexer.commenters = ""
    return list(lexer)


def _git_subcommand(segment: list[str]) -> str | None:
    """The git subcommand this segment invokes, or None if it does not run git.

    Unknown global options are the fail-open trap this closes. `--attr-source`
    (missing from `_GIT_OPTS_WITH_VALUE`) let its value token (`main`) be
    mistaken for the subcommand while the real `push` after it went
    unexamined (Critical #4) — and the whitelist can never be exhaustive
    against every option a future git version adds. An option this function
    cannot classify means it no longer knows which token is really the
    subcommand, so instead of guessing (the old "unknown = bare flag, the
    very next token is the subcommand" assumption) it fails closed: if `push`
    appears anywhere later in the segment, treat the segment as a push.
    `--foo=value` tokens are exempt from that uncertainty — the value is
    embedded in the same token, so no *separate* token can be misread.
    """
    i = 0
    while i < len(segment) and _ENV_ASSIGN.match(segment[i]):
        i += 1  # leading `FOO=1 git …` env assignments
    # basename so an absolute/relative path to git (`/usr/bin/git`) still
    # counts, and case-insensitively: macOS/Windows default to a
    # case-insensitive filesystem, so `GIT push` / `Git push` really do
    # invoke git (Critical #3) even though `str.__eq__` would say otherwise.
    if i >= len(segment) or os.path.basename(segment[i]).lower() != "git":
        return None
    i += 1
    while i < len(segment):
        token = segment[i]
        if token in _GIT_OPTS_WITH_VALUE:
            i += 2  # skip the option *and* its value
            continue
        if token.startswith("-"):
            if "=" in token:
                i += 1  # `--git-dir=x` etc. — value is inline, always safe to skip
                continue
            # Unrecognized flag with no inline value: we cannot tell whether
            # the *next* token is this flag's separate value or the real
            # subcommand. Fail closed rather than assume "bare flag".
            return "push" if "push" in segment[i + 1:] else None
        return token  # first non-flag token is the subcommand
    return None


def _is_git_push(command: str) -> bool:
    """True when the command actually *runs* `git push` in some segment.

    Decides on the parsed git subcommand, not on the presence of the word
    "push" somewhere after a `git`. The latter blocked `git commit` whenever
    the commit message mentioned push, and blocked `grep "…\\|git push\\|…"`
    because the quoted `\\|` was read as a pipe.

    No raw-string "push" pre-filter (there used to be one, for the hot-path
    cost of tokenizing every Bash call): `git 'pu''sh' --force` is a real
    `git push --force` once the shell concatenates the adjacent quoted
    fragments, but the *raw* command string never contains the contiguous
    substring "push" — a pre-filter on it is unsound (Critical #2) and
    skipped the REVIEW/PLAN gates outright. Measured cost of always
    tokenizing instead: low tens of microseconds worst-case for a realistic
    command (~6-24us across a range of real Bash-tool commands, via
    `timeit`), against a ~13ms python3 interpreter start-up the hook already
    pays on every invocation — three orders of magnitude smaller, i.e. not
    observable next to the process-launch floor.
    """
    if not command:
        return False
    try:
        tokens = _tokenize(command)
    except ValueError:
        # Unbalanced quotes and the like. A guard must not turn permissive when
        # it cannot parse, so fall back to the over-eager regex and block.
        return bool(_GIT_PUSH_FALLBACK.search(command))

    segment: list[str] = []
    for token in tokens:
        if _is_segment_boundary(token):
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
