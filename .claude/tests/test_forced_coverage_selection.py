"""`_newest_resolved_review_mtime` over real session dirs — the forced gate's safety argument.

The argument for rolling the forced-coverage requirement out to *all* history without a
grandfather clause was: an under-covered session simply drops out of the "resolved" set,
the guard takes the newest session still in it, and old sessions were older than the code
being changed anyway — so nothing is retroactively broken, only future reviews are held to
the bar. That is load-bearing (it is why 106 sessions could stop counting without blocking
anyone), and every existing test of this function mocks it away.

It is also not hypothetical: session `01_27_10` skipped forced reviewers and `08_17_35`
later covered the same range — exactly the shape asserted here.

Real dirs on disk, because the function's whole job is reading them: the session **clock
is the directory name** (`<Y>/<m>/<d>/<H>_<M>_<S>`, checkout- and rebase-immune), which a
mock cannot exercise.
"""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

import _harness  # noqa: F401  — side effect: puts .claude/hooks on sys.path
from _lib import review_guard as rg

CLEAN_SUMMARY = """# Code Review 통합 보고서

## 전체 위험도
**NONE** — clean

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
"""

FORCED = ["security", "scope"]


class NewestResolvedReviewTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def _session(self, stamp: str, *, reports) -> Path:
        """A committed-looking review session at `review/code/<stamp>`."""
        sd = self.repo / "review" / "code" / stamp
        sd.mkdir(parents=True)
        (sd / "SUMMARY.md").write_text(CLEAN_SUMMARY, encoding="utf-8")
        (sd / "_retry_state.json").write_text(
            json.dumps(
                {
                    "agents_forced": FORCED,
                    "subagent_invocations": [
                        # Recorded path names a worktree that no longer exists — the shape
                        # every finished task leaves behind.
                        {"name": n, "output_file": f"/Volumes/gone/wt/review/code/{stamp}/{n}.md"}
                        for n in FORCED
                    ],
                }
            ),
            encoding="utf-8",
        )
        for n in reports:
            (sd / f"{n}.md").write_text("# report\n", encoding="utf-8")
        return sd

    def _newest(self) -> float:
        # `dirty=set()` → every artifact reads as committed, so the session-dir clock is
        # the only input (no mtime folding).
        return rg._newest_resolved_review_mtime(str(self.repo), dirty=set())

    def test_an_under_covered_session_does_not_count_as_resolved(self):
        self._session("2026/07/17/01_27_10", reports=["scope"])  # security skipped
        self.assertEqual(self._newest(), 0.0, "a session short a forced reviewer must not count")

    def test_a_later_complete_session_supersedes_an_under_covered_one(self):
        # The real 01_27_10 → 08_17_35 shape: the incomplete session drops out, the
        # complete one carries the branch. This is why no grandfather clause was needed.
        self._session("2026/07/17/01_27_10", reports=["scope"])
        complete = self._session("2026/07/17/08_17_35", reports=FORCED)
        self.assertEqual(self._newest(), rg._path_session_time(str(complete)))

    def test_an_earlier_complete_session_is_not_shadowed_by_a_later_gap(self):
        # Order must not matter: "newest *resolved*", not "newest".
        complete = self._session("2026/07/17/01_00_00", reports=FORCED)
        self._session("2026/07/17/09_00_00", reports=[])  # later but covers nothing
        self.assertEqual(self._newest(), rg._path_session_time(str(complete)))

    def test_the_newest_of_several_complete_sessions_wins(self):
        self._session("2026/07/16/10_00_00", reports=FORCED)
        newest = self._session("2026/07/17/10_00_00", reports=FORCED)
        self.assertEqual(self._newest(), rg._path_session_time(str(newest)))

    def test_an_empty_forced_report_does_not_rescue_a_session(self):
        # `touch security.md` must not turn an incomplete session into a resolved one.
        sd = self._session("2026/07/17/01_27_10", reports=["scope"])
        (sd / "security.md").write_text("", encoding="utf-8")
        self.assertEqual(self._newest(), 0.0)

    def test_no_sessions_at_all_reads_as_no_review(self):
        self.assertEqual(self._newest(), 0.0)

    def test_a_dirty_resolution_folds_its_mtime_in(self):
        # The just-fixed-and-not-yet-committed case: the RESOLUTION written this session
        # is newer than the session dir's own timestamp.
        sd = self._session("2020/01/01/00_00_00", reports=FORCED)
        (sd / "RESOLUTION.md").write_text("## 조치 항목\n## TEST 결과\n", encoding="utf-8")
        rel = os.path.relpath(sd / "RESOLUTION.md", self.repo).replace(os.sep, "/")
        got = rg._newest_resolved_review_mtime(str(self.repo), dirty={rel})
        self.assertGreater(
            got, rg._path_session_time(str(sd)),
            "a dirty RESOLUTION's mtime must fold in — otherwise a 2020-stamped path wins",
        )


if __name__ == "__main__":
    unittest.main()
