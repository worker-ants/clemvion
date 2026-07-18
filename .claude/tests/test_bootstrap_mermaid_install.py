"""Tests for bootstrap-session.sh's mermaid-lint install guard.

The install runs at SessionStart in the MAIN checkout, which every worktree
shares. Running several worktree sessions at once is the documented workflow,
so on a cold checkout they all reach the install at the same moment. The guard
is marker-based, and these tests pin what it does — and, as of the
review/code/2026/07/18/02_06_42 round, honestly pin what it does NOT do:

  - a partial node_modules (dir but no completion marker) must reinstall, not be
    accepted forever as "installed" — the silent-permanent-disable failure this
    guard exists to eliminate;
  - a failed install must leave no marker (so it retries) and stamp a cooldown
    (so it does not hammer npm on every SessionStart);
  - concurrent cold-start sessions are NOT serialised — the earlier hand-rolled
    `mkdir` lock was dropped after its stale-lock steal proved to be a
    reproducible check-then-act race (02_06_42 C1). What the marker still
    guarantees is CONVERGENCE, not exactly-once: once the dust settles the
    marker exists and every later session skips. `test_concurrent_cold_start_*`
    pins that weaker-but-real property.

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

import _harness  # noqa: F401  — side effect: harness path setup; REPO_ROOT used below

BOOTSTRAP_SRC = _harness.REPO_ROOT / ".claude" / "tools" / "bootstrap-session.sh"

# Records one line per call (with the caller's PID so a test can prove two
# installs overlapped), optionally sleeps to model a slow install, and
# materialises node_modules like a real install.
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

    def _env(self, fail=False, sleep=0, retry_after=0):
        """One place builds the bootstrap env.

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
        # reap section is inert here: reap-merged-worktrees.sh is not copied into
        # this fixture, so the whole section is skipped regardless of these.
        env["REAP_MIN_INTERVAL"] = "0"
        env["REAP_GH_BIN"] = os.path.join(self.tmp, "no-such-gh")
        return env

    def _run(self, fail=False, sleep=0, retry_after=0):
        env = self._env(fail=fail, sleep=sleep, retry_after=retry_after)
        return subprocess.run(["bash", self.bootstrap], cwd=self.repo, env=env,
                              capture_output=True, text=True, timeout=60)

    def _npm_calls(self):
        if not os.path.exists(self.call_log):
            return 0
        with open(self.call_log) as f:
            return len([ln for ln in f if ln.strip()])

    # --- marker: install once, skip once installed --------------------------
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

    # --- marker binds to the lockfile hash (review 12_06_58 W1) -------------
    def _write_lock(self, body):
        self._write(os.path.join(self.tool_dir, "package-lock.json"), body)

    def test_lockfile_change_retriggers_install(self):
        """The marker records the installed lockfile's hash, so a changed
        lockfile — most importantly a merged Dependabot security bump, which is
        lockfile-only — reinstalls on the next run instead of the marker's mere
        presence masking a stale, still-vulnerable node_modules (W1)."""
        self._write_lock('{"lockfileVersion":3,"deps":{"undici":"7.27.0"}}\n')
        self._run()
        self.assertEqual(self._npm_calls(), 1)
        with open(self.marker) as f:
            first = f.read().strip()
        self.assertNotEqual(first, "", "marker must record the lockfile hash, not be empty")

        # A security bump changes only the lockfile. The marker is still present.
        self._write_lock('{"lockfileVersion":3,"deps":{"undici":"7.28.0"}}\n')
        self._run()
        self.assertEqual(self._npm_calls(), 2, "a changed lockfile must retrigger install")
        with open(self.marker) as f:
            self.assertNotEqual(f.read().strip(), first,
                                "marker must update to the new lockfile hash")

    def test_unchanged_lockfile_does_not_reinstall(self):
        """The other half: an unchanged lockfile must still short-circuit — the
        hash binding must not make every SessionStart reinstall."""
        self._write_lock('{"lockfileVersion":3,"deps":{"undici":"7.28.0"}}\n')
        self._run()
        self._run()
        self.assertEqual(self._npm_calls(), 1, "an unchanged lockfile must not reinstall")

    # --- concurrency: marker-only converges, it does NOT serialise ----------
    def test_concurrent_cold_start_converges_and_then_stops_reinstalling(self):
        """No lock (02_06_42 C1): concurrent cold-start sessions are NOT
        serialised — several may npm-install at once, the accepted residual
        documented in bootstrap-session.sh's design note. What the marker still
        guarantees is CONVERGENCE: once they finish, the marker exists and every
        later session skips. This pins that property, not the exactly-once the
        dropped lock used to (over-)promise.

        stdout/stderr go to DEVNULL, not PIPE: undrained PIPEs can fill the OS
        buffer and deadlock the children while the parent waits.
        """
        env = self._env()
        procs = [subprocess.Popen(["bash", self.bootstrap], cwd=self.repo, env=env,
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                 for _ in range(5)]
        for p in procs:
            p.wait(timeout=60)
        self.assertEqual([p.returncode for p in procs], [0] * 5,
                         "bootstrap must never block a session, even racing")
        self.assertGreaterEqual(self._npm_calls(), 1,
                                "at least one racing session must install")
        self.assertTrue(os.path.isfile(self.marker),
                        "the racing sessions must converge to a completion marker")
        converged = self._npm_calls()
        self._run()  # a fresh session, now that the marker exists
        self.assertEqual(self._npm_calls(), converged,
                         "once converged, a later session must not reinstall")

    # --- failure throttle ---------------------------------------------------
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


if __name__ == "__main__":
    unittest.main()
