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
    raising = [p for p in os.environ.get("STUB_RAISE_PATHS", "").split(os.pathsep) if p]
    if cwd and os.path.realpath(cwd) in [os.path.realpath(p) for p in raising]:
        raise RuntimeError(f"simulated internal error for {cwd}")
    blocked = [p for p in os.environ.get("STUB_BLOCKED_PATHS", "").split(os.pathsep) if p]
    if cwd and os.path.realpath(cwd) in [os.path.realpath(p) for p in blocked]:
        return _Decision(blocked=True, reason=f"unreviewed changes in {cwd}")
    return _Decision(blocked=False, reason="clean")
'''

_PLAN_STUB = '''\
import os
from dataclasses import dataclass


@dataclass
class _Plan:
    untouched: bool
    reason: str
    plan_path: str


def evaluate_plan(cwd=None):
    blocked = [p for p in os.environ.get("STUB_PLAN_BLOCKED_PATHS", "").split(os.pathsep) if p]
    if cwd and os.path.realpath(cwd) in [os.path.realpath(p) for p in blocked]:
        return _Plan(untouched=True, reason=f"plan untouched in {cwd}",
                     plan_path="plan/in-progress/x.md")
    return _Plan(untouched=False, reason="plan touched", plan_path="plan/in-progress/x.md")
'''


def _ensure_on_path(entry: str) -> None:
    """Insert `entry` at the front of sys.path once.

    `_harness.py` warns that repeated unguarded inserts (a) grow sys.path for the
    rest of the run and (b) can shadow a same-named module from another tree —
    `_lib/` here holds top-level `review_guard`/`plan_guard`, exactly the
    collision surface it names."""
    if entry not in sys.path:
        sys.path.insert(0, entry)


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

    def _run(
        self, command, cwd, blocked_paths=(), plan_blocked_paths=(), raise_paths=()
    ):
        env = dict(os.environ)
        env["STUB_BLOCKED_PATHS"] = os.pathsep.join(blocked_paths)
        env["STUB_PLAN_BLOCKED_PATHS"] = os.pathsep.join(plan_blocked_paths)
        env["STUB_RAISE_PATHS"] = os.pathsep.join(raise_paths)
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

    # -------------------------------------------------- PLAN gate scoping

    def test_plan_gate_is_scoped_too(self):
        """The PLAN gate must scope identically — it was the untested half of
        the fix (review 17_28_02 WARNING 1). REVIEW clean everywhere, PLAN dirty
        only in the named branch's worktree: the hook must still block."""
        r = self._run(
            f"git push origin {self.side_branch}",
            cwd=self.main_wt,
            plan_blocked_paths=[self.side_wt],
        )
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertIn("plan gate", r.stderr)
        self.assertIn(self.side_wt, r.stderr)

    def test_plan_gate_unrelated_worktree_does_not_block(self):
        r = self._run(
            "git push origin main",
            cwd=self.main_wt,
            plan_blocked_paths=[self.side_wt],
        )
        self.assertEqual(r.returncode, 0, r.stderr)

    # ------------------------------------------------------- fail-open paths

    def test_stale_worktree_entry_is_skipped(self):
        """`git worktree list` still reports a worktree whose directory was
        deleted; `_push_targets` must skip it rather than hand a missing path to
        a gate."""
        shutil.rmtree(self.side_wt)
        r = self._run(
            f"git push origin {self.side_branch}",
            cwd=self.main_wt,
            blocked_paths=[self.side_wt],
        )
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_per_target_fail_open_still_checks_remaining_targets(self):
        """`_evaluate_over_targets`'s per-target fail-open (review 17_51_28 W1).

        An internal error on ONE worktree must skip only that worktree. Turning
        the `continue` into `return False` left 38/38 green before this test —
        i.e. a first-target crash would silently pass the whole gate, which is
        the same false-ALLOW class this PR exists to close. cwd raises; the named
        branch's worktree is dirty; the hook must still reach it and block."""
        r = self._run(
            f"git push origin {self.side_branch}",
            cwd=self.main_wt,
            raise_paths=[self.main_wt],   # first target blows up
            blocked_paths=[self.side_wt],  # second target must still be checked
        )
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertIn(self.side_wt, r.stderr)

    def test_degradation_is_counted_once_per_gate_not_per_target(self):
        """Scoping must not inflate #999's fail-open streak counter.

        A gate is evaluated once per push target, so a gate that is genuinely
        broken raises once per worktree. The streak measures "this gate was
        effectively off" — three failing worktrees are still ONE gate, and
        counting per target would make a single broken gate look like a
        multi-gate outage and trip escalation early. Pinned because a
        `_evaluate_over_targets` mutation that drops the per-gate dedup survives
        every other test in this file."""
        streak_file = os.path.join(
            self.tmp, ".claude", "state", "push_guard_failopen.json"
        )
        shutil.copy(
            _harness.HOOKS_DIR / "_lib" / "failopen_state.py",
            os.path.join(self.hooks_dir, "_lib", "failopen_state.py"),
        )
        env = dict(os.environ)
        env["STUB_BLOCKED_PATHS"] = ""
        env["STUB_PLAN_BLOCKED_PATHS"] = ""
        # REVIEW raises on BOTH targets (cwd + the named branch's worktree)
        env["STUB_RAISE_PATHS"] = os.pathsep.join([self.main_wt, self.side_wt])
        env["CLAUDE_PROJECT_DIR"] = self.tmp  # isolate the streak file
        env.pop("BYPASS_REVIEW_GUARD", None)
        env.pop("BYPASS_PLAN_GUARD", None)
        r = subprocess.run(
            [sys.executable, self.hook],
            input=json.dumps(
                {
                    "tool_input": {"command": f"git push origin {self.side_branch}"},
                    "cwd": self.main_wt,
                }
            ),
            capture_output=True,
            text=True,
            env=env,
        )
        self.assertEqual(r.returncode, 0, "still fails OPEN — policy unchanged")
        self.assertTrue(os.path.exists(streak_file), r.stdout + r.stderr)
        with open(streak_file, encoding="utf-8") as fh:
            streak = json.load(fh)["streak"]
        self.assertEqual(streak, 1, "two failing targets must count as ONE gate")
        # …and the banner must name the gate exactly once, not once per target.
        self.assertEqual(
            r.stdout.count("REVIEW gate"), 1, f"gate listed more than once:\n{r.stdout}"
        )

    def test_bare_push_from_another_worktree_is_scoped_by_path(self):
        """`cd <worktree> && <push>` with no refspec — the everyday cross-worktree
        form (review 00_34_09 WARNING 1).

        Upstream tracking means the branch name never appears in the command, so
        branch matching alone left this uncovered — the same false-ALLOW class
        this hook exists to close. The worktree PATH does appear, so we match on
        it too."""
        # `os.path.realpath` because `git worktree list` reports the resolved
        # path and macOS temp dirs are symlinked (`/var` → `/private/var`). In
        # this repo the worktree path is already canonical, so this is what a
        # real `cd <worktree> && <push>` looks like — using the symlinked alias
        # here would test the fixture's quirk, not the feature.
        r = self._run(
            f"cd {os.path.realpath(self.side_wt)} && git " + "push",
            cwd=self.main_wt,          # hook's cwd is the OTHER worktree
            blocked_paths=[self.side_wt],
        )
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertIn(self.side_wt, r.stderr)

    def test_target_selection_failure_is_counted_not_silent(self):
        """A crash in `_push_targets` must reach the §E fail-open report.

        The gates then answer on a narrower scope than the push publishes; if
        that shrink is silent the run looks perfectly healthy (review 00_34_09
        WARNING 2). Asserted via the streak file, the same signal #999 uses."""
        crashing = os.path.join(self.hooks_dir, "hook_crash_targets_observed.py")
        with open(self.hook, encoding="utf-8") as fh:
            src = fh.read()
        marker = "def _push_targets(command: str, cwd: str) -> list[str]:"
        self.assertIn(marker, src, "hook shape changed — update this patch point")
        self._write(
            crashing,
            src.replace(
                marker, marker + '\n    raise RuntimeError("boom")', 1
            ),
        )
        shutil.copy(
            _harness.HOOKS_DIR / "_lib" / "failopen_state.py",
            os.path.join(self.hooks_dir, "_lib", "failopen_state.py"),
        )
        env = dict(os.environ)
        env.update(
            STUB_BLOCKED_PATHS="",
            STUB_PLAN_BLOCKED_PATHS="",
            STUB_RAISE_PATHS="",
            CLAUDE_PROJECT_DIR=self.tmp,
        )
        env.pop("BYPASS_REVIEW_GUARD", None)
        env.pop("BYPASS_PLAN_GUARD", None)
        r = subprocess.run(
            [sys.executable, crashing],
            input=json.dumps(
                {
                    "tool_input": {"command": "git " + "push origin HEAD"},
                    "cwd": self.main_wt,
                }
            ),
            capture_output=True,
            text=True,
            env=env,
        )
        self.assertEqual(r.returncode, 0, "still fails OPEN")
        self.assertIn("TARGET_SELECTION", r.stdout, r.stdout + r.stderr)
        streak = os.path.join(
            self.tmp, ".claude", "state", "push_guard_failopen.json"
        )
        self.assertTrue(os.path.exists(streak), "degradation was not counted")

    def test_worktree_listing_failure_degrades_to_cwd(self):
        """A repo where `git worktree list` cannot run must fall back to the
        legacy cwd-only check rather than crashing or skipping the gate.

        NOTE this exercises `_worktree_branches`'s OWN fail-open (it returns []),
        not `main()`'s `except` around `_push_targets` — a distinction the
        17_28_02 RESOLUTION got wrong. That other path is pinned by
        `test_push_targets_crash_falls_back_to_cwd` below."""
        nogit = os.path.join(self.tmp, "not-a-repo")
        os.makedirs(nogit)
        r = self._run(
            f"git push origin {self.side_branch}",
            cwd=nogit,
            blocked_paths=[nogit],  # cwd itself is dirty → must still block
        )
        self.assertEqual(r.returncode, 2, r.stderr)

    def test_push_targets_crash_falls_back_to_cwd(self):
        """`main()`'s `except` around `_push_targets`, pinned (17_51_28 WARNING 1).

        If target selection itself raises, the hook must still evaluate cwd. A
        `targets = []` mutation there left 39/39 green — the gate would have been
        skipped ENTIRELY, the very false-ALLOW class this PR closes.

        We force the raise by patching `_push_targets` in a copy of the hook, so
        the assertion is on the real `main()` control flow."""
        crashing = os.path.join(self.hooks_dir, "hook_crashing_targets.py")
        with open(self.hook, encoding="utf-8") as f:
            src = f.read()
        marker = "def _push_targets(command: str, cwd: str) -> list[str]:"
        self.assertIn(marker, src, "hook shape changed — update this patch point")
        src = src.replace(
            marker,
            marker + '\n    raise RuntimeError("simulated target-selection failure")',
            1,
        )
        self._write(crashing, src)

        env = dict(os.environ)
        env["STUB_BLOCKED_PATHS"] = self.main_wt  # cwd is dirty
        env["STUB_PLAN_BLOCKED_PATHS"] = ""
        env["STUB_RAISE_PATHS"] = ""
        env.pop("BYPASS_REVIEW_GUARD", None)
        env.pop("BYPASS_PLAN_GUARD", None)
        r = subprocess.run(
            [sys.executable, crashing],
            input=json.dumps(
                {
                    "tool_input": {"command": f"git push origin {self.side_branch}"},
                    "cwd": self.main_wt,
                }
            ),
            capture_output=True,
            text=True,
            env=env,
        )
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertIn("review gate", r.stderr)

    def test_oversized_command_still_checks_cwd(self):
        """Past `_MAX_REDACTION_INPUT` the branch scan is truncated. That may
        drop a branch mention (→ pre-fix behaviour for it) but must never weaken
        the cwd check."""
        filler = "#" + "x" * 20000
        r = self._run(
            f"git push origin HEAD {filler}",
            cwd=self.main_wt,
            blocked_paths=[self.main_wt],
        )
        self.assertEqual(r.returncode, 2, r.stderr)

    def test_branch_mention_past_the_cap_is_not_scanned(self):
        """Pins the truncation itself (review 17_28_02 WARNING 7).

        A branch named beyond `_MAX_REDACTION_INPUT` is NOT picked up — the
        documented, deliberate degradation to pre-fix behaviour for that branch.
        Without this the cap is unobservable and a future edit could drop it (or
        make it truncate far too aggressively) with every test still green."""
        filler = "x" * 20000
        r = self._run(
            f"git push origin HEAD # {filler} {self.side_branch}",
            cwd=self.main_wt,
            blocked_paths=[self.side_wt],  # only the far-away branch is dirty
        )
        self.assertEqual(r.returncode, 0, r.stderr)

        # …and the same mention just inside the cap IS picked up, so the test
        # above cannot pass merely because the branch was never matchable.
        r2 = self._run(
            f"git push origin HEAD # {self.side_branch}",
            cwd=self.main_wt,
            blocked_paths=[self.side_wt],
        )
        self.assertEqual(r2.returncode, 2, r2.stderr)


class MentionsBranchTest(unittest.TestCase):
    """`_mentions_branch` — bounded substring, NOT tokenization.

    Bounded so a short branch name cannot match inside every longer token; the
    trade (a branch named in a commit message is also evaluated) only ever makes
    the gate stricter, matching the blind push regex's stated philosophy."""

    def setUp(self):
        # Idempotent: `_harness` documents one insert at import time, and an
        # unguarded insert per test method grows sys.path for the whole run.
        _ensure_on_path(str(_harness.HOOKS_DIR))
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


class AcceptsCwdContractTest(unittest.TestCase):
    """`_accepts_cwd` against the REAL gate functions.

    This is the pin that keeps the fix alive. `_accepts_cwd` degrades to the
    legacy cwd-only call when a gate does not take a positional cwd — a
    deliberate safety choice, but it means that changing `evaluate_review` to,
    say, keyword-only would silently reinstate the false-ALLOW hole with every
    other test still green. Assert the real signatures satisfy it."""

    def setUp(self):
        _ensure_on_path(str(_harness.HOOKS_DIR))
        _ensure_on_path(str(_harness.HOOKS_DIR / "_lib"))
        import importlib

        self.mod = importlib.import_module("guard_review_before_push")
        self.review = importlib.import_module("review_guard")
        self.plan = importlib.import_module("plan_guard")

    def test_real_gates_accept_a_positional_cwd(self):
        self.assertTrue(
            self.mod._accepts_cwd(self.review.evaluate_review),
            "review_guard.evaluate_review no longer takes a positional cwd — the "
            "hook would silently fall back to cwd-only and reopen the false-ALLOW hole",
        )
        self.assertTrue(
            self.mod._accepts_cwd(self.plan.evaluate_plan),
            "plan_guard.evaluate_plan no longer takes a positional cwd — same hole",
        )

    def test_keyword_only_signature_is_rejected(self):
        """The degradation trigger itself, pinned: keyword-only → not scoped."""

        def kw_only(*, cwd=None):
            return None

        self.assertFalse(self.mod._accepts_cwd(kw_only))

    def test_zero_arg_signature_is_rejected(self):
        self.assertFalse(self.mod._accepts_cwd(lambda: None))


if __name__ == "__main__":
    unittest.main()
