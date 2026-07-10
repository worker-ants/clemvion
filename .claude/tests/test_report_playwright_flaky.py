"""`scripts/report_playwright_flaky.py` 의 flaky 추출·렌더 로직 검증.

CI 워크플로(`.github/workflows/e2e.yml`)가 Playwright JSON 리포트에서 flaky(재시도로 통과)
테스트를 뽑아 노출하는데, 그 파싱 로직이 조용히 회귀하면 flaky 관측 자체가 무력화된다.
stdlib unittest 로 harness-checks 에서 게이트한다.
"""

from __future__ import annotations

import unittest

from _harness import REPO_ROOT, load_module_by_path

flaky = load_module_by_path(
    "report_playwright_flaky", REPO_ROOT / "scripts" / "report_playwright_flaky.py"
)


def _spec(title, status, *, file="e2e/x.spec.ts", line=10, retries=0):
    """Playwright JSON 리포트의 spec 노드 하나를 만든다.

    status: 그 spec 의 단일 test 의 status ("flaky" | "expected" | "unexpected" | "skipped").
    retries: results 의 최대 retry 인덱스(재시도 횟수).
    """
    results = [{"status": "passed", "retry": r} for r in range(retries + 1)]
    return {
        "title": title,
        "file": file,
        "line": line,
        "tests": [{"status": status, "results": results}],
    }


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
        titles = {r["title"] for r in result}
        self.assertEqual(titles, {"직속 flaky", "중첩 flaky"})
        # 재시도 횟수 = results 의 최대 retry 인덱스
        by_title = {r["title"]: r for r in result}
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

    def test_spec_flaky_if_any_test_flaky(self):
        # 한 spec 이 여러 projects 로 여러 test 를 가질 때, 하나라도 flaky 면 집계
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
                                {"status": "expected", "results": [{"retry": 0}]},
                                {"status": "flaky", "results": [{"retry": 0}, {"retry": 1}]},
                            ],
                        }
                    ],
                }
            ]
        }
        result = flaky.find_flaky(report)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["retries"], 1)


class RenderMarkdownTest(unittest.TestCase):
    def test_no_flaky_message(self):
        md = flaky.render_markdown([])
        self.assertIn("flaky 없음", md)

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
        self.assertIn("테스트 2", md)

    def test_pipe_in_title_is_escaped(self):
        md = flaky.render_markdown(
            [{"file": "f", "title": "a | b", "line": 1, "retries": 1}]
        )
        self.assertIn("a \\| b", md)


class MainSmokeTest(unittest.TestCase):
    def test_missing_report_returns_zero(self):
        self.assertEqual(
            flaky.main(["prog", str(REPO_ROOT / "does-not-exist.json")]), 0
        )


if __name__ == "__main__":
    unittest.main()
