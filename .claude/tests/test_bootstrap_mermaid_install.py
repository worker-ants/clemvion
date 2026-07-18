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
    pins that weaker-but-real property;
  - the marker is bound to the package-lock.json hash (12_06_58 W1), so a
    lockfile change — a merged Dependabot security bump, which is lockfile-only —
    reinstalls instead of the marker's mere presence masking a stale, still-
    vulnerable tree. The hash is recomputed AFTER install so an `npm`-rewritten
    lockfile still converges (12_31_29 W2), it degrades to presence-only with no
    hashing tool (12_31_29 W3), a legacy empty marker migrates to a hash exactly
    once, a failed bump keeps the old marker and recovers after the cooldown, and
    a lockfile change under concurrent starts converges the marker to the new
    hash (13_07_57 W1/W2/W3). The `test_*lockfile*` / `test_legacy_*` /
    `test_failed_hash_*` / `test_missing_hasher_*` methods pin these.

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
# Model `npm install` rewriting the lockfile in place (lockfileVersion
# normalization etc.) so a test can prove the marker records the POST-install
# hash and still converges (W2). Runs with cwd = tool_dir.
[ "${NPM_REWRITES_LOCK:-0}" = "1" ] && echo "// normalized $RANDOM" >> package-lock.json
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

    def _env(self, fail=False, sleep=0, retry_after=0, rewrites_lock=False):
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
        env["NPM_REWRITES_LOCK"] = "1" if rewrites_lock else "0"
        env["MERMAID_INSTALL_RETRY_SEC"] = str(retry_after)
        # reap section is inert here: reap-merged-worktrees.sh is not copied into
        # this fixture, so the whole section is skipped regardless of these.
        env["REAP_MIN_INTERVAL"] = "0"
        env["REAP_GH_BIN"] = os.path.join(self.tmp, "no-such-gh")
        return env

    def _run(self, fail=False, sleep=0, retry_after=0, rewrites_lock=False):
        env = self._env(fail=fail, sleep=sleep, retry_after=retry_after,
                        rewrites_lock=rewrites_lock)
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

    def test_npm_rewriting_lockfile_still_converges(self):
        """W2 (review 12_31_29): `npm install` may rewrite the lockfile in place.
        The marker records the POST-install hash (recomputed after npm), so the
        next session matches and skips. Were it the PRE-install hash, it would
        never match the rewritten file and every session would reinstall
        forever — this pins convergence against that."""
        self._write_lock('{"lockfileVersion":3}\n')
        self._run(rewrites_lock=True)
        self._run(rewrites_lock=True)
        self._run(rewrites_lock=True)
        self.assertEqual(self._npm_calls(), 1,
                         "a post-install lockfile rewrite must not cause perpetual reinstall")

    def test_legacy_empty_marker_migrates_once(self):
        """review 13_07_57 W1 — the migration path EVERY already-installed
        checkout takes the moment this merges: its marker is the old empty
        touch-file. On first run the empty content != the current lockfile hash,
        so it reinstalls exactly once and rewrites the marker to the real hash;
        the run after that skips. Pins that the empty→hash migration is a
        one-shot, not perpetual (a future "empty content is special-cased" edit
        would break here)."""
        self._write_lock('{"lockfileVersion":3,"deps":{"undici":"7.28.0"}}\n')
        os.makedirs(os.path.dirname(self.marker), exist_ok=True)
        open(self.marker, "w").close()  # seed the legacy empty marker
        self._run()
        self.assertEqual(self._npm_calls(), 1, "a legacy empty marker must reinstall once")
        with open(self.marker) as f:
            self.assertNotEqual(f.read().strip(), "", "marker must migrate to the real hash")
        self._run()
        self.assertEqual(self._npm_calls(), 1, "and the migrated marker must then skip")

    def test_failed_hash_reinstall_keeps_old_marker_and_recovers(self):
        """review 13_07_57 W2 — the FAILURE side of security propagation. A
        hash-triggered reinstall that fails must not delete the (now stale) old
        marker: it stamps the cooldown, leaves the old hash in place (the tree
        stays lint-ready, fail-open), and once the cooldown clears it converges
        to the new hash. Pins that a failed bump neither wedges the linter nor
        silently claims the new version is installed."""
        self._write_lock('{"lockfileVersion":3,"deps":{"undici":"7.27.0"}}\n')
        self._run()
        with open(self.marker) as f:
            old_hash = f.read().strip()

        # A bump changes the lockfile, but the reinstall fails.
        self._write_lock('{"lockfileVersion":3,"deps":{"undici":"7.28.0"}}\n')
        self._run(fail=True, retry_after=1800)
        self.assertTrue(os.path.exists(self.fail_marker), "a failed reinstall stamps the cooldown")
        with open(self.marker) as f:
            self.assertEqual(f.read().strip(), old_hash,
                             "a failed reinstall must leave the old marker, not delete it")

        # Past the cooldown, it retries and converges to the new hash.
        old = time.time() - 2000
        os.utime(self.fail_marker, (old, old))
        self._run(retry_after=1800)
        self.assertEqual(self._npm_calls(), 3,
                         "install #1, failed reinstall #2, successful retry #3")
        with open(self.marker) as f:
            self.assertNotEqual(f.read().strip(), old_hash, "marker converges to the new hash")

    def test_missing_hasher_degrades_to_presence_only(self):
        """W3 (review 12_31_29): with neither shasum nor sha256sum available,
        want_hash is empty, so change-detection is disabled — the first install
        still happens (marker missing), but a later lockfile change is NOT
        detected. Pins that documented degradation so it cannot silently regress
        into a hard failure (e.g. never installing at all)."""
        for name in ("shasum", "sha256sum"):
            stub = os.path.join(self.bin, name)
            self._write(stub, "#!/usr/bin/env bash\nexit 127\n")
            os.chmod(stub, 0o755)
        self._write_lock('{"lockfileVersion":3,"deps":{"undici":"7.27.0"}}\n')
        self._run()
        self.assertEqual(self._npm_calls(), 1, "first install must still happen without a hasher")
        self.assertTrue(os.path.isfile(self.marker))
        # A lockfile change now goes undetected (the accepted degradation).
        self._write_lock('{"lockfileVersion":3,"deps":{"undici":"7.28.0"}}\n')
        self._run()
        self.assertEqual(self._npm_calls(), 1,
                         "with no hasher, a lockfile change is not detected (degrades to presence-only)")

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

    def test_concurrent_lockfile_change_converges_to_correct_hash(self):
        """review 13_07_57 W3 — the concurrency axis this diff widened: an
        already-installed tree whose lockfile then changes (a Dependabot bump),
        hit by simultaneous sessions. All see the hash mismatch and may reinstall
        at once (the accepted residual), but they must converge — and the marker
        must end holding the CURRENT lockfile hash, not just exist, or the next
        session would loop. Exercises the hash-compare branch under parallelism,
        which the cold-start concurrency test (no lockfile) never reaches."""
        self._write_lock('{"lockfileVersion":3,"deps":{"undici":"7.27.0"}}\n')
        self._run()  # establish an installed tree + marker
        self.assertEqual(self._npm_calls(), 1)

        self._write_lock('{"lockfileVersion":3,"deps":{"undici":"7.28.0"}}\n')
        env = self._env()
        procs = [subprocess.Popen(["bash", self.bootstrap], cwd=self.repo, env=env,
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                 for _ in range(5)]
        for p in procs:
            p.wait(timeout=60)
        self.assertEqual([p.returncode for p in procs], [0] * 5)
        # Converged: the marker holds the CURRENT lockfile hash (content, not mere
        # existence) so a subsequent session skips.
        want = subprocess.run(
            "shasum -a 256 package-lock.json 2>/dev/null || sha256sum package-lock.json",
            cwd=self.tool_dir, shell=True, capture_output=True, text=True,
        ).stdout.split()[0]
        with open(self.marker) as f:
            self.assertEqual(f.read().strip(), want,
                             "the racing sessions must converge the marker to the new hash")
        before = self._npm_calls()
        self._run()
        self.assertEqual(self._npm_calls(), before, "a session after convergence must not reinstall")

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
