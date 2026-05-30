"""Unit tests for the review-coverage guard.

Two surfaces:
  - `_summary_is_resolved` — the SUMMARY.md / RESOLUTION.md parser (real temp
    files; this is where format drift would bite).
  - `evaluate_review` — the block/allow decision table (git + fs helpers are
    patched so the table is asserted hermetically, mirroring test_branch_guard).
"""

from __future__ import annotations

import os
import tempfile
import unittest
from unittest import mock

import _harness  # noqa: F401  — side effect: puts .claude/hooks on sys.path
from _lib import review_guard as rg


CLEAN_SUMMARY = """# Code Review 통합 보고서

## 전체 위험도
**NONE** — 변경 없음 수준

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
"""

CRITICAL_SUMMARY = """# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 인증 우회

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 인증 우회 | auth.py:10 | 검증 추가 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
"""

WARNING_ONLY_SUMMARY = """# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 경고 1건

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수 | 매직 넘버 | foo.py:3 | 상수화 |
"""


class SummaryResolvedTest(unittest.TestCase):
    def _write(self, summary_text, *, with_resolution=False):
        d = tempfile.mkdtemp()
        sp = os.path.join(d, "SUMMARY.md")
        with open(sp, "w", encoding="utf-8") as f:
            f.write(summary_text)
        if with_resolution:
            with open(os.path.join(d, "RESOLUTION.md"), "w") as f:
                f.write("## 조치 항목\n## TEST 결과\n")
        return sp

    def test_clean_report_is_resolved(self):
        self.assertTrue(rg._summary_is_resolved(self._write(CLEAN_SUMMARY)))

    def test_critical_without_resolution_is_unresolved(self):
        self.assertFalse(rg._summary_is_resolved(self._write(CRITICAL_SUMMARY)))

    def test_warning_rows_without_resolution_is_unresolved(self):
        self.assertFalse(
            rg._summary_is_resolved(self._write(WARNING_ONLY_SUMMARY))
        )

    def test_critical_with_resolution_is_resolved(self):
        self.assertTrue(
            rg._summary_is_resolved(
                self._write(CRITICAL_SUMMARY, with_resolution=True)
            )
        )

    def test_warning_with_resolution_is_resolved(self):
        self.assertTrue(
            rg._summary_is_resolved(
                self._write(WARNING_ONLY_SUMMARY, with_resolution=True)
            )
        )


class EvaluateDecisionTableTest(unittest.TestCase):
    def _evaluate(self, *, committed, uncommitted, code_mtime, review_mtime):
        with mock.patch.object(rg, "_repo_root", return_value="/r"), \
             mock.patch.object(rg, "_default_branch", return_value="main"), \
             mock.patch.object(rg, "_merge_base", return_value="base"), \
             mock.patch.object(rg, "_committed_code_changes", return_value=committed), \
             mock.patch.object(rg, "_uncommitted_code_changes", return_value=uncommitted), \
             mock.patch.object(rg, "_newest_code_mtime", return_value=code_mtime), \
             mock.patch.object(rg, "_newest_resolved_review_mtime", return_value=review_mtime):
            return rg.evaluate_review("/fake/cwd")

    def test_allows_when_no_code_change(self):
        d = self._evaluate(committed=[], uncommitted=[], code_mtime=0.0, review_mtime=0.0)
        self.assertFalse(d.blocked)

    def test_blocks_code_change_with_no_review(self):
        d = self._evaluate(
            committed=["codebase/backend/a.py"], uncommitted=[],
            code_mtime=100.0, review_mtime=0.0,
        )
        self.assertTrue(d.blocked)
        self.assertIn("no resolved review", d.reason)

    def test_blocks_code_edited_after_review(self):
        d = self._evaluate(
            committed=["codebase/backend/a.py"], uncommitted=[],
            code_mtime=200.0, review_mtime=100.0,
        )
        self.assertTrue(d.blocked)
        self.assertIn("AFTER", d.reason)

    def test_allows_fresh_resolved_review(self):
        d = self._evaluate(
            committed=["codebase/backend/a.py"], uncommitted=[],
            code_mtime=100.0, review_mtime=150.0,
        )
        self.assertFalse(d.blocked)

    def test_uncommitted_code_change_counts(self):
        d = self._evaluate(
            committed=[], uncommitted=["codebase/frontend/x.ts"],
            code_mtime=100.0, review_mtime=0.0,
        )
        self.assertTrue(d.blocked)

    def test_allows_outside_git_repo(self):
        with mock.patch.object(rg, "_repo_root", return_value=None):
            d = rg.evaluate_review("/fake/cwd")
        self.assertFalse(d.blocked)


if __name__ == "__main__":
    unittest.main()
