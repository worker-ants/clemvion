"""Normalize harness-created `worktree-<name>` branches to the project's
`claude/<name>` convention.

Background: the built-in `EnterWorktree` tool always names its branch
`worktree-<name>`. The project convention (enforced by
`.claude/tools/ensure-worktree.sh`) is `claude/<task>-<slug>`. No harness
setting controls that prefix, and the `WorktreeCreate` hook does not fire
inside a git repository (it is a non-git fallback only). So we cannot
intercept creation — we normalize after the fact.

Policy (`normalize`):
  - Act only inside a **linked worktree** (top-level `.git` is a file), so
    branches on the main worktree are never touched.
  - Act only when the current branch starts with `worktree-`. Otherwise
    no-op — this makes the function idempotent and self-healing for any
    pre-existing stray branches.
  - **Skip if the branch already has an upstream** — renaming a branch that
    was already pushed would diverge local/remote and disrupt an open PR.
    Only fresh, un-pushed local branches are renamed.
  - On collision with an existing `claude/<name>`, append a short random
    slug so the rename never clobbers another branch.

The rename uses `git branch -m`, which safely renames the currently
checked-out branch (HEAD follows) even from within a linked worktree.
"""

from __future__ import annotations

import os
import secrets
from dataclasses import dataclass

from _lib.branch_guard import (
    _current_branch,
    _is_main_worktree,
    _repo_root,
    _run_git,
)

LEGACY_PREFIX = "worktree-"
TARGET_PREFIX = "claude/"


@dataclass(frozen=True)
class RenameResult:
    renamed: bool
    old: str | None = None
    new: str | None = None
    reason: str = ""  # human-readable context for logging / reminders.


def _has_upstream(cwd: str) -> bool:
    rc, _, _ = _run_git(
        ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], cwd,
    )
    return rc == 0


def _branch_exists(cwd: str, name: str) -> bool:
    rc, _, _ = _run_git(
        ["show-ref", "--verify", "--quiet", f"refs/heads/{name}"], cwd,
    )
    return rc == 0


def normalize(cwd: str | None = None) -> RenameResult:
    """Rename a `worktree-*` branch to `claude/*` when safe. See module doc."""
    cwd = cwd or os.getcwd()

    repo_root = _repo_root(cwd)
    if repo_root is None:
        return RenameResult(False, reason="not inside a git repository")

    # Never touch the main worktree — only linked worktrees (.git is a file).
    if _is_main_worktree(repo_root):
        return RenameResult(False, reason="main worktree — skip")

    branch = _current_branch(cwd)
    if not branch:
        return RenameResult(False, reason="detached HEAD or non-branch state")

    if not branch.startswith(LEGACY_PREFIX):
        return RenameResult(False, reason="already conventional — nothing to do")

    if _has_upstream(cwd):
        return RenameResult(
            False, old=branch, reason="branch already has upstream — skip rename",
        )

    target = TARGET_PREFIX + branch[len(LEGACY_PREFIX):]
    if _branch_exists(cwd, target):
        target = f"{target}-{secrets.token_hex(3)}"

    rc, _, err = _run_git(["branch", "-m", branch, target], cwd)
    if rc != 0:
        return RenameResult(False, old=branch, reason=f"git branch -m failed: {err}")

    return RenameResult(True, old=branch, new=target)
