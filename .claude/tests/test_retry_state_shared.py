"""Both orchestrators' state bookkeeping, after it moved to `_shared/`.

The two files carried their own copies kept in step by a "Change both" comment —
the arrangement `_shared/report_paths.py` was extracted to replace. Comparing by
AST (docstrings excluded) showed four of the five functions were identical and
only `_emit_summary_state` differed, and only in the fields it prints. Comparing
rendered line counts had suggested far more divergence (154 vs 113) and would
have argued for leaving all five alone; that difference was comment volume.

What these tests actually protect is the CLI contract. `--summary-state` and
`--update` are read by `/loop` and by humans auditing a session, so the exact
stdout line and the stderr notice are the interface, not an implementation
detail. The first wiring of this extraction kept the stdout line byte-identical
and **silently dropped the stderr notice on one side** — the caller had to
reconcile first to build its extra fields, and the shared function's own
reconcile then found nothing left to announce. Asserting only on stdout would
have passed.
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

CODE_REVIEW = (_harness.CLAUDE_DIR / "skills" / "code-review-agents" / "scripts"
               / "code_review_orchestrator.py")
CONSISTENCY = (_harness.CLAUDE_DIR / "skills" / "consistency-checker" / "scripts"
               / "consistency_orchestrator.py")


class SummaryStateCliTest(unittest.TestCase):
    def _session(self, *, report_on_disk):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        sess = os.path.join(d, "s")
        os.makedirs(sess)
        state = {
            "subagent_invocations": [{"name": "security"}],
            "agents_success": [], "agents_pending": ["security"],
            "agents_fatal": [], "agents_skipped": [], "routing_status": "pending",
        }
        with open(os.path.join(sess, "_retry_state.json"), "w") as f:
            json.dump(state, f)
        if report_on_disk:
            with open(os.path.join(sess, "security.md"), "w") as f:
                f.write("보고서 본문")
        return sess

    def _run(self, script, sess):
        return subprocess.run(
            [sys.executable, str(script), "--summary-state", sess],
            capture_output=True, text=True, timeout=60,
        )

    def test_code_review_line_keeps_its_router_fields(self):
        r = self._run(CODE_REVIEW, self._session(report_on_disk=True))
        self.assertEqual(
            r.stdout.strip(),
            "pending=0 success=1 fatal=0 skipped=0 routing=pending last_reset=null",
        )

    def test_consistency_line_has_no_router_fields(self):
        """The one axis on which the two copies legitimately differed."""
        r = self._run(CONSISTENCY, self._session(report_on_disk=True))
        self.assertEqual(r.stdout.strip(),
                         "pending=0 success=1 fatal=0 last_reset=null")

    def test_both_announce_a_reconciling_write(self):
        """The assertion the first wiring would have failed.

        `--summary-state` is a conditional writer: auditing an old committed
        session can dirty the worktree. The notice is how that stops being a
        surprise, so losing it is a real regression even though stdout is
        unchanged — and stdout is what a careless test would have checked.
        """
        for script in (CODE_REVIEW, CONSISTENCY):
            with self.subTest(script=os.path.basename(str(script))):
                r = self._run(script, self._session(report_on_disk=True))
                self.assertIn("reconciled", r.stderr)

    def test_neither_announces_when_nothing_changed(self):
        """A notice that always prints is the same as no notice."""
        for script in (CODE_REVIEW, CONSISTENCY):
            with self.subTest(script=os.path.basename(str(script))):
                sess = self._session(report_on_disk=True)
                self._run(script, sess)          # first run reconciles
                r = self._run(script, sess)      # second has nothing to do
                self.assertNotIn("reconciled", r.stderr)


class AtomicWriteTest(unittest.TestCase):
    """`save_state` writes via temp + `os.replace`, and that is worth pinning.

    The original was a plain truncating `open(..., "w")`: a concurrent reader
    opening mid-write saw a half-written file and `load_state`'s `json.load`
    raised straight through — a traceback, while the "file missing" case one line
    above is handled gracefully. Nothing tested the new property, so a silent
    regression to truncating write would go unnoticed.
    """

    def _lib(self):
        import sys as _sys
        if str(_harness.CLAUDE_DIR) not in _sys.path:
            _sys.path.insert(0, str(_harness.CLAUDE_DIR))
        from _shared import retry_state
        return retry_state

    def _tmpdir(self):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        return d

    def test_writes_and_leaves_no_temp_behind(self):
        rs = self._lib()
        f = os.path.join(self._tmpdir(), "_retry_state.json")
        rs.save_state(f, {"a": 1})
        self.assertEqual(json.load(open(f, encoding="utf-8")), {"a": 1})
        leftovers = [x for x in os.listdir(os.path.dirname(f)) if ".tmp." in x]
        self.assertEqual(leftovers, [])

    def test_a_failed_write_leaves_the_original_intact(self):
        """The property truncation cannot offer: the old state survives."""
        from unittest import mock
        rs = self._lib()
        f = os.path.join(self._tmpdir(), "_retry_state.json")
        rs.save_state(f, {"good": True})
        with mock.patch.object(rs.json, "dump", side_effect=RuntimeError("disk")):
            with self.assertRaises(RuntimeError):
                rs.save_state(f, {"bad": True})
        self.assertEqual(json.load(open(f, encoding="utf-8")), {"good": True})
        leftovers = [x for x in os.listdir(os.path.dirname(f)) if ".tmp." in x]
        self.assertEqual(leftovers, [], "a failed write left its temp file behind")


class MergeCoordinatorUsesTheSharedStateTest(unittest.TestCase):
    """The third consumer, which had no test of its own.

    `merge_coordinator_orchestrator.py` now delegates three of the five helpers,
    but nothing in `.claude/tests/` exercised that file at all — the migration
    was unguarded on the one orchestrator with no other coverage.
    """

    def test_update_cli_writes_through_the_shared_helper(self):
        import subprocess
        import sys as _sys
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        sess = os.path.join(d, "s")
        os.makedirs(sess)
        with open(os.path.join(sess, "_retry_state.json"), "w") as f:
            json.dump({"subagent_invocations": [{"name": "merge_conflict"}],
                       "agents_success": [], "agents_pending": ["merge_conflict"],
                       "agents_fatal": []}, f)
        script = (_harness.CLAUDE_DIR / "skills" / "merge-coordinator" / "scripts"
                  / "merge_coordinator_orchestrator.py")
        r = subprocess.run(
            [_sys.executable, str(script), "--update", sess,
             "--agent", "merge_conflict", "--status", "success"],
            capture_output=True, text=True, timeout=60,
        )
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        state = json.load(open(os.path.join(sess, "_retry_state.json"), encoding="utf-8"))
        self.assertIn("merge_conflict", state["agents_success"])
        self.assertIn("merge_conflict", state.get("agent_history", {}))


if __name__ == "__main__":
    unittest.main()
