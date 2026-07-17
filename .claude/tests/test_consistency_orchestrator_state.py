"""State-machine tests for the consistency orchestrator's read paths.

The two orchestrators keep their state machines in lockstep by duplication (a convention
their headers state), but `test_orchestrator_state.py` only ever drove the code-review
one. That gap let a change land where the SKILLs documented "`--summary-state`/`--resume`
reconcile with disk" while only `code_review_orchestrator.py` actually did — documented
behaviour with no mechanism behind it, which is the very failure mode the surrounding
work exists to remove. Four reviewers reproduced it independently; these tests make the
duplicate carry its own weight.

Driven through the real CLI via subprocess, matching test_orchestrator_state.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from _harness import REPO_ROOT

ORCH = (
    REPO_ROOT / ".claude" / "skills" / "consistency-checker" / "scripts"
    / "consistency_orchestrator.py"
)

CHECKERS = ["cross_spec", "rationale_continuity", "naming_collision"]


def _run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(ORCH), *args],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )


class ConsistencyReconcileTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.sd = Path(self._tmp.name)
        self.state_file = self.sd / "_retry_state.json"

    def tearDown(self):
        self._tmp.cleanup()

    def _write_state(self, names=CHECKERS, *, output_dir=None, **overrides):
        base = output_dir if output_dir is not None else str(self.sd)
        state = {
            "agents_pending": list(names),
            "agents_success": [],
            "agents_fatal": [],
            "subagent_invocations": [
                {"name": n, "output_file": f"{base}/{n}.md"} for n in names
            ],
        }
        state.update(overrides)
        self.state_file.write_text(json.dumps(state), encoding="utf-8")

    def _state(self) -> dict:
        return json.loads(self.state_file.read_text(encoding="utf-8"))

    def test_summary_state_reconciles_before_reporting(self):
        # The exact shape a fallback Agent fan-out leaves: reports on disk, state frozen
        # at the prepare-time snapshot because --update was never called.
        self._write_state()
        (self.sd / "cross_spec.md").write_text("x", encoding="utf-8")
        r = _run("--summary-state", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("success=1", r.stdout)
        self.assertIn("pending=2", r.stdout)
        self.assertEqual(self._state()["agents_success"], ["cross_spec"])

    def test_an_empty_checker_report_is_not_promoted_to_success(self):
        # Symmetric with code_review_orchestrator's
        # `AgreementTest.test_agree_on_an_empty_report` (test_report_paths_shared.py):
        # `touch cross_spec.md` must not satisfy the gate. Consistency has no
        # `--verify-coverage` command of its own, so this is driven through
        # `--summary-state`'s `_reconcile_state_with_disk` instead — the only place the
        # non-empty rule is actually exercised on this side.
        self._write_state()
        (self.sd / "cross_spec.md").write_text("", encoding="utf-8")  # empty — not a report
        r = _run("--summary-state", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("success=0", r.stdout)
        self.assertIn("pending=3", r.stdout)
        s = self._state()
        self.assertNotIn("cross_spec", s["agents_success"])
        self.assertIn("cross_spec", s["agents_pending"])

    def test_resume_reconciles_so_a_loop_does_not_rerun_finished_checkers(self):
        self._write_state()
        (self.sd / "cross_spec.md").write_text("x", encoding="utf-8")
        r = _run("--resume", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self._state()
        self.assertEqual(s["agents_success"], ["cross_spec"])
        self.assertNotIn("cross_spec", s["agents_pending"])

    def test_a_claimed_success_without_a_report_is_demoted(self):
        self._write_state(agents_success=list(CHECKERS), agents_pending=[])
        (self.sd / "cross_spec.md").write_text("x", encoding="utf-8")
        _run("--summary-state", str(self.sd))
        s = self._state()
        self.assertEqual(s["agents_success"], ["cross_spec"])
        self.assertEqual(sorted(s["agents_pending"]), ["naming_collision", "rationale_continuity"])

    def test_reports_are_found_when_the_recorded_worktree_is_gone(self):
        # `output_file` records the worktree the session ran in; it is deleted when the
        # task ends while review/** lives on in git.
        self._write_state(
            output_dir="/Volumes/gone/.claude/worktrees/dead-1234/review/consistency/2026/01/01/00_00_00"
        )
        (self.sd / "cross_spec.md").write_text("x", encoding="utf-8")
        r = _run("--summary-state", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("success=1", r.stdout)

    def test_reconcile_preserves_rate_limit_bookkeeping(self):
        self._write_state(rate_limit_episodes=3, last_reset_hint_sec=600)
        r = _run("--summary-state", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self._state()
        self.assertEqual(s["rate_limit_episodes"], 3)
        self.assertEqual(s["last_reset_hint_sec"], 600)
        self.assertIn("last_reset=600", r.stdout)

    def test_reconcile_does_not_leave_a_checker_in_both_pending_and_fatal(self):
        self._write_state(agents_fatal=["cross_spec"], agents_pending=["rationale_continuity"])
        _run("--summary-state", str(self.sd))
        s = self._state()
        self.assertEqual(s["agents_fatal"], ["cross_spec"])
        self.assertNotIn("cross_spec", s["agents_pending"])


if __name__ == "__main__":
    unittest.main()
