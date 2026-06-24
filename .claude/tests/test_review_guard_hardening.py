"""Unit tests for the review-guard hardening pass.

Covers the checkout-immune freshness rework and the failure modes the harness
audit surfaced:
  - _porcelain_path        — rename/copy parsing (literal "->" in a filename).
  - _glob_to_regex         — `**/` must match on a segment boundary, not `ax`.
  - _path_session_time     — checkout-immune review clock from the dir name.
  - _authoritative_code_time — dirty→mtime, clean→commit-time split.
  - _newest_commit_time    — author-date (rebase-immune) clock; a rebase that
    only rewrites committer date must NOT re-arm the gate on unchanged code.
  - _code_review_in_flight — started-but-unfinished review suppresses the gate.
  - evaluate_review        — in-flight short-circuit.
  - _summary_is_resolved   — risk level found beyond the old 3-line window.
  - stop-hook throttle     — per-branch token + missing session_id fallback.
  - _resolution_in_flight  — resolution-applier fix in flight suppresses the Stop
    nudge (dispatch marker + applier-started filesystem signal, both TTL-bound).
  - mark_/clear_resolution_in_flight — the PreToolUse(Agent)/SubagentStop marker
    hooks: write on resolution-applier dispatch, remove on completion.
  - stop-hook resolution suppression + nudge-text branching (review-done wording).
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from unittest import mock

import _harness  # noqa: F401  — side effect: puts .claude/hooks on sys.path
from _lib import review_guard as rg
import guard_review_before_stop as stop
import mark_resolution_in_flight as mark_hook
import clear_resolution_in_flight as clear_hook


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


_RESOLVED_SUMMARY = (
    "# Code Review 통합 보고서\n\n## 전체 위험도\n**NONE**\n\n"
    "## Critical 발견사항\n\n| # | 카테고리 | 발견 | 위치 | 제안 |\n"
    "|---|---|---|---|---|\n\n"
    "## 경고 (WARNING)\n\n| # | 카테고리 | 발견 | 위치 | 제안 |\n"
    "|---|---|---|---|---|\n"
)


def _epoch_utc(y, m, d):
    """Absolute epoch for a UTC calendar date — tz-independent, so it can be
    compared against git `%at` (also absolute) regardless of the test host TZ."""
    return float(int(datetime(y, m, d, tzinfo=timezone.utc).timestamp()))


class RebaseAuthorDateTest(unittest.TestCase):
    """Regression: `git rebase` rewrites a replayed commit's committer date to
    the rebase instant while preserving its author date. The code-freshness
    clock must track the AUTHOR date, so a content-identical rebase does NOT
    push the code past the review that already covered it (the reported
    false-stale block). Uses a real temp git repo: a commit with author date in
    the past and committer date in the future is exactly a post-rebase replayed
    commit, with no wall-clock dependency.

    Dates are spaced ~2 months apart so the session-dir clock (parsed in LOCAL
    time by _path_session_time) and the git author clock (absolute UTC) cannot
    cross-over under any real timezone offset (max ±14h)."""

    def setUp(self):
        self.root = os.path.realpath(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        self._git("init", "-b", "main")

    def _git(self, *args, author=None, committer=None):
        env = dict(os.environ)
        # Isolate from the host's global/system git config (signing, hooks, …).
        env["GIT_CONFIG_GLOBAL"] = os.devnull
        env["GIT_CONFIG_SYSTEM"] = os.devnull
        env["GIT_AUTHOR_NAME"] = env["GIT_COMMITTER_NAME"] = "t"
        env["GIT_AUTHOR_EMAIL"] = env["GIT_COMMITTER_EMAIL"] = "t@t"
        if author:
            env["GIT_AUTHOR_DATE"] = author
        if committer:
            env["GIT_COMMITTER_DATE"] = committer
        subprocess.run(
            ["git", *args], cwd=self.root, env=env, check=True,
            capture_output=True, text=True,
        )

    def _write(self, rel, body):
        p = os.path.join(self.root, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            f.write(body)

    def _base_then_feature_code(self, *, author, committer):
        # main baseline → merge-base anchor for the code diff.
        self._write("README.md", "base\n")
        self._git("add", "-A")
        self._git("commit", "-m", "base",
                  author="2026-01-01T00:00:00 +0000",
                  committer="2026-01-01T00:00:00 +0000")
        # feature branch carrying the code change. author=PAST / committer=FUTURE
        # models a commit replayed by `git rebase` after the review ran.
        self._git("checkout", "-b", "feat")
        self._write("codebase/backend/a.py", "print('x')\n")
        self._git("add", "-A")
        self._git("commit", "-m", "feat code", author=author, committer=committer)

    def _add_resolved_review(self, *ymdhms):
        d = os.path.join(self.root, "review", "code", *ymdhms)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "SUMMARY.md"), "w", encoding="utf-8") as f:
            f.write(_RESOLVED_SUMMARY)

    def test_newest_commit_time_follows_author_not_committer(self):
        # author 2026-02-01, committer 2026-06-01 (the rebase instant).
        self._base_then_feature_code(
            author="2026-02-01T00:00:00 +0000",
            committer="2026-06-01T00:00:00 +0000",
        )
        t = rg._newest_commit_time(self.root, ["codebase/backend/a.py"])
        self.assertEqual(t, _epoch_utc(2026, 2, 1))          # author date
        self.assertLess(t, _epoch_utc(2026, 6, 1))           # NOT committer date

    def test_rebase_does_not_rearm_gate(self):
        # author Feb 1  <  review session Apr 1  <  committer Jun 1.
        # Pre-fix the committer clock (Jun 1) looked newer than the review →
        # false block. The author clock (Feb 1) keeps the review fresh.
        self._base_then_feature_code(
            author="2026-02-01T00:00:00 +0000",
            committer="2026-06-01T00:00:00 +0000",
        )
        self._add_resolved_review("2026", "04", "01", "12_00_00")
        d = rg.evaluate_review(self.root)
        self.assertFalse(d.blocked, d.reason)

    def test_genuinely_newer_code_still_blocks(self):
        # Negative case: code authored AFTER the review (author==committer==Jun)
        # is real unreviewed work and must STILL block.
        self._base_then_feature_code(
            author="2026-06-01T00:00:00 +0000",
            committer="2026-06-01T00:00:00 +0000",
        )
        self._add_resolved_review("2026", "04", "01", "12_00_00")
        d = rg.evaluate_review(self.root)
        self.assertTrue(d.blocked, d.reason)
        self.assertIn("AFTER", d.reason)


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


class ResolutionInFlightTest(unittest.TestCase):
    """`_resolution_in_flight`: a resolution-applier fix in progress must be
    detected (to suppress the Stop nudge), via either the dispatch marker or the
    applier-started filesystem state, both TTL-bounded."""

    def setUp(self):
        self.root = os.path.realpath(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        self.mdir = os.path.join(self.root, "markers")
        os.makedirs(self.mdir)

    def _marker(self, name, epoch):
        with open(os.path.join(self.mdir, name), "w", encoding="utf-8") as f:
            f.write(str(epoch))

    def _write(self, path, body):
        with open(path, "w", encoding="utf-8") as f:
            f.write(body)

    def _session(self, *parts, state=True, summary=True, resolution=False):
        sd = os.path.join(self.root, "review", "code", *parts)
        os.makedirs(sd, exist_ok=True)
        if state:
            self._write(os.path.join(sd, "_resolution_state.json"), "{}")
        if summary:
            self._write(os.path.join(sd, "SUMMARY.md"), "# x")
        if resolution:
            self._write(os.path.join(sd, "RESOLUTION.md"), "# r")
        return sd

    def test_fresh_marker_is_in_flight(self):
        self._marker("toolu_1", 1000.0 - 10)
        self.assertTrue(rg._resolution_in_flight(self.root, now=1000.0, marker_dir=self.mdir))

    def test_stale_marker_not_in_flight(self):
        self._marker("toolu_1", 1000.0 - rg._IN_FLIGHT_TTL_SECONDS - 100)
        self.assertFalse(rg._resolution_in_flight(self.root, now=1000.0, marker_dir=self.mdir))

    def test_empty_marker_falls_back_to_mtime(self):
        # A 0-byte marker (content lost) still counts via its fresh mtime.
        p = os.path.join(self.mdir, "toolu_empty")
        open(p, "w").close()
        now = rg._mtime(p) + 5.0
        self.assertTrue(rg._resolution_in_flight(self.root, now=now, marker_dir=self.mdir))

    def test_applier_started_state_is_in_flight(self):
        # No marker; the applier-started filesystem signal alone suffices.
        self._session("2026", "06", "25", "00_30_00", resolution=False)
        now = rg._path_session_time("x/2026/06/25/00_30_00") + 60.0
        self.assertTrue(rg._resolution_in_flight(self.root, now=now, marker_dir=self.mdir))

    def test_resolution_written_not_in_flight(self):
        # RESOLUTION.md present → the fix is done, not in flight.
        self._session("2026", "06", "25", "00_30_00", resolution=True)
        now = rg._path_session_time("x/2026/06/25/00_30_00") + 60.0
        self.assertFalse(rg._resolution_in_flight(self.root, now=now, marker_dir=self.mdir))

    def test_stale_started_state_not_in_flight(self):
        self._session("2026", "06", "25", "00_30_00", resolution=False)
        now = rg._path_session_time("x/2026/06/25/00_30_00") + rg._IN_FLIGHT_TTL_SECONDS + 100.0
        self.assertFalse(rg._resolution_in_flight(self.root, now=now, marker_dir=self.mdir))

    def test_nothing_in_flight_when_no_signals(self):
        self.assertFalse(rg._resolution_in_flight(self.root, now=1000.0, marker_dir=self.mdir))


class ResolutionMarkerHookTest(unittest.TestCase):
    """The PreToolUse(Agent)/SubagentStop marker hooks."""

    def setUp(self):
        self.pd = os.path.realpath(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.pd, ignore_errors=True)

    def _run(self, mod, payload):
        with mock.patch.dict(os.environ, {"CLAUDE_PROJECT_DIR": self.pd}), \
             mock.patch.object(sys, "stdin", io.StringIO(json.dumps(payload))):
            return mod.main()

    def _marker(self, tool_use_id):
        return os.path.join(self.pd, ".claude", "state", "resolution_in_flight", tool_use_id)

    def test_mark_writes_marker_for_resolution_applier(self):
        rc = self._run(mark_hook, {
            "tool_name": "Agent", "tool_use_id": "toolu_ABC",
            "tool_input": {"subagent_type": "resolution-applier",
                           "prompt": "session_dir=review/code/2026/06/25/00_30_00"},
        })
        self.assertEqual(rc, 0)
        m = self._marker("toolu_ABC")
        self.assertTrue(os.path.isfile(m))
        with open(m, encoding="utf-8") as f:
            float(f.read().strip())  # content is a parseable epoch

    def test_mark_ignores_non_agent_tool(self):
        self._run(mark_hook, {"tool_name": "Bash", "tool_input": {"command": "ls"}})
        self.assertFalse(os.path.isdir(os.path.dirname(self._marker("x"))))

    def test_mark_ignores_other_subagent_type(self):
        self._run(mark_hook, {
            "tool_name": "Agent", "tool_use_id": "t",
            "tool_input": {"subagent_type": "general-purpose"},
        })
        self.assertFalse(os.path.exists(self._marker("t")))

    def test_clear_removes_marker_by_tool_use_id(self):
        # seed a marker, then clear it.
        self._run(mark_hook, {
            "tool_name": "Agent", "tool_use_id": "toolu_ABC",
            "tool_input": {"subagent_type": "resolution-applier", "prompt": "session_dir=x"},
        })
        self.assertTrue(os.path.isfile(self._marker("toolu_ABC")))
        rc = self._run(clear_hook, {"tool_use_id": "toolu_ABC"})
        self.assertEqual(rc, 0)
        self.assertFalse(os.path.exists(self._marker("toolu_ABC")))

    def test_clear_without_tool_use_id_is_noop(self):
        self.assertEqual(self._run(clear_hook, {}), 0)  # no crash


class StopResolutionSuppressionTest(unittest.TestCase):
    """guard_review_before_stop: suppress the review nudge while resolution is in
    flight (Stop only), and branch the nudge wording on whether a review ran."""

    def _run_stop(self, *, blocked, in_flight, summaries):
        payload = {"session_id": "s", "stop_hook_active": False}
        buf = io.StringIO()
        with mock.patch.object(stop, "evaluate_review",
                               return_value=rg.ReviewDecision(blocked, "reason-x")), \
             mock.patch.object(stop, "_resolution_in_flight", return_value=in_flight), \
             mock.patch.object(stop, "_repo_root", return_value="/r"), \
             mock.patch.object(stop, "_iter_summaries", return_value=summaries), \
             mock.patch.object(stop, "evaluate_plan", None), \
             mock.patch.object(stop, "_throttle_token", return_value="br"), \
             mock.patch.object(stop, "_already_nudged", return_value=False), \
             mock.patch.object(stop, "_mark_nudged"), \
             mock.patch.object(sys, "stdin", io.StringIO(json.dumps(payload))), \
             contextlib.redirect_stdout(buf):
            os.environ.pop("BYPASS_REVIEW_GUARD", None)
            stop.main()
        return buf.getvalue()

    def test_in_flight_suppresses_review_nudge(self):
        # Resolution in flight + a review exists → no block emitted (falls through
        # to the plan nudge, which is disabled here → allow / empty stdout).
        out = self._run_stop(blocked=True, in_flight=True, summaries=["s"])
        self.assertEqual(out.strip(), "")

    def test_not_in_flight_blocks_with_review_done_wording(self):
        out = self._run_stop(blocked=True, in_flight=False, summaries=["s"])
        d = json.loads(out)
        self.assertEqual(d["decision"], "block")
        self.assertIn("이미 수행됐습니다", d["reason"])

    def test_not_in_flight_no_review_uses_run_ai_review_wording(self):
        out = self._run_stop(blocked=True, in_flight=False, summaries=[])
        d = json.loads(out)
        self.assertEqual(d["decision"], "block")
        self.assertIn("/ai-review — 변경에 대한 리뷰", d["reason"])

    def test_not_blocked_allows(self):
        out = self._run_stop(blocked=False, in_flight=False, summaries=[])
        self.assertEqual(out.strip(), "")


if __name__ == "__main__":
    unittest.main()
