"""Plan-coverage guard — judges whether the current branch carries
`codebase/**` changes while the *linked* in-progress plan was neither updated
nor moved to `plan/complete/`.

This is the enforcement teeth behind the project rule "PR 를 올리기 전에는
처리하던 plan 을 갱신하거나 complete 로 이동" (CLAUDE.md / plan-lifecycle.md).
Until now that rule lived only as prose, while *review* coverage was hook-gated
(`review_guard.py`) — the same asymmetry that let review/fix slip to "the PR"
also let plan bookkeeping slip past the push. This module gives the plan step
the same kind of teeth, riding the existing `git push` / Stop gates.

Consumed by:
  - .claude/hooks/guard_review_before_push.py  (PreToolUse(Bash): hard-blocks `git push`)
  - .claude/hooks/guard_review_before_stop.py  (Stop: soft "move to complete" nudge)

Two distinct signals (see PlanDecision):
  - untouched (HARD, push gate): the branch changed `codebase/**` AND a linked
    in-progress plan exists AND that plan file was NOT touched in the branch
    diff (neither updated in place nor moved to plan/complete/). Block the push.
  - complete_but_in_progress (SOFT, Stop nudge): the linked plan's checkboxes
    are ALL `[x]` but it still lives under plan/in-progress/. Suggest moving it
    to plan/complete/ (the "마지막 작업 PR 안에서 이동" rule). Never blocks —
    "done" is a judgment call, so this is a one-shot reminder only.

Scope — like review_guard, **only `codebase/**` changes arm the gate.** A
spec/plan/docs-only branch is never plan-gated. The gate is further scoped to
branches that actually have a *linked* plan: the in-progress plan whose
frontmatter `worktree:` resolves to the current worktree. Ad-hoc / hotfix work
with no associated plan is therefore never blocked (the natural escape hatch);
`BYPASS_PLAN_GUARD=1` (handled by callers) is the conscious one-off override.

How the plan↔branch link is resolved — the `worktree:` frontmatter field is
free-form in practice (`agent-memory-model-select-83e703`, `(unstarted)`,
`.claude/worktrees/x (branch claude/y)`, bare `fix-bg-context`). We normalise it
to a worktree *basename* and match it against the current worktree dir basename
(== `git rev-parse --show-toplevel` basename, which in the standard flow equals
the branch with the `claude/` prefix stripped). A plan whose worktree is
`(unstarted)` / empty never matches, so it cannot arm the gate.

Like the CWD-based worktree guard and review_guard, this errs toward NOT
false-blocking: any parse failure, missing git, detached HEAD, or absent linked
plan resolves to "not blocked".
"""

from __future__ import annotations

import os
import re
import subprocess
from dataclasses import dataclass

THIS_DIR = os.path.dirname(os.path.abspath(__file__))

try:
    # Reuse the default-branch resolver so the merge-base is computed against the
    # same default branch the other guards use.
    from branch_guard import _origin_default_branch  # type: ignore
except Exception:  # pragma: no cover - import path fallback
    _origin_default_branch = None  # type: ignore


CODE_PREFIX = "codebase/"
PLAN_PREFIX = "plan/"
IN_PROGRESS_DIR = os.path.join("plan", "in-progress")

# Placeholder `worktree:` values that mean "no worktree yet" — these must never
# resolve to a real worktree basename (else an unstarted plan could arm the gate
# for an unrelated branch).
_PLACEHOLDER_WORKTREE = {"(unstarted)", "unstarted", "-", "tbd", "none", "n/a"}

# A markdown task checkbox line: `- [ ]`, `- [x]`, `* [X]`, with optional indent.
_CHECKBOX = re.compile(r"^\s*[-*]\s+\[(?P<mark>[ xX])\]")
# Trailing " (branch ...)" annotation some plans append to the worktree value.
_BRANCH_ANNOT = re.compile(r"\s*\(branch[^)]*\)\s*$", re.IGNORECASE)


@dataclass(frozen=True)
class PlanDecision:
    # HARD gate (push): linked in-progress plan was not updated or moved.
    untouched: bool
    # SOFT gate (Stop): linked plan is all-checked but still in plan/in-progress/.
    complete_but_in_progress: bool
    reason: str
    plan_path: str | None  # repo-relative path of the linked plan, for messages.


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


def _current_branch(cwd: str) -> str | None:
    rc, out, _ = _run_git(["symbolic-ref", "--short", "HEAD"], cwd)
    if rc == 0 and out:
        return out
    return None


def _default_branch(cwd: str) -> str | None:
    if _origin_default_branch is not None:
        try:
            d = _origin_default_branch(cwd)
            if d:
                return d
        except Exception:
            pass
    for name in ("main", "master"):
        rc, _, _ = _run_git(["rev-parse", "--verify", f"refs/heads/{name}"], cwd)
        if rc == 0:
            return name
    return None


def _merge_base(cwd: str, default_branch: str) -> str | None:
    for ref in (f"origin/{default_branch}", default_branch):
        rc, out, _ = _run_git(["merge-base", "HEAD", ref], cwd)
        if rc == 0 and out:
            return out
    return None


def _porcelain_path(ln: str) -> str:
    """Destination path from one `git status --porcelain v1` line (rename-aware)."""
    if len(ln) < 4:
        return ""
    code = ln[:2]
    path = ln[3:].strip()
    if code and code[0] in ("R", "C") and " -> " in path:
        path = path.split(" -> ", 1)[1].strip()
    return path


def _committed_changes(cwd: str, base: str, prefix: str) -> list[str]:
    rc, out, _ = _run_git(
        ["diff", "--name-only", f"{base}..HEAD", "--", prefix], cwd
    )
    if rc != 0 or not out:
        return []
    return [ln for ln in out.splitlines() if ln.strip()]


def _uncommitted_changes(cwd: str, prefix: str) -> list[str]:
    rc, out, _ = _run_git(["status", "--porcelain", "--", prefix], cwd)
    if rc != 0 or not out:
        return []
    return [p for p in (_porcelain_path(ln) for ln in out.splitlines()) if p]


def _branch_changes(cwd: str, base: str | None, prefix: str) -> list[str]:
    """Union of committed-since-base and uncommitted paths under `prefix`."""
    committed = _committed_changes(cwd, base, prefix) if base else []
    uncommitted = _uncommitted_changes(cwd, prefix)
    return sorted(set(committed) | set(uncommitted))


def _normalize_worktree_value(value: str) -> str | None:
    """Reduce a free-form `worktree:` frontmatter value to a worktree basename.

    Strips a trailing ` (branch …)` annotation and any leading path (so
    `.claude/worktrees/x` → `x`), and rejects placeholder/empty values. Returns
    None when the value does not denote a concrete worktree.
    """
    v = (value or "").strip()
    v = _BRANCH_ANNOT.sub("", v).strip()
    if not v or v.lower() in _PLACEHOLDER_WORKTREE:
        return None
    v = v.rstrip("/").split("/")[-1].strip()
    if not v or v.startswith("("):
        return None
    return v


def _frontmatter_worktree(path: str) -> str | None:
    """The raw `worktree:` value from a markdown file's YAML frontmatter, or None."""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            if f.readline().strip() != "---":
                return None
            for line in f:
                if line.strip() == "---":
                    break
                m = re.match(r"^worktree:\s*(.*)$", line)
                if m:
                    return m.group(1).strip()
    except OSError:
        return None
    return None


def _linked_plans(repo_root: str, cwd: str) -> list[str]:
    """Repo-relative paths of in-progress plans linked to the current worktree.

    Match = a plan/in-progress/*.md whose normalised `worktree:` equals the
    current worktree dir basename, or the branch with the `claude/` prefix
    stripped. Returns ALL matches (sorted) — one worktree may legitimately carry
    several plans, so the gate is satisfied when *any* one of them was handled.
    Empty list when none match (the gate then stays disarmed)."""
    in_progress = os.path.join(repo_root, IN_PROGRESS_DIR)
    if not os.path.isdir(in_progress):
        return []

    keys = {os.path.basename(repo_root.rstrip("/"))}
    branch = _current_branch(cwd)
    if branch and branch.startswith("claude/"):
        keys.add(branch[len("claude/"):])
    keys = {k for k in keys if k}
    if not keys:
        return []

    matches: list[str] = []
    for name in sorted(os.listdir(in_progress)):
        if not name.endswith(".md"):
            continue
        raw = _frontmatter_worktree(os.path.join(in_progress, name))
        if raw is None:
            continue
        norm = _normalize_worktree_value(raw)
        if norm and norm in keys:
            matches.append(os.path.join(IN_PROGRESS_DIR, name).replace(os.sep, "/"))
    return matches


def _plan_handled(plan_rel: str, plan_changes: list[str]) -> bool:
    """True if `plan_rel` was updated in place OR moved to plan/complete/ in the
    branch diff. Matches the exact path (update) or a same-basename file under
    plan/complete/ excluding archive (move) — NOT a bare basename match, so an
    unrelated same-named file elsewhere in plan/ cannot satisfy the gate."""
    base = os.path.basename(plan_rel)
    for p in plan_changes:
        if p == plan_rel:
            return True  # updated in place
        if (
            os.path.basename(p) == base
            and p.startswith("plan/complete/")
            and not p.startswith("plan/complete/archive/")
        ):
            return True  # moved to plan/complete/ (archive is not a completion)
    return False


def _all_checkboxes_done(repo_root: str, plan_rel: str) -> bool:
    """True when the plan has at least one checkbox and none are open (`[ ]`)."""
    path = os.path.join(repo_root, plan_rel)
    open_count = done_count = 0
    in_frontmatter = False
    seen_first = False
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                stripped = line.strip()
                # Skip the YAML frontmatter block so a `code:`-style fence cannot
                # be miscounted; toggle on the first and second `---`.
                if stripped == "---":
                    if not seen_first:
                        seen_first = True
                        in_frontmatter = True
                        continue
                    if in_frontmatter:
                        in_frontmatter = False
                        continue
                if in_frontmatter:
                    continue
                m = _CHECKBOX.match(line)
                if not m:
                    continue
                if m.group("mark") == " ":
                    open_count += 1
                else:
                    done_count += 1
    except OSError:
        return False
    return done_count > 0 and open_count == 0


def evaluate_plan(cwd: str | None = None) -> PlanDecision:
    """Return a PlanDecision for the working dir (cwd or '.').

    untouched == True               → push gate should hard-block.
    complete_but_in_progress == True → Stop gate should nudge to move the plan.
    """
    cwd = cwd or os.getcwd()
    none = PlanDecision(False, False, "", None)

    repo_root = _repo_root(cwd)
    if repo_root is None:
        return none

    default = _default_branch(cwd)
    base = _merge_base(cwd, default) if default else None

    code_changes = _branch_changes(cwd, base, CODE_PREFIX)
    if not code_changes:
        # Only codebase/ work arms the plan gate (same scope as review_guard).
        return none

    plan_rels = _linked_plans(repo_root, cwd)
    if not plan_rels:
        # No in-progress plan is linked to this worktree → nothing to enforce.
        # (A plan already MOVED to complete is no longer under in-progress, so it
        # correctly reads as "satisfied" — moving counts as handling the plan.)
        return none

    plan_changes = _branch_changes(cwd, base, PLAN_PREFIX)
    handled = [pr for pr in plan_rels if _plan_handled(pr, plan_changes)]
    # Soft signal: a linked plan whose checkboxes are all done but still in-progress.
    complete_pending = [pr for pr in plan_rels if _all_checkboxes_done(repo_root, pr)]
    # For messages, prefer pointing at a finished-but-unmoved plan.
    focus = complete_pending[0] if complete_pending else plan_rels[0]

    if not handled:
        # None of the linked plans was updated or moved → hard block.
        multi = (
            f" (이 worktree 에 연결된 plan {len(plan_rels)}개 중 갱신·이동된 것 없음)"
            if len(plan_rels) > 1
            else ""
        )
        return PlanDecision(
            True,
            bool(complete_pending),
            (
                f"{len(code_changes)} codebase/ file(s) changed on this branch but "
                f"the linked in-progress plan ({focus}) was neither updated nor "
                f"moved to plan/complete/.{multi}"
            ),
            focus,
        )

    # At least one linked plan handled → push gate satisfied. Surface the soft
    # "move the finished plan" signal if any linked plan is complete-but-in-progress.
    return PlanDecision(
        False,
        bool(complete_pending),
        f"{len(handled)}/{len(plan_rels)} linked plan(s) updated or moved.",
        focus if complete_pending else handled[0],
    )
