"""Review-coverage guard — judges whether the current branch carries
`codebase/**` changes that have NOT yet been covered by a *resolved* AI code
review.

This is the enforcement teeth behind CLAUDE.md / developer SKILL's "구현을
완료하면 test·review·critical/warning fix 는 강제 사항" rule. Until now that
rule lived only as SKILL prose, while the *worktree* rule was hook-enforced —
an asymmetry that let the workflow-era cost/async pressures push review/fix to
"next turn or the PR". This module gives review/fix the same kind of teeth the
worktree guard has.

Consumed by:
  - .claude/hooks/guard_review_before_push.py  (PreToolUse(Bash): blocks `git push`)
  - .claude/hooks/guard_review_before_stop.py  (Stop: blocks turn-end once)

Scope decision — **only `codebase/**` counts as "code that needs review".**
  spec/plan/docs/.claude changes go through `consistency-check`, not `ai-review`,
  so a spec-only or harness-only PR is never blocked by this guard. This both
  matches the review domain and avoids false-blocking doc/spec/meta PRs.

Policy (see evaluate_review): BLOCK when the branch has codebase/ changes
(uncommitted, or committed since the merge-base with the default branch) AND
EITHER of these coverage gates fails:
    1. CODE-REVIEW gate — there is no *fresh, resolved* code review covering the
       changes, OR
    2. SPEC-CONSISTENCY gate (spec-impl drift) — some changed file matches a
       spec's frontmatter `code:` glob (i.e. it implements a documented spec
       surface) but there is no *fresh* `--impl-done` consistency report
       (BLOCK: NO) postdating that change. This is the enforcement teeth behind
       developer SKILL's "구현이 spec 을 준수하는지" — promoting the previously
       *advisory* `/consistency-check --impl-done` to a hard exit gate, but only
       for changes that touch spec-linked code (a refactor of code no spec
       references is never blocked by this gate).
  ALLOW otherwise — including no code change, no git repo, detached HEAD, no
  spec-linked change, or any internal error (fail-open: a guard must never
  wedge the session; either gate's parsing falls back to "not blocked").

"Fresh, resolved review" =
  a `review/code/**/SUMMARY.md` in the working tree whose
    - risk is resolved:  `## 전체 위험도` line is NONE/LOW, OR a sibling
      `RESOLUTION.md` exists (critical/warning were addressed), AND
    - freshness:         it postdates the newest changed codebase file.

"Fresh impl-done consistency report" =
  a `review/consistency/**/SUMMARY.md` whose session `meta.json` mode names
  `--impl-done` AND whose top `BLOCK:` line is NO (no Critical spec-impl
  divergence), postdating the newest spec-linked changed file.

Freshness uses **checkout- and rebase-immune** clocks, NOT raw filesystem
mtime, and NOT a commit's committer date. Two distinct history rewrites would
otherwise poison the comparison:
  - `git worktree add` / checkout reset a file's *mtime* to the checkout
    instant — which made a genuinely-resolved review look stale (its committed
    SUMMARY.md mtime jumped behind the code) and false-blocked;
  - `git rebase` (also `commit --amend`, `cherry-pick`) rewrite each replayed
    commit's *committer* date to the rewrite instant while PRESERVING its author
    date — so a content-identical rebase pushed the code's committer clock past
    the review session that already covered it, re-arming the gate on unchanged
    code (the symptom this module's author-date clock fixes).
Instead:
  - a review's "done" time is its session-dir timestamp (`<Y>/<m>/<d>/<H>_<M>_
    <S>`, encoded in the path — never reset by checkout/rebase), with a
    just-written (dirty) SUMMARY/RESOLUTION's mtime folded in;
  - a code file's edit time is the newest *author* date among the commits that
    touch it when clean (rebase-immune; see _newest_commit_time), or its mtime
    when it carries an uncommitted change (genuinely just edited).
Both sides therefore share one stable, rewrite-immune clock. The residual hole
is deliberate-and-rare: a commit authored before the review but introduced onto
the branch *after* it (cherry-pick of an old commit, or `--date` backdating)
reads as already-covered — a conscious bypass, accepted per the fail-open
contract below. Additionally, a review that has
*started but not finished* (session dir + meta.json present, SUMMARY.md not yet
written, within _IN_FLIGHT_TTL_SECONDS) suppresses the gate — the async
`/ai-review` is mid-flight, not an unreviewed branch.

This is a strong nudge, not a precise oracle; like the CWD-based worktree guard
it errs toward not false-blocking, and BYPASS_REVIEW_GUARD=1 (handled by
callers) provides a conscious one-off override.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime

THIS_DIR = os.path.dirname(os.path.abspath(__file__))

try:
    # Reuse the default-branch resolver so "since the branch started" is
    # computed against the same default branch the worktree guard uses.
    from branch_guard import _origin_default_branch  # type: ignore
except Exception:  # pragma: no cover - import path fallback
    _origin_default_branch = None  # type: ignore


CODE_PREFIX = "codebase/"
REVIEW_GLOB_ROOT = os.path.join("review", "code")
SPEC_DIR = "spec"
CONSISTENCY_GLOB_ROOT = os.path.join("review", "consistency")
# The impl-done consistency mode label written into each session's meta.json
# carries this token (see consistency_orchestrator.py mode_label for --impl-done).
_IMPL_DONE_MODE_TOKEN = "--impl-done"
_BLOCK_LINE = re.compile(r"BLOCK:\s*(YES|NO)", re.IGNORECASE)

# How long a started-but-unfinished review session suppresses the gate. A
# `/ai-review` run that has created its session dir (meta.json) but not yet
# written SUMMARY.md is "in flight" — blocking turn-end then would fire the
# nudge for a review the model is *already* running. Past this TTL an abandoned
# session no longer suppresses enforcement (the push guard still hard-gates).
_IN_FLIGHT_TTL_SECONDS = 1800  # 30 min — comfortably covers a slow review fan-out

# Trailing `<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>` of a review/consistency session dir.
# This path is checkout-immune (it is the directory *name*, not its mtime), so
# it is the authoritative "when did this review run" clock — unlike file mtime,
# which `git worktree add` / checkout / rebase reset to the checkout instant.
_SESSION_TS_RE = re.compile(
    r"(?P<Y>\d{4})/(?P<m>\d{2})/(?P<d>\d{2})/(?P<H>\d{2})_(?P<M>\d{2})_(?P<S>\d{2})/?$"
)


@dataclass(frozen=True)
class ReviewDecision:
    blocked: bool
    reason: str  # human-readable; used for stderr / system-reminder bodies.


def _run_git(args: list[str], cwd: str, timeout: float = 5.0) -> tuple[int, str, str]:
    try:
        p = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return p.returncode, p.stdout.strip(), p.stderr.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return 1, "", ""


def _repo_root(cwd: str) -> str | None:
    rc, out, _ = _run_git(["rev-parse", "--show-toplevel"], cwd)
    if rc != 0 or not out:
        return None
    return out


def _default_branch(cwd: str) -> str | None:
    if _origin_default_branch is not None:
        try:
            d = _origin_default_branch(cwd)
            if d:
                return d
        except Exception:
            pass
    # Fallback: probe common names.
    for name in ("main", "master"):
        rc, _, _ = _run_git(["rev-parse", "--verify", f"refs/heads/{name}"], cwd)
        if rc == 0:
            return name
    return None


def _merge_base(cwd: str, default_branch: str) -> str | None:
    # Prefer the remote ref (origin/<default>) so we diff against where the
    # branch forked, falling back to the local branch ref.
    for ref in (f"origin/{default_branch}", default_branch):
        rc, out, _ = _run_git(["merge-base", "HEAD", ref], cwd)
        if rc == 0 and out:
            return out
    return None


def _committed_code_changes(cwd: str, base: str) -> list[str]:
    rc, out, _ = _run_git(
        ["diff", "--name-only", f"{base}..HEAD", "--", CODE_PREFIX], cwd
    )
    if rc != 0 or not out:
        return []
    return [ln for ln in out.splitlines() if ln.strip()]


def _uncommitted_code_changes(cwd: str) -> list[str]:
    rc, out, _ = _run_git(["status", "--porcelain", "--", CODE_PREFIX], cwd)
    if rc != 0 or not out:
        return []
    return [p for p in (_porcelain_path(ln) for ln in out.splitlines()) if p]


def _porcelain_path(ln: str) -> str:
    """Extract the (destination) path from one `git status --porcelain v1` line.

    Format: "XY <path>" where the status code is the first two columns and the
    path starts at column 3. For a rename the payload is "<old> -> <new>" — we
    want <new>. The split is anchored on git's literal `" -> "` separator (with
    surrounding spaces) and only applied when the status code's first column is
    `R`/`C`; a bare `"->"` substring inside an ordinary filename must not split.
    """
    if len(ln) < 4:
        return ""
    code = ln[:2]
    path = ln[3:].strip()
    if code and code[0] in ("R", "C") and " -> " in path:
        path = path.split(" -> ", 1)[1].strip()
    return path


def _mtime(path: str) -> float:
    try:
        return os.path.getmtime(path)
    except OSError:
        return 0.0


def _dirty_set(repo_root: str) -> set[str]:
    """Repo-relative paths with any uncommitted change (one `git status` call).

    Used to decide, per file, whether its *real* edit time is the filesystem
    mtime (the file was just edited in the working tree) or its last commit time
    (the file is clean — its mtime may be a meaningless checkout/rebase artifact).
    """
    rc, out, _ = _run_git(["status", "--porcelain"], repo_root)
    if rc != 0 or not out:
        return set()
    return {p for p in (_porcelain_path(ln) for ln in out.splitlines()) if p}


def _newest_commit_time(repo_root: str, rel_paths: list[str]) -> float:
    """Newest *author* date (epoch) across the commits touching any of rel_paths.

    Both checkout- AND rebase-immune. Two distinct history rewrites would poison
    a naive code clock:
      - `git worktree add` / `git checkout` reset a file's *mtime* to the
        checkout instant — sidestepped by reading commit metadata at all rather
        than fs mtime;
      - `git rebase` (also `git commit --amend`, `git cherry-pick`) rewrite each
        replayed commit's *committer* date to the rewrite instant while
        PRESERVING its author date. Using committer date (`%ct`, the old
        behaviour) therefore made a content-identical rebase look newer than the
        resolved review that already covered it → false-stale re-arming of the
        gate. Author date (`%at`) is the stable "when was this content authored"
        clock that survives a rebase.

    We take the MAX author date across *every* commit touching the paths, not
    `git log -1`'s topmost: after a rebase all replayed commits share ~one
    committer date, so the commit-date-ordered `-1` could return a non-latest
    commit; a max over author dates is order-independent. 0.0 if none are
    tracked / committed. One `git log` call regardless of count.

    Residual (deliberate, rare) hole: a commit authored *before* the review but
    introduced onto the branch *after* it — a cherry-pick of an old commit, or
    an explicit `--date` backdate — reads as already-covered. This guard is a
    nudge, not an oracle; that bypass is conscious and accepted per fail-open."""
    if not rel_paths:
        return 0.0
    rc, out, _ = _run_git(
        ["log", "--format=%at", "HEAD", "--", *rel_paths], repo_root
    )
    if rc != 0 or not out.strip():
        return 0.0
    newest = 0.0
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            v = float(line)
        except ValueError:
            continue
        if v > newest:
            newest = v
    return newest


def _authoritative_code_time(repo_root: str, rel_paths: list[str],
                             dirty: set[str] | None = None) -> float:
    """Newest *real* edit time across rel_paths, immune to checkout mtime resets.

    Dirty (uncommitted) files → filesystem mtime (they were genuinely just
    edited). Clean tracked files → the newest author date of the commits that
    touch them (rebase-immune; see _newest_commit_time — a committer date or fs
    mtime would be a rebase/checkout artifact in a worktree). This is the same
    clock on both the code and review sides, so the freshness comparison stays
    internally consistent."""
    if not rel_paths:
        return 0.0
    if dirty is None:
        dirty = _dirty_set(repo_root)
    dirty_paths = [p for p in rel_paths if p in dirty]
    clean_paths = [p for p in rel_paths if p not in dirty]
    newest = 0.0
    for rel in dirty_paths:
        m = _mtime(os.path.join(repo_root, rel))
        if m > newest:
            newest = m
    ct = _newest_commit_time(repo_root, clean_paths)
    if ct > newest:
        newest = ct
    return newest


def _newest_code_mtime(repo_root: str, rel_paths: list[str],
                       dirty: set[str] | None = None) -> float:
    """Back-compat name retained as the seam evaluate_review/tests reference;
    the body is now checkout-immune (see _authoritative_code_time). `dirty` is
    an optional pre-computed dirty set to avoid a redundant `git status`."""
    return _authoritative_code_time(repo_root, rel_paths, dirty)


def _path_session_time(session_dir: str) -> float:
    """Epoch parsed from a review session dir's `<Y>/<m>/<d>/<H>_<M>_<S>` tail.

    Checkout-immune authoritative "when this review ran" clock. 0.0 if the path
    does not carry the timestamp layout."""
    posix = session_dir.replace(os.sep, "/")
    m = _SESSION_TS_RE.search(posix)
    if not m:
        return 0.0
    try:
        dt = datetime(
            int(m["Y"]), int(m["m"]), int(m["d"]),
            int(m["H"]), int(m["M"]), int(m["S"]),
        )
        return dt.timestamp()
    except (ValueError, OverflowError):
        return 0.0


def _iter_summaries(repo_root: str) -> list[str]:
    root = os.path.join(repo_root, REVIEW_GLOB_ROOT)
    found: list[str] = []
    if not os.path.isdir(root):
        return found
    for dirpath, _dirs, files in os.walk(root):
        if "SUMMARY.md" in files:
            found.append(os.path.join(dirpath, "SUMMARY.md"))
    return found


_RISK_LINE = re.compile(r"전체\s*위험도")
_RISK_LEVEL = re.compile(r"\b(NONE|LOW|MEDIUM|HIGH|CRITICAL)\b")
# A markdown table data row that is not the header / separator and has real text.
_TABLE_DATA_ROW = re.compile(r"^\s*\|\s*\d+\s*\|")  # rows start with a "| 1 |" index


def _summary_is_resolved(summary_path: str) -> bool:
    """A review is 'resolved' if it surfaced nothing actionable OR was followed
    up. True when:
      - a sibling RESOLUTION.md exists (critical/warning were addressed), OR
      - the report's overall risk is NONE/LOW AND neither the Critical nor the
        Warning table has a data row.
    """
    session_dir = os.path.dirname(summary_path)
    if os.path.exists(os.path.join(session_dir, "RESOLUTION.md")):
        return True

    try:
        with open(summary_path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
    except OSError:
        return False

    lines = text.splitlines()

    # Overall risk: the first level token after the '전체 위험도' heading, up to
    # the next markdown heading (the level often sits a few lines below the
    # heading, e.g. under a bold "**HIGH**" line — a fixed 3-line window missed
    # those and silently defaulted risk_level to None).
    risk_level = None
    for i, ln in enumerate(lines):
        if _RISK_LINE.search(ln):
            # Index-based (`j > 0`) rather than `probe is not ln` — object
            # identity would lean on CPython string interning.
            for j, probe in enumerate(lines[i:]):
                if j > 0 and probe.lstrip().startswith("#"):
                    break  # next section — stop before bleeding into it
                m = _RISK_LEVEL.search(probe)
                if m:
                    risk_level = m.group(1)
                    break
            break

    # Count actionable rows under the Critical and Warning sections.
    has_actionable = _section_has_rows(lines, "Critical") or _section_has_rows(
        lines, "경고"
    )

    if risk_level in ("HIGH", "CRITICAL"):
        return False
    if has_actionable:
        return False
    # NONE/LOW/MEDIUM (or unparsed) with no actionable rows and no RESOLUTION:
    # a clean report that surfaced nothing to act on → resolved.
    return True


def _section_has_rows(lines: list[str], heading_token: str) -> bool:
    """True if the markdown section whose heading contains `heading_token` has
    at least one numbered table data row before the next heading."""
    in_section = False
    for ln in lines:
        if ln.lstrip().startswith("#"):
            in_section = heading_token in ln
            continue
        if in_section and _TABLE_DATA_ROW.match(ln):
            return True
    return False


def _newest_resolved_review_mtime(repo_root: str,
                                  dirty: set[str] | None = None) -> float:
    """Authoritative time of the most recent *resolved* review (0.0 if none).

    Checkout-immune: the review's "done" clock is the session-dir timestamp
    (encoded in the path, never reset by a worktree checkout). For a RESOLUTION
    or SUMMARY that is still *dirty* (just written this session, not yet
    committed) we also fold in its filesystem mtime — that is a genuine, later
    write time and covers the case where the resolving edits landed after the
    session dir was created. Committed-and-clean artifacts rely on the path time
    alone, never on their (checkout-poisoned) mtime. `dirty` may be passed in to
    reuse a single `git status` across the evaluate_review call."""
    if dirty is None:
        dirty = _dirty_set(repo_root)
    best = 0.0
    for summary in _iter_summaries(repo_root):
        if not _summary_is_resolved(summary):
            continue
        session_dir = os.path.dirname(summary)
        t = _path_session_time(session_dir)
        rel_summary = os.path.relpath(summary, repo_root).replace(os.sep, "/")
        if rel_summary in dirty:
            t = max(t, _mtime(summary))
        res = os.path.join(session_dir, "RESOLUTION.md")
        if os.path.exists(res):
            rel_res = os.path.relpath(res, repo_root).replace(os.sep, "/")
            if rel_res in dirty:
                t = max(t, _mtime(res))
        if t > best:
            best = t
    return best


# ---------------------------------------------------------------------------
# SPEC-CONSISTENCY gate (spec-impl drift) — see module docstring §2.
# ---------------------------------------------------------------------------


def _glob_to_regex(glob: str) -> re.Pattern:
    """Compile a spec `code:` glob into an anchored regex over repo-relative
    POSIX paths. Supports `**` (across directories), `*` (within a segment) and
    `?`. Best-effort — the gate fails open if anything here misbehaves."""
    out: list[str] = []
    i, n = 0, len(glob)
    while i < n:
        c = glob[i]
        if c == "*":
            if i + 1 < n and glob[i + 1] == "*":
                i += 2
                if i < n and glob[i] == "/":
                    # `**/` → zero or more *whole* directory segments. Emitting a
                    # bare `.*` here let `**/x` match `ax`; `(?:.*/)?` keeps the
                    # match on a segment boundary.
                    out.append("(?:.*/)?")
                    i += 1
                else:
                    out.append(".*")       # trailing `**` → cross-directory wildcard
                continue
            out.append("[^/]*")            # * → within one path segment
        elif c == "?":
            out.append("[^/]")
        else:
            out.append(re.escape(c))
        i += 1
    return re.compile("^" + "".join(out) + "$")


def _parse_frontmatter_code(path: str) -> list[str]:
    """Extract the `code:` glob list from a markdown file's YAML frontmatter.
    Handles inline (`code: [a, b]`), single-value (`code: a`) and block-list
    (`code:\\n  - a\\n  - b`) forms. Returns [] when there is no frontmatter or
    no `code:` field."""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            if f.readline().strip() != "---":
                return []
            fm: list[str] = []
            for line in f:
                if line.strip() == "---":
                    break
                fm.append(line.rstrip("\n"))
    except OSError:
        return []

    def _clean(tok: str) -> str:
        return tok.strip().strip('"').strip("'")

    globs: list[str] = []
    i, n = 0, len(fm)
    while i < n:
        m = re.match(r"^code:\s*(.*)$", fm[i])
        if not m:
            i += 1
            continue
        rest = m.group(1).strip()
        if rest.startswith("["):
            for part in rest.strip("[]").split(","):
                g = _clean(part)
                if g:
                    globs.append(g)
        elif rest:
            g = _clean(rest)
            if g:
                globs.append(g)
        else:  # block list on following `  - <glob>` lines
            j = i + 1
            while j < n:
                mm = re.match(r"^\s*-\s*(.+)$", fm[j])
                if not mm:
                    break
                g = _clean(mm.group(1))
                if g:
                    globs.append(g)
                j += 1
        break  # only the first `code:` key matters
    return globs


def _spec_code_patterns(repo_root: str) -> list[re.Pattern]:
    """All compiled `code:` glob regexes across spec/**/*.md (deduped)."""
    spec_root = os.path.join(repo_root, SPEC_DIR)
    if not os.path.isdir(spec_root):
        return []
    seen: set[str] = set()
    patterns: list[re.Pattern] = []
    for dirpath, _dirs, files in os.walk(spec_root):
        for name in files:
            if not name.endswith(".md"):
                continue
            for g in _parse_frontmatter_code(os.path.join(dirpath, name)):
                if g in seen:
                    continue
                seen.add(g)
                try:
                    patterns.append(_glob_to_regex(g))
                except re.error:
                    continue
    return patterns


def _spec_linked_changes(repo_root: str, changed: list[str]) -> list[str]:
    """Subset of `changed` (repo-relative codebase/ paths) that matches at least
    one spec `code:` glob — i.e. code that implements a documented spec surface."""
    patterns = _spec_code_patterns(repo_root)
    if not patterns:
        return []
    linked: list[str] = []
    for rel in changed:
        posix = rel.replace(os.sep, "/")
        if any(p.match(posix) for p in patterns):
            linked.append(rel)
    return linked


def _iter_consistency_summaries(repo_root: str) -> list[str]:
    root = os.path.join(repo_root, CONSISTENCY_GLOB_ROOT)
    found: list[str] = []
    if not os.path.isdir(root):
        return found
    for dirpath, _dirs, files in os.walk(root):
        if "SUMMARY.md" in files:
            found.append(os.path.join(dirpath, "SUMMARY.md"))
    return found


def _is_impl_done_session(session_dir: str) -> bool:
    """True when the session's meta.json mode names the --impl-done mode."""
    try:
        with open(os.path.join(session_dir, "meta.json"), "r", encoding="utf-8") as f:
            mode = (json.load(f) or {}).get("mode", "")
    except (OSError, ValueError):
        return False
    return _IMPL_DONE_MODE_TOKEN in (mode or "")


def _summary_block_is_no(summary_path: str) -> bool:
    """True when the consistency SUMMARY's top `BLOCK:` line reads NO (no
    Critical spec-impl divergence). Unparseable / BLOCK: YES → False."""
    try:
        with open(summary_path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
    except OSError:
        return False
    # Read the whole file: a 4 KB cap could miss a BLOCK: line pushed past the
    # boundary by a long preamble. SUMMARY.md files are small (a few KB).
    m = _BLOCK_LINE.search(text)
    return bool(m) and m.group(1).upper() == "NO"


def _newest_resolved_impl_done_mtime(repo_root: str,
                                     dirty: set[str] | None = None) -> float:
    """Authoritative time of the most recent --impl-done consistency SUMMARY with
    BLOCK: NO (0.0 if none). Checkout-immune via the session-dir timestamp, with
    a dirty (just-written) SUMMARY's mtime folded in — same rule as the code
    review side. `dirty` may be passed in to reuse a single `git status`."""
    if dirty is None:
        dirty = _dirty_set(repo_root)
    best = 0.0
    for summary in _iter_consistency_summaries(repo_root):
        session_dir = os.path.dirname(summary)
        if not _is_impl_done_session(session_dir):
            continue
        if not _summary_block_is_no(summary):
            continue
        t = _path_session_time(session_dir)
        rel_summary = os.path.relpath(summary, repo_root).replace(os.sep, "/")
        if rel_summary in dirty:
            t = max(t, _mtime(summary))
        if t > best:
            best = t
    return best


def _code_review_in_flight(repo_root: str, now: float | None = None) -> bool:
    """True when a `/ai-review` session has been *started* but not finished.

    A started review has created its session dir + meta.json (the orchestrator's
    --prepare step) but not yet written SUMMARY.md (the reviewers are still
    running). Blocking turn-end in that window is the root of the "I just
    launched /ai-review and the Stop hook fired anyway" symptom — the gate has
    no other way to see an async review in progress. We only honour recent
    sessions (within _IN_FLIGHT_TTL_SECONDS, by the checkout-immune session-dir
    timestamp) so an abandoned/crashed session cannot suppress the gate forever;
    the push guard remains the hard backstop. `now` is injectable for tests;
    production callers omit it (defaults to time.time())."""
    now = time.time() if now is None else now
    root = os.path.join(repo_root, REVIEW_GLOB_ROOT)
    if not os.path.isdir(root):
        return False
    for dirpath, _dirs, files in os.walk(root):
        if "meta.json" not in files or "SUMMARY.md" in files:
            continue
        t = _path_session_time(dirpath)
        if t <= 0.0 or (now - t) > _IN_FLIGHT_TTL_SECONDS:
            continue
        # Require a parseable meta.json — a stray/empty file in the tree must not
        # silently suppress the gate (defence-in-depth; the orchestrator always
        # writes valid JSON here).
        try:
            with open(os.path.join(dirpath, "meta.json"), "r", encoding="utf-8") as f:
                json.load(f)
        except (OSError, ValueError):
            continue
        return True
    return False


def evaluate_review(cwd: str | None = None) -> ReviewDecision:
    """Return a ReviewDecision for the working dir (cwd or '.').

    blocked == True  → caller should refuse (push) / block stop.
    blocked == False → proceed; `reason` may carry context for logging.
    """
    cwd = cwd or os.getcwd()

    repo_root = _repo_root(cwd)
    if repo_root is None:
        return ReviewDecision(False, "not inside a git repository — allowed")

    default = _default_branch(cwd)
    base = _merge_base(cwd, default) if default else None

    committed = _committed_code_changes(cwd, base) if base else []
    uncommitted = _uncommitted_code_changes(cwd)
    changed = sorted(set(committed) | set(uncommitted))

    if not changed:
        return ReviewDecision(False, "no codebase/ changes on this branch — allowed")

    # A `/ai-review` started this turn but still running is not an unreviewed
    # branch — it is a review mid-flight. Don't fire the nudge for work the model
    # is already doing; the push guard still hard-gates if the review never
    # lands. (Targets the async-review ↔ synchronous-Stop race.)
    if _code_review_in_flight(repo_root):
        return ReviewDecision(
            False, "a code review session is in flight (started, SUMMARY pending) — allowed"
        )

    # One `git status` shared across every freshness query below (the dirty set
    # decides mtime-vs-commit-time per file on both the code and review sides).
    dirty = _dirty_set(repo_root)

    # ---- Gate 1: code review coverage --------------------------------------
    newest_code = _newest_code_mtime(repo_root, changed, dirty)
    newest_review = _newest_resolved_review_mtime(repo_root, dirty)

    if newest_review <= 0.0:
        return ReviewDecision(
            True,
            f"{len(changed)} codebase/ file(s) changed on this branch but no "
            f"resolved review (review/code/**/SUMMARY.md) was found.",
        )

    if newest_review < newest_code:
        return ReviewDecision(
            True,
            f"{len(changed)} codebase/ file(s) changed AFTER the most recent "
            f"resolved review — the code was edited since it was reviewed.",
        )

    # ---- Gate 2: spec-impl consistency (--impl-done) -----------------------
    # Only the subset of changes that implement a documented spec surface
    # (matches a spec frontmatter `code:` glob) is held to this gate.
    spec_linked = _spec_linked_changes(repo_root, changed)
    if spec_linked:
        newest_spec_code = _newest_code_mtime(repo_root, spec_linked, dirty)
        newest_impl_done = _newest_resolved_impl_done_mtime(repo_root, dirty)
        if newest_impl_done <= 0.0:
            return ReviewDecision(
                True,
                f"{len(spec_linked)} changed file(s) implement a spec-documented "
                f"surface (matched a spec `code:` glob) but no passing "
                f"`--impl-done` consistency report (review/consistency/**, "
                f"BLOCK: NO) was found. Run "
                f"`/consistency-check --impl-done <spec/영역>` to verify the "
                f"implementation still matches the spec.",
            )
        if newest_impl_done < newest_spec_code:
            return ReviewDecision(
                True,
                f"{len(spec_linked)} spec-linked file(s) changed AFTER the most "
                f"recent `--impl-done` consistency report — re-run "
                f"`/consistency-check --impl-done <spec/영역>` so the spec-impl "
                f"check postdates the latest edit.",
            )

    return ReviewDecision(
        False,
        f"{len(changed)} codebase/ change(s) covered by a fresh resolved review"
        + (
            f" and a fresh --impl-done consistency report ({len(spec_linked)} "
            f"spec-linked)"
            if spec_linked
            else ""
        )
        + " — allowed",
    )
