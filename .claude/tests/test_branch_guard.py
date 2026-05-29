"""Unit tests for the default-branch guard decision logic.

`branch_guard.evaluate()` composes four git-backed helpers; we patch those
helpers (not git itself) so the tests are hermetic and assert the *decision
table* documented in the module: block only on (main worktree) ∧ (current ==
origin default); allow in every other case.
"""

from __future__ import annotations

import contextlib
import io
import unittest
from unittest import mock

import _harness  # noqa: F401  — side effect: puts .claude/hooks on sys.path
from _lib import branch_guard as bg


class EvaluateDecisionTableTest(unittest.TestCase):
    def _evaluate(self, *, repo_root, is_main, branch, default):
        with mock.patch.object(bg, "_repo_root", return_value=repo_root), \
             mock.patch.object(bg, "_is_main_worktree", return_value=is_main), \
             mock.patch.object(bg, "_current_branch", return_value=branch), \
             mock.patch.object(bg, "_origin_default_branch", return_value=default):
            return bg.evaluate("/fake/cwd")

    def test_blocks_on_main_worktree_default_branch(self):
        d = self._evaluate(repo_root="/r", is_main=True, branch="main", default="main")
        self.assertTrue(d.blocked)
        self.assertIn("main", d.reason)

    def test_allows_non_default_branch_on_main_worktree(self):
        d = self._evaluate(
            repo_root="/r", is_main=True, branch="claude/x-123", default="main"
        )
        self.assertFalse(d.blocked)

    def test_allows_linked_worktree_even_on_default_branch_name(self):
        # A linked worktree is never blocked, regardless of branch name.
        d = self._evaluate(repo_root="/r", is_main=False, branch="main", default="main")
        self.assertFalse(d.blocked)

    def test_allows_outside_git_repo(self):
        d = self._evaluate(repo_root=None, is_main=True, branch="main", default="main")
        self.assertFalse(d.blocked)

    def test_allows_detached_head(self):
        d = self._evaluate(repo_root="/r", is_main=True, branch=None, default="main")
        self.assertFalse(d.blocked)

    def test_allows_when_origin_default_unknown(self):
        d = self._evaluate(repo_root="/r", is_main=True, branch="main", default=None)
        self.assertFalse(d.blocked)

    def test_default_branch_is_not_hardcoded_to_main(self):
        # Repos whose default branch is e.g. `master` or `trunk` must block too.
        d = self._evaluate(
            repo_root="/r", is_main=True, branch="trunk", default="trunk"
        )
        self.assertTrue(d.blocked)


class IsMainWorktreeTest(unittest.TestCase):
    """`.git` is a directory on the main worktree, a file on a linked one."""

    def test_dir_is_main(self):
        with mock.patch("os.path.isdir", return_value=True):
            self.assertTrue(bg._is_main_worktree("/repo"))

    def test_file_is_linked(self):
        with mock.patch("os.path.isdir", return_value=False):
            self.assertFalse(bg._is_main_worktree("/repo/.claude/worktrees/x"))


class CliExitCodeTest(unittest.TestCase):
    def test_blocked_returns_2(self):
        with mock.patch.object(
            bg, "evaluate", return_value=bg.GuardDecision(True, "blocked")
        ), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(bg.main_for_cli(), 2)

    def test_allowed_returns_0(self):
        with mock.patch.object(
            bg, "evaluate", return_value=bg.GuardDecision(False, "allowed")
        ), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(bg.main_for_cli(), 0)


if __name__ == "__main__":
    unittest.main()
