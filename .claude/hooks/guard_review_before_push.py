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

Fail-open is OBSERVED, not silent (policy decision 2026-07-23,
harness-guard-followups §E). When a gate cannot answer — its module failed to
import, `evaluate_*()` raised, or push detection itself blew up — the push is
still allowed, but the hook prints an explicit "this push was not checked"
banner and records the CONSECUTIVE count in
`.claude/state/push_guard_failopen.json`; three in a row escalates the wording.
Only a push where EVERY gate answered cleanly clears the counter. A BYPASS_*
skip, a non-push, and a push where one gate blocked before the other ever ran
are all "no evidence" — not "healthy" — and leave the streak untouched. That
predicate was wrong three times in review, each time by accepting weaker
evidence than "all of them answered", so `_report_fail_open` compares against
the named `_ALL_GATES` set rather than testing truthiness. Read it there before
changing anything here.
"""

from __future__ import annotations

import inspect
import json
import os
import re
import subprocess
import sys
import traceback

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(THIS_DIR, "_lib"))

# Both gates are imported independently and best-effort: a failure to import one
# (e.g. a syntax error introduced in that module) must not silence the other.
_REVIEW_IMPORT_ERROR = ""
_PLAN_IMPORT_ERROR = ""

try:
    from review_guard import evaluate_review  # noqa: E402
except Exception as exc:  # noqa: BLE001
    traceback.print_exc(file=sys.stderr)
    _REVIEW_IMPORT_ERROR = f"{type(exc).__name__}: {exc}"
    evaluate_review = None  # review gate disabled; plan gate still runs.

# Guarded: extracting this reporting into _lib/ means the hook now depends on a
# module that can be absent or broken. Losing it must not cost the *signal* —
# silence is the exact failure this mechanism exists to prevent — so the
# fallback still prints a banner, just without the streak counting.
try:
    import failopen_state  # noqa: E402
except Exception:  # noqa: BLE001
    failopen_state = None

try:
    from plan_guard import evaluate_plan  # noqa: E402
except Exception as exc:  # noqa: BLE001
    _PLAN_IMPORT_ERROR = f"{type(exc).__name__}: {exc}"
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
# Process substitution `<(…)` / `>(…)` is deliberately absent: it is not
# recognised inside quotes or a heredoc body, which are the only regions this
# module ever releases (verified against a real shell during review).
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
# Split into three INDEPENDENT linear probes instead of one pattern with two
# greedy `[^\n]*` runs. Those two runs overlapped, so an input that repeats
# `commit` and never reaches `-F -` made the engine try every split between them
# — O(n²) (measured: input ×2 → time ×4; 28KB of `commit ` repeats took 0.64s,
# 84KB took ~6s, while the same length of ordinary text took 0.4ms). This hook
# gates every Bash call synchronously, so that is the same hang class as the
# `_MESSAGE_ARG` ReDoS. Each probe below scans once, with no nested quantifier
# over the same text.
_SEGMENT_IS_GIT = re.compile(r"^\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\b")
_COMMIT_OR_TAG = re.compile(r"\b(?:commit|tag)\b")
_STDIN_FILE_FLAG = re.compile(r"(?<![\w-])(?:-F|--file=?)\s*-(?![\w-])")

# Naive separator split. Splitting inside a quoted string can only move the
# boundary LATER — i.e. toward a segment less likely to look like a git commit —
# so naivety errs toward "do not release", the safe direction.
_SEGMENT_SPLIT = re.compile(r"&&|[|;\n]")

# How much text before a `<<` marker the ownership check may look at. The owning
# command is short (`[VAR=val …] git commit|tag … -F -`), so this is generous.
_OWNER_WINDOW = 512

# Redaction is only attempted on commands up to this size. Every scan below is
# linear today, but three review rounds each found a different super-linear
# corner in this hand-written scanning code (an ambiguous alternation, two
# accumulating re-scans). This cap bounds the whole CLASS instead of the next
# instance: past it we skip redaction and simply block, which is the safe
# direction and exactly the pre-allowlist behaviour. Real Bash commands are
# orders of magnitude smaller — the longest commit message in this repo's own
# history is a few KB.
_MAX_REDACTION_INPUT = 16_384


def _owns_heredoc_as_message(prefix: str) -> bool:
    """True when the command immediately before `<<` is `git commit|tag … -F -`.

    Three single-pass probes rather than one regex: the segment must BE a git
    command, mention commit/tag, and carry the read-from-stdin flag AFTER that
    word. Keeping them separate is what makes this linear (see the constants).
    """
    segment = _SEGMENT_SPLIT.split(prefix)[-1]
    if not _SEGMENT_IS_GIT.match(segment):
        return False
    subcommand = _COMMIT_OR_TAG.search(segment)
    if subcommand is None:
        return False
    return bool(_STDIN_FILE_FLAG.search(segment, subcommand.end()))

# `-m '…'` / `-m "…"` / `--message=…` / `-F …` values. The two quote styles need
# DIFFERENT bodies, and conflating them was a real gate bypass (review
# 2026/07/23 14_23_23 C1):
#
#   single quotes — POSIX shell does NO escape processing inside '…'; the first
#     `'` always closes it (a quote cannot even be embedded). So the body is
#     literally "up to the next quote". Treating `\'` as an escape pair made
#     `git commit -m 'a\' && git push -- 'end'` read as one long message and
#     blanked the REAL `&& git push` out of existence.
#   double quotes — `\"` does escape, so escape pairs must be consumed. The two
#     alternatives are kept DISJOINT (`[^"\\]` excludes the backslash `\\.`
#     starts with). An overlapping version backtracked exponentially on a body
#     with no closing quote (same review, C2): this hook gates every Bash call
#     synchronously, so that hang freezes the session.
_MESSAGE_ARG = re.compile(
    r"(?:(?<=\s)|^)(?:-m|--message=|-F)\s*"
    r"(?:'(?P<sbody>[^']*)'"
    r"|\"(?P<dbody>(?:\\.|[^\"\\])*)\")",
    re.S,
)


def _is_inert(region: str) -> bool:
    """True when the shell cannot execute anything inside `region`."""
    return not any(tok in region for tok in _LIVE_EXPANSION)


def _blank_spans(text: str, spans: list[tuple[int, int]]) -> str:
    """Replace every span with spaces in ONE linear rebuild.

    Length is preserved, so offsets collected against `text` stay valid. Blanking
    each span with its own slice-and-concat would copy the whole string per span
    — O(n·k), quadratic on a command with many `-m` values.
    """
    if not spans:
        return text
    parts: list[str] = []
    prev = 0
    for start, end in sorted(spans):
        if start < prev:  # overlapping span already covered by the previous one
            continue
        parts.append(text[prev:start])
        parts.append(" " * (end - start))
        prev = end
    parts.append(text[prev:])
    return "".join(parts)


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

    The rules run in a fixed ORDER and it matters: (1) normalises escaped pipes
    first so the later scans see the same segment boundaries the blind pass will.
    (2) and (3) only collect spans, which are applied in a single rebuild.
    """
    # (1) escaped pipes are literal characters, not separators. One pass.
    out = _ESCAPED_PIPE.sub(lambda m: m.group(1) + " ", command)

    # (2)+(3) collect every blankable span, then rebuild once (see _blank_spans).
    spans = _commit_heredoc_spans(out)

    # -m / --message= / -F quoted values, in ONE finditer pass. (A "re-search
    # until nothing changes" loop would not terminate: a blanked body is still a
    # match, and still inert.)
    for m in _MESSAGE_ARG.finditer(out):
        group = "sbody" if m.group("sbody") is not None else "dbody"
        if _is_inert(m.group(group)):
            spans.append((m.start(group), m.end(group)))

    return _blank_spans(out, spans)


def _commit_heredoc_spans(text: str) -> list[tuple[int, int]]:
    """Spans of `git commit`/`git tag` heredoc bodies that contain no expansions.

    Returns spans rather than blanking in place so the caller can apply every
    redaction in one rebuild. The scan already skips past each body, so not
    mutating as we go changes nothing: a `<<` inside a body was never reachable.
    """
    spans: list[tuple[int, int]] = []
    pos = 0
    prev_end = 0  # end of the last `<<` marker we looked at, on this same line
    while True:
        m = _HEREDOC_START.search(text, pos)
        if m is None:
            return spans
        # Window for the ownership check. Everything here is bounded by
        # _OWNER_WINDOW, because a line of many `<<` markers otherwise re-scans an
        # ever-growing prefix once per marker — O(h²) (measured: 12k markers /
        # 118KB took 11.6s, past this suite's own 10s hang threshold). Two
        # separate accumulators had to be capped: the slice fed to the ownership
        # check, AND this backward `rfind` for the line start, which with no
        # newline in the command walked the whole prefix every time.
        #   prev_end      — text before the previous marker belongs to it, not us;
        #   _OWNER_WINDOW — the owning command (`[VAR=…] git commit … -F -`) is
        #                   short, so a fixed cap is enough. Truncating the front
        #                   can only make the anchored match FAIL, i.e. not
        #                   release — the safe direction.
        floor = max(0, m.start() - _OWNER_WINDOW)
        line_start = text.rfind("\n", floor, m.start()) + 1
        window_start = max(line_start, prev_end, floor)
        prev_end = m.end()
        # Only a commit-message heredoc — never a `bash <<EOF` script body.
        if not _owns_heredoc_as_message(text[window_start:m.start()]):
            pos = m.end()
            continue
        body_start = text.find("\n", m.end())
        if body_start == -1:
            return spans
        body_start += 1
        delim = m.group("delim")
        end_re = re.compile(rf"^[ \t]*{re.escape(delim)}[ \t]*$", re.M)
        end = end_re.search(text, body_start)
        body_end = end.start() if end else len(text)
        if _is_inert(text[body_start:body_end]):
            spans.append((body_start, body_end))
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
    """True when this Bash command should be treated as a `git push`.

    Blind first pass, then an enumerated allowlist that can only SUBTRACT.
    """
    if not command or "push" not in command:
        return False
    if not _GIT_PUSH.search(command):
        return False  # blind pass says no — detection is unchanged from legacy.
    if len(command) > _MAX_REDACTION_INPUT:
        # Too big to analyse under a bounded time budget — block. This hook gates
        # every Bash call synchronously, so a slow scan is a frozen session; a
        # false positive on an absurdly long command is the cheaper failure.
        return True
    if not _is_inert(command):
        # A shell expansion lives SOMEWHERE in this command. Releasing is only
        # sound when the blind match was the only reason to block; here the
        # expansion could itself be a push the blind pass never matched, and
        # blanking a message would silently unmask it. Reviewed regression
        # (2026/07/23 14_23_23 C3):
        #   git commit -m "fix: retry push bug" && echo "$(git push origin main)"
        # legacy blocked this by accidentally matching "push" in the message;
        # blanking the message dropped that match while `$(git push …)` still
        # runs. Refuse to release whenever any expansion is present.
        return True
    # Release ONLY if the match cannot survive removing provably-inert text —
    # i.e. it only ever lived inside a commit message or a grep pattern.
    return bool(_GIT_PUSH.search(_redact_inert_text(command)))


# ---------------------------------------------------------------------------
# Which worktree(s) does this push publish?
#
# Both gates evaluate a *worktree* (HEAD + working tree). Historically they only
# ever evaluated the hook process's own cwd, which is wrong in a multi-worktree
# repo — this project keeps every task in `.claude/worktrees/<task>-<slug>/`, so
# an agent routinely runs `cd <other-worktree> && git push origin <its-branch>`.
# The hook's cwd is then a DIFFERENT worktree than the one being published:
#
#   - false BLOCK  — cwd worktree is mid-review, the pushed branch is clean.
#   - false ALLOW  — cwd worktree is clean, the pushed branch is unreviewed.
#     (2026-07-23 실측: evaluate_review(<fresh clean worktree>) → blocked=False
#      while evaluate_review(<branch with an unresolved gate>) → blocked=True.
#      Running the push from the clean one skipped the gate entirely.)
#
# The false ALLOW is the reason this is a correctness fix and not a convenience
# one: it is a working bypass of the review gate.
#
# HOW WE RESOLVE IT — blind text match, deliberately NOT a parser.
# `_is_git_push` above is blind on purpose (see its docstring: a 2026-07-17
# shlex rewrite was REVERTED after every review round found a new false-negative
# class). We keep that philosophy: we do NOT parse the push refspec. Instead we
# ask, for each checked-out branch in the repo, "does this branch name occur in
# the command text?" — a bounded, ignorant question with no shell semantics.
#
# Consequences, chosen deliberately:
#   - A branch named in a comment / commit message also gets evaluated. That can
#     only make the gate STRICTER (extra worktree checked), never weaker — the
#     same trade the blind push regex already makes.
#   - A push whose branch is not checked out anywhere is not additionally
#     covered; there is no worktree state to evaluate. Behaviour there is
#     exactly today's (cwd only) — strictly no regression.
# The cwd worktree is ALWAYS evaluated, so this can only add checks.
_BRANCH_CHAR = re.compile(r"[A-Za-z0-9._/-]")


def _worktree_branches(cwd: str) -> list[tuple[str, str]]:
    """`[(worktree_path, short_branch), …]` for every checked-out branch.

    Best-effort: returns [] on any failure (fail-open, same as the gates)."""
    try:
        out = subprocess.run(
            ["git", "worktree", "list", "--porcelain"],
            cwd=cwd,
            capture_output=True,
            text=True,
            # 5s: same order as the other subprocess in this hook; a
            # `worktree list` is a local metadata read, so anything
            # slower means a wedged repo → fail open rather than hang
            # a PreToolUse gate that fronts every push.
            timeout=5.0,
        )
        if out.returncode != 0:
            return []
    except Exception:
        return []
    pairs: list[tuple[str, str]] = []
    path: str | None = None
    for line in out.stdout.splitlines():
        if line.startswith("worktree "):
            path = line[len("worktree ") :].strip()
        elif line.startswith("branch ") and path:
            ref = line[len("branch ") :].strip()
            short = ref[len("refs/heads/") :] if ref.startswith("refs/heads/") else ref
            if short:
                pairs.append((path, short))
            path = None
    return pairs


def _mentions_branch(command: str, branch: str) -> bool:
    """True when `branch` occurs in `command` bounded by non-branch characters.

    Bounded so a 1-2 char branch name cannot match inside every longer token.
    This is a substring test, not tokenization — no shell semantics involved."""
    start = 0
    while True:
        i = command.find(branch, start)
        if i < 0:
            return False
        before = command[i - 1] if i > 0 else ""
        after_idx = i + len(branch)
        after = command[after_idx] if after_idx < len(command) else ""
        if not _BRANCH_CHAR.match(before or " ") and not _BRANCH_CHAR.match(
            after or " "
        ):
            return True
        start = i + 1


def _accepts_cwd(fn) -> bool:
    """True when `fn` takes at least one positional argument (the worktree).

    Probed explicitly rather than by catching TypeError from the call, because
    that catch is indistinguishable from a genuine internal error and would turn
    a signature mismatch into a SILENTLY DISABLED gate (2026-07-23: the stub
    gates in `test_guard_review_before_push_main.py` take no argument, and an
    early draft of this change made all 9 blocking tests exit 0 instead of 2).
    On an unexpected signature we degrade to the legacy single-worktree call —
    weaker than the fix, but never weaker than the behaviour it replaced."""
    try:
        params = inspect.signature(fn).parameters.values()
        return any(
            p.kind
            in (
                inspect.Parameter.POSITIONAL_ONLY,
                inspect.Parameter.POSITIONAL_OR_KEYWORD,
                inspect.Parameter.VAR_POSITIONAL,
            )
            for p in params
        )
    except Exception:
        return False


def _push_targets(command: str, cwd: str) -> list[str]:
    """Worktrees this push may publish: always cwd, plus any whose branch the
    command names. Order-stable, de-duplicated, cwd first.

    The command is truncated to `_MAX_REDACTION_INPUT` before scanning, matching
    the cap the other hand-rolled scan in this file already applies. Truncation
    can only DROP a branch mention (→ fewer targets, i.e. the pre-fix behaviour
    for that branch), never invent one — it cannot weaken the cwd check."""
    command = command[:_MAX_REDACTION_INPUT]
    targets = [cwd]
    seen = {os.path.realpath(cwd)}
    for path, branch in _worktree_branches(cwd):
        real = os.path.realpath(path)
        if real in seen or not os.path.isdir(path):
            continue
        if _mentions_branch(command, branch):
            targets.append(path)
            seen.add(real)
    return targets


_REVIEW_MSG = (
    "BLOCKED by .claude/hooks/guard_review_before_push.py (review gate)\n"
    "  attempted: git push\n"
    "  worktree:  {worktree}\n"
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
    "  worktree:  {worktree}\n"
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


# --- fail-open observability -------------------------------------------------
# The gates fail OPEN by design: a broken guard must not stop routine work. The
# cost is that a gate can be effectively OFF and nobody notices — this module
# calls itself the hard gate for review-before-push, so silent degradation is
# the worst shape it can take. Policy decision 2026-07-23: keep failing open,
# but make it LOUD and COUNTED (harness-guard-followups §E).
#
# Nothing here may ever raise into the guard: observability that breaks the
# thing it observes is worse than no observability.
_FAILOPEN_STATE_NAME = "push_guard_failopen.json"
# Gate identifiers. Constants rather than repeated literals: a typo in one of
# them would make `set(answered) != _ALL_GATES` permanently true, permanently
# suppressing the reset — fail-safe in direction, but invisible to every static
# check.
_GATE_REVIEW = "REVIEW"
_GATE_PLAN = "PLAN"
# Every gate that must answer before the streak may be cleared. Named, not
# counted, so a future third gate cannot silently satisfy the reset with two.
_ALL_GATES = frozenset({_GATE_REVIEW, _GATE_PLAN})


def _report_fail_open(outcome, exit_code: int) -> None:
    """Announce (and count) any gate that could not answer.

    Channel depends on the exit code, because that decides what the harness
    surfaces: on exit 2 the refusal is read from stderr, while on exit 0 it is
    STDOUT that gets injected into the model's context (the same reasoning
    `guard_default_branch_bash.py` documents for its never-blocking reminder).
    A banner on the wrong stream is a banner nobody reads, which would quietly
    undo the whole point of this policy. The Stop hook cannot make the same
    choice — its stdout is a JSON protocol — which is why the stream is the
    caller's decision and not baked into `failopen_state.report`.

    The counting/reset rules and their two previous wrong versions are
    documented in `_lib/failopen_state.py`.
    """
    stream = sys.stderr if exit_code == 2 else sys.stdout
    if failopen_state is None:
        # Degraded reporting: no counter, but never silence.
        try:
            if outcome.degraded:
                print("\n⚠️  push guard: 게이트가 판정하지 못하고 통과시켰습니다 "
                      "(fail-open). [_lib/failopen_state.py 부재 — 연속 횟수 미집계]",
                      file=stream)
                for gate, reason in outcome.degraded:
                    print(f"      {gate} gate — {reason}", file=stream)
        except Exception:  # noqa: BLE001
            pass
        return
    failopen_state.report(
        outcome,
        state_name=_FAILOPEN_STATE_NAME,
        label="push guard",
        subject="이 push",
        all_gates=_ALL_GATES,
        stream=stream,
    )


if failopen_state is not None:
    _Outcome = failopen_state.Outcome
else:  # minimal stand-in so the gates can still record what they did.
    class _Outcome:  # type: ignore[no-redef]
        def __init__(self) -> None:
            self.answered: list = []
            self.bypassed: list = []
            self.degraded: list = []


def _import_reason(module: str, symbol: str, error: str) -> str:
    if failopen_state is not None:
        return failopen_state.import_failure_reason(module, symbol, error)
    return f"{module} failed to import — {error}" if error else \
f"{module} imported but {symbol} is None"


def _evaluate_over_targets(evaluate, targets, *, gate, outcome, is_blocked, render):
    """Run ONE gate over every push target. Returns the block message or None.

    Bridges two invariants that arrived from different directions and both have
    to survive:

      - **fail-open observability** (#999 §E) — a gate that could not answer must
        be *counted*, not silent. `outcome.answered` gets the gate only when some
        target produced a verdict; `outcome.degraded` records the first failure.
        Recorded ONCE per gate, not per target: the streak counter measures "this
        gate was effectively off", and three failing worktrees are still one gate.
      - **per-target fail-open** (worktree scoping) — an internal error on one
        worktree must skip only that worktree. Returning early here would let a
        crash on the FIRST target pass the whole gate, which is the same
        false-ALLOW class the scoping exists to close.

    `_accepts_cwd` decides scoping: a gate whose signature takes no positional
    cwd is called bare, exactly as before scoping existed (legacy degrade).
    """
    scoped = _accepts_cwd(evaluate)
    answered = False
    for target in targets if scoped else [None]:
        try:
            result = evaluate(target) if scoped else evaluate()
        except Exception as exc:
            traceback.print_exc(file=sys.stderr)
            if not any(g == gate for g, _ in outcome.degraded):
                outcome.degraded.append((gate, f"{type(exc).__name__}: {exc}"))
            continue  # fail open for THIS target — keep checking the rest
        if result is None:
            continue
        answered = True
        if is_blocked(result):
            if gate not in outcome.answered:
                outcome.answered.append(gate)
            return render(result, target if scoped else os.getcwd())
    if answered and gate not in outcome.answered:
        outcome.answered.append(gate)
    return None


def _run_gates(outcome: _Outcome, targets: list[str]) -> int:
    """Run both gates, recording into `outcome` what each one did."""
    # ---- REVIEW gate -------------------------------------------------------
    if os.environ.get("BYPASS_REVIEW_GUARD") == "1":
        outcome.bypassed.append(_GATE_REVIEW)
    else:
        if evaluate_review is None:
            outcome.degraded.append((_GATE_REVIEW, _import_reason(
                "_lib/review_guard.py", "evaluate_review", _REVIEW_IMPORT_ERROR)))
        else:
            blocked = _evaluate_over_targets(
                evaluate_review,
                targets,
                gate=_GATE_REVIEW,
                outcome=outcome,
                is_blocked=lambda d: d.blocked,
                render=lambda d, wt: _REVIEW_MSG.format(
                    reason=d.reason, worktree=wt
                ),
            )
            if blocked is not None:
                print(blocked, file=sys.stderr)
                return 2

    # ---- PLAN gate ---------------------------------------------------------
    if os.environ.get("BYPASS_PLAN_GUARD") == "1":
        outcome.bypassed.append(_GATE_PLAN)
    else:
        if evaluate_plan is None:
            outcome.degraded.append((_GATE_PLAN, _import_reason(
                "_lib/plan_guard.py", "evaluate_plan", _PLAN_IMPORT_ERROR)))
        else:
            blocked = _evaluate_over_targets(
                evaluate_plan,
                targets,
                gate=_GATE_PLAN,
                outcome=outcome,
                is_blocked=lambda pl: pl.untouched,
                render=lambda pl, wt: _PLAN_MSG.format(
                    reason=pl.reason, plan=pl.plan_path, worktree=wt
                ),
            )
            if blocked is not None:
                print(blocked, file=sys.stderr)
                return 2

    return 0


def main() -> int:
    # `finally` so the report happens on every exit path, including the blocking
    # ones (a gate can block while the OTHER one failed open — that is exactly
    # when it would otherwise be quietest).
    outcome = _Outcome()
    exit_code = 0
    try:
        payload = _read_payload()
        tool_input = payload.get("tool_input") or payload.get("input") or {}
        command = tool_input.get("command") or ""

        if not _is_git_push(command):
            return 0  # not a push — nothing to enforce.

        # Every worktree this push may publish (cwd + any branch the command
        # names). `payload["cwd"]` is the Bash tool's directory; fall back to the
        # process cwd so a payload without it behaves exactly as before.
        base_cwd = payload.get("cwd") or os.getcwd()
        try:
            targets = _push_targets(command, base_cwd)
        except Exception:
            traceback.print_exc(file=sys.stderr)
            targets = [base_cwd]  # fail open to legacy single-worktree behaviour

        exit_code = _run_gates(outcome, targets)
        return exit_code
    except Exception as exc:
        # Fail-open #3 from the plan: anything unhandled above — payload read,
        # or push DETECTION itself. It used to escape here and the harness's
        # "non-0/non-2 means allow" rule let the push through with nothing
        # recorded anywhere. Same outcome, but now counted: detection is the
        # code three review rounds kept finding bugs in, so a silent failure
        # there is the worst shape this can take.
        traceback.print_exc(file=sys.stderr)
        outcome.degraded.append(("DETECTION", f"{type(exc).__name__}: {exc}"))
        return 0
    finally:
        _report_fail_open(outcome, exit_code)


if __name__ == "__main__":
    sys.exit(main())
