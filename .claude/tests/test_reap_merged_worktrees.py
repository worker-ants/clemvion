"""Integration tests for reap-merged-worktrees.sh.

These build a throwaway git repo with real worktrees + branches, stub `gh` via
REAP_GH_BIN, and run the actual script (copied verbatim into the temp repo
alongside cleanup-worktree.sh). They assert the documented behaviour:
  - remove a worktree only when gh reports its PR MERGED and it is clean;
  - skip the dirty / unmerged worktree (fail-safe);
  - delete a dangling ancestor-merged branch with no gh (git-enforced `-d`);
  - delete a dangling squash-merged branch only on a gh MERGED verdict (`-D`);
  - never touch a dangling branch gh cannot confirm;
  - never touch a --keep worktree, and keep reaping everything else;
  - --dry-run plans without mutating anything.
The throttle is disabled (REAP_MIN_INTERVAL=0) so each run executes.

The --keep cases cover a real incident: the reaper's other skip is the shell
cwd, and a session whose $CLAUDE_PROJECT_DIR anchor is a *different* worktree
than its cwd (the state EnterWorktree leaves behind) had its anchor reaped,
which wedges the session — every hook is loaded from that path. So the cases
below always run with cwd set to a worktree other than the kept one; a test
that let them coincide would pass on the cwd skip alone and prove nothing.
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
BOOTSTRAP_SRC = SRC_ROOT / ".claude" / "tools" / "bootstrap-session.sh"

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

    def _env(self, merged=(), gh_bin=None):
        env = os.environ.copy()
        env["REAP_GH_BIN"] = gh_bin if gh_bin is not None else self.gh
        env["MERGED_BRANCHES"] = " ".join(merged)
        env["REAP_MIN_INTERVAL"] = "0"
        return env

    def _run(self, *extra, merged=(), gh_bin=None, dry=False, cwd=None):
        args = ["bash", self.reaper, *(("--dry-run",) if dry else ()), *extra]
        return subprocess.run(args, cwd=cwd or self.repo,
                              env=self._env(merged, gh_bin),
                              capture_output=True, text=True)

    def _install_bootstrap(self, worktree):
        """Put bootstrap where the harness runs it from: <anchor>/.claude/tools/.

        That path is the whole point — bootstrap reads BASH_SOURCE to learn which
        worktree it was invoked out of. Committed on the worktree's own branch so
        the worktree stays CLEAN: a dirty worktree is skipped for an unrelated
        reason, which would make the anchor tests pass vacuously.
        """
        dest_dir = os.path.join(worktree, ".claude", "tools")
        os.makedirs(dest_dir, exist_ok=True)
        dest = os.path.join(dest_dir, "bootstrap-session.sh")
        shutil.copy(BOOTSTRAP_SRC, dest)
        self._git("add", ".claude/tools/bootstrap-session.sh", cwd=worktree)
        self._git("commit", "-m", "bootstrap", cwd=worktree)
        self.assertEqual(
            self._git("status", "--porcelain", cwd=worktree).stdout, "",
            "anchor worktree must be clean, else the dirty skip — not --keep — "
            "is what saves it and the test proves nothing",
        )
        return dest

    def _run_bootstrap(self, bootstrap, cwd, merged=()):
        return subprocess.run(["bash", bootstrap], cwd=cwd,
                              env=self._env(merged),
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

    # --- --keep / session anchor -------------------------------------------
    def test_keep_protects_anchor_when_cwd_is_a_different_worktree(self):
        """The incident: anchor ≠ cwd, both merged. Without --keep the anchor
        was reaped and the session lost every hook."""
        anchor = self._add_worktree("wt-anchor")
        elsewhere = self._add_worktree("wt-cwd")
        r = self._run("--keep", anchor, cwd=elsewhere,
                      merged=["claude/wt-anchor", "claude/wt-cwd"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(os.path.exists(anchor), "--keep worktree must survive")
        self.assertIn("claude/wt-anchor", self._branches(),
                      "the kept worktree's branch must survive with it")
        self.assertTrue(os.path.exists(elsewhere), "cwd worktree must survive")

    def test_keep_does_not_shield_other_merged_worktrees(self):
        """--keep must not degrade into 'skip everything' (option C, rejected)."""
        anchor = self._add_worktree("wt-anchor")
        other = self._add_worktree("wt-other")
        self._run("--keep", anchor, cwd=self.repo,
                  merged=["claude/wt-anchor", "claude/wt-other"])
        self.assertTrue(os.path.exists(anchor))
        self.assertFalse(os.path.exists(other),
                         "an unrelated merged worktree must still be reaped")

    def test_keep_matches_whole_path_not_prefix(self):
        """`…/wt-a` must not shield its prefix-sharing sibling `…/wt-a-2`."""
        anchor = self._add_worktree("wt-a")
        sibling = self._add_worktree("wt-a-2")
        self._run("--keep", anchor, cwd=self.repo,
                  merged=["claude/wt-a", "claude/wt-a-2"])
        self.assertTrue(os.path.exists(anchor))
        self.assertFalse(os.path.exists(sibling))

    def test_keep_is_repeatable_and_protects_every_named_worktree(self):
        """WARNING #2: `--keep` is documented (and coded, via `keep_paths`
        accumulating rather than overwriting) as repeatable, but no existing
        test ever passed it twice in one invocation — only the single-anchor
        shape was pinned. A future parser refactor that swapped accumulation
        for last-write-wins would silently protect only the second `--keep`
        and pass every test above (each uses exactly one)."""
        first = self._add_worktree("wt-keep-a")
        second = self._add_worktree("wt-keep-b")
        other = self._add_worktree("wt-other")
        r = self._run("--keep", first, "--keep", second, cwd=self.repo,
                      merged=["claude/wt-keep-a", "claude/wt-keep-b",
                              "claude/wt-other"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(os.path.exists(first), "first --keep target must survive")
        self.assertTrue(os.path.exists(second), "second --keep target must survive")
        self.assertFalse(os.path.exists(other),
                         "an unrelated merged worktree must still be reaped")

    def test_keep_when_cwd_equals_anchor_is_harmless(self):
        """The ordinary session, where both skips name the same worktree."""
        anchor = self._add_worktree("wt-anchor")
        other = self._add_worktree("wt-other")
        r = self._run("--keep", anchor, cwd=anchor,
                      merged=["claude/wt-anchor", "claude/wt-other"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(os.path.exists(anchor))
        self.assertFalse(os.path.exists(other), "double skip must not disable reaping")

    def test_dry_run_does_not_plan_to_remove_a_kept_worktree(self):
        anchor = self._add_worktree("wt-anchor")
        self._add_worktree("wt-other")
        r = self._run("--keep", anchor, cwd=self.repo, dry=True,
                      merged=["claude/wt-anchor", "claude/wt-other"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertNotIn("wt-anchor", r.stdout)
        self.assertIn("WOULD remove worktree wt-other", r.stdout)

    def test_keep_requires_a_value(self):
        r = self._run("--keep")
        self.assertEqual(r.returncode, 2, "a valueless --keep must not be ignored")

    def test_unknown_argument_still_rejected(self):
        r = self._run("--bogus")
        self.assertEqual(r.returncode, 2)

    def test_bootstrap_keeps_the_worktree_it_was_invoked_from(self):
        """End-to-end over the real seam: bootstrap must derive its anchor from
        BASH_SOURCE and pass it through. Guards the whole chain — a --keep the
        reaper honours but bootstrap never sends would leave the bug in place."""
        anchor = self._add_worktree("wt-anchor")
        elsewhere = self._add_worktree("wt-cwd")
        bootstrap = self._install_bootstrap(anchor)
        r = self._run_bootstrap(bootstrap, cwd=elsewhere,
                                merged=["claude/wt-anchor", "claude/wt-cwd"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(os.path.exists(anchor),
                        "bootstrap must keep its own anchor worktree alive")

    def test_bootstrap_still_reaps_unrelated_merged_worktrees(self):
        anchor = self._add_worktree("wt-anchor")
        stale = self._add_worktree("wt-stale")
        bootstrap = self._install_bootstrap(anchor)
        self._run_bootstrap(bootstrap, cwd=anchor,
                            merged=["claude/wt-anchor", "claude/wt-stale"])
        self.assertTrue(os.path.exists(anchor))
        self.assertFalse(os.path.exists(stale),
                         "bootstrap must not disable the reaper's actual job")

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
