"""Default-branch guard — judges whether the caller is on the main worktree
**and** has the origin default branch checked out.

This module is consumed by:
  - .claude/hooks/guard_default_branch_edit.py    (PreToolUse hook)
  - .claude/hooks/guard_default_branch_prompt.py  (UserPromptSubmit hook)
  - .githooks/pre-commit                          (via `python3 -m`)

Policy:
  - BLOCK when both:
      1. The top-level `.git` is a **directory** (== main worktree, not a
         linked worktree where `.git` is a file).
      2. The current branch equals origin's default branch.
  - ALLOW in every other case — including a missing origin, a detached
    HEAD, or a non-default branch on the main worktree.

The module never reads environment variables on its own. Callers handle
`BYPASS_DEFAULT_BRANCH_GUARD=1` themselves so the judgment surface stays
single-purpose.
"""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass


@dataclass(frozen=True)
class GuardDecision:
    blocked: bool
    reason: str  # human-readable; useful for stderr / system reminder bodies.


def _run_git(args: list[str], cwd: str, timeout: float = 5.0) -> tuple[int, str, str]:
    """Run a git command with short timeout. Empty output on failure."""
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


def _is_main_worktree(repo_root: str) -> bool:
    """Main worktree: top-level `.git` is a directory.
    Linked worktrees: top-level `.git` is a file containing `gitdir: ...`.
    """
    git_path = os.path.join(repo_root, ".git")
    return os.path.isdir(git_path)


def _current_branch(cwd: str) -> str | None:
    """Return current branch name, or None for detached HEAD / unknown."""
    rc, out, _ = _run_git(["symbolic-ref", "--short", "HEAD"], cwd)
    if rc == 0 and out:
        return out
    return None  # detached HEAD or other non-branch state


def _origin_default_branch(cwd: str) -> str | None:
    """Resolve origin's default branch.

    Priority:
      1. `git symbolic-ref refs/remotes/origin/HEAD` — fully local, fast.
         Returns refs/remotes/origin/<name> on success.
      2. `git remote show origin` — needs network; only used as fallback.
      3. None if origin does not exist or both methods fail.
    """
    # Step 0: does origin remote exist at all?
    rc, out, _ = _run_git(["remote"], cwd)
    if rc != 0:
        return None
    remotes = {line.strip() for line in out.splitlines() if line.strip()}
    if "origin" not in remotes:
        return None

    # Method 1: symbolic-ref of origin/HEAD (local cache; no network).
    rc, out, _ = _run_git(
        ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], cwd,
    )
    if rc == 0 and out:
        # `out` looks like "origin/main" — strip the remote prefix.
        prefix = "origin/"
        if out.startswith(prefix):
            return out[len(prefix):]
        return out  # unexpected format; pass through

    # Method 2: ask the remote. May hit the network; cap with short timeout.
    # This runs on every Stop / push PreToolUse, so keep the worst-case stall
    # small — Method 1 (local symbolic-ref) covers the normal case for free.
    rc, out, _ = _run_git(["remote", "show", "origin"], cwd, timeout=2.0)
    if rc == 0 and out:
        for line in out.splitlines():
            stripped = line.strip()
            if stripped.startswith("HEAD branch:"):
                name = stripped.split(":", 1)[1].strip()
                if name and name != "(unknown)":
                    return name
    return None


def evaluate(cwd: str | None = None) -> GuardDecision:
    """Return a GuardDecision for the given working directory (cwd or `.`).

    blocked == True  → caller should refuse the operation.
    blocked == False → caller should proceed; `reason` may carry context
                       for logging (e.g. "origin missing — allowed").
    """
    cwd = cwd or os.getcwd()

    repo_root = _repo_root(cwd)
    if repo_root is None:
        return GuardDecision(False, "not inside a git repository — allowed")

    if not _is_main_worktree(repo_root):
        return GuardDecision(False, "linked worktree (.git is a file) — allowed")

    current = _current_branch(cwd)
    if current is None:
        return GuardDecision(False, "detached HEAD or non-branch state — allowed")

    default = _origin_default_branch(cwd)
    if default is None:
        return GuardDecision(False, "no origin remote or default branch unknown — allowed")

    if current == default:
        return GuardDecision(
            True,
            f"main worktree on default branch '{default}' — blocked. "
            f"Create or switch to a worktree/branch under .claude/worktrees/, "
            f"or set BYPASS_DEFAULT_BRANCH_GUARD=1 for a one-off override.",
        )

    return GuardDecision(
        False,
        f"main worktree but current branch '{current}' != default '{default}' — allowed",
    )


def main_for_cli() -> int:
    """Allow `python3 -m branch_guard` to be used by the shell pre-commit hook.

    Exit codes:
      0 — allowed (reason on stdout for optional logging)
      2 — blocked (reason on stderr)
    Any other value indicates a programming error.
    """
    import sys
    decision = evaluate()
    if decision.blocked:
        print(decision.reason, file=sys.stderr)
        return 2
    if decision.reason:
        print(decision.reason)
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main_for_cli())
