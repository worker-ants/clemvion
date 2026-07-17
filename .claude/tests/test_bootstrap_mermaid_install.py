"""Tests for bootstrap-session.sh's mermaid-lint install guard.

The install runs at SessionStart in the MAIN checkout, which every worktree
shares. Running several worktree sessions at once is the documented workflow,
so on a cold checkout they all reach the install at the same moment. Two
failures follow from that, and these tests pin both:

  - two sessions npm-installing into one tree concurrently, and
  - the *persistent* consequence: a partial node_modules that a bare
    `[ -d node_modules ]` test accepts forever, leaving mermaid lint silently
    disabled with no signal.

`npm` is stubbed on PATH (never the network), and it records each invocation so
a test can assert how many installs actually happened.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import time
import unittest

import _harness  # noqa: F401

BOOTSTRAP_SRC = _harness.REPO_ROOT / ".claude" / "tools" / "bootstrap-session.sh"

# Records one line per call (with the caller's PID so a test can prove two
# installs overlapped), optionally sleeps to model a slow-but-alive install,
# and materialises node_modules like a real install.
_NPM_STUB = """#!/usr/bin/env bash
echo "call pid=$PPID start=$(date +%s)" >> "$NPM_CALL_LOG"
[ "${NPM_SLEEP:-0}" != "0" ] && sleep "$NPM_SLEEP"
[ "${NPM_STUB_FAIL:-0}" = "1" ] && exit 1
mkdir -p node_modules/somedep
exit 0
"""


class BootstrapMermaidInstallTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
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
        shutil.copy(BOOTSTRAP_SRC, os.path.join(tools, "bootstrap-session.sh"))
        self.bootstrap = os.path.join(tools, "bootstrap-session.sh")

        self.tool_dir = os.path.join(tools, "mermaid-lint")
        os.makedirs(self.tool_dir)
        self._write(os.path.join(self.tool_dir, "package.json"), '{"name":"x"}\n')
        self.marker = os.path.join(self.tool_dir, "node_modules",
                                   ".bootstrap-install-complete")
        self.lock = os.path.join(self.tool_dir, ".install.lock")
        self.fail_marker = os.path.join(self.repo, ".claude", "state",
                                        "mermaid_install_last_fail")

        # Stub npm ahead of the real one on PATH.
        self.bin = os.path.join(self.tmp, "bin")
        os.makedirs(self.bin)
        self._write(os.path.join(self.bin, "npm"), _NPM_STUB)
        os.chmod(os.path.join(self.bin, "npm"), 0o755)
        self.call_log = os.path.join(self.tmp, "npm-calls.log")

    # --- helpers -----------------------------------------------------------
    def _git(self, *args):
        return subprocess.run(["git", "-C", self.repo, *args],
                              capture_output=True, text=True, check=True)

    def _write(self, path, content):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def _env(self, fail=False, sleep=0, retry_after=0, lock_grace=None):
        """One place builds the bootstrap env (WARNING #6 — no per-test copies).

        Throttle defaults OFF (retry_after=0), matching how the reap tests set
        REAP_MIN_INTERVAL=0: a cooldown left on by default would make every
        install test that runs twice flake. Throttle tests opt in explicitly.
        """
        env = dict(os.environ)
        env["PATH"] = self.bin + os.pathsep + env["PATH"]
        env["NPM_CALL_LOG"] = self.call_log
        env["NPM_STUB_FAIL"] = "1" if fail else "0"
        env["NPM_SLEEP"] = str(sleep)
        env["MERMAID_INSTALL_RETRY_SEC"] = str(retry_after)
        if lock_grace is not None:
            env["MERMAID_INSTALL_LOCK_GRACE_SEC"] = str(lock_grace)
        # reap section is inert here: reap-merged-worktrees.sh is not copied into
        # this fixture, so the whole section is skipped regardless of these.
        env["REAP_MIN_INTERVAL"] = "0"
        env["REAP_GH_BIN"] = os.path.join(self.tmp, "no-such-gh")
        return env

    def _run(self, fail=False, sleep=0, retry_after=0, lock_grace=None):
        env = self._env(fail=fail, sleep=sleep, retry_after=retry_after,
                        lock_grace=lock_grace)
        return subprocess.run(["bash", self.bootstrap], cwd=self.repo, env=env,
                              capture_output=True, text=True, timeout=60)

    def _npm_calls(self):
        if not os.path.exists(self.call_log):
            return 0
        with open(self.call_log) as f:
            return len([ln for ln in f if ln.strip()])

    # --- tests -------------------------------------------------------------
    def test_installs_once_and_writes_completion_marker(self):
        r = self._run()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self._npm_calls(), 1)
        self.assertTrue(os.path.isfile(self.marker), "marker must be written")

    def test_second_session_skips_when_marker_present(self):
        self._run()
        self._run()
        self.assertEqual(self._npm_calls(), 1, "a complete install must not reinstall")

    def test_partial_node_modules_without_marker_is_retried(self):
        """The persistent failure: a bare `[ -d node_modules ]` test would accept
        this tree forever and leave mermaid lint silently disabled."""
        os.makedirs(os.path.join(self.tool_dir, "node_modules", "half-written"))
        self.assertFalse(os.path.exists(self.marker))
        self._run()
        self.assertEqual(self._npm_calls(), 1,
                         "a node_modules with no marker must be reinstalled")
        self.assertTrue(os.path.isfile(self.marker))

    def test_failed_install_leaves_no_marker_so_it_retries(self):
        r = self._run(fail=True)
        self.assertEqual(r.returncode, 0, "bootstrap must never block a session")
        self.assertIn("install failed", r.stderr)
        self.assertFalse(os.path.exists(self.marker),
                         "a failed install must not be marked complete")
        self._run()  # next session retries and succeeds
        self.assertEqual(self._npm_calls(), 2)
        self.assertTrue(os.path.isfile(self.marker))

    def test_held_lock_makes_this_session_skip_rather_than_race(self):
        os.makedirs(self.lock)  # another session is mid-install
        r = self._run()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self._npm_calls(), 0,
                         "must not install while another session holds the lock")
        self.assertTrue(os.path.isdir(self.lock), "someone else's lock is not ours to drop")

    def test_stale_lock_is_stolen_so_it_cannot_wedge_forever(self):
        """A lock is only safe if a crashed holder cannot disable installs for good."""
        os.makedirs(self.lock)
        old = time.time() - 3600  # 1h — well past the 10min steal threshold
        os.utime(self.lock, (old, old))
        self._run()
        self.assertEqual(self._npm_calls(), 1, "a stale lock must be stolen")
        self.assertTrue(os.path.isfile(self.marker))

    def test_lock_is_released_after_a_successful_install(self):
        self._run()
        self.assertFalse(os.path.exists(self.lock), "lock must not leak")

    def test_lock_is_released_after_a_failed_install(self):
        self._run(fail=True)
        self.assertFalse(os.path.exists(self.lock),
                         "a failed install must still release the lock")

    def test_concurrent_sessions_install_at_most_once(self):
        """The race itself: several sessions starting at the same moment.

        stdout/stderr go to DEVNULL, not PIPE (WARNING #5): undrained PIPEs can
        fill the OS buffer and deadlock the children while the parent waits.
        """
        env = self._env()
        procs = [subprocess.Popen(["bash", self.bootstrap], cwd=self.repo, env=env,
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                 for _ in range(5)]
        for p in procs:
            p.wait(timeout=60)
        self.assertEqual([p.returncode for p in procs], [0] * 5)
        self.assertLessEqual(self._npm_calls(), 1,
                             "the mkdir lock must serialise the cold-start race")

    # --- lock liveness (WARNING #1: steal on liveness, not elapsed time) -----
    def _plant_lock(self, owner_pid, age_seconds):
        """A held lock owned by `owner_pid`, with its dir mtime aged.

        owner is written BEFORE aging: creating the file bumps the dir mtime, so
        the utime must come last or the age is lost.
        """
        os.makedirs(self.lock)
        if owner_pid is not None:
            with open(os.path.join(self.lock, "owner"), "w") as f:
                f.write(str(owner_pid))
        old = time.time() - age_seconds
        os.utime(self.lock, (old, old))

    def test_live_but_slow_lock_is_not_stolen_even_when_aged(self):
        """The reviewer-reproduced regression: an install that is slow but ALIVE
        (owner PID still running) crossed the old pure-age threshold and had its
        lock stolen, so a second npm install ran into the same tree. Liveness,
        not age, must gate the steal."""
        holder = subprocess.Popen(["sleep", "30"])

        def _reap():
            holder.kill()
            holder.wait()  # reap the zombie so no ResourceWarning leaks
        self.addCleanup(_reap)
        self._plant_lock(holder.pid, age_seconds=3600)  # aged well past grace
        r = self._run()  # default grace 600s → aged, but owner is alive
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self._npm_calls(), 0,
                         "a live holder's lock must never be stolen, however old")
        self.assertTrue(os.path.isdir(self.lock), "the live holder's lock must survive")

    def test_dead_pid_lock_is_stolen(self):
        """The legitimate steal: the recorded owner is gone, so reclaim it."""
        corpse = subprocess.Popen(["true"])
        corpse.wait()  # its PID is now dead (reaped)
        self._plant_lock(corpse.pid, age_seconds=3600)
        self._run()
        self.assertEqual(self._npm_calls(), 1, "a dead holder's lock must be reclaimed")
        self.assertTrue(os.path.isfile(self.marker))

    def test_young_dead_pid_lock_is_not_stolen(self):
        """Liveness alone is not enough — the grace age still gates the steal, so
        a PID number freshly reused by an unrelated process is not trusted to
        hand the lock over immediately."""
        corpse = subprocess.Popen(["true"])
        corpse.wait()
        self._plant_lock(corpse.pid, age_seconds=0)  # dead owner but brand-new lock
        r = self._run()
        self.assertEqual(self._npm_calls(), 0,
                         "a young lock must be left alone regardless of owner liveness")
        self.assertTrue(os.path.isdir(self.lock))

    # --- failure throttle (WARNING #3) ---------------------------------------
    def test_failed_install_is_throttled_within_cooldown(self):
        self._run(fail=True, retry_after=1800)      # fails, stamps cooldown
        self.assertTrue(os.path.exists(self.fail_marker), "failure must stamp a cooldown")
        self._run(retry_after=1800)                 # immediate retry → throttled
        self.assertEqual(self._npm_calls(), 1,
                         "a retry inside the cooldown window must be skipped")
        self.assertFalse(os.path.exists(self.marker))

    def test_failed_install_retries_after_cooldown(self):
        self._run(fail=True, retry_after=1800)
        old = time.time() - 2000                    # age the cooldown past the window
        os.utime(self.fail_marker, (old, old))
        self._run(retry_after=1800)                 # now allowed to retry (succeeds)
        self.assertEqual(self._npm_calls(), 2)
        self.assertTrue(os.path.isfile(self.marker))
        self.assertFalse(os.path.exists(self.fail_marker),
                         "a successful install must clear the cooldown stamp")
        self.assertTrue(os.path.isfile(self.marker))


if __name__ == "__main__":
    unittest.main()
