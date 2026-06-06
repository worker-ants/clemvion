"""Unit tests for the review-guard hardening pass.

Covers the checkout-immune freshness rework and the failure modes the harness
audit surfaced:
  - _porcelain_path        — rename/copy parsing (literal "->" in a filename).
  - _glob_to_regex         — `**/` must match on a segment boundary, not `ax`.
  - _path_session_time     — checkout-immune review clock from the dir name.
  - _authoritative_code_time — dirty→mtime, clean→commit-time split.
  - _code_review_in_flight — started-but-unfinished review suppresses the gate.
  - evaluate_review        — in-flight short-circuit.
  - _summary_is_resolved   — risk level found beyond the old 3-line window.
  - stop-hook throttle     — per-branch token + missing session_id fallback.
"""

from __future__ import annotations

import os
import shutil
import tempfile
import unittest
from unittest import mock

import _harness  # noqa: F401  — side effect: puts .claude/hooks on sys.path
from _lib import review_guard as rg
import guard_review_before_stop as stop


class PorcelainPathTest(unittest.TestCase):
    def test_plain_modified(self):
        self.assertEqual(rg._porcelain_path(" M codebase/a.ts"), "codebase/a.ts")

    def test_added(self):
        self.assertEqual(rg._porcelain_path("?? codebase/new.ts"), "codebase/new.ts")

    def test_rename_takes_destination(self):
        self.assertEqual(
            rg._porcelain_path("R  codebase/old.ts -> codebase/new.ts"),
            "codebase/new.ts",
        )

    def test_copy_takes_destination(self):
        self.assertEqual(
            rg._porcelain_path("C  codebase/a.ts -> codebase/b.ts"),
            "codebase/b.ts",
        )

    def test_literal_arrow_in_filename_not_split(self):
        # A non-rename line whose filename legitimately contains "->" must NOT
        # be split — only R/C status codes carry the " -> " separator.
        self.assertEqual(
            rg._porcelain_path(" M codebase/a->b.ts"), "codebase/a->b.ts"
        )

    def test_too_short(self):
        self.assertEqual(rg._porcelain_path("M"), "")


class GlobBoundaryTest(unittest.TestCase):
    def test_leading_double_star_respects_segment_boundary(self):
        p = rg._glob_to_regex("**/x.ts")
        self.assertTrue(p.match("x.ts"))           # zero leading dirs
        self.assertTrue(p.match("a/b/x.ts"))       # several leading dirs
        self.assertFalse(p.match("ax.ts"))         # the bug: must NOT match

    def test_mid_double_star_still_crosses_dirs(self):
        p = rg._glob_to_regex("codebase/**/x.ts")
        self.assertTrue(p.match("codebase/x.ts"))
        self.assertTrue(p.match("codebase/a/b/x.ts"))
        self.assertFalse(p.match("codebaseX/x.ts"))

    def test_trailing_double_star_matches_any_path(self):
        # Trailing `**` (no slash after) → `.*`, matches any descendant.
        p = rg._glob_to_regex("codebase/backend/**")
        self.assertTrue(p.match("codebase/backend/a.ts"))
        self.assertTrue(p.match("codebase/backend/deep/nested/x.ts"))
        self.assertFalse(p.match("codebase/frontend/a.ts"))


class PathSessionTimeTest(unittest.TestCase):
    def test_parses_session_dir_timestamp(self):
        t = rg._path_session_time("review/code/2026/06/06/10_47_52")
        self.assertGreater(t, 0.0)
        # Round-trips to the same wall-clock fields in local time.
        from datetime import datetime
        self.assertEqual(datetime.fromtimestamp(t).strftime("%Y-%m-%d %H_%M_%S"),
                         "2026-06-06 10_47_52")

    def test_trailing_slash_ok(self):
        self.assertGreater(rg._path_session_time("review/code/2026/06/06/10_47_52/"), 0.0)

    def test_non_session_path_zero(self):
        self.assertEqual(rg._path_session_time("review/code/SUMMARY.md"), 0.0)


class AuthoritativeCodeTimeTest(unittest.TestCase):
    def test_dirty_uses_mtime_clean_uses_commit_time(self):
        # a.ts is dirty → its mtime (500) counts; b.ts is clean → commit time.
        with mock.patch.object(rg, "_dirty_set", return_value={"codebase/a.ts"}), \
             mock.patch.object(rg, "_mtime", return_value=500.0), \
             mock.patch.object(rg, "_newest_commit_time", return_value=900.0) as ct:
            t = rg._authoritative_code_time(
                "/r", ["codebase/a.ts", "codebase/b.ts"]
            )
        # commit time of the clean file (900) dominates the dirty mtime (500).
        self.assertEqual(t, 900.0)
        # only the clean path is handed to the commit-time query.
        ct.assert_called_once_with("/r", ["codebase/b.ts"])

    def test_all_clean_ignores_mtime(self):
        with mock.patch.object(rg, "_dirty_set", return_value=set()), \
             mock.patch.object(rg, "_mtime", return_value=10_000.0), \
             mock.patch.object(rg, "_newest_commit_time", return_value=42.0):
            t = rg._authoritative_code_time("/r", ["codebase/a.ts"])
        # checkout-poisoned mtime (10000) must be ignored for a clean file.
        self.assertEqual(t, 42.0)

    def test_all_dirty_uses_only_mtime(self):
        # Every path dirty → commit-time query gets an empty list, result is mtime.
        with mock.patch.object(rg, "_dirty_set",
                               return_value={"codebase/a.ts", "codebase/b.ts"}), \
             mock.patch.object(rg, "_mtime", return_value=500.0), \
             mock.patch.object(rg, "_newest_commit_time", return_value=0.0) as ct:
            t = rg._authoritative_code_time("/r", ["codebase/a.ts", "codebase/b.ts"])
        self.assertEqual(t, 500.0)
        ct.assert_called_once_with("/r", [])


class CodeReviewInFlightTest(unittest.TestCase):
    def _session(self, root, ts_path, *, summary):
        d = os.path.join(root, "review", "code", *ts_path.split("/"))
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "meta.json"), "w") as f:
            f.write("{}")
        if summary:
            with open(os.path.join(d, "SUMMARY.md"), "w") as f:
                f.write("# x")
        return d

    def test_started_recent_session_is_in_flight(self):
        with tempfile.TemporaryDirectory() as root:
            self._session(root, "2026/06/06/10_47_52", summary=False)
            now = rg._path_session_time("x/2026/06/06/10_47_52") + 60.0
            self.assertTrue(rg._code_review_in_flight(root, now=now))

    def test_finished_session_not_in_flight(self):
        with tempfile.TemporaryDirectory() as root:
            self._session(root, "2026/06/06/10_47_52", summary=True)
            now = rg._path_session_time("x/2026/06/06/10_47_52") + 60.0
            self.assertFalse(rg._code_review_in_flight(root, now=now))

    def test_stale_started_session_not_in_flight(self):
        with tempfile.TemporaryDirectory() as root:
            self._session(root, "2026/06/06/10_47_52", summary=False)
            now = rg._path_session_time("x/2026/06/06/10_47_52") + rg._IN_FLIGHT_TTL_SECONDS + 60.0
            self.assertFalse(rg._code_review_in_flight(root, now=now))


class EvaluateInFlightShortCircuitTest(unittest.TestCase):
    def test_in_flight_allows_even_with_stale_review(self):
        with mock.patch.object(rg, "_repo_root", return_value="/r"), \
             mock.patch.object(rg, "_default_branch", return_value="main"), \
             mock.patch.object(rg, "_merge_base", return_value="base"), \
             mock.patch.object(rg, "_committed_code_changes",
                               return_value=["codebase/a.ts"]), \
             mock.patch.object(rg, "_uncommitted_code_changes", return_value=[]), \
             mock.patch.object(rg, "_code_review_in_flight", return_value=True), \
             mock.patch.object(rg, "_newest_code_mtime", return_value=999.0), \
             mock.patch.object(rg, "_newest_resolved_review_mtime", return_value=0.0):
            d = rg.evaluate_review("/fake")
        self.assertFalse(d.blocked)
        self.assertIn("in flight", d.reason)


class RiskLevelWindowTest(unittest.TestCase):
    def _write(self, summary):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        sp = os.path.join(d, "SUMMARY.md")
        with open(sp, "w", encoding="utf-8") as f:
            f.write(summary)
        return sp

    def test_high_risk_below_old_window_with_rows_is_unresolved(self):
        # Risk token sits 5 lines below the heading (past the old 3-line window)
        # AND a Critical row exists → must be unresolved.
        summary = (
            "# 보고서\n\n## 전체 위험도\n\n\n\n\n**HIGH**\n\n"
            "## Critical 발견사항\n\n"
            "| # | 카테고리 | 발견 | 위치 | 제안 |\n|---|---|---|---|---|\n"
            "| 1 | 보안 | x | a.py:1 | fix |\n"
        )
        self.assertFalse(rg._summary_is_resolved(self._write(summary)))

    def test_medium_with_no_rows_is_resolved(self):
        # After the dead-code removal: MEDIUM risk with no actionable rows and no
        # RESOLUTION is a clean report → resolved.
        summary = (
            "# 보고서\n\n## 전체 위험도\n\n**MEDIUM**\n\n"
            "## Critical 발견사항\n\n| # |\n|---|\n\n"
            "## 경고 (WARNING)\n\n| # |\n|---|\n"
        )
        self.assertTrue(rg._summary_is_resolved(self._write(summary)))


class StopThrottleTest(unittest.TestCase):
    def test_marker_path_falls_back_when_no_session_id(self):
        # Missing session_id must still produce a marker (throttle preserved),
        # not None (which previously disabled the once-per-branch throttle).
        p = stop._marker_path(None, "claude-foo")
        self.assertTrue(p.endswith("nosession__claude-foo"))

    def test_marker_path_uses_session_and_token(self):
        p = stop._marker_path("sess1", "main")
        self.assertTrue(p.endswith("sess1__main"))

    def test_marker_path_sanitizes_path_traversal(self):
        # A session_id with `/` (the traversal vector) must not escape the state
        # dir: the marker stays a single filename directly under it. Remaining
        # `.` chars are harmless inside a filename component.
        p = stop._marker_path("../../etc/evil", "main")
        self.assertNotIn("/", os.path.basename(p))
        self.assertEqual(os.path.dirname(p), stop._state_dir())

    def test_throttle_token_sanitizes_branch_slashes(self):
        with mock.patch("subprocess.run") as run:
            run.return_value = mock.Mock(returncode=0, stdout="claude/harden/x\n")
            self.assertEqual(stop._throttle_token(), "claude-harden-x")

    def test_throttle_token_detached_head_returns_sha(self):
        # abbrev-ref returns "HEAD" when detached → fall back to the short sha.
        def fake_run(args, **kw):
            if "--abbrev-ref" in args:
                return mock.Mock(returncode=0, stdout="HEAD\n")
            return mock.Mock(returncode=0, stdout="deadbee\n")
        with mock.patch("subprocess.run", side_effect=fake_run):
            self.assertEqual(stop._throttle_token(), "deadbee")

    def test_throttle_token_no_git_returns_norepo(self):
        with mock.patch("subprocess.run", side_effect=FileNotFoundError()):
            self.assertEqual(stop._throttle_token(), "norepo")


if __name__ == "__main__":
    unittest.main()
