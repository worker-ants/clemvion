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


class GlobAndFrontmatterTest(unittest.TestCase):
    def test_glob_double_star_crosses_dirs(self):
        p = rg._glob_to_regex("codebase/backend/src/**/*.ts")
        self.assertTrue(p.match("codebase/backend/src/a.ts"))
        self.assertTrue(p.match("codebase/backend/src/x/y/z.ts"))
        self.assertFalse(p.match("codebase/frontend/src/a.ts"))
        self.assertFalse(p.match("codebase/backend/src/a.js"))

    def test_glob_single_star_stays_in_segment(self):
        p = rg._glob_to_regex("codebase/backend/*.ts")
        self.assertTrue(p.match("codebase/backend/a.ts"))
        self.assertFalse(p.match("codebase/backend/sub/a.ts"))

    def test_glob_trailing_double_star_dir(self):
        p = rg._glob_to_regex("codebase/frontend/src/app/**")
        self.assertTrue(p.match("codebase/frontend/src/app/page.tsx"))
        self.assertTrue(p.match("codebase/frontend/src/app/deep/x.tsx"))

    def _spec(self, body):
        d = tempfile.mkdtemp()
        sp = os.path.join(d, "x.md")
        with open(sp, "w", encoding="utf-8") as f:
            f.write(body)
        return sp

    def test_parse_inline_list(self):
        sp = self._spec("---\nid: a\nstatus: implemented\n"
                        "code: [codebase/backend/a.ts, codebase/frontend/b.ts]\n---\n# x\n")
        self.assertEqual(
            rg._parse_frontmatter_code(sp),
            ["codebase/backend/a.ts", "codebase/frontend/b.ts"],
        )

    def test_parse_block_list(self):
        sp = self._spec("---\nid: a\ncode:\n  - codebase/backend/a.ts\n"
                        "  - codebase/frontend/b.ts\nstatus: partial\n---\n# x\n")
        self.assertEqual(
            rg._parse_frontmatter_code(sp),
            ["codebase/backend/a.ts", "codebase/frontend/b.ts"],
        )

    def test_parse_single_value(self):
        sp = self._spec("---\ncode: codebase/backend/a.ts\n---\n# x\n")
        self.assertEqual(rg._parse_frontmatter_code(sp), ["codebase/backend/a.ts"])

    def test_parse_no_frontmatter(self):
        sp = self._spec("# just a heading\ncode: not-frontmatter\n")
        self.assertEqual(rg._parse_frontmatter_code(sp), [])

    def test_parse_no_code_field(self):
        sp = self._spec("---\nid: a\nstatus: spec-only\n---\n# x\n")
        self.assertEqual(rg._parse_frontmatter_code(sp), [])


class ImplDoneSessionTest(unittest.TestCase):
    def _session(self, mode, block):
        d = tempfile.mkdtemp()
        with open(os.path.join(d, "meta.json"), "w", encoding="utf-8") as f:
            f.write('{"mode": "%s", "target_path": "spec/x"}' % mode)
        sp = os.path.join(d, "SUMMARY.md")
        with open(sp, "w", encoding="utf-8") as f:
            f.write("# Consistency Check 통합 보고서\n\n**BLOCK: %s** — ...\n" % block)
        return d, sp

    def test_impl_done_mode_detected(self):
        d, _ = self._session("구현 완료 후 검토 (--impl-done, scope=spec/4-nodes)", "NO")
        self.assertTrue(rg._is_impl_done_session(d))

    def test_non_impl_done_mode_rejected(self):
        d, _ = self._session("spec draft 검토 (--spec)", "NO")
        self.assertFalse(rg._is_impl_done_session(d))

    def test_block_no_parsed(self):
        _, sp = self._session("(--impl-done)", "NO")
        self.assertTrue(rg._summary_block_is_no(sp))

    def test_block_yes_rejected(self):
        _, sp = self._session("(--impl-done)", "YES")
        self.assertFalse(rg._summary_block_is_no(sp))


class SpecConsistencyGateTest(unittest.TestCase):
    """Gate 2: spec-linked changes require a fresh --impl-done consistency report.
    The code-review gate is held satisfied (review_mtime >= code_mtime)."""

    def _evaluate(self, *, spec_linked, code_mtime, impl_done_mtime):
        with mock.patch.object(rg, "_repo_root", return_value="/r"), \
             mock.patch.object(rg, "_default_branch", return_value="main"), \
             mock.patch.object(rg, "_merge_base", return_value="base"), \
             mock.patch.object(rg, "_committed_code_changes",
                               return_value=["codebase/backend/a.ts"]), \
             mock.patch.object(rg, "_uncommitted_code_changes", return_value=[]), \
             mock.patch.object(rg, "_newest_code_mtime", return_value=code_mtime), \
             mock.patch.object(rg, "_newest_resolved_review_mtime", return_value=9999.0), \
             mock.patch.object(rg, "_spec_linked_changes", return_value=spec_linked), \
             mock.patch.object(rg, "_newest_resolved_impl_done_mtime",
                               return_value=impl_done_mtime):
            return rg.evaluate_review("/fake/cwd")

    def test_non_spec_linked_change_not_gated(self):
        d = self._evaluate(spec_linked=[], code_mtime=100.0, impl_done_mtime=0.0)
        self.assertFalse(d.blocked)

    def test_spec_linked_without_impl_done_blocks(self):
        d = self._evaluate(
            spec_linked=["codebase/backend/a.ts"], code_mtime=100.0, impl_done_mtime=0.0
        )
        self.assertTrue(d.blocked)
        self.assertIn("--impl-done", d.reason)

    def test_spec_linked_with_stale_impl_done_blocks(self):
        d = self._evaluate(
            spec_linked=["codebase/backend/a.ts"], code_mtime=200.0, impl_done_mtime=100.0
        )
        self.assertTrue(d.blocked)
        self.assertIn("AFTER", d.reason)

    def test_spec_linked_with_fresh_impl_done_allows(self):
        d = self._evaluate(
            spec_linked=["codebase/backend/a.ts"], code_mtime=100.0, impl_done_mtime=150.0
        )
        self.assertFalse(d.blocked)


if __name__ == "__main__":
    unittest.main()
