"""State-machine tests for the code-review orchestrator's CLI.

The orchestrator is a pure-Python state machine (it never calls a model — main
Claude does, via the Agent tool). Its `--update` / `--apply-routing` /
`--summary-state` / `--resume` subcommands mutate `_retry_state.json` on main's
behalf. This is the most intricate automation in the harness and had no tests.

We drive the **real CLI via subprocess** rather than importing the module:
  - it tests the exact surface SKILL.md invokes, and
  - it sidesteps the two-`_lib`-packages import collision (the orchestrator
    needs skills/_lib.project_config; the branch tests need hooks/_lib — they
    can't both own the `_lib` name in one interpreter). A subprocess gets the
    orchestrator's own clean sys.path.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from _harness import REPO_ROOT

ORCH = (
    REPO_ROOT / ".claude" / "skills" / "code-review-agents" / "scripts"
    / "code_review_orchestrator.py"
)


def _run(*args: str, cwd: Path | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(ORCH), *args],
        cwd=str(cwd or REPO_ROOT),
        capture_output=True,
        text=True,
    )


class OrchestratorStateTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.sd = Path(self._tmp.name)
        self.state_file = self.sd / "_retry_state.json"

    def tearDown(self):
        self._tmp.cleanup()

    def _write_state(self, **overrides):
        state = {
            "agents_pending": ["security", "performance", "testing"],
            "agents_success": [],
            "agents_fatal": [],
        }
        state.update(overrides)
        self.state_file.write_text(json.dumps(state), encoding="utf-8")

    def _state(self) -> dict:
        return json.loads(self.state_file.read_text(encoding="utf-8"))

    # ---- --update transitions ----------------------------------------------

    def test_update_success_moves_to_success_bucket(self):
        self._write_state()
        r = _run("--update", str(self.sd), "--agent", "security", "--status", "success")
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self._state()
        self.assertIn("security", s["agents_success"])
        self.assertNotIn("security", s["agents_pending"])

    def test_update_fatal_moves_to_fatal_bucket(self):
        self._write_state()
        _run("--update", str(self.sd), "--agent", "performance", "--status", "fatal")
        s = self._state()
        self.assertIn("performance", s["agents_fatal"])
        self.assertNotIn("performance", s["agents_pending"])

    def test_update_network_keeps_pending(self):
        self._write_state()
        _run("--update", str(self.sd), "--agent", "testing", "--status", "network")
        s = self._state()
        self.assertIn("testing", s["agents_pending"])

    def test_rate_limit_increments_episodes_and_sets_reset_hint(self):
        self._write_state()
        _run("--update", str(self.sd), "--agent", "security",
             "--status", "rate_limit", "--reset-hint", "120")
        s = self._state()
        self.assertIn("security", s["agents_pending"])
        self.assertEqual(s["rate_limit_episodes"], 1)
        self.assertEqual(s["last_reset_hint_sec"], 120)

    def test_reset_hint_keeps_maximum(self):
        self._write_state(last_reset_hint_sec=300)
        _run("--update", str(self.sd), "--agent", "security",
             "--status", "rate_limit", "--reset-hint", "60")
        # 60 < 300 → keep the larger existing hint.
        self.assertEqual(self._state()["last_reset_hint_sec"], 300)

    def test_resuccess_after_retry_does_not_duplicate(self):
        self._write_state()
        _run("--update", str(self.sd), "--agent", "security", "--status", "network")
        _run("--update", str(self.sd), "--agent", "security", "--status", "success")
        s = self._state()
        self.assertEqual(s["agents_success"].count("security"), 1)
        self.assertNotIn("security", s["agents_pending"])

    def test_history_records_each_transition(self):
        self._write_state()
        _run("--update", str(self.sd), "--agent", "security", "--status", "network")
        _run("--update", str(self.sd), "--agent", "security", "--status", "success")
        hist = self._state()["agent_history"]["security"]
        self.assertEqual([h["status"] for h in hist], ["network", "success"])

    def test_update_requires_agent_and_status(self):
        self._write_state()
        r = _run("--update", str(self.sd))
        self.assertEqual(r.returncode, 2)

    # ---- --apply-routing ----------------------------------------------------

    def test_apply_routing_keeps_selected_and_forced(self):
        self._write_state(agents_forced=["security"])
        (self.sd / "_routing_decision.json").write_text(json.dumps({
            "decisions": [
                {"name": "security", "selected": False},   # forced → kept anyway
                {"name": "performance", "selected": True},
                {"name": "testing", "selected": False},     # dropped → skipped
            ]
        }), encoding="utf-8")
        r = _run("--apply-routing", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self._state()
        self.assertEqual(set(s["agents_pending"]), {"security", "performance"})
        self.assertIn("testing", s["agents_skipped"])
        self.assertEqual(s["routing_status"], "done")

    def test_apply_routing_fallback_keeps_all_pending(self):
        self._write_state()
        r = _run("--apply-routing", str(self.sd), "--fallback")
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self._state()
        self.assertEqual(set(s["agents_pending"]), {"security", "performance", "testing"})
        self.assertEqual(s["routing_status"], "skipped")
        self.assertIn("routing_skip_reason", s)

    # ---- --summary-state / --resume ----------------------------------------

    def test_summary_state_line_format(self):
        self._write_state(agents_success=["security"], agents_pending=["performance"],
                          routing_status="done")
        r = _run("--summary-state", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        out = r.stdout.strip()
        self.assertIn("pending=1", out)
        self.assertIn("success=1", out)
        self.assertIn("routing=done", out)
        self.assertIn("last_reset=null", out)

    def test_resume_echoes_path(self):
        self._write_state()
        r = _run("--resume", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        # orchestrator echoes os.path.abspath (not realpath) — match that, so
        # the macOS /tmp→/private/tmp symlink doesn't cause a false mismatch.
        self.assertEqual(r.stdout.strip(), os.path.abspath(str(self.sd)))

    def test_resume_missing_state_fails(self):
        # no _retry_state.json written
        r = _run("--resume", str(self.sd))
        self.assertEqual(r.returncode, 1)


if __name__ == "__main__":
    unittest.main()
