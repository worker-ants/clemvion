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


if __name__ == "__main__":
    unittest.main()
