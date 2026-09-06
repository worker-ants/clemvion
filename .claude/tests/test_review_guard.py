"""Unit tests for the review-coverage guard.

Two surfaces:
  - `_summary_is_resolved` — the SUMMARY.md / RESOLUTION.md parser (real temp
    files; this is where format drift would bite).
  - `evaluate_review` — the block/allow decision table (git + fs helpers are
    patched so the table is asserted hermetically, mirroring test_branch_guard).
"""

from __future__ import annotations

import json
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


class ForcedCoverageTest(unittest.TestCase):
    """`agents_forced` (router_safety whitelist) must have run for a review to count.

    Until this gate the whitelist was prose, and prose is what a "this diff is small"
    judgement call talks itself past: 160 of 575 committed sessions were short a forced
    reviewer when measured (2026-07-17), 107 of them carrying a RESOLUTION.md and so
    passing as "resolved". One had skipped `security` on a diff editing the
    open-redirect boundary.
    """

    def _session(self, *, forced, reports, with_resolution=True, output_dir=None):
        d = tempfile.mkdtemp()
        with open(os.path.join(d, "SUMMARY.md"), "w", encoding="utf-8") as f:
            f.write(CLEAN_SUMMARY)
        if with_resolution:
            with open(os.path.join(d, "RESOLUTION.md"), "w") as f:
                f.write("## 조치 항목\n## TEST 결과\n")
        # `output_dir` lets a test record paths into a worktree that no longer exists —
        # the shape every finished task leaves behind in a committed session.
        base = output_dir if output_dir is not None else d
        state = {
            "agents_forced": list(forced),
            "subagent_invocations": [
                {"name": n, "output_file": os.path.join(base, f"{n}.md")} for n in forced
            ],
        }
        with open(os.path.join(d, "_retry_state.json"), "w", encoding="utf-8") as f:
            json.dump(state, f)
        for n in reports:
            with open(os.path.join(d, f"{n}.md"), "w", encoding="utf-8") as f:
                f.write("# report\n")
        return os.path.join(d, "SUMMARY.md")

    def test_full_forced_coverage_is_resolved(self):
        sp = self._session(forced=["security", "scope"], reports=["security", "scope"])
        self.assertTrue(rg._summary_is_resolved(sp))

    def test_a_missing_forced_reviewer_is_unresolved_even_with_a_RESOLUTION(self):
        # The exact 2026-07-17 shape: RESOLUTION.md written, forced reviewer skipped.
        sp = self._session(forced=["security", "scope"], reports=["scope"])
        self.assertFalse(rg._summary_is_resolved(sp))

    def test_a_claimed_success_without_a_report_does_not_count(self):
        # Coverage is judged by files, never by agents_success — a self-reported status
        # with no file behind it is the fake success this contract removes.
        d = tempfile.mkdtemp()
        with open(os.path.join(d, "SUMMARY.md"), "w", encoding="utf-8") as f:
            f.write(CLEAN_SUMMARY)
        with open(os.path.join(d, "_retry_state.json"), "w", encoding="utf-8") as f:
            json.dump(
                {
                    "agents_forced": ["security"],
                    "agents_success": ["security"],  # claimed…
                    "subagent_invocations": [
                        {"name": "security", "output_file": os.path.join(d, "security.md")}
                    ],
                },
                f,
            )  # …but no security.md on disk
        self.assertFalse(rg._summary_is_resolved(os.path.join(d, "SUMMARY.md")))

    def test_reports_are_found_when_the_recorded_worktree_is_gone(self):
        # `output_file` points at the worktree the session ran in; that directory is
        # deleted when the task ends while `review/**` lives on in git. Resolving against
        # it would mark 537/575 committed sessions uncovered and fire on nearly all of them.
        sp = self._session(
            forced=["security"],
            reports=["security"],
            output_dir="/Volumes/gone/.claude/worktrees/dead-1234/review/code/2026/01/01/00_00_00",
        )
        self.assertTrue(rg._summary_is_resolved(sp))

    def test_a_session_without_a_manifest_is_unaffected(self):
        # Hand-written sessions and pre-manifest history must not be swept up: this gate
        # only tightens sessions that declared a whitelist.
        d = tempfile.mkdtemp()
        sp = os.path.join(d, "SUMMARY.md")
        with open(sp, "w", encoding="utf-8") as f:
            f.write(CLEAN_SUMMARY)
        self.assertEqual(rg._forced_coverage_missing(d), [])
        self.assertTrue(rg._summary_is_resolved(sp))

    def test_an_empty_forced_list_is_unaffected(self):
        sp = self._session(forced=[], reports=[])
        self.assertTrue(rg._summary_is_resolved(sp))

    def test_a_corrupt_manifest_fails_open(self):
        d = tempfile.mkdtemp()
        sp = os.path.join(d, "SUMMARY.md")
        with open(sp, "w", encoding="utf-8") as f:
            f.write(CLEAN_SUMMARY)
        with open(os.path.join(d, "_retry_state.json"), "w", encoding="utf-8") as f:
            f.write("{not json")
        self.assertEqual(rg._forced_coverage_missing(d), [])

    def test_an_empty_report_does_not_count_as_coverage(self):
        # `touch security.md` must not satisfy the whitelist — "looks done, isn't" is the
        # shape this gate exists to catch. Every real report is ≥254 bytes.
        sp = self._session(forced=["security"], reports=[])
        with open(os.path.join(os.path.dirname(sp), "security.md"), "w") as f:
            f.write("")
        self.assertEqual(rg._forced_coverage_missing(os.path.dirname(sp)), ["security"])
        self.assertFalse(rg._summary_is_resolved(sp))

    def test_malformed_field_types_do_not_crash_the_guard(self):
        d = tempfile.mkdtemp()
        sp = os.path.join(d, "SUMMARY.md")
        with open(sp, "w", encoding="utf-8") as f:
            f.write(CLEAN_SUMMARY)
        with open(os.path.join(d, "_retry_state.json"), "w", encoding="utf-8") as f:
            # valid JSON, wrong shapes — a str would otherwise be iterated per-character
            json.dump({"agents_forced": "security", "subagent_invocations": {"x": 1}}, f)
        self.assertEqual(rg._forced_coverage_missing(d), [])

    def test_a_forced_name_absent_from_invocations_falls_back_to_name_md(self):
        d = tempfile.mkdtemp()
        sp = os.path.join(d, "SUMMARY.md")
        with open(sp, "w", encoding="utf-8") as f:
            f.write(CLEAN_SUMMARY)
        with open(os.path.join(d, "_retry_state.json"), "w", encoding="utf-8") as f:
            json.dump({"agents_forced": ["security"], "subagent_invocations": []}, f)
        self.assertEqual(rg._forced_coverage_missing(d), ["security"])
        with open(os.path.join(d, "security.md"), "w") as f:
            f.write("# report\n")
        self.assertEqual(rg._forced_coverage_missing(d), [])


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

    def test_parse_block_list_survives_yaml_comment(self):
        """`#` 주석 뒤 항목이 사라지면 안 된다.

        블록 리스트 루프가 `- ` 가 아닌 첫 줄에서 break 하던 판은, 유효한 YAML 인
        인라인 주석 하나에 **뒤 항목을 전부** 떨궜다. 그러면 `code:` 에 등재된 파일이
        spec-linked 판정에서 조용히 빠진다 — 게이트가 안 무는 것이 기본값이 된다.

        실측(2026-09-06): 저장소 spec 387개 중 7개 파일이 이 형태였고 **41개 entry**
        가 유실 중이었다. 그중 하나(`spec/2-navigation/9-user-profile.md` 의
        `codebase/backend/src/modules/workspaces/**`)는 당시 작업 중이던 PR 자신의
        수정 파일을 덮고 있었다 (`review/consistency/2026/09/06/13_52_23` Critical 1).

        gray-matter 를 쓰는 프런트엔드 파서(`spec-frontmatter-parse.ts`)는 처음부터
        주석 뒤를 봤다 — 두 파서가 유효한 YAML 에 서로 다른 답을 내고 있었다.
        """
        sp = self._spec("---\nid: a\ncode:\n  - codebase/backend/a.ts\n"
                        "  # 범주 구분 주석\n"
                        "  - codebase/frontend/b.ts\nstatus: partial\n---\n# x\n")
        self.assertEqual(
            rg._parse_frontmatter_code(sp),
            ["codebase/backend/a.ts", "codebase/frontend/b.ts"],
        )

    def test_parse_block_list_survives_blank_line(self):
        """빈 줄도 같은 이유로 리스트를 끊으면 안 된다."""
        sp = self._spec("---\nid: a\ncode:\n  - codebase/backend/a.ts\n"
                        "\n"
                        "  - codebase/frontend/b.ts\nstatus: partial\n---\n# x\n")
        self.assertEqual(
            rg._parse_frontmatter_code(sp),
            ["codebase/backend/a.ts", "codebase/frontend/b.ts"],
        )

    def test_parse_block_list_still_stops_at_next_key(self):
        """주석·빈 줄만 건너뛴다 — **다음 키에서는 여전히 멈춘다.**

        이 단언이 없으면 위 두 수정이 리스트를 다음 키의 항목까지 삼키는 방향으로
        넓어져도 통과한다. 넓힌 술어에는 반대 방향 대조군이 필요하다.
        """
        sp = self._spec("---\nid: a\ncode:\n  - codebase/backend/a.ts\n"
                        "\n"
                        "  # 주석\n"
                        "pending_plans:\n  - plan/in-progress/x.md\n---\n# x\n")
        self.assertEqual(
            rg._parse_frontmatter_code(sp), ["codebase/backend/a.ts"]
        )

    def test_parse_block_list_starting_with_comment(self):
        """리스트의 **첫 줄**이 주석인 경우 (`review/code/2026/09/06/14_25_40` INFO#8)."""
        sp = self._spec("---\nid: a\ncode:\n  # 범주 주석\n"
                        "  - codebase/backend/a.ts\nstatus: partial\n---\n# x\n")
        self.assertEqual(
            rg._parse_frontmatter_code(sp), ["codebase/backend/a.ts"]
        )

    def test_parse_strips_trailing_comment_block_list(self):
        """항목과 **같은 줄**에 붙은 주석은 값이 아니다.

        줄 전체 주석만 건너뛰던 판은 트레일링 주석을 값에 붙여 **어떤 파일과도 매치되지
        않는 죽은 glob** 을 만들었다 — 항목이 사라지는 것과 같은 등급의 조용한 유실이다.
        직전 수정이 한 칸 좁았다 (`review/code/2026/09/06/14_25_40` W1 — maintainability·
        testing 두 reviewer 가 정규식을 직접 실행해 독립 재현).
        """
        sp = self._spec("---\nid: a\ncode:\n"
                        "  - codebase/backend/a.ts  # 시행 코드\n"
                        "  - codebase/frontend/b.ts\nstatus: partial\n---\n# x\n")
        self.assertEqual(
            rg._parse_frontmatter_code(sp),
            ["codebase/backend/a.ts", "codebase/frontend/b.ts"],
        )

    def test_parse_strips_trailing_comment_single_and_inline(self):
        """단일값·인라인 리스트 형태도 같다 — 세 분기 전부 같은 경로를 탄다."""
        sp = self._spec("---\ncode: codebase/backend/a.ts  # 비고\n---\n# x\n")
        self.assertEqual(rg._parse_frontmatter_code(sp), ["codebase/backend/a.ts"])

        sp2 = self._spec("---\ncode: [codebase/backend/a.ts, codebase/frontend/b.ts]  # 비고\n"
                         "---\n# x\n")
        self.assertEqual(
            rg._parse_frontmatter_code(sp2),
            ["codebase/backend/a.ts", "codebase/frontend/b.ts"],
        )

    def test_parse_strips_trailing_comment_after_quoted_scalar(self):
        """**따옴표로 감싼 값 + 트레일링 주석**도 같다.

        언쿼트 세 형태만 닫았더니 이 인접 변형이 남았다 — 닫는 따옴표와 주석이 값에 붙어
        `a.ts"  # note` 라는 **죽은 glob** 이 재생산된다(재현 확인). 같은 결함 클래스를
        **세 번째**로 한 칸씩 좁게 닫은 셈이라, 이번엔 인용 부호 안팎을 갈라 처리한다
        (`review/code/2026/09/06/14_59_48` W3).
        """
        sp = self._spec('---\nid: a\ncode:\n'
                        '  - "codebase/backend/a.ts"  # note\n'
                        "  - 'codebase/frontend/b.ts'  # note\n"
                        "status: partial\n---\n# x\n")
        self.assertEqual(
            rg._parse_frontmatter_code(sp),
            ["codebase/backend/a.ts", "codebase/frontend/b.ts"],
        )

    def test_parse_quoted_scalar_trailing_comment_single_and_inline(self):
        """인용+주석을 **세 분기 모두**에서 문는다.

        직전 판은 블록 리스트 형태만 태웠다. 같은 `_strip_comment` 를 타므로 구현은
        맞았지만, **관측되지 않는 분기는 다음 편집에서 조용히 죽는다** — 이 파일이
        이미 세 번 겪은 형태다 (`review/code/2026/09/06/15_30_59` W2).
        """
        sp = self._spec('---\ncode: "codebase/backend/a.ts"  # note\n---\n# x\n')
        self.assertEqual(rg._parse_frontmatter_code(sp), ["codebase/backend/a.ts"])

        sp2 = self._spec(
            '---\ncode: ["codebase/backend/a.ts", "codebase/frontend/b.ts"]  # note\n'
            "---\n# x\n"
        )
        self.assertEqual(
            rg._parse_frontmatter_code(sp2),
            ["codebase/backend/a.ts", "codebase/frontend/b.ts"],
        )

    def test_parse_quoted_scalar_keeps_inner_hash(self):
        """따옴표 **안**의 `#` 은 주석이 아니다 — 반대 방향 대조군."""
        sp = self._spec('---\nid: a\ncode:\n'
                        '  - "codebase/backend/a #b.ts"\n'
                        "status: partial\n---\n# x\n")
        self.assertEqual(
            rg._parse_frontmatter_code(sp), ["codebase/backend/a #b.ts"]
        )

    def test_parse_unterminated_quote_falls_back(self):
        """닫는 따옴표가 없으면 잘라내지 않는다 — 추측해서 자르면 값이 사라진다."""
        sp = self._spec('---\nid: a\ncode:\n'
                        '  - "codebase/backend/a.ts\n'
                        "status: partial\n---\n# x\n")
        self.assertEqual(
            rg._parse_frontmatter_code(sp), ["codebase/backend/a.ts"]
        )

    def test_parse_hash_without_leading_space_is_not_a_comment(self):
        """**앞에 공백이 없는 `#` 은 주석이 아니다** — YAML 규칙 그대로.

        넓힌 술어의 반대 방향 대조군이다. 이게 없으면 `#` 을 무조건 자르는 방향으로
        넓어져도 통과해, 이번엔 **값을 잘라 먹는** 쪽으로 같은 유실이 난다.
        """
        sp = self._spec("---\nid: a\ncode:\n"
                        "  - codebase/backend/a#b.ts\nstatus: partial\n---\n# x\n")
        self.assertEqual(
            rg._parse_frontmatter_code(sp), ["codebase/backend/a#b.ts"]
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
