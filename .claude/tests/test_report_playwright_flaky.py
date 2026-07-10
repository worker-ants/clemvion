"""`scripts/report_playwright_flaky.py` 의 flaky 추출·렌더·노출 로직 검증.

CI 워크플로(`.github/workflows/e2e.yml`)가 Playwright JSON 리포트에서 flaky(재시도로 통과)
테스트를 뽑아 노출하는데, 그 파싱/노출 로직이 조용히 회귀하면 flaky 관측 자체가 무력화된다.
stdlib unittest 로 harness-checks 에서 게이트한다 — 단, harness-checks 트리거는 `scripts/**`
글롭이 아니라 **개별 경로 등재**(migration-check.yml 선례)이므로, `scripts/` 밑에 harness 로
검증할 스크립트를 새로 추가할 때마다 `harness-checks.yml` `paths` 에 그 경로를 각각 등재해야 한다.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from _harness import REPO_ROOT, load_module_by_path

flaky = load_module_by_path(
    "report_playwright_flaky", REPO_ROOT / "scripts" / "report_playwright_flaky.py"
)


def _spec(title, status, *, file="e2e/x.spec.ts", line=10, retries=0):
    """Playwright JSON 리포트의 spec 노드 하나(단일 test)."""
    results = [{"status": "passed", "retry": r} for r in range(retries + 1)]
    return {
        "title": title,
        "file": file,
        "line": line,
        "tests": [{"status": status, "results": results}],
    }


class SafeIntTest(unittest.TestCase):
    def test_valid_and_invalid(self):
        self.assertEqual(flaky._safe_int(3), 3)
        self.assertEqual(flaky._safe_int("5"), 5)
        self.assertEqual(flaky._safe_int(None), 0)
        self.assertEqual(flaky._safe_int("x"), 0)
        self.assertEqual(flaky._safe_int(None, default=-1), -1)


class FindFlakyTest(unittest.TestCase):
    def test_extracts_flaky_from_nested_suites(self):
        report = {
            "suites": [
                {
                    "title": "auth/login.spec.ts",
                    "specs": [_spec("직속 flaky", "flaky", line=54, retries=1)],
                    "suites": [
                        {
                            "title": "describe A",
                            "specs": [
                                _spec("중첩 flaky", "flaky", line=87, retries=2),
                                _spec("정상 통과", "expected", line=99),
                            ],
                        }
                    ],
                }
            ]
        }
        result = flaky.find_flaky(report)
        by_title = {r["title"]: r for r in result}
        self.assertEqual(set(by_title), {"직속 flaky", "중첩 flaky"})
        self.assertEqual(by_title["직속 flaky"]["retries"], 1)
        self.assertEqual(by_title["중첩 flaky"]["retries"], 2)
        self.assertEqual(by_title["중첩 flaky"]["line"], 87)

    def test_no_flaky_when_all_expected(self):
        report = {
            "suites": [
                {
                    "title": "f.spec.ts",
                    "specs": [
                        _spec("a", "expected"),
                        _spec("b", "skipped"),
                        _spec("c", "unexpected"),  # 실패(flaky 아님)는 제외
                    ],
                }
            ]
        }
        self.assertEqual(flaky.find_flaky(report), [])

    def test_empty_or_missing_keys(self):
        self.assertEqual(flaky.find_flaky({}), [])
        self.assertEqual(flaky.find_flaky({"suites": []}), [])
        self.assertEqual(flaky.find_flaky({"suites": [{"title": "x"}]}), [])

    def test_retries_counted_from_flaky_test_only(self):
        # 같은 spec 의 비-flaky test 가 더 많은 retry 를 가져도 flaky test 기준으로만 집계
        report = {
            "suites": [
                {
                    "title": "f.spec.ts",
                    "specs": [
                        {
                            "title": "multi",
                            "file": "e2e/f.spec.ts",
                            "line": 5,
                            "tests": [
                                {
                                    "status": "expected",
                                    "results": [{"retry": 0}, {"retry": 1}, {"retry": 2}],
                                },
                                {"status": "flaky", "results": [{"retry": 0}, {"retry": 1}]},
                            ],
                        }
                    ],
                }
            ]
        }
        result = flaky.find_flaky(report)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["retries"], 1)  # flaky test 의 max retry(=1)

    def test_non_integer_retry_is_defended(self):
        report = {
            "suites": [
                {
                    "title": "f.spec.ts",
                    "specs": [
                        {
                            "title": "bad",
                            "file": "e2e/f.spec.ts",
                            "line": 1,
                            "tests": [{"status": "flaky", "results": [{"retry": None}]}],
                        }
                    ],
                }
            ]
        }
        self.assertEqual(flaky.find_flaky(report)[0]["retries"], 0)


class RenderMarkdownTest(unittest.TestCase):
    def test_no_flaky_message(self):
        self.assertIn("flaky 없음", flaky.render_markdown([]))

    def test_flaky_table_lists_each(self):
        entries = [
            {"file": "e2e/a.spec.ts", "title": "테스트 1", "line": 12, "retries": 1},
            {"file": "e2e/b.spec.ts", "title": "테스트 2", "line": 0, "retries": 2},
        ]
        md = flaky.render_markdown(entries)
        self.assertIn("flaky 2건", md)
        self.assertIn("`e2e/a.spec.ts:12`", md)
        self.assertIn("`e2e/b.spec.ts`", md)  # line 0 이면 위치에 :line 생략
        self.assertIn("테스트 1", md)
        self.assertIn("테스트 2", md)  # 다건 렌더 — 두 번째 이후 행 누락 회귀 가드

    def test_pipe_in_title_is_escaped(self):
        md = flaky.render_markdown([{"file": "f", "title": "a | b", "line": 1, "retries": 1}])
        self.assertIn("a \\| b", md)


class WriteStepSummaryTest(unittest.TestCase):
    def test_noop_when_env_unset(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            # 예외 없이 no-op (환경변수 미설정)
            self.assertIsNone(flaky._write_step_summary("x"))

    def test_appends_when_env_set(self):
        with tempfile.TemporaryDirectory() as d:
            summary = os.path.join(d, "summary.md")
            with mock.patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": summary}):
                flaky._write_step_summary("첫 줄")
                flaky._write_step_summary("둘째 줄")
            body = Path(summary).read_text(encoding="utf-8")
            self.assertIn("첫 줄", body)
            self.assertIn("둘째 줄", body)  # append(덮어쓰기 아님)

    def test_open_failure_is_swallowed(self):
        # 열 수 없는 경로(디렉토리) → OSError 침묵 처리, 예외 전파 없음
        with tempfile.TemporaryDirectory() as d:
            with mock.patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": d}):
                self.assertIsNone(flaky._write_step_summary("x"))


class GhaEscapeTest(unittest.TestCase):
    def test_newlines_and_percent_escaped(self):
        self.assertEqual(flaky._gha_escape("a\nb"), "a%0Ab")
        self.assertEqual(flaky._gha_escape("a\rb"), "a%0Db")
        self.assertEqual(flaky._gha_escape("100%"), "100%25")

    def test_emit_annotations_escapes_title(self):
        import contextlib
        import io

        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            flaky._emit_annotations(
                [{"file": "e2e/a.spec.ts", "title": "줄1\n줄2", "line": 7, "retries": 1}]
            )
        out = buf.getvalue()
        self.assertIn("::warning file=e2e/a.spec.ts,line=7::", out)
        self.assertIn("줄1%0A줄2", out)  # 개행이 escape 되어 어노테이션이 깨지지 않음


class MainIntegrationTest(unittest.TestCase):
    def _run_main(self, report_obj_or_text):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "results.json")
            if isinstance(report_obj_or_text, str):
                Path(path).write_text(report_obj_or_text, encoding="utf-8")
            else:
                Path(path).write_text(json.dumps(report_obj_or_text), encoding="utf-8")
            summary = os.path.join(d, "summary.md")
            with mock.patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": summary}):
                rc = flaky.main(["prog", path])
            written = Path(summary).read_text(encoding="utf-8") if os.path.exists(summary) else ""
            return rc, written

    def test_happy_path_flaky_written_to_summary(self):
        report = {"suites": [{"title": "f.spec.ts", "specs": [_spec("t", "flaky", line=7, retries=1)]}]}
        rc, written = self._run_main(report)
        self.assertEqual(rc, 0)
        self.assertIn("flaky 1건", written)

    def test_clean_report_returns_zero(self):
        report = {"suites": [{"title": "f.spec.ts", "specs": [_spec("t", "expected")]}]}
        rc, written = self._run_main(report)
        self.assertEqual(rc, 0)
        self.assertIn("flaky 없음", written)

    def test_malformed_json_returns_zero(self):
        rc, _ = self._run_main("{ not valid json ")
        self.assertEqual(rc, 0)

    def test_unexpected_schema_does_not_crash(self):
        # suites 가 리스트 아님 → find_flaky 내부 예외. main 은 그래도 exit 0, 부분 summary 미기록.
        rc, written = self._run_main({"suites": "표준아님"})
        self.assertEqual(rc, 0)
        self.assertEqual(written, "")  # 예외가 render/write 전에 발생 → summary 오염 없음

    def test_missing_report_returns_zero(self):
        self.assertEqual(flaky.main(["prog", str(REPO_ROOT / "does-not-exist.json")]), 0)


class CrossFilePathGuardTest(unittest.TestCase):
    """리포트 경로 SoT 정합 — 어긋나면 스크립트가 조용히 skip 하여 surfacing 이 무력화된다."""

    def test_report_path_consistent_across_script_workflow_config(self):
        default_report = flaky.DEFAULT_REPORT  # 예: codebase/frontend/playwright-report/results.json

        # 1) e2e.yml step 인자
        e2e = (REPO_ROOT / ".github" / "workflows" / "e2e.yml").read_text(encoding="utf-8")
        m = re.search(r"report_playwright_flaky\.py\s+(\S+)", e2e)
        self.assertIsNotNone(m, "e2e.yml 에서 report_playwright_flaky.py 인자 경로를 못 찾음")
        self.assertEqual(m.group(1), default_report)

        # 2) playwright.config.ts 의 json reporter outputFile (config=frontend 기준 상대경로)
        cfg = (REPO_ROOT / "codebase" / "frontend" / "playwright.config.ts").read_text(encoding="utf-8")
        m2 = re.search(r'"json",\s*\{\s*outputFile:\s*"([^"]+)"', cfg)
        self.assertIsNotNone(m2, "playwright.config.ts 에서 json outputFile 을 못 찾음")
        self.assertEqual("codebase/frontend/" + m2.group(1), default_report)


if __name__ == "__main__":
    unittest.main()
