"""End-to-end tests for the `run-test.sh` watchdog (timeout / process-group kill).

`run-test.sh` wraps each test stage in a pure-bash watchdog so a stage that
hangs — e.g. Jest's "did not exit one second after the test run has completed"
open-handle leak — can never block the harness forever. These tests exercise
that wrapper as a black box: a stub `test-stages.sh` (injected via
`RUN_TEST_CONFIG`) defines fast / failing / hanging stages, and we assert the
wrapper's one-line `status=`, exit code, cleanup-hook dispatch, and — the part
with the highest blast radius — that the whole stage process *group* (not just
the leader) is torn down so no orphan survives.

Kept fast and hermetic via `RUN_TEST_POLL_INTERVAL=1` / `RUN_TEST_KILL_GRACE=1`
and a cwd outside any git repo (so `run-test.sh`'s `git rev-parse` falls back to
`pwd` and logs land in the temp dir, not the worktree). Every subprocess carries
its own hard `timeout=` so a watchdog regression fails the test instead of
hanging the suite.
"""

from __future__ import annotations

import os
import re
import subprocess
import tempfile
import textwrap
import time
import unittest
from pathlib import Path

import _harness  # noqa: F401  — side effect: harness path setup / REPO_ROOT

RUN_TEST = _harness.REPO_ROOT / ".claude" / "tools" / "run-test.sh"

# Stub stages. Stage name `X` dispatches to `cmd_X`; the watchdog's cleanup hook
# is `on_timeout_X`. `cmd_stubborn` ignores SIGTERM in a re-looping shell so only
# the SIGKILL escalation can stop it (exercises the grace window).
STUB_CONFIG = textwrap.dedent(
    """\
    cmd_fast()  { echo "Tests: 3 passed, 3 total"; return 0; }
    cmd_boom()  { echo "FAIL some.spec.ts"; return 1; }
    cmd_hang()  { echo "Tests: 5 passed, 5 total"; \
                  echo "Jest did not exit one second after the test run has completed."; \
                  sleep 600; }
    cmd_child() { sleep 600 & echo "child_pid=$!"; wait; }
    cmd_stubborn() { trap '' TERM; while true; do sleep 0.5; done; }
    on_timeout_hang()     { echo "CLEANUP_HANG_RAN"; }
    on_timeout_child()    { echo "CLEANUP_CHILD_RAN"; }
    on_timeout_stubborn() { echo "CLEANUP_STUBBORN_RAN"; }
    """
)


class WatchdogTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.config = self.tmp / "stub-stages.sh"
        self.config.write_text(STUB_CONFIG)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _run(self, stage, *, timeout=None, poll=1, grace=1, sub_timeout=60):
        env = dict(os.environ)
        env["RUN_TEST_CONFIG"] = str(self.config)
        env["RUN_TEST_POLL_INTERVAL"] = str(poll)
        env["RUN_TEST_KILL_GRACE"] = str(grace)
        if timeout is not None:
            env["RUN_TEST_TIMEOUT"] = str(timeout)
        return subprocess.run(
            ["bash", str(RUN_TEST), stage],
            cwd=self.tmp,  # outside any git repo → logs land here, not the worktree
            env=env,
            capture_output=True,
            text=True,
            timeout=sub_timeout,
        )

    # --- fast paths: the watchdog must be transparent ---

    def test_fast_pass_reports_pass(self):
        r = self._run("fast", timeout=30)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("status=PASS", r.stdout)

    def test_fast_fail_preserves_exit_code(self):
        r = self._run("boom", timeout=30)
        self.assertEqual(r.returncode, 1)
        self.assertIn("status=FAIL", r.stdout)

    # --- hang path: the core guarantee ---

    def test_hang_times_out_with_124(self):
        r = self._run("hang", timeout=2)
        self.assertEqual(r.returncode, 124)
        self.assertIn("status=TIMEOUT", r.stdout)
        self.assertNotIn("status=PASS", r.stdout)

    def test_timeout_dispatches_cleanup_hook(self):
        # cleanup output is appended to the log, which the wrapper tails to stdout.
        r = self._run("hang", timeout=2)
        self.assertEqual(r.returncode, 124)
        self.assertIn("CLEANUP_HANG_RAN", r.stdout)

    def test_timeout_kills_whole_process_group(self):
        # The leader spawns a child `sleep`; both share the leader's process
        # group. A leader-only kill would orphan the child — assert it dies.
        r = self._run("child", timeout=2)
        self.assertEqual(r.returncode, 124)
        match = re.search(r"child_pid=(\d+)", self._read_log(r))
        self.assertIsNotNone(match, "stub did not report a child pid")
        self._assert_pid_dead(
            int(match.group(1)),
            msg="child survived the timeout — process group was not killed (orphan leak)",
        )

    def test_stubborn_process_escalates_to_sigkill(self):
        # Ignores SIGTERM in a re-looping shell → only the SIGKILL escalation
        # after the grace window can stop it. Still resolves to status=TIMEOUT.
        r = self._run("stubborn", timeout=2, grace=1)
        self.assertEqual(r.returncode, 124)
        self.assertIn("status=TIMEOUT", r.stdout)

    # --- disabled watchdog: legacy passthrough ---

    def test_timeout_zero_disables_watchdog(self):
        r = self._run("fast", timeout=0)
        self.assertEqual(r.returncode, 0)
        self.assertIn("status=PASS", r.stdout)

    # --- helpers ---

    def _read_log(self, result):
        match = re.search(r"log=(\S+)", result.stdout)
        self.assertIsNotNone(match, f"no log= path in output:\n{result.stdout}")
        return Path(match.group(1)).read_text()

    def _assert_pid_dead(self, pid, *, msg, timeout=5.0):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if not _pid_alive(pid):
                return
            time.sleep(0.1)
        self.fail(f"pid {pid} still alive after {timeout}s — {msg}")


def _pid_alive(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


if __name__ == "__main__":
    unittest.main()
