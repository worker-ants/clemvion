"""Integration tests for reap-merged-worktrees.sh.

These build a throwaway git repo with real worktrees + branches, stub `gh` via
REAP_GH_BIN, and run the actual script (copied verbatim into the temp repo
alongside cleanup-worktree.sh). They assert the documented behaviour:
  - remove a worktree only when gh reports its PR MERGED and it is clean;
  - skip the dirty / unmerged worktree (fail-safe);
  - delete a dangling ancestor-merged branch with no gh (git-enforced `-d`);
  - delete a dangling squash-merged branch only on a gh MERGED verdict (`-D`);
  - never touch a dangling branch gh cannot confirm;
  - --dry-run plans without mutating anything.
The throttle is disabled (REAP_MIN_INTERVAL=0) so each run executes.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import unittest

import _harness  # noqa: F401  — side effect: puts .claude/hooks on sys.path

SRC_ROOT = _harness.REPO_ROOT
REAPER_SRC = SRC_ROOT / ".claude" / "tools" / "reap-merged-worktrees.sh"
CLEANUP_SRC = SRC_ROOT / ".claude" / "tools" / "cleanup-worktree.sh"

_GH_STUB = """#!/usr/bin/env bash
# Test stub: echo MERGED for branches named in $MERGED_BRANCHES, else OPEN.
if [ "${1:-}" = "pr" ] && [ "${2:-}" = "view" ]; then
  for b in ${MERGED_BRANCHES:-}; do
    [ "$b" = "${3:-}" ] && { echo MERGED; exit 0; }
  done
fi
echo OPEN
exit 0
"""


class ReaperTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        # realpath so git-common-dir and worktree paths agree under /var symlinks.
        self.repo = os.path.realpath(os.path.join(self.tmp, "repo"))
        os.makedirs(self.repo)
        self._git("init", "-b", "main")
        self._git("config", "user.email", "t@t")
        self._git("config", "user.name", "t")
        self._write(os.path.join(self.repo, "README.md"), "init\n")
        self._git("add", "-A")
        self._git("commit", "-m", "init")

        tools = os.path.join(self.repo, ".claude", "tools")
        os.makedirs(tools)
        shutil.copy(REAPER_SRC, os.path.join(tools, "reap-merged-worktrees.sh"))
        shutil.copy(CLEANUP_SRC, os.path.join(tools, "cleanup-worktree.sh"))
        self.reaper = os.path.join(tools, "reap-merged-worktrees.sh")

        self.gh = os.path.join(self.repo, "gh-stub.sh")
        self._write(self.gh, _GH_STUB)
        os.chmod(self.gh, 0o755)

    # --- helpers -----------------------------------------------------------
    def _git(self, *args, cwd=None):
        return subprocess.run(
            ["git", "-C", cwd or self.repo, *args],
            capture_output=True, text=True, check=True,
        )

    def _write(self, path, content):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def _add_worktree(self, name):
        path = os.path.join(self.repo, ".claude", "worktrees", name)
        self._git("worktree", "add", path, "-b", f"claude/{name}")
        return path

    def _add_branch_at_main(self, name):
        self._git("branch", f"claude/{name}", "main")

    def _add_branch_with_commit(self, name):
        """A dangling branch carrying a commit NOT on main (not an ancestor).

        Stages only the new file (NOT `-A`): the copied harness scripts live
        untracked in the working tree, and a blanket `add -A` would commit them
        onto this branch so `git checkout main` then deletes them.
        """
        self._git("checkout", "-b", f"claude/{name}")
        self._write(os.path.join(self.repo, f"{name}.txt"), "x\n")
        self._git("add", f"{name}.txt")
        self._git("commit", "-m", name)
        self._git("checkout", "main")

    def _branches(self):
        out = self._git("branch", "--format=%(refname:short)").stdout
        return {ln.strip() for ln in out.splitlines() if ln.strip()}

    def _run(self, *extra, merged=(), gh_bin=None, dry=False):
        env = os.environ.copy()
        env["REAP_GH_BIN"] = gh_bin if gh_bin is not None else self.gh
        env["MERGED_BRANCHES"] = " ".join(merged)
        env["REAP_MIN_INTERVAL"] = "0"
        args = ["bash", self.reaper, *(("--dry-run",) if dry else ()), *extra]
        return subprocess.run(args, cwd=self.repo, env=env,
                              capture_output=True, text=True)

    # --- tests -------------------------------------------------------------
    def test_removes_merged_clean_worktree(self):
        path = self._add_worktree("wt-merged")
        r = self._run(merged=["claude/wt-merged"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertFalse(os.path.exists(path), "merged worktree should be removed")
        self.assertNotIn("claude/wt-merged", self._branches())

    def test_keeps_unmerged_worktree(self):
        path = self._add_worktree("wt-open")
        self._run(merged=[])  # gh stub returns OPEN
        self.assertTrue(os.path.exists(path), "open-PR worktree must be kept")
        self.assertIn("claude/wt-open", self._branches())

    def test_skips_dirty_merged_worktree(self):
        path = self._add_worktree("wt-dirty")
        self._write(os.path.join(path, "scratch.txt"), "uncommitted\n")
        self._run(merged=["claude/wt-dirty"])
        self.assertTrue(os.path.exists(path), "dirty worktree must be preserved")

    def test_failsafe_no_gh_keeps_merged_worktree(self):
        path = self._add_worktree("wt-nogh")
        # gh binary missing → cannot prove merge → keep.
        r = self._run(merged=["claude/wt-nogh"],
                      gh_bin=os.path.join(self.repo, "no-such-gh"))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(os.path.exists(path))

    def test_deletes_dangling_ancestor_branch_without_gh(self):
        self._add_branch_at_main("dangling-anc")  # ancestor of main
        self._run(merged=[], gh_bin=os.path.join(self.repo, "no-such-gh"))
        self.assertNotIn("claude/dangling-anc", self._branches())

    def test_deletes_dangling_squash_branch_with_gh(self):
        self._add_branch_with_commit("dangling-squash")  # not an ancestor
        self.assertIn("claude/dangling-squash", self._branches())
        self._run(merged=["claude/dangling-squash"])
        self.assertNotIn("claude/dangling-squash", self._branches())

    def test_keeps_dangling_unmerged_branch(self):
        self._add_branch_with_commit("dangling-open")  # not ancestor, gh OPEN
        self._run(merged=[])
        self.assertIn("claude/dangling-open", self._branches())

    def test_dry_run_plans_without_mutating(self):
        wt = self._add_worktree("wt-merged")
        self._add_branch_at_main("dangling-anc")
        self._add_branch_with_commit("dangling-squash")
        r = self._run(merged=["claude/wt-merged", "claude/dangling-squash"], dry=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("WOULD remove worktree wt-merged", r.stdout)
        self.assertIn("WOULD delete dangling branch claude/dangling-anc (merged ancestor)",
                      r.stdout)
        self.assertIn("dangling branch claude/dangling-squash (PR MERGED", r.stdout)
        # Nothing actually changed.
        self.assertTrue(os.path.exists(wt))
        self.assertIn("claude/wt-merged", self._branches())
        self.assertIn("claude/dangling-anc", self._branches())
        self.assertIn("claude/dangling-squash", self._branches())


if __name__ == "__main__":
    unittest.main()
