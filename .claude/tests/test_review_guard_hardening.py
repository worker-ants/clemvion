"""Unit tests for the review-guard hardening pass.

Covers the checkout-immune freshness rework and the failure modes the harness
audit surfaced:
  - _porcelain_path        — rename/copy parsing (literal "->" in a filename).
  - _glob_to_regex         — `**/` must match on a segment boundary, not `ax`.
  - _path_session_time     — checkout-immune review clock from the dir name.
  - _authoritative_code_time — dirty→mtime, clean→commit-time split.
  - _newest_commit_time    — author-date (rebase-immune) clock; a rebase that
    only rewrites committer date must NOT re-arm the gate on unchanged code.
  - _code_review_in_flight — a started-but-unfinished review suppresses the
    *Stop nudge*, and only when the caller passes `in_flight_ok=True`. The push
    gate never opts in, so it is never suppressed. (Said unconditionally, this
    line described the bug: both guards share `evaluate_review`, so while the
    suppression was unconditional it opened the push gate for the whole TTL.)
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

import ast
import contextlib
import io
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from datetime import datetime, timezone
from unittest import mock

import _harness  # noqa: F401  — side effect: puts .claude/hooks on sys.path
from _lib import review_guard as rg
import guard_review_before_stop as stop
import mark_resolution_in_flight as mark_hook
import clear_resolution_in_flight as clear_hook

TESTS_DIR = pathlib.Path(__file__).resolve().parent


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
    """The in-flight concession is Stop-only — `in_flight_ok` decides.

    Both guards call `evaluate_review`. While the suppression was
    unconditional it also opened the PUSH gate for the whole TTL, which
    contradicted the documented invariant ("the push guard still hard-gates").
    These two tests lock both directions: flipping the default back to
    suppress-always turns the first one RED.
    """

    def _evaluate(self, **kwargs):
        with mock.patch.object(rg, "_repo_root", return_value="/r"), \
             mock.patch.object(rg, "_default_branch", return_value="main"), \
             mock.patch.object(rg, "_merge_base", return_value="base"), \
             mock.patch.object(rg, "_committed_code_changes",
                               return_value=["codebase/a.ts"]), \
             mock.patch.object(rg, "_uncommitted_code_changes", return_value=[]), \
             mock.patch.object(rg, "_code_review_in_flight", return_value=True), \
             mock.patch.object(rg, "_newest_code_mtime", return_value=999.0), \
             mock.patch.object(rg, "_newest_resolved_review_mtime", return_value=0.0):
            return rg.evaluate_review("/fake", **kwargs)

    def test_push_path_still_blocks_while_in_flight(self):
        # Default (no opt-in) is the push guard's call shape.
        d = self._evaluate()
        self.assertTrue(d.blocked)
        self.assertNotIn("in flight", d.reason)

    def test_stop_path_opts_in_and_is_allowed(self):
        d = self._evaluate(in_flight_ok=True)
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
        # `git -C` + ceiling. A fixture of this shape overwrote the SHARED
        # `.git/config` once — five worktrees read that file, so other sessions'
        # `git fetch` broke and nothing signalled it. Pin the directory instead of
        # trusting cwd, and stop git walking up to find a repository.
        _root = os.path.realpath(self.root)
        env["GIT_CEILING_DIRECTORIES"] = _root
        subprocess.run(
            ["git", "-C", _root, *args], env=env, check=True,
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
        # Isolate CLAUDE_PROJECT_DIR: `evaluate_plan=None` below is a legitimate
        # "this gate is off" patch, which the hook correctly counts as degraded —
        # so without isolation each run writes a real fail-open streak into the
        # working tree and a few suite runs would escalate a healthy gate.
        # (Same isolation #999 added to the push-hook `_run` helper.)
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        prev = os.environ.get("CLAUDE_PROJECT_DIR")
        os.environ["CLAUDE_PROJECT_DIR"] = tmp
        if prev is None:
            self.addCleanup(os.environ.pop, "CLAUDE_PROJECT_DIR", None)
        else:
            self.addCleanup(os.environ.__setitem__, "CLAUDE_PROJECT_DIR", prev)
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


class NotesReachThePublicEntryPointTest(unittest.TestCase):
    """`evaluate_review()` itself must carry the downgrade advisory.

    Everything else pins pieces: the predicate, the helper, the two hooks'
    reporting. Nothing drove the public entry point over a real repository and
    asserted a note comes out — so every mock-based test would stay GREEN if
    Gate 2 stopped attaching them. A review measured that gap twice before this
    existed; "the advisory is silently lost" is the failure this whole branch is
    about, so leaving its own top-level path unpinned was the wrong asymmetry.

    Real temp git repo rather than mocks: the note only exists when Gate 2
    actually adopts a session, and adoption depends on the spec glob, the
    session clock and the `BLOCK:` verdict all lining up. Mocking any of those
    would test the mock.
    """

    def setUp(self):
        self.root = os.path.realpath(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        self._git("init", "-b", "main")

    def _git(self, *args):
        env = dict(os.environ)
        env["GIT_CONFIG_GLOBAL"] = os.devnull
        env["GIT_CONFIG_SYSTEM"] = os.devnull
        env["GIT_AUTHOR_NAME"] = env["GIT_COMMITTER_NAME"] = "t"
        env["GIT_AUTHOR_EMAIL"] = env["GIT_COMMITTER_EMAIL"] = "t@t"
        # `git -C` + ceiling. A fixture of this shape overwrote the SHARED
        # `.git/config` once — five worktrees read that file, so other sessions'
        # `git fetch` broke and nothing signalled it. Pin the directory instead of
        # trusting cwd, and stop git walking up to find a repository.
        _root = os.path.realpath(self.root)
        env["GIT_CEILING_DIRECTORIES"] = _root
        subprocess.run(["git", "-C", _root, *args], env=env, check=True,
                       capture_output=True, text=True)

    def _write(self, rel, body):
        path = os.path.join(self.root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(body)

    def _repo(self, *, critical: bool):
        """A branch with spec-linked code and one `--impl-done` session."""
        self._write("README.md", "base\n")
        self._git("add", "-A")
        self._git("commit", "-m", "base")
        self._git("checkout", "-b", "feature")
        self._write("spec/x.md",
                    "---\ncode: codebase/backend/src/**/*.ts\n---\n# x\n")
        self._write("codebase/backend/src/a.ts", "export const a = 1;\n")
        self._git("add", "-A")
        self._git("commit", "-m", "feature")
        # Gate 1 must PASS, or Gate 2 never runs and there is no note to carry.
        # (That ordering is not a leak: an unreviewed branch is blocked for the
        # code-review reason, and the downgrade surfaces on the next attempt
        # once a review exists. The first version of this test asserted against
        # a repo with no review at all and failed for that reason, not a bug.)
        cr = os.path.join(self.root, "review", "code",
                          "2099", "01", "01", "00_00_00")
        os.makedirs(cr)
        self._write(os.path.join(cr, "SUMMARY.md"),
                    "## 전체 위험도\n\nNONE\n")
        self._write(os.path.join(cr, "RESOLUTION.md"), "처분 완료\n")
        # The session must postdate the code; its directory name is the clock.
        d = os.path.join(self.root, "review", "consistency",
                         "2099", "01", "01", "00_00_00")
        os.makedirs(d)
        self._write(os.path.join(d, "meta.json"),
                    '{"mode": "구현 완료 후 검토 (--impl-done, scope=spec/x)"}')
        self._write(os.path.join(d, "SUMMARY.md"), "**BLOCK: NO** — 요약\n")
        self._write(os.path.join(d, "cross_spec.md"),
                    "- **[CRITICAL]** 모순\n" if critical else "발견 없음\n")
        return d

    def test_a_downgraded_session_puts_a_note_on_the_decision(self):
        self._repo(critical=True)
        d = rg.evaluate_review(self.root)
        self.assertTrue(d.notes, "evaluate_review dropped the advisory")
        joined = " ".join(d.notes)
        self.assertIn("cross_spec", joined, "the note must name the checker")

    def test_an_agreeing_session_puts_no_note_on_the_decision(self):
        """The other half — a warning that fires when nothing is wrong is how a
        real one gets ignored, and an assertion that only checks the positive
        case passes for a function that always warns."""
        self._repo(critical=False)
        d = rg.evaluate_review(self.root)
        self.assertEqual(tuple(d.notes), ())


class UnstagedModificationKeepsItsPathTest(unittest.TestCase):
    """가장 평범한 흐름 — 파일 하나 고치고 push — 에서 게이트가 fail-open 했다.

    `git status --porcelain` 은 두 칸짜리 상태 코드를 내고, "추적 중인 파일이 수정됐지만
    스테이지되지 않음" 은 `" M path"` — **선행 공백**이다. `_run_git` 이 stdout 전체에
    `.strip()` 을 걸어 그 공백을 지웠고, `_porcelain_path` 의 고정폭 파싱이 경로 첫 글자를
    깎아 `codebase/backend/src/a.ts` 를 `odebase/...` 로 돌려줬다. 그 경로는 아무것과도
    매칭되지 않으므로 그 파일은 "방금 편집됨" 신호를 잃고, 게이트는 변경을 못 본 채 통과한다.

    7R 리뷰가 찾았다. 공격이 아니라 일상 흐름이고, **이미 enforce 중인 1차 방어선**이다.

    헬퍼가 아니라 실제 저장소를 만들어 `_changed_code_files` 까지 구동한다 —
    `_porcelain_path` 만 직접 부르면 `.strip()` 이 어디서 일어나는지를 못 본다.
    (초판 docstring 은 존재하지 않는 `_changed_code_files` 를 인용했다 — 실제로 구동하는
    함수는 `_uncommitted_code_changes` 와 `_dirty_set` 이다.)
    """

    def setUp(self):
        self.root = os.path.realpath(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        self._git("init", "-b", "main")
        self._write("codebase/backend/src/a.ts", "export const a = 1;\n")
        self._git("add", "-A")
        self._git("commit", "-m", "base")

    def _git(self, *args):
        env = dict(os.environ)
        env["GIT_CONFIG_GLOBAL"] = os.devnull
        env["GIT_CONFIG_SYSTEM"] = os.devnull
        env["GIT_AUTHOR_NAME"] = env["GIT_COMMITTER_NAME"] = "t"
        env["GIT_AUTHOR_EMAIL"] = env["GIT_COMMITTER_EMAIL"] = "t@t"
        # `git -C` + ceiling. A fixture of this shape overwrote the SHARED
        # `.git/config` once — five worktrees read that file, so other sessions'
        # `git fetch` broke and nothing signalled it. Pin the directory instead of
        # trusting cwd, and stop git walking up to find a repository.
        _root = os.path.realpath(self.root)
        env["GIT_CEILING_DIRECTORIES"] = _root
        subprocess.run(["git", "-C", _root, *args], env=env, check=True,
                       capture_output=True, text=True)

    def _write(self, rel, body):
        path = os.path.join(self.root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(body)

    def test_a_modified_unstaged_file_is_seen_with_its_full_path(self):
        """`" M path"` — 선행 공백이 있는 유일한 형태이자 가장 흔한 형태."""
        self._write("codebase/backend/src/a.ts", "export const a = 2;\n")
        self.assertIn("codebase/backend/src/a.ts",
                      rg._uncommitted_code_changes(self.root))
        self.assertIn("codebase/backend/src/a.ts", rg._dirty_set(self.root))

    def test_a_staged_file_still_works(self):
        """`"M  path"` — 선행 공백이 없다. 원래 맞았고, 수정이 깨지 않았는지 함께 본다."""
        self._write("codebase/backend/src/a.ts", "export const a = 3;\n")
        self._git("add", "-A")
        self.assertIn("codebase/backend/src/a.ts",
                      rg._uncommitted_code_changes(self.root))
        self.assertIn("codebase/backend/src/a.ts", rg._dirty_set(self.root))

    def test_a_non_ascii_path_survives_git_quoting(self):
        """git 은 비-ASCII 경로를 기본으로 C-quote 한다 — `"\\355\\225\\234.ts"`.

        아무도 그걸 디코드하지 않으므로 (a) `_dirty_set` 에 실제 경로가 없어 방금 편집한
        파일이 clean=오래됨 으로 읽히고, (b) `_newest_commit_time` 이 그 문자열을 그대로
        `git log -- <path>` 에 넘겨 매칭 실패 → 0.0 → Gate 1 이 저장소의 **아무 오래된
        resolved 리뷰로나** 통과시킨다. 둘 다 fail-open 이고, 7R 이 한 층 위에서 고친
        선행-공백 결함과 같은 뿌리다.

        `_run_git` 이 `-c core.quotePath=false` 를 걸어 관문에서 막는다.
        """
        rel = "codebase/backend/src/한글파일.ts"
        self._write(rel, "export const k = 1;\n")
        self.assertIn(rel, rg._uncommitted_code_changes(self.root),
                      "인용된 경로가 디코드되지 않았다")
        self.assertIn(rel, rg._dirty_set(self.root))

        # docstring 이 말하는 **더 심한 절반**도 건다. 커밋된 뒤에는 `_newest_commit_time` 이
        # 그 경로를 `git log -- <path>` 에 넘기는데, 인용된 문자열은 아무것과도 매칭되지 않아
        # 0.0 을 돌려준다 — 그 순간 Gate 1 은 저장소의 아무 오래된 resolved 리뷰로나 통과한다.
        # 초판은 (a) 만 단언하고 이쪽을 비워 뒀다(8R 리뷰어 지적).
        self._git("add", "-A")
        self._git("commit", "-m", "non-ascii")
        self.assertGreater(
            rg._newest_commit_time(self.root, [rel]), 0.0,
            "커밋 시각을 0.0 으로 읽는다 — Gate 1 이 오래된 리뷰로 통과하게 된다",
        )

    def test_an_untracked_file_is_seen(self):
        """`"?? path"` — 역시 선행 공백이 없다."""
        self._write("codebase/backend/src/b.ts", "export const b = 1;\n")
        self.assertIn("codebase/backend/src/b.ts",
                      rg._uncommitted_code_changes(self.root))


class RiskHeadingDecoyTest(unittest.TestCase):
    """헤딩 앞의 헛매치 한 줄이 위험도 파싱을 통째로 끝내지 못한다.

    `_summary_is_resolved` 의 바깥 루프가 무조건 `break` 였다. `전체 위험도` 라는 문구를 본문에서
    한 번 언급하기만 해도 — 절차를 인용하는 평범한 문장 — 그 지점에서 스캔이 끝나고
    `risk_level` 이 None 으로 남는다. 표 행 없는 서술형 리포트라면 `has_actionable` 도 False 라
    **HIGH/CRITICAL 리포트가 RESOLUTION 없이 "해결됨"** 으로 게이트를 연다.

    커밋된 SUMMARY 1,548개 실측: 이 형태 0건(헤딩 매치가 2회 이상인 문서는 21개지만 첫 매치가
    항상 레벨을 낸다). 즉 잠복 경로이고, 조건 하나로 닫힌다.
    """

    def _resolved(self, text):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        with open(os.path.join(d, "SUMMARY.md"), "w", encoding="utf-8") as f:
            f.write(text)
        return rg._summary_is_resolved(os.path.join(d, "SUMMARY.md"))

    _TAIL = "\n## 발견사항\n\n표 없이 서술로만 적는다.\n"

    def test_a_critical_report_is_not_resolved(self):
        """대조군 — 헛매치가 없으면 원래 올바르게 판정한다."""
        self.assertFalse(self._resolved(
            "## 전체 위험도\n\n**CRITICAL** — 심각한 결함.\n" + self._TAIL))

    def test_a_decoy_mention_before_the_heading_does_not_flip_it(self):
        self.assertFalse(self._resolved(
            "본 문서는 § 전체 위험도 절차를 따른다.\n\n"
            "## 전체 위험도\n\n**CRITICAL** — 심각한 결함.\n" + self._TAIL))

    def test_a_clean_report_still_resolves(self):
        """반대 방향도 건다 — 이 조건이 모든 것을 미해결로 만들면 게이트는 늘 우는 경고가 된다."""
        self.assertTrue(self._resolved(
            "## 전체 위험도\n\nNONE — 발견 없음.\n" + self._TAIL))


class ResolutionMarkerPathIsConsistentTest(unittest.TestCase):
    """마커 디렉터리 경로가 네 곳에 손으로 적혀 있다 — 갈리면 조용히 망가진다.

    `review_guard.RESOLUTION_MARKER_SUBDIR` 가 정본이고, 쓰는 쪽
    (`mark_resolution_in_flight.py`), 지우는 쪽(`clear_resolution_in_flight.py`), 그리고
    이 파일의 테스트 헬퍼가 각각 같은 문자열을 다시 적는다. 한 곳만 바뀌면 마커를 쓰는 곳과
    읽는 곳이 어긋나 **resolution 진행 중에도 Stop 넛지가 계속 뜬다** — 그 메커니즘의 존재
    이유가 사라지는데, 어떤 테스트도 실패하지 않는다(10R 리뷰어가 뮤테이션으로 실증: 디렉터리명을
    바꿔도 111개 테스트 전부 GREEN).

    이 브랜치가 git 프로브에서 세 라운드 연속 겪은 것과 같은 클래스다 — 손으로 동기화하는 쌍은
    갈린다. 여기서는 소비자가 훅 스크립트라 위임 구조를 만들기보다, 네 표현이 같은 경로를
    가리키는지 한 줄로 고정한다.
    """

    def test_all_four_spellings_agree(self):
        import re as _re
        canonical = rg.RESOLUTION_MARKER_SUBDIR
        self.assertEqual(canonical, os.path.join(".claude", "state",
                                                 "resolution_in_flight"))
        for name in ("mark_resolution_in_flight.py", "clear_resolution_in_flight.py"):
            src = (_harness.HOOKS_DIR / name).read_text(encoding="utf-8")
            with self.subTest(hook=name):
                joins = _re.findall(
                    r'os\.path\.join\(\s*project_dir\s*,\s*(.+?)\)', src)
                self.assertTrue(joins, f"{name}: 마커 경로 조립을 못 찾았다")
                parts = [p.strip().strip('"\'') for p in joins[0].split(",")]
                self.assertEqual(
                    os.path.join(*parts), canonical,
                    f"{name} 의 마커 경로가 정본과 다르다 — 쓰는 곳과 읽는 곳이 어긋난다",
                )


class ActionsCheckoutTopologyTest(unittest.TestCase):
    """`actions/checkout` 이 만드는 저장소 모양에서 게이트가 실제로 판정한다.

    이 층은 CI 를 위해 만들어졌는데, **정작 CI 환경에서 아무것도 안 하고 있었다.**
    `actions/checkout` 은 `clone` 이 아니라 `init` + `remote add` + `fetch` 로 워크트리를
    만들고 `git remote set-head` 를 부르지 않는다. 그래서:

      · `refs/remotes/origin/HEAD` 가 없다 → `_origin_default_branch` 의 로컬 경로 실패
      · 로컬 `refs/heads/main` 도 없다(PR ref 만 fetch) → 옛 폴백도 빗나감
      · 남는 것은 **네트워크 호출**(`git remote show origin`)뿐이고, 그게 실패하면
        `_default_branch()` 가 None → base 없음 → 커밋 변경 목록이 빈 리스트 →
        **"codebase 변경 없음 — 허용"**

    격리 재현: 위 절차로 저장소를 만들고 origin 을 도달 불가로 둔 뒤, `codebase/` 파일을
    고치고 리뷰는 전혀 없는 상태에서 `--enforce` 가 `통과`(exit 0)를 냈다. 수정 후 같은
    저장소에서 `미커버`(exit 1). 네트워크 없이 `refs/remotes/origin/<name>` 만 보면 된다.
    """

    def setUp(self):
        self.tmp = os.path.realpath(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.origin = os.path.join(self.tmp, "origin.git")
        self.work = os.path.join(self.tmp, "work")
        self._git(self.tmp, "init", "--bare", "-b", "main", self.origin)
        seed = os.path.join(self.tmp, "seed")
        self._git(self.tmp, "init", "-b", "main", seed)
        self._write(seed, "codebase/backend/src/a.ts", "export const a = 1;\n")
        self._git(seed, "add", "-A")
        self._git(seed, "commit", "-m", "base")
        self._git(seed, "remote", "add", "origin", self.origin)
        self._git(seed, "push", "-q", "origin", "main")

        # `actions/checkout` 위상 — clone 이 아니다.
        os.makedirs(self.work)
        self._git(self.work, "init", "-b", "main", ".")
        self._git(self.work, "remote", "add", "origin", self.origin)
        self._git(self.work, "fetch", "-q", "--no-tags", "origin", "main")
        self._git(self.work, "checkout", "-q", "-b", "feature", "FETCH_HEAD")

    def _git(self, cwd, *args):
        """임시 트리 밖에서는 절대 돌지 않는다.

        이 픽스처가 실제로 **공유 `.git/config` 를 오염시켰다** — `remote add origin` 이
        워크트리 쪽에서 실행돼 `origin` URL 이 임시 경로로 덮였고, 이 저장소의 워크트리 다섯
        개가 같은 config 를 공유하므로 다른 세션의 `git fetch` 까지 함께 깨졌다. 조용히 성공한
        것이 최악이었다 — 다음 `git fetch` 가 실패할 때까지 아무 신호가 없었다.
        
        cwd 가 임시 루트 밖이면 여기서 죽는다. git 이 상위로 저장소를 찾아 올라가는 것도
        `GIT_CEILING_DIRECTORIES` 로 막는다.
        """
        resolved = os.path.realpath(cwd)
        root = os.path.realpath(self.tmp)
        assert resolved == root or resolved.startswith(root + os.sep), (
            f"임시 트리 밖에서 git 을 실행하려 한다: {resolved!r} (루트 {root!r})"
        )
        env = dict(os.environ)
        env["GIT_CONFIG_GLOBAL"] = os.devnull
        env["GIT_CONFIG_SYSTEM"] = os.devnull
        env["GIT_CEILING_DIRECTORIES"] = root
        env["GIT_AUTHOR_NAME"] = env["GIT_COMMITTER_NAME"] = "t"
        env["GIT_AUTHOR_EMAIL"] = env["GIT_COMMITTER_EMAIL"] = "t@t"
        subprocess.run(["git", "-C", resolved, *args], env=env, check=True,
                       capture_output=True, text=True)

    def _write(self, root, rel, body):
        path = os.path.join(root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(body)

    def test_the_topology_really_lacks_both_local_refs(self):
        """전제 자체를 고정한다 — 이게 틀리면 아래 테스트는 아무것도 증명하지 않는다."""
        for ref in ("refs/remotes/origin/HEAD", "refs/heads/main"):
            with self.subTest(ref=ref):
                rc, _, _ = rg._run_git(["rev-parse", "--verify", ref], self.work)
                self.assertNotEqual(rc, 0, f"{ref} 가 있다 — 위상 재현이 틀렸다")
        rc, _, _ = rg._run_git(["rev-parse", "--verify", "refs/remotes/origin/main"],
                               self.work)
        self.assertEqual(rc, 0, "origin/main 조차 없다 — fetch 가 안 됐다")

    def test_the_default_branch_resolves_without_the_network(self):
        self._git(self.work, "remote", "set-url", "origin",
                  "https://invalid.invalid/nonexistent.git")
        self.assertEqual(rg._default_branch(self.work), "main",
                         "네트워크 없이 기본 브랜치를 못 찾는다 — 게이트가 무력화된다")

    def test_the_remote_tracking_ref_outranks_a_local_branch_of_another_name(self):
        """순서가 실제로 의미를 갖는 경우를 고정한다.

        주석이 "`origin/<name>` 을 먼저 보는 것은 그쪽이 DEFAULT 브랜치에 대한 더 강한
        주장이기 때문" 이라고 적었는데, 처음 쓴 테스트로는 순서를 뒤바꿔도 통과했다 — 주장만
        하고 검증하지 않은 상태였다. 로컬에 `main` 이 있고 origin 의 기본이 `master` 인
        저장소(포크에서 흔하다)면 둘이 갈린다.
        """
        # origin 쪽 기본 브랜치를 master 로 만든다.
        self._git(self.origin, "symbolic-ref", "HEAD", "refs/heads/master")
        seed2 = os.path.join(self.tmp, "seed2")
        self._git(self.tmp, "init", "-b", "master", seed2)
        self._write(seed2, "codebase/backend/src/b.ts", "export const b = 1;\n")
        self._git(seed2, "add", "-A")
        self._git(seed2, "commit", "-m", "master base")
        self._git(seed2, "remote", "add", "origin", self.origin)
        self._git(seed2, "push", "-q", "origin", "master")

        w2 = os.path.join(self.tmp, "work2")
        os.makedirs(w2)
        self._git(w2, "init", "-b", "main", ".")     # 로컬 브랜치 이름은 main
        self._git(w2, "remote", "add", "origin", self.origin)
        self._git(w2, "fetch", "-q", "--no-tags", "origin", "master")
        self._write(w2, "x.txt", "x\n")
        self._git(w2, "add", "-A")
        self._git(w2, "commit", "-m", "local main")   # refs/heads/main 이 생긴다
        self._git(w2, "remote", "set-url", "origin",
                  "https://invalid.invalid/nonexistent.git")

        for ref in ("refs/heads/main", "refs/remotes/origin/master"):
            rc, _, _ = rg._run_git(["rev-parse", "--verify", ref], w2)
            self.assertEqual(rc, 0, f"{ref} 가 없다 — 픽스처가 두 후보를 못 만들었다")
        self.assertEqual(
            rg._default_branch(w2), "master",
            "로컬 `main` 이 origin 의 기본 `master` 를 이겼다 — 순서가 뒤집혔다",
        )

    def test_an_unreviewed_change_is_not_reported_as_no_change(self):
        """가장 중요한 단언 — 이 층이 CI 에서 실제로 무언가를 하는가."""
        self._git(self.work, "remote", "set-url", "origin",
                  "https://invalid.invalid/nonexistent.git")
        self._write(self.work, "codebase/backend/src/a.ts", "export const a = 2;\n")
        self._git(self.work, "add", "-A")
        self._git(self.work, "commit", "-m", "feat")
        decision = rg.evaluate_review(self.work)
        self.assertTrue(
            decision.blocked,
            f"리뷰 없는 codebase 변경이 통과했다 — reason={decision.reason!r}",
        )
        self.assertNotIn("no codebase/ changes", decision.reason,
                         "변경을 아예 못 봤다 — base 해석 실패가 '변경 없음' 으로 읽혔다")


if __name__ == "__main__":
    unittest.main()


class TempRepoFixturesGoThroughTheSharedHelperTest(unittest.TestCase):
    """임시 git 저장소를 만드는 픽스처는 `_harness.git_in` 을 거쳐야 한다.

    2026-08-06 사고: 한 픽스처가 `git remote add origin …` 을 임시 트리 **밖에서**
    실행해 워크트리 5개가 공유하는 `.git/config` 를 덮었다. 다른 세션의 `fetch` 가
    깨졌고 **아무 신호도 없었다**. 개별 픽스처를 손으로 경화하는 것으로는 다음에
    추가되는 픽스처를 막지 못한다 — 그래서 목록이 아니라 **도출**로 강제한다.

    허용되는 형태는 둘뿐이다:
      · `_harness.git_in(...)` — 임시 저장소. 헬퍼가 `-C`·ceiling·임시경로 단언을 건다.
      · `cwd=REPO_ROOT` 로의 직접 호출 — 이 체크아웃 자신의 이력을 읽는 테스트.
        그쪽엔 ceiling 이 무의미하므로 경화 대상이 아니다(아래 레지스트리).
    """

    # 실 저장소를 의도적으로 읽는 호출. 각 항목은 "왜 임시 저장소가 아닌가" 다.
    _REAL_REPO_READERS = {
        "test_dependabot_npm_coverage.py":
            "이 저장소의 추적 파일 목록을 읽어 dependabot 등록 불변식을 검사한다",
        "test_harness_checks_paths_coverage.py":
            "이 저장소의 실제 경로를 harness-checks paths 와 대조한다",
        "test_line_anchors.py":
            "실제 커밋 이력에서 diff/소스를 뽑아 gutter 번호를 검증한다",
    }

    def _git_calls(self, tree):
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            f = node.func
            if not (isinstance(f, ast.Attribute) and f.attr == "run"
                    and isinstance(f.value, ast.Name) and f.value.id == "subprocess"):
                continue
            if not node.args:
                continue
            first = node.args[0]
            if isinstance(first, ast.List) and first.elts:
                head = first.elts[0]
                if isinstance(head, ast.Constant) and head.value == "git":
                    yield node

    def test_every_temp_repo_git_call_pins_dir_and_ceiling(self):
        """검사하는 것은 **속성**이지 메커니즘이 아니다.

        처음엔 "`_harness.git_in` 을 쓰는가" 로 짰는데, 이미 손으로 `git -C` + ceiling 을
        건 호출 10곳을 전부 위반으로 잡았다 — **고쳐야 할 것이 아니라 이미 옳은 것들**이다.
        그래서 판정을 두 성질로 바꾼다: 디렉터리가 argv 에 고정됐는가(`-C`), 그리고
        상향 탐색이 막혔는가(`GIT_CEILING_DIRECTORIES`). `git_in` 은 그 둘을 한 곳에
        모아 둔 구현일 뿐이고, 손으로 건 것도 같은 보증이면 통과시킨다.
        """
        offenders = []
        for path in sorted(TESTS_DIR.glob("test_*.py")):
            src = path.read_text(encoding="utf-8")
            lines = src.splitlines()
            tree = ast.parse(src)
            # 각 함수의 소스 범위 — ceiling 설정은 호출과 같은 함수 안에 있다.
            funcs = [(n.lineno, n.end_lineno) for n in ast.walk(tree)
                     if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
            for call in self._git_calls(tree):
                cwd = next((k.value for k in call.keywords if k.arg == "cwd"), None)
                names = {n.id for n in ast.walk(cwd) if isinstance(n, ast.Name)} if cwd else set()
                if "REPO_ROOT" in names:
                    self.assertIn(
                        path.name, self._REAL_REPO_READERS,
                        f"{path.name}:{call.lineno} 이 REPO_ROOT 로 git 을 부르는데 "
                        "레지스트리에 없다 — 실 저장소를 읽는 이유를 등재할 것",
                    )
                    continue
                argv = call.args[0].elts
                pinned = any(isinstance(e, ast.Constant) and e.value == "-C" for e in argv)
                enclosing = [f for f in funcs if f[0] <= call.lineno <= f[1]]
                start, end = (min(f[0] for f in enclosing), max(f[1] for f in enclosing)) \
                    if enclosing else (call.lineno, call.lineno)
                ceiled = "GIT_CEILING_DIRECTORIES" in "\n".join(lines[start - 1:end])
                if not (pinned and ceiled):
                    offenders.append(
                        f"{path.name}:{call.lineno} "
                        f"(-C={'있음' if pinned else '없음'}, ceiling={'있음' if ceiled else '없음'})")
        self.assertEqual(
            offenders, [],
            "임시 저장소에 대한 git 호출은 디렉터리를 argv 에 고정(`-C`)하고 상향 탐색을 "
            "막아야(`GIT_CEILING_DIRECTORIES`) 한다. `_harness.git_in()` 이 둘을 함께 건다.\n  "
            + "\n  ".join(offenders),
        )

    def test_the_registry_has_no_dead_entries(self):
        # 레지스트리가 낡으면 "등재됐으니 괜찮다" 가 거짓이 된다.
        for name in self._REAL_REPO_READERS:
            self.assertTrue((TESTS_DIR / name).is_file(),
                            f"레지스트리의 {name} 이 존재하지 않는다")

    def test_the_ast_blind_spot_is_named(self):
        """AST 는 **문자열 안**의 픽스처를 보지 못한다 — 그 사각을 이름으로 고정한다.

        `test_consistency_context_budget.py` 는 fresh-interpreter 스니펫(문자열)
        안에서 임시 저장소를 만든다. 위 도출 검사는 그것을 호출로 보지 않으므로
        **조용히 통과한다**. 사각이 있다는 사실 자체를 테스트로 남겨, 나중에 이 파일이
        정리될 때(§14 보일러플레이트 추출) 함께 처리되도록 한다.
        """
        p = TESTS_DIR / "test_consistency_context_budget.py"
        src = p.read_text(encoding="utf-8")
        self.assertIn('subprocess.run(["git"', src.replace(", *a]", ", *a]"),
                      "이 파일이 정리됐다면 이 테스트와 위 주석도 함께 지울 것")
        self.assertIn("run_in_orchestrator", src,
                      "fresh-interpreter 경로가 사라졌다면 사각도 사라진 것이다")


class DefaultBranchResolutionOrderTest(unittest.TestCase):
    """`_default_branch` 의 **성공** 경로들을 실 저장소로 구동한다 (백로그 §15).

    11R 이 닫은 결함은 "이 함수가 저장소 위상에 따라 다르게 행동한다" 였는데, 그때
    만든 유일한 실 저장소 픽스처(`ActionsCheckoutTopologyTest`)는 **정의상
    `refs/remotes/origin/HEAD` 가 없는** 위상이다. 즉 두 위상 중 하나만 실물로 봤고,
    "있을 때" 는 stub 으로만 고정돼 있었다.

    여기서 네 위상을 각각 만든다. 순서가 계약의 일부다 —
    `refs/remotes/origin/<name>` 이 `refs/heads/<name>` 보다 **먼저**여야 한다.
    같은 이름의 로컬 브랜치는 "무엇이 기본 브랜치인가" 에 대해 더 약한 주장이다.
    """

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)

    def _origin(self, branch="main"):
        origin = _harness.make_temp_git_repo(os.path.join(self.tmp, f"origin-{branch}"),
                                             branch=branch)
        return origin

    def test_remote_head_is_what_answers_when_the_name_is_neither_main_nor_master(self):
        """Method 1 을 **분리해서** 잰다.

        평범한 clone 에서는 `refs/remotes/origin/HEAD` 와 `refs/remotes/origin/main` 이
        **둘 다** 있어서, 결과가 'main' 이어도 Method 1 이 답했는지 폴백 루프가 답했는지
        구분되지 않는다 — 그 상태로 두면 Method 1 을 지운 뮤턴트가 통과한다.

        기본 브랜치를 `trunk` 로 두면 갈린다: 폴백 루프는 main/master 만 보므로 답할 수
        없고, `symbolic-ref refs/remotes/origin/HEAD` 만이 'trunk' 를 낼 수 있다.
        """
        origin = self._origin("trunk")
        clone = os.path.join(self.tmp, "clone-trunk")
        _harness.git_in(self.tmp, "clone", "-q", str(origin), clone)
        _harness.git_in(clone, "remote", "set-url", "origin",
                        os.path.join(self.tmp, "unreachable.git"))
        # 폴백이 답할 수 없음을 전제로 단언한다.
        for name in ("main", "master"):
            rc, _, _ = rg._run_git(
                ["rev-parse", "--verify", f"refs/remotes/origin/{name}"], clone)
            self.assertNotEqual(rc, 0, f"픽스처에 origin/{name} 이 있으면 분리가 깨진다")
        self.assertEqual(rg._default_branch(clone), "trunk")

    def test_clone_resolves_via_remote_head_without_network(self):
        """Method 1 성공 — `git clone` 은 `refs/remotes/origin/HEAD` 를 만든다."""
        origin = self._origin("main")
        clone = os.path.join(self.tmp, "clone")
        _harness.git_in(self.tmp, "clone", "-q", str(origin), clone)
        # 전제부터 단언한다 — 이 ref 가 없으면 이 테스트는 다른 경로를 재는 셈이다.
        rc, out, _ = rg._run_git(["rev-parse", "--verify", "refs/remotes/origin/HEAD"], clone)
        self.assertEqual(rc, 0, "픽스처가 remote HEAD 를 만들지 못했다")

        # origin 을 도달 불가로 만들어 네트워크 경유가 아님을 증명한다.
        _harness.git_in(clone, "remote", "set-url", "origin",
                        os.path.join(self.tmp, "does-not-exist.git"))
        self.assertEqual(rg._default_branch(clone), "main")

    def test_master_named_default_is_not_hardcoded_to_main(self):
        origin = self._origin("master")
        clone = os.path.join(self.tmp, "clone-master")
        _harness.git_in(self.tmp, "clone", "-q", str(origin), clone)
        _harness.git_in(clone, "remote", "set-url", "origin",
                        os.path.join(self.tmp, "gone.git"))
        self.assertEqual(rg._default_branch(clone), "master")

    def test_remote_tracking_ref_wins_over_a_same_named_local_branch(self):
        """`origin/master` 만 있고 로컬엔 `main` 도 있을 때 — remote 쪽이 이겨야 한다.

        순서가 뒤집히면 로컬에 우연히 만든 `main` 이 기본 브랜치를 참칭한다.
        """
        origin = self._origin("master")
        clone = os.path.join(self.tmp, "clone-order")
        _harness.git_in(self.tmp, "clone", "-q", str(origin), clone)
        _harness.git_in(clone, "remote", "set-url", "origin",
                        os.path.join(self.tmp, "gone2.git"))
        # remote HEAD 를 지워 Method 1 을 무력화하고, 로컬 main 을 만든다.
        #
        # `update-ref -d` 로는 **지워지지 않는다** — rc 0 을 내면서 symref 는 그대로 남고,
        # `symbolic-ref` 가 계속 answers 한다(실측). 그 상태로 두면 이 테스트는 Method 1 을
        # 그대로 탄 채 우연히 기대값과 같아 통과했다. symref 는 `symbolic-ref --delete` 로
        # 지운다.
        _harness.git_in(clone, "symbolic-ref", "--delete", "refs/remotes/origin/HEAD")
        rc, _, _ = rg._run_git(
            ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], clone)
        self.assertNotEqual(rc, 0, "Method 1 이 아직 살아 있으면 이 테스트는 순서를 재지 못한다")
        _harness.git_in(clone, "branch", "main")
        self.assertEqual(
            rg._default_branch(clone), "master",
            "refs/remotes/origin/* 가 refs/heads/* 보다 먼저 조회돼야 한다",
        )

    def test_local_branch_only_still_resolves(self):
        repo = _harness.make_temp_git_repo(os.path.join(self.tmp, "local-only"))
        self.assertEqual(rg._default_branch(repo), "main")

    def test_no_branch_no_remote_yields_none(self):
        bare = os.path.join(self.tmp, "empty")
        _harness.make_temp_git_repo(bare, branch="wip", initial_commit=True)
        self.assertIsNone(
            rg._default_branch(bare),
            "main/master 어느 쪽도 없으면 추측하지 않고 None 이어야 한다",
        )


class RunGitTimeoutIsSwallowedTest(unittest.TestCase):
    """`_run_git` 의 타임아웃 경로 (백로그 §16).

    이 분기는 가설이 아니다 — 11R 이 실측했듯 **CI 에서 매번 실제로 밟히던 경로**다
    (네트워크 프로브가 자기 2초 상한에 걸렸다). 삼키는 방향이 fail-open 이라
    ("실패로 취급" = rc 1), 조용히 사라지면 상위 판정이 통째로 기울어진다.
    """

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.bin = os.path.join(self.tmp, "bin")
        os.makedirs(self.bin)
        stub = os.path.join(self.bin, "git")
        with open(stub, "w", encoding="utf-8") as f:
            f.write("#!/bin/sh\nsleep 30\n")
        os.chmod(stub, 0o755)
        self._old_path = os.environ["PATH"]
        os.environ["PATH"] = self.bin + os.pathsep + self._old_path
        self.addCleanup(os.environ.__setitem__, "PATH", self._old_path)

    def test_a_hanging_git_returns_failure_not_an_exception(self):
        rc, out, err = rg._run_git(["status"], self.tmp, timeout=0.3)
        self.assertEqual((rc, out, err), (1, "", ""),
                         "타임아웃은 예외가 아니라 '실패' 로 흡수돼야 한다")

    def test_it_actually_timed_out_rather_than_finishing(self):
        # 스텁이 정말 매달렸는지 — 안 그러면 위 테스트가 다른 이유로 통과한다.
        start = time.monotonic()
        rg._run_git(["status"], self.tmp, timeout=0.3)
        elapsed = time.monotonic() - start
        self.assertGreater(elapsed, 0.25, "스텁이 즉시 끝났다 — 타임아웃 경로가 아니다")
        self.assertLess(elapsed, 10.0, "상한이 적용되지 않았다")
