"""Unit tests for `worktree-*` → `claude/*` branch normalization.

The function must be idempotent and self-healing: it renames only fresh,
un-pushed `worktree-*` branches inside a linked worktree, and is a safe no-op
everywhere else. We patch the git-backed helpers and the `git branch -m` call.
"""

from __future__ import annotations

import unittest
from unittest import mock

import _harness  # noqa: F401  — side effect: puts .claude/hooks on sys.path
from _lib import branch_naming as bn


class NormalizeTest(unittest.TestCase):
    def _normalize(self, *, repo_root, is_main, branch, has_upstream,
                   target_exists=False, rename_rc=0):
        run_git = mock.Mock(return_value=(rename_rc, "", "" if rename_rc == 0 else "boom"))
        with mock.patch.object(bn, "_repo_root", return_value=repo_root), \
             mock.patch.object(bn, "_is_main_worktree", return_value=is_main), \
             mock.patch.object(bn, "_current_branch", return_value=branch), \
             mock.patch.object(bn, "_has_upstream", return_value=has_upstream), \
             mock.patch.object(bn, "_branch_exists", return_value=target_exists), \
             mock.patch.object(bn, "_run_git", run_git):
            result = bn.normalize("/fake/cwd")
        return result, run_git

    def test_renames_fresh_worktree_branch(self):
        result, run_git = self._normalize(
            repo_root="/r", is_main=False, branch="worktree-foo", has_upstream=False
        )
        self.assertTrue(result.renamed)
        self.assertEqual(result.old, "worktree-foo")
        self.assertEqual(result.new, "claude/foo")
        run_git.assert_called_once_with(
            ["branch", "-m", "worktree-foo", "claude/foo"], "/fake/cwd"
        )

    def test_idempotent_on_already_conventional_branch(self):
        result, run_git = self._normalize(
            repo_root="/r", is_main=False, branch="claude/foo-abc", has_upstream=False
        )
        self.assertFalse(result.renamed)
        run_git.assert_not_called()

    def test_skips_main_worktree(self):
        result, run_git = self._normalize(
            repo_root="/r", is_main=True, branch="worktree-foo", has_upstream=False
        )
        self.assertFalse(result.renamed)
        run_git.assert_not_called()

    def test_skips_when_branch_has_upstream(self):
        # Renaming a pushed branch would diverge from its open PR.
        result, run_git = self._normalize(
            repo_root="/r", is_main=False, branch="worktree-foo", has_upstream=True
        )
        self.assertFalse(result.renamed)
        run_git.assert_not_called()

    def test_skips_outside_repo(self):
        result, run_git = self._normalize(
            repo_root=None, is_main=False, branch="worktree-foo", has_upstream=False
        )
        self.assertFalse(result.renamed)
        run_git.assert_not_called()

    def test_skips_detached_head(self):
        result, run_git = self._normalize(
            repo_root="/r", is_main=False, branch=None, has_upstream=False
        )
        self.assertFalse(result.renamed)
        run_git.assert_not_called()

    def test_collision_appends_slug(self):
        result, _ = self._normalize(
            repo_root="/r", is_main=False, branch="worktree-foo",
            has_upstream=False, target_exists=True,
        )
        self.assertTrue(result.renamed)
        self.assertTrue(result.new.startswith("claude/foo-"))
        self.assertNotEqual(result.new, "claude/foo")  # slug appended

    def test_rename_failure_is_reported_not_raised(self):
        result, _ = self._normalize(
            repo_root="/r", is_main=False, branch="worktree-foo",
            has_upstream=False, rename_rc=1,
        )
        self.assertFalse(result.renamed)
        self.assertIn("failed", result.reason)


if __name__ == "__main__":
    unittest.main()
