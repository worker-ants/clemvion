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

Policy (see evaluate_review):
  BLOCK when BOTH:
    1. the branch has codebase/ changes (uncommitted, or committed since the
       merge-base with the default branch), AND
    2. there is no *fresh, resolved* review covering them.
  ALLOW otherwise — including no code change, no git repo, detached HEAD, or
  any internal error (fail-open: a guard must never wedge the session).

"Fresh, resolved review" =
  a `review/code/**/SUMMARY.md` in the working tree whose
    - risk is resolved:  `## 전체 위험도` line is NONE/LOW, OR a sibling
      `RESOLUTION.md` exists (critical/warning were addressed), AND
    - freshness:         its mtime >= the newest changed codebase file's mtime
      (the review postdates the latest code edit).

The freshness check uses filesystem mtime for both sides — they are compared
within the *same* working tree at the same instant, so the comparison is
internally consistent even though absolute mtimes are not portable across
checkouts. This is a strong nudge, not a precise oracle; like the CWD-based
worktree guard it errs toward not false-blocking, and BYPASS_REVIEW_GUARD=1
(handled by callers) provides a conscious one-off override.
"""

from __future__ import annotations

import os
import re
import subprocess
from dataclasses import dataclass

THIS_DIR = os.path.dirname(os.path.abspath(__file__))

try:
    # Reuse the default-branch resolver so "since the branch started" is
    # computed against the same default branch the worktree guard uses.
    from branch_guard import _origin_default_branch  # type: ignore
except Exception:  # pragma: no cover - import path fallback
    _origin_default_branch = None  # type: ignore


CODE_PREFIX = "codebase/"
REVIEW_GLOB_ROOT = os.path.join("review", "code")


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
    files: list[str] = []
    for ln in out.splitlines():
        # porcelain v1: "XY <path>" (path starts at col 3). Handles renames "->".
        path = ln[3:].strip()
        if "->" in path:
            path = path.split("->", 1)[1].strip()
        if path:
            files.append(path)
    return files


def _mtime(path: str) -> float:
    try:
        return os.path.getmtime(path)
    except OSError:
        return 0.0


def _newest_code_mtime(repo_root: str, rel_paths: list[str]) -> float:
    newest = 0.0
    for rel in rel_paths:
        m = _mtime(os.path.join(repo_root, rel))
        if m > newest:
            newest = m
    return newest


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

    # Overall risk: the level token on/just after the '전체 위험도' heading.
    risk_level = None
    for i, ln in enumerate(lines):
        if _RISK_LINE.search(ln):
            window = "\n".join(lines[i:i + 3])
            m = _RISK_LEVEL.search(window)
            if m:
                risk_level = m.group(1)
            break

    # Count actionable rows under the Critical and Warning sections.
    has_actionable = _section_has_rows(lines, "Critical") or _section_has_rows(
        lines, "경고"
    )

    if risk_level in ("HIGH", "CRITICAL"):
        return False
    if has_actionable:
        return False
    # NONE/LOW/MEDIUM with no actionable rows, and no RESOLUTION → treat MEDIUM
    # as unresolved only if it carried rows (already handled). Clean report.
    if risk_level in (None, "MEDIUM") and has_actionable:
        return False
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


def _newest_resolved_review_mtime(repo_root: str) -> float:
    """mtime of the most recent *resolved* review SUMMARY.md (0.0 if none)."""
    best = 0.0
    for summary in _iter_summaries(repo_root):
        if not _summary_is_resolved(summary):
            continue
        # Freshness anchored on the latest of SUMMARY.md / RESOLUTION.md mtime.
        m = _mtime(summary)
        res = os.path.join(os.path.dirname(summary), "RESOLUTION.md")
        if os.path.exists(res):
            m = max(m, _mtime(res))
        if m > best:
            best = m
    return best


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

    newest_code = _newest_code_mtime(repo_root, changed)
    newest_review = _newest_resolved_review_mtime(repo_root)

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

    return ReviewDecision(
        False,
        f"{len(changed)} codebase/ change(s) covered by a fresh resolved review "
        f"— allowed",
    )
