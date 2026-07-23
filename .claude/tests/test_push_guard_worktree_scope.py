"""Tests for guard_review_before_push.py's WORKTREE SCOPING.

The gates evaluate a *worktree* (HEAD + working tree). Until 2026-07-23 the hook
only ever evaluated its own cwd, which is wrong in this repo: every task lives in
`.claude/worktrees/<task>-<slug>/`, so `cd <other-worktree> && git push origin
<its-branch>` is routine. The hook's cwd is then a DIFFERENT worktree than the
one being published, giving:

  - false BLOCK — cwd worktree mid-review, pushed branch clean.
  - false ALLOW — cwd worktree clean, pushed branch unreviewed. **This one is a
    working bypass of the review gate**, which is why the fix is a correctness
    fix. `test_false_allow_hole_is_closed` is the regression pin for it.

Scope here: target SELECTION (`_push_targets` / `_mentions_branch`) and the
`main()` wiring that evaluates each target. Detection of "is this a push at all"
lives in `test_push_guard_allowlist.py`; main()'s gate ORDER / bypass / fail-open
orchestration lives in `test_guard_review_before_push_main.py`. Commands below
are deliberately unambiguous pushes so they exercise scoping, not detection.

The end-to-end cases run the REAL hook as a subprocess with stub gates whose
verdict is keyed BY WORKTREE PATH (`STUB_BLOCKED_PATHS`, os.pathsep-separated),
so a test can make exactly one worktree dirty and assert the hook noticed it.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

import _harness  # noqa: F401  — side effect: harness path setup

HOOK_SRC = _harness.HOOKS_DIR / "guard_review_before_push.py"

# Stub gates that accept a cwd (the real signature) and decide per path. Any
# path listed in STUB_BLOCKED_PATHS blocks; everything else is clean. This is
# what lets us prove the hook evaluated a worktree OTHER than its own cwd.
_REVIEW_STUB = '''\
import os
from dataclasses import dataclass


@dataclass
class _Decision:
    blocked: bool
    reason: str


def evaluate_review(cwd=None):
    blocked = [p for p in os.environ.get("STUB_BLOCKED_PATHS", "").split(os.pathsep) if p]
    if cwd and os.path.realpath(cwd) in [os.path.realpath(p) for p in blocked]:
        return _Decision(blocked=True, reason=f"unreviewed changes in {cwd}")
    return _Decision(blocked=False, reason="clean")
'''

_PLAN_STUB = '''\
from dataclasses import dataclass


@dataclass
class _Plan:
    untouched: bool
    reason: str
    plan_path: str


def evaluate_plan(cwd=None):
    return _Plan(untouched=False, reason="plan touched", plan_path="plan/in-progress/x.md")
'''


def _git(*args, cwd):
    return subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True, check=True
    )


class PushGuardWorktreeScopeTest(unittest.TestCase):
    """End-to-end: a real git repo with a real linked worktree."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)

        # --- a real repo + a real second worktree on its own branch ----------
        self.main_wt = os.path.join(self.tmp, "repo")
        os.makedirs(self.main_wt)
        _git("init", "-q", "-b", "main", cwd=self.main_wt)
        _git("config", "user.email", "t@example.com", cwd=self.main_wt)
        _git("config", "user.name", "t", cwd=self.main_wt)
        with open(os.path.join(self.main_wt, "f.txt"), "w") as f:
            f.write("x\n")
        _git("add", "-A", cwd=self.main_wt)
        _git("commit", "-qm", "init", cwd=self.main_wt)

        self.side_branch = "claude/side-task-abc123"
        self.side_wt = os.path.join(self.tmp, "side")
        _git("worktree", "add", "-q", "-b", self.side_branch, self.side_wt, cwd=self.main_wt)

        # --- hook copy with stub gates beside it -----------------------------
        self.hooks_dir = os.path.join(self.tmp, "hooks")
        os.makedirs(os.path.join(self.hooks_dir, "_lib"))
        self.hook = os.path.join(self.hooks_dir, "guard_review_before_push.py")
        shutil.copy(HOOK_SRC, self.hook)
        self._write(os.path.join(self.hooks_dir, "_lib", "review_guard.py"), _REVIEW_STUB)
        self._write(os.path.join(self.hooks_dir, "_lib", "plan_guard.py"), _PLAN_STUB)

    def _write(self, path, content):
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def _run(self, command, cwd, blocked_paths=()):
        env = dict(os.environ)
        env["STUB_BLOCKED_PATHS"] = os.pathsep.join(blocked_paths)
        env.pop("BYPASS_REVIEW_GUARD", None)
        env.pop("BYPASS_PLAN_GUARD", None)
        return subprocess.run(
            [sys.executable, self.hook],
            input=json.dumps({"tool_input": {"command": command}, "cwd": cwd}),
            capture_output=True,
            text=True,
            env=env,
        )

    # ------------------------------------------------------------------ core

    def test_false_allow_hole_is_closed(self):
        """THE regression pin: pushing a dirty branch from a CLEAN worktree.

        Pre-fix the hook evaluated only its cwd (clean) and exited 0, letting an
        unreviewed branch through. It must now notice the named branch's own
        worktree and block."""
        r = self._run(
            f"git push origin {self.side_branch}",
            cwd=self.main_wt,          # clean worktree
            blocked_paths=[self.side_wt],  # the branch being pushed is dirty
        )
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertIn("review gate", r.stderr)
        # The message must name WHICH worktree blocked — the pre-fix message did
        # not, which is exactly why the misjudgement was hard to diagnose.
        self.assertIn(self.side_wt, r.stderr)

    def test_cwd_worktree_is_still_evaluated(self):
        """Legacy behaviour preserved: cwd is always a target."""
        r = self._run(
            "git push origin HEAD",
            cwd=self.main_wt,
            blocked_paths=[self.main_wt],
        )
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertIn(self.main_wt, r.stderr)

    def test_unrelated_dirty_worktree_does_not_block(self):
        """No blanket 'any dirty worktree blocks everything' — the side worktree
        is dirty but this push neither runs there nor names its branch."""
        r = self._run(
            "git push origin main",
            cwd=self.main_wt,
            blocked_paths=[self.side_wt],
        )
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_clean_everywhere_allows(self):
        r = self._run(f"git push origin {self.side_branch}", cwd=self.main_wt)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_bypass_still_applies_to_scoped_targets(self):
        """BYPASS_REVIEW_GUARD must suppress the *scoped* block too, otherwise
        the documented one-off escape stops working for cross-worktree pushes."""
        env_run = subprocess.run(
            [sys.executable, self.hook],
            input=json.dumps(
                {
                    "tool_input": {"command": f"git push origin {self.side_branch}"},
                    "cwd": self.main_wt,
                }
            ),
            capture_output=True,
            text=True,
            env={
                **os.environ,
                "STUB_BLOCKED_PATHS": self.side_wt,
                "BYPASS_REVIEW_GUARD": "1",
            },
        )
        self.assertEqual(env_run.returncode, 0, env_run.stderr)

    def test_non_push_is_untouched(self):
        r = self._run("git status", cwd=self.main_wt, blocked_paths=[self.side_wt])
        self.assertEqual(r.returncode, 0, r.stderr)


class MentionsBranchTest(unittest.TestCase):
    """`_mentions_branch` — bounded substring, NOT tokenization.

    Bounded so a short branch name cannot match inside every longer token; the
    trade (a branch named in a commit message is also evaluated) only ever makes
    the gate stricter, matching the blind push regex's stated philosophy."""

    def setUp(self):
        sys.path.insert(0, str(_harness.HOOKS_DIR))
        import importlib

        self.mod = importlib.import_module("guard_review_before_push")

    def test_exact_and_delimited_matches(self):
        f = self.mod._mentions_branch
        for cmd in (
            "git push origin claude/foo-abc",
            "git push -u origin claude/foo-abc",
            "cd /x && git push origin claude/foo-abc --force",
            "git push origin claude/foo-abc:refs/heads/claude/foo-abc",
        ):
            with self.subTest(cmd=cmd):
                self.assertTrue(f(cmd, "claude/foo-abc"))

    def test_substring_of_longer_branch_does_not_match(self):
        """`claude/foo` must NOT match `claude/foo-abc` — otherwise a short
        branch name would drag unrelated worktrees into every push."""
        f = self.mod._mentions_branch
        self.assertFalse(f("git push origin claude/foo-abc", "claude/foo"))
        self.assertFalse(f("git push origin main-backup", "main"))

    def test_absent_branch(self):
        self.assertFalse(self.mod._mentions_branch("git push origin main", "claude/x"))


if __name__ == "__main__":
    unittest.main()
