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

# `git` global options that this module treats as consuming a *separate*
# value token, so that token can never be misread as the subcommand:
# `git -C <dir> push` skips `-C` and `<dir>` and still finds `push`.
# This is a closed *known-safe-to-skip-two* list, not a closed "every option
# git has" list — an option missing from here does not fall through to
# "treat as a bare flag" (that was Critical #4: `--attr-source` was missing,
# so its value `main` was misread as the subcommand and the real `push` after
# it went unexamined). See `_git_subcommand`'s fail-closed branch instead.
#
# WARNING #3 (review/code/2026/07/17/18_04_20, measured against git 2.50.1):
# do not restate this set as "every entry consumes a separate value token" —
# two of the nine do not, when written with a space instead of `=`, and
# skipping two tokens for them is safe for a *different* reason than "the
# second token is its value":
#   - `--exec-path` (bare, no `=`): prints the built-in exec-path and exits
#     immediately, never reaching a subcommand regardless of what follows —
#     `git --exec-path push` does not push. Skipping the next token anyway is
#     harmless: there is no subcommand to hide either way.
#   - `--super-prefix`: not recognized at all by this git build (`unknown
#     option: --super-prefix`, exit 129) — git refuses before a subcommand is
#     ever reached, also harmless to skip.
# `-C`/`-c`/`--git-dir`/`--work-tree`/`--namespace`/`--config-env`/
# `--attr-source` were individually re-measured alongside these two and do
# genuinely consume the next token as their value. Confident, unverified
# phrasing here is exactly what f4489d314 (this module's own
# `_is_segment_boundary` docstring, "quoting protects it") had to walk back
# after being measured and found wrong — do not reintroduce that pattern.
_GIT_OPTS_WITH_VALUE = frozenset(
    {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path",
     "--config-env", "--super-prefix", "--attr-source"}
)

# `git` global options measured (git 2.50.1) to take no value at all and to
# leave the *next* token as an ordinary continuation (global option or
# subcommand) — plain boolean switches. Missing from `_GIT_OPTS_WITH_VALUE`,
# but must NOT fall into `_git_subcommand`'s fail-closed branch either
# (WARNING #2): that branch's job is tokens it truly cannot classify, and
# treating a *known* boolean flag as unknown scans the rest of the segment
# for a literal "push" token and blocks on it even when that "push" belongs
# to something else — measured false positive: `git --no-pager log --grep
# push`. Plan's "이론적 사례" ("no such option is known to exist") framing for
# this class was wrong; this is what refuted it.
#
# Deliberately excludes look-alikes that are NOT safe to model this way:
# `--exec-path`/`--html-path`/`--man-path`/`--info-path` print-and-exit
# before reaching any subcommand (see the footnote above), and `-h`/`--help`
# repurpose the *next* token as "show help for this command" rather than
# treating it as an ordinary continuation (`git -h status` shows status's
# man page, it does not run status) — "skip one and keep scanning normally"
# would mismodel both groups. Leaving them out routes them through the
# fail-closed branch instead, which only over-blocks (safe direction), never
# under-blocks.
_GIT_OPTS_NO_VALUE = frozenset(
    {"--no-pager", "-p", "--paginate", "-P", "--bare",
     "--literal-pathspecs", "--glob-pathspecs", "--noglob-pathspecs",
     "--icase-pathspecs", "--no-optional-locks", "--no-replace-objects",
     "--no-lazy-fetch", "--no-advice"}
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

# Control characters `_is_git_push` treats as hostile enough to distrust
# shlex's tokenization entirely (WARNING #1, review/code/2026/07/17/
# 18_04_20) — chiefly NUL: a token like `"git push\x00 extra"` tokenizes as
# the single token `push\x00` (NUL is not shlex whitespace, so it fuses onto
# "push"), and `_git_subcommand`'s exact-string comparison against `"push"`
# is then False — a false negative. The legacy regex's `\b` treated NUL as a
# non-word character and blocked this correctly; the shlex rewrite
# regressed it (measured).
# `\t`/`\n`/`\r` are excluded: those are ordinary, expected shell content
# (heredocs, multi-line commands) `_tokenize` already handles correctly —
# treating them as hostile would fail every heredoc onto the over-eager
# `_GIT_PUSH_FALLBACK` regex and reintroduce the false positives the shlex
# rewrite exists to remove (e.g. a heredoc body that merely mentions "push").
_BENIGN_CONTROL_CHARS = frozenset("\t\n\r")

# Interpreter names `_shell_dash_c_argument` recurses into via their `-c`
# argument. Matched by basename, case-insensitively — same reasoning as
# `_git_subcommand`'s `git` check (Critical #3, 2026-07-17 17_09_10 session):
# a case-insensitive filesystem resolves `BASH` to the same binary as `bash`.
_SHELL_INTERPRETERS = frozenset({"sh", "bash", "zsh", "dash", "ksh"})

# How many levels of `$(...)`/backtick/`-c`/`eval` recursion `_is_git_push`
# will follow before it stops looking *deeper* (the outermost level at the
# cap is still evaluated directly — only further nesting past it is left
# unexamined). Bounds the cost of pathological nesting; realistic commands
# are 1-2 levels deep at most.
_MAX_RECURSION_DEPTH = 4


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


def _has_hostile_control_characters(command: str) -> bool:
    """True when `command` contains a control character shlex's tokenizer
    cannot be trusted around (WARNING #1). See `_BENIGN_CONTROL_CHARS`'s
    comment for which control characters are exempted and why.
    """
    return any(
        ord(ch) < 0x20 and ch not in _BENIGN_CONTROL_CHARS for ch in command
    )


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


def _find_command_substitutions(text: str) -> list[str]:
    """The inner content of every `$(...)` and backtick `` `...` `` span in
    `text`, recursed into by `_is_git_push` (Critical #1, review/code/
    2026/07/17/18_04_20): a real shell evaluates command substitution
    *before* running the surrounding command, so `git commit -m "$(git
    push)"` really does push — the plain segment tokenizer never saw it
    because the whole substitution sat inside one quoted `-m` argument.

    `$(...)` is extracted with a **balanced-paren scan**, not a regex like
    `\\$\\(([^()]*)\\)`: nested substitution — `$(git push $(date))` — has an
    inner `(` that such a regex's `[^()]*` cannot cross, so it matches only
    the *inner* `$(date)` and silently skips the outer span that actually
    contains the literal `git push` tokens, leaving the regression half-fixed.
    Backticks are matched to the next backtick with no nesting support
    (legitimate nested backticks require `\\`` escaping and are rare enough
    that POSIX itself deprecates the form); an unterminated backtick or
    `$(...)` is left unmatched / takes the rest of the string rather than
    raising — over-inclusive is the safe direction for something this
    module cannot fully parse.

    Deliberately over-inclusive in one more way: this scans the *raw*
    command string, not shell-aware tokens, so a `$(...)` sitting inside
    *single* quotes — which a real shell would NOT evaluate — is extracted
    and recursed into anyway (`git commit -m '$(git push)'` is blocked even
    though it does not actually push). Accepted (safe direction): by the
    time posix `shlex` has stripped quotes, a single-quoted span is
    indistinguishable from a double-quoted or bare one the shell WOULD
    evaluate, and telling them apart ahead of tokenization would mean
    re-implementing shell quoting rules. See the plan's "잔여 한계" section.
    """
    spans: list[str] = []
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if ch == "$" and i + 1 < n and text[i + 1] == "(":
            depth = 1
            j = i + 2
            while j < n and depth > 0:
                if text[j] == "(":
                    depth += 1
                elif text[j] == ")":
                    depth -= 1
                j += 1
            end = j - 1 if depth == 0 else j  # unterminated: take the rest
            spans.append(text[i + 2:end])
            i = j
            continue
        if ch == "`":
            end = text.find("`", i + 1)
            if end == -1:
                break  # unterminated backtick — nothing more to pair with
            spans.append(text[i + 1:end])
            i = end + 1
            continue
        i += 1
    return spans


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

    That fail-closed branch must not swallow *known* boolean options, though
    (WARNING #2, review/code/2026/07/17/18_04_20): `_GIT_OPTS_NO_VALUE`
    lists global flags measured to take no value and leave the next token as
    an ordinary continuation, so `git --no-pager log --grep push` resolves
    to subcommand `log`, not a fail-closed scan that finds the unrelated
    literal "push" belonging to `--grep`.
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
        if token in _GIT_OPTS_NO_VALUE:
            i += 1  # skip only the flag itself — no value token to consume
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


def _shell_dash_c_argument(segment: list[str]) -> str | None:
    """The `-c` script argument if `segment` invokes a shell that way, else
    None (Critical #1's `sh`/`bash`/`zsh`/`dash`/`ksh` half, review/code/
    2026/07/17/18_04_20): `bash -c "cd /tmp && git push"` really does push
    once the shell runs the `-c` string, so `_is_git_push` recurses into it.

    Recognized by basename (`/bin/bash -c …` counts) and case-insensitively,
    same reasoning as `_git_subcommand`'s `git` check. Only a literal `-c`
    token is recognized, anywhere after the interpreter name — combined
    short flags (`-lc`) and `--command`-style long forms are out of scope,
    matched to `eval`'s equally narrow handling below.
    """
    if not segment:
        return None
    if os.path.basename(segment[0]).lower() not in _SHELL_INTERPRETERS:
        return None
    for i, token in enumerate(segment[1:], start=1):
        if token == "-c":
            return segment[i + 1] if i + 1 < len(segment) else None
    return None


def _eval_argument(segment: list[str]) -> str | None:
    """The re-evaluated string if `segment` invokes `eval`, else None.

    Pre-existing gap, not a regression by itself — the legacy regex did not
    catch `eval "git push"` either — but it is the same "indirect execution"
    family as `-c` and is two lines to close, so this session's Critical #1
    fix folds it in (the plan's earlier "`eval` is accepted" framing is
    corrected alongside, not left to imply this is still open). POSIX `eval`
    concatenates all of its arguments with a single space and executes the
    result, so `eval git push` (two bare tokens) and `eval "git push"` (one
    quoted token) both reduce to the same recursive check.
    """
    if not segment or segment[0] != "eval":
        return None
    return " ".join(segment[1:]) if len(segment) > 1 else None


def _segment_runs_push(segment: list[str], depth: int) -> bool:
    """`_git_subcommand(segment) == "push"`, plus one level of `-c`/`eval`
    indirection when recursion budget remains. Split out of `_is_git_push`
    so both the mid-loop and trailing-segment checks share the same
    indirection handling instead of drifting apart.
    """
    if _git_subcommand(segment) == "push":
        return True
    if depth >= _MAX_RECURSION_DEPTH:
        return False
    inner = _shell_dash_c_argument(segment)
    if inner is None:
        inner = _eval_argument(segment)
    return inner is not None and _is_git_push(inner, depth + 1)


def _is_git_push(command: str, _depth: int = 0) -> bool:
    """True when the command actually *runs* `git push` in some segment,
    directly or through indirection this module recurses into.

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

    Indirect execution (Critical #1, review/code/2026/07/17/18_04_20): a real
    shell evaluates `$(...)`/backticks and re-executes `-c`/`eval` strings
    *before* the surrounding command runs, so a `push` hidden inside one of
    those really does execute even though it never appears as a bare `push`
    token in the outer segment. This function recurses into:
      - every `$(...)`/backtick span found by `_find_command_substitutions`
        (balanced-paren scan — see that function's docstring for why a naive
        non-nesting regex loses the outer span of `$(git push $(date))`);
      - the `-c` argument of a `sh`/`bash`/`zsh`/`dash`/`ksh` segment
        (`_shell_dash_c_argument`);
      - the argument(s) of an `eval` segment (`_eval_argument`).
    `_depth` bounds this at `_MAX_RECURSION_DEPTH` levels to rule out
    pathological nesting; realistic commands never approach it.

    Two of this session's originally reported findings do not survive direct
    measurement and are handled accordingly, not as literally proposed:
      - `bash -c "cd /tmp && git push"` was reported as a blind spot shared
        by the legacy regex and this rewrite; measured, the *legacy* regex
        actually blocked it (its raw `&&` substring anchor matches
        regardless of the surrounding quotes) — this is a regression like
        the `$(...)` cases above, not a pre-existing gap, and the `-c`
        recursion above fixes it the same way.
      - `sh -c "git push"` (no `&&`) and `eval "git push"` were genuinely
        pre-existing gaps (the legacy regex missed both too), but they are
        cheap to close in the same pass and are folded into this fix rather
        than left open for a future session.

    Deliberately NOT recursed into — pre-existing, structural limitations of
    a static token-based guard, unchanged by this fix (see the plan's "잔여
    한계" section for the general argument, not just a single named case):
    `find … -exec git push \\;`, process substitution (`diff <(git push)
    x`), a `git` alias (`git config alias.p push` then `git p`), and any
    interpreter/wrapper not in `_SHELL_INTERPRETERS`.
    """
    if not command:
        return False
    if _has_hostile_control_characters(command):
        # WARNING #1: do not trust shlex's tokenization around a control
        # character it does not treat as a boundary (chiefly NUL). Fail
        # closed exactly like the ValueError branch below.
        return bool(_GIT_PUSH_FALLBACK.search(command))
    try:
        tokens = _tokenize(command)
    except ValueError:
        # Unbalanced quotes and the like. A guard must not turn permissive when
        # it cannot parse, so fall back to the over-eager regex and block.
        return bool(_GIT_PUSH_FALLBACK.search(command))

    if _depth < _MAX_RECURSION_DEPTH:
        for inner in _find_command_substitutions(command):
            if _is_git_push(inner, _depth + 1):
                return True

    segment: list[str] = []
    for token in tokens:
        if _is_segment_boundary(token):
            if _segment_runs_push(segment, _depth):
                return True
            segment = []
            continue
        segment.append(token)
    return _segment_runs_push(segment, _depth)


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
