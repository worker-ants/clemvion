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

    def test_summary_state_cli_reads_through_the_shared_helper(self):
        """The other path the delegation changed — `_emit_summary_state` keeps
        the `branches`/`base` fields, which are the one axis on which this
        orchestrator's line legitimately differs from the other two.

        The report file is written on purpose. An earlier version of this
        fixture claimed `agents_success: ["merge_conflict"]` with nothing on
        disk, and passed — because this consumer did not reconcile. That is the
        fake success the contract exists to remove, so the fixture now states a
        success that disk can back up."""
        import subprocess
        import sys as _sys
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        sess = os.path.join(d, "s")
        os.makedirs(sess)
        with open(os.path.join(sess, "_retry_state.json"), "w") as f:
            json.dump({"subagent_invocations": [{"name": "merge_conflict"}],
                       "agents_success": ["merge_conflict"], "agents_pending": [],
                       "agents_fatal": [], "branches": ["a", "b"],
                       "base": "origin/main", "last_reset_hint_sec": 42}, f)
        with open(os.path.join(sess, "merge_conflict.md"), "w") as f:
            f.write("분석 결과 본문")
        script = (_harness.CLAUDE_DIR / "skills" / "merge-coordinator" / "scripts"
                  / "merge_coordinator_orchestrator.py")
        r = subprocess.run(
            [_sys.executable, str(script), "--summary-state", sess],
            capture_output=True, text=True, timeout=60,
        )
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        # Whole line, not substrings: field ORDER is part of the CLI contract
        # (SKILL.md documents the line verbatim) and `assertIn` per field cannot
        # see a reordering.
        self.assertEqual(
            r.stdout.strip(),
            "pending=0 success=1 fatal=0 branches=2 base=origin/main last_reset=42",
        )

    def test_summary_state_exits_nonzero_when_the_state_file_is_missing(self):
        """`load_state`'s `sys.exit(1)` is the contract this consumer inherited;
        a silent empty-dict fallback would make an unrun session read as clean."""
        import subprocess
        import sys as _sys
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        sess = os.path.join(d, "empty")
        os.makedirs(sess)
        script = (_harness.CLAUDE_DIR / "skills" / "merge-coordinator" / "scripts"
                  / "merge_coordinator_orchestrator.py")
        r = subprocess.run(
            [_sys.executable, str(script), "--summary-state", sess],
            capture_output=True, text=True, timeout=60,
        )
        self.assertEqual(r.returncode, 1)
        self.assertIn("_retry_state.json", r.stderr)


class MergeCoordinatorReconcilesWithDiskTest(unittest.TestCase):
    """The self-healing the third orchestrator was missing.

    `code_review_orchestrator` and `consistency_orchestrator` both reconcile
    `_retry_state.json` against the reports on disk on `--summary-state` and on
    `--resume`. `merge_coordinator_orchestrator` did not — measured 2026-08-07,
    AST with comments and docstrings stripped: `reconcile_state_with_disk`
    appeared **0 times** in its code and once in a comment saying it was absent.

    That mattered because this skill documents the same fallback the other two
    have: when `Workflow` is unavailable, main fans the four analyzers out with
    the `Agent` tool directly, and that path never calls `--update`. The buckets
    then stayed at the prepare-time snapshot while the sibling SUMMARY.md
    reported real analyzer output — the two-committed-artifacts-contradicting-
    each-other failure, on the one orchestrator that still had it.
    """

    SCRIPT = (_harness.CLAUDE_DIR / "skills" / "merge-coordinator" / "scripts"
              / "merge_coordinator_orchestrator.py")
    ANALYZERS = ["merge_conflict_analyzer", "semantic_conflict_analyzer"]

    def _session(self, *, state_overrides=None, reports=()):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        sess = os.path.join(d, "s")
        os.makedirs(sess)
        state = {
            "subagent_invocations": [
                {"name": n, "output_file": os.path.join(sess, f"{n}.md")}
                for n in self.ANALYZERS
            ],
            # The prepare-time snapshot verbatim: everything pending.
            "agents_pending": list(self.ANALYZERS),
            "agents_success": [],
            "agents_fatal": [],
            "branches": ["feat/a", "feat/b"],
            "base": "origin/main",
        }
        state.update(state_overrides or {})
        with open(os.path.join(sess, "_retry_state.json"), "w") as f:
            json.dump(state, f)
        for name in reports:
            with open(os.path.join(sess, f"{name}.md"), "w") as f:
                f.write("분석 결과 본문")
        return sess

    def _read_state(self, sess):
        with open(os.path.join(sess, "_retry_state.json"), encoding="utf-8") as f:
            return json.load(f)

    def _run(self, *argv):
        return subprocess.run(
            [sys.executable, str(self.SCRIPT), *argv],
            capture_output=True, text=True, timeout=60,
        )

    def test_summary_state_heals_a_snapshot_frozen_by_an_agent_fan_out(self):
        sess = self._session(reports=self.ANALYZERS)
        # Vacuity check: the fixture must actually be in the broken state, or
        # everything below passes for the wrong reason.
        self.assertEqual(self._read_state(sess)["agents_success"], [],
                         "픽스처가 이미 치유된 상태다 — 이 테스트는 아무것도 재지 않는다")

        r = self._run("--summary-state", sess)

        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        self.assertEqual(
            r.stdout.strip(),
            "pending=0 success=2 fatal=0 branches=2 base=origin/main last_reset=null",
        )
        self.assertIn("reconciled", r.stderr)
        # Not just the printed line — the file itself is corrected, because that
        # file is what `/loop` and the summary agent read next.
        self.assertEqual(sorted(self._read_state(sess)["agents_success"]),
                         sorted(self.ANALYZERS))

    def test_summary_state_demotes_a_success_that_left_no_report(self):
        """The other direction, and the one the old fixture was hiding.

        Disk is the arbiter both ways: a self-reported success with no file
        behind it is exactly the fake success this contract removes.
        """
        sess = self._session(
            state_overrides={"agents_pending": [], "agents_success": list(self.ANALYZERS)},
            reports=[self.ANALYZERS[0]],
        )
        r = self._run("--summary-state", sess)
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        self.assertEqual(
            r.stdout.strip(),
            "pending=1 success=1 fatal=0 branches=2 base=origin/main last_reset=null",
        )
        self.assertEqual(self._read_state(sess)["agents_pending"],
                         [self.ANALYZERS[1]])

    def test_resume_reconciles_before_handing_the_session_back(self):
        """`--resume` is the `/loop` wake-up path, so it decides what re-runs.

        Without this, a wake-up re-invokes analyzers whose reports are already
        on disk — burning a rate-limited budget on work that is done.
        """
        sess = self._session(reports=self.ANALYZERS)
        r = self._run("--resume", sess)
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        self.assertEqual(r.stdout.strip(), os.path.abspath(sess))
        self.assertEqual(self._read_state(sess)["agents_pending"], [])

    def test_the_reconcile_notice_stays_conditional(self):
        """A notice that always prints is the same as no notice — and this CLI
        is a conditional writer, so the notice is how auditing an old committed
        session stops silently dirtying the worktree."""
        sess = self._session(reports=self.ANALYZERS)
        self.assertIn("reconciled", self._run("--summary-state", sess).stderr)
        self.assertNotIn("reconciled", self._run("--summary-state", sess).stderr)

    def test_a_fatal_analyzer_is_not_resurrected_as_pending(self):
        """`fatal` outranks `pending` for an agent with no report — otherwise
        the two buckets disagree and `/loop` retries a permanent failure."""
        sess = self._session(
            state_overrides={"agents_pending": [self.ANALYZERS[0]],
                             "agents_fatal": [self.ANALYZERS[1]]},
        )
        r = self._run("--summary-state", sess)
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        state = self._read_state(sess)
        self.assertEqual(state["agents_fatal"], [self.ANALYZERS[1]])
        self.assertEqual(state["agents_pending"], [self.ANALYZERS[0]])


if __name__ == "__main__":
    unittest.main()
