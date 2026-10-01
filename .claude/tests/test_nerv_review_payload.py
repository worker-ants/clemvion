"""`.claude/tools/nerv_review_payload.py` — 역할 리포트를 NERV 제출 묶음으로.

NERV 정본 전환 단계 2(NERV Task `CLE-T-4ABTG7`)부터 리뷰 결과는 NERV 레코드다. main 은 이
도구의 출력을 역할마다 `nerv_review_submit` 으로 낸다(결정 D7 · D9). 여기서 고정하는 것:

  - 리뷰어 · checker 정의의 출력 형식(`- **[SEVERITY]** 제목` + `위치:` · `상세:` · `제안:`,
    `### 요약`, `### 위험도`)이 발견 · 위험도 · 요약으로 옮겨진다.
  - 형식에서 벗어난 심각도 표지는 버리지 않고 `warnings` 로 알린다. 조용히 버리면 그 발견 없이
    라운드가 passed 가 된다.
  - 강제 역할의 리포트가 빠지면 exit 1 — 그대로 내면 라운드가 `missing_roles` 로 남는다.
  - 세션 경로에서 kind 를 읽는다(`.review/<kind>/<Y>/<m>/<d>/<H_M_S>`).
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import _harness

TOOL_PATH = _harness.CLAUDE_DIR / "tools" / "nerv_review_payload.py"
tool = _harness.load_module_by_path("nerv_review_payload_under_test", TOOL_PATH)

REPORT = """# 보안(Security) 리뷰

## 발견사항

- **[CRITICAL]** 토큰이 로그에 남는다
  - 위치: `codebase/backend/src/auth.ts:42` (`login`)
  - 상세: 실패 경로에서 원문 토큰을 남긴다.
    - 예측: 뮤턴트가 산다.
  - 제안: 마스킹한다.

- **[WARNING]** 입력 길이 상한이 없다
  - 위치: `./codebase/backend/src/dto.ts`
  - 상세: 상한이 없다.

1. **[INFO]** 참고 사항
   - 상세: 산문만 있다.

### 요약
보안 관점에서 한 건이 막는다.
나머지는 경미하다.

### 위험도
HIGH
"""


class ParseReportTest(unittest.TestCase):
    def setUp(self):
        self.sub, self.warnings = tool.parse_report(REPORT, "security")
        self.findings = self.sub["findings"]

    def test_every_finding_with_its_severity(self):
        self.assertEqual([f["severity"] for f in self.findings], ["critical", "warning", "info"])
        self.assertEqual(self.findings[0]["title"], "토큰이 로그에 남는다")
        self.assertTrue(all(f["category"] == "security" for f in self.findings))

    def test_location_becomes_file_and_line(self):
        self.assertEqual(self.findings[0]["file"], "codebase/backend/src/auth.ts")
        self.assertEqual(self.findings[0]["line"], 42)
        self.assertEqual(self.findings[1]["file"], "codebase/backend/src/dto.ts")
        self.assertNotIn("line", self.findings[1])
        self.assertNotIn("file", self.findings[2])

    def test_body_keeps_location_detail_and_nested_bullets(self):
        body = self.findings[0]["body"]
        self.assertIn("위치:", body)
        self.assertIn("실패 경로에서 원문 토큰", body)
        self.assertIn("예측: 뮤턴트가 산다", body)
        self.assertNotIn("마스킹한다", body, "제안은 body 가 아니라 suggestion 이다")
        self.assertEqual(self.findings[0]["suggestion"], "마스킹한다.")
        self.assertIn("산문만 있다", self.findings[2]["body"])

    def test_risk_and_summary(self):
        self.assertEqual(self.sub["reviewer"], {"role": "security", "risk": "high"})
        self.assertEqual(self.sub["summary"], "보안 관점에서 한 건이 막는다. 나머지는 경미하다.")
        self.assertEqual(self.warnings, [])

    def test_risk_scale_maps_to_nerv_values(self):
        for level, want in (("NONE", "low"), ("LOW", "low"), ("MEDIUM", "medium"),
                            ("HIGH", "high"), ("CRITICAL", "high")):
            with self.subTest(level=level):
                sub, _ = tool.parse_report(f"### 위험도\n{level}\n", "x")
                self.assertEqual(sub["reviewer"].get("risk"), want)

    def test_a_report_without_findings_is_still_a_submission(self):
        """발견 0건도 낸다 — 필수 역할은 0건이어도 제출해야 라운드가 그 역할을 센다."""
        sub, w = tool.parse_report("## 발견사항\n\n없음.\n\n### 위험도\nNONE\n", "scope")
        self.assertEqual(sub["findings"], [])
        self.assertEqual(sub["reviewer"]["role"], "scope")
        self.assertEqual(w, [])

    def test_off_format_markers_are_warned_not_dropped_silently(self):
        text = "## 발견사항\n\n[CRITICAL] 형식 밖의 발견\n\n| 1 | [WARNING] 표 안 |\n"
        sub, w = tool.parse_report(text, "testing")
        self.assertEqual(sub["findings"], [])
        self.assertEqual(len(w), 1, w)
        self.assertIn("testing.md:3", w[0])

    def test_heading_shaped_findings_are_read(self):
        sub, _ = tool.parse_report("### [WARNING] 제목형 발견\n- 상세: 본문\n", "cross_spec")
        self.assertEqual([(f["severity"], f["title"]) for f in sub["findings"]],
                         [("warning", "제목형 발견")])

    def test_long_fields_are_capped(self):
        long = "가" * (tool.MAX_BODY + 500)
        sub, _ = tool.parse_report(f"- **[INFO]** {'제' * 400}\n  - 상세: {long}\n", "x")
        f = sub["findings"][0]
        self.assertLessEqual(len(f["title"]), tool.MAX_TITLE)
        self.assertLessEqual(len(f["body"]), tool.MAX_BODY)


class BuildTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(os.path.realpath(tempfile.mkdtemp()))
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.sd = self.tmp / ".review" / "code" / "2026" / "10" / "01" / "12_00_00"
        self.sd.mkdir(parents=True)
        (self.sd / "security.md").write_text(REPORT, encoding="utf-8")
        (self.sd / "scope.md").write_text("### 위험도\nLOW\n", encoding="utf-8")
        (self.sd / "SUMMARY.md").write_text("# 통합\n- **[CRITICAL]** 요약 속 발견\n", encoding="utf-8")
        (self.sd / "_retry_state.json").write_text(json.dumps({
            "agents_forced": ["security", "scope"],
            "subagent_invocations": [{"name": "security", "output_file": "security.md"},
                                     {"name": "scope", "output_file": "scope.md"}],
        }), encoding="utf-8")

    def run_cli(self, *args):
        return subprocess.run([sys.executable, str(TOOL_PATH), str(self.sd), *args],
                              capture_output=True, text=True, timeout=60)

    def test_one_submission_per_role_report_and_no_summary(self):
        out = tool.build(str(self.sd))
        self.assertEqual(out["kind"], "code")
        self.assertEqual([s["reviewer"]["role"] for s in out["submissions"]], ["scope", "security"])
        self.assertEqual(out["missing_forced"], [])

    def test_cli_prints_json_and_exits_zero(self):
        r = self.run_cli()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout)["kind"], "code")

    def test_a_missing_forced_report_fails(self):
        (self.sd / "scope.md").unlink()
        r = self.run_cli()
        self.assertEqual(r.returncode, 1)
        self.assertEqual(json.loads(r.stdout)["missing_forced"], ["scope"])

    def test_an_empty_report_is_not_submitted(self):
        (self.sd / "scope.md").write_text("", encoding="utf-8")
        out = tool.build(str(self.sd))
        self.assertEqual([s["reviewer"]["role"] for s in out["submissions"]], ["security"])
        self.assertEqual(out["missing_forced"], ["scope"])
        self.assertTrue(any("scope.md" in w for w in out["warnings"]))

    def test_kind_comes_from_the_path_or_the_flag(self):
        for name, kind in (("consistency", "consistency"), ("merge", "merge"),
                           ("spec-coverage", "spec_coverage")):
            with self.subTest(name=name):
                d = self.tmp / ".review" / name / "2026" / "10" / "01" / "12_00_00"
                d.mkdir(parents=True)
                self.assertEqual(tool.build(str(d))["kind"], kind)
        odd = self.tmp / "odd"
        odd.mkdir()
        with self.assertRaises(SystemExit):
            tool.build(str(odd))
        self.assertEqual(tool.build(str(odd), "consistency")["kind"], "consistency")

    def test_a_missing_session_dir_is_an_error(self):
        with self.assertRaises(SystemExit):
            tool.build(str(self.tmp / "nope"))


class RealSessionShapeTest(unittest.TestCase):
    """리뷰어 정의가 문서로 정한 형식이 실제 정의 파일과 맞는지 — 형식이 바뀌면 이 도구도 바뀐다."""

    def test_reviewer_and_checker_definitions_still_use_the_parsed_shape(self):
        agents = _harness.CLAUDE_DIR / "agents"
        for name in ("security-reviewer.md", "testing-reviewer.md", "cross-spec-checker.md"):
            with self.subTest(agent=name):
                text = (agents / name).read_text(encoding="utf-8")
                self.assertIn("- **[CRITICAL/WARNING/INFO]**", text)
                self.assertIn("### 요약", text)
                self.assertIn("### 위험도", text)


if __name__ == "__main__":
    unittest.main()
