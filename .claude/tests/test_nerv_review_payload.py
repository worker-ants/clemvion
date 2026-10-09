"""`.claude/tools/nerv_review_payload.py` — 역할 리포트를 NERV 제출 묶음으로.

NERV 정본 전환 단계 2(NERV Task `CLE-T-4ABTG7`)부터 리뷰 결과는 NERV 레코드다. main 은 이
도구의 출력을 역할마다 `nerv_review_submit` 으로 낸다(결정 D7 · D9). 여기서 고정하는 것:

  - 리뷰어 · checker 정의의 출력 형식(`- **[SEVERITY]** 제목` + `위치:` · `상세:` · `제안:`,
    `### 요약`, `### 위험도`)이 발견 · 위험도 · 요약으로 옮겨진다.
  - 형식에서 벗어난 심각도 표지는 버리지 않고 `warnings` 로 알린다. 조용히 버리면 그 발견 없이
    라운드가 passed 가 된다.
  - 강제 역할의 리포트가 빠지면 exit 1 — 그대로 내면 라운드가 `missing_roles` 로 남는다.
  - 역할은 상태 파일의 `subagent_invocations` 가 정한다. 목록에 없는 `*.md` 는 내지 않는다.
  - kind=code 에서 상태 파일이 없거나, 낼 묶음이 없으면 exit 1 — 조용히 통과하지 않는다.
  - 세션 경로에서 kind 를 읽는다(`.review/<kind>/<Y>/<m>/<d>/<H_M_S>`).
"""

from __future__ import annotations

import ast
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import textwrap
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
        text = "## 발견사항\n\n[CRITICAL] 형식 밖의 발견\n\n| 1 | [WARNING] 표 안 |\n> [CRITICAL] 인용\n"
        sub, w = tool.parse_report(text, "testing")
        self.assertEqual(sub["findings"], [])
        self.assertEqual(len(w), 3, w)
        self.assertEqual([x.split(":")[1] for x in w], ["3", "5", "6"])

    def test_near_miss_severity_shapes_are_warned(self):
        """리뷰어 정의의 예시(`[CRITICAL/WARNING/INFO]`)를 흉내 낸 변형이 경고 없이 빠지면 안 된다."""
        for line in ("- **[CRITICAL/HIGH]** x", "- **[WARNING — 인증]** x", "- **[ CRITICAL ]** x",
                     "- **CRITICAL** x"):
            with self.subTest(line=line):
                sub, w = tool.parse_report(f"## 발견사항\n\n{line}\n", "security")
                self.assertEqual(sub["findings"], [])
                self.assertEqual(len(w), 1, w)

    def test_plain_risk_words_are_not_markers(self):
        _, w = tool.parse_report("### 위험도\nCRITICAL\n\nCRITICAL 없음. | WARNING | 0 |\n", "security")
        self.assertEqual(w, [])

    def test_bold_wrapping_the_title_is_read_as_a_finding(self):
        """`- **[WARNING] 제목**` — 9월 역할 리포트 187개가 이 형식이었다."""
        sub, w = tool.parse_report("- **[WARNING] 제목이 굵다**\n  - 상세: 본문\n- **[INFO]** 보통\n"
                                   "- **[critical]:** 쌍점 뒤 제목\n", "testing")
        self.assertEqual([(f["severity"], f["title"]) for f in sub["findings"]],
                         [("warning", "제목이 굵다"), ("info", "보통"), ("critical", "쌍점 뒤 제목")])
        self.assertEqual(w, [])

    def test_spec_drift_is_tagged_for_nerv(self):
        sub, _ = tool.parse_report("- **[WARNING]** [SPEC-DRIFT] 스펙이 낡았다\n- **[INFO]** 보통\n", "requirement")
        self.assertEqual(sub["findings"][0].get("tags"), ["spec_drift"])
        self.assertEqual(sub["findings"][0].get("area"), "spec")
        self.assertNotIn("tags", sub["findings"][1])

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
            # 실제 오케스트레이터는 절대 경로를 쓴다.
            "subagent_invocations": [{"name": "security", "output_file": str(self.sd / "security.md")},
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

    def test_a_report_outside_the_role_list_is_not_submitted(self):
        """처리 중에 세션에 생긴 제안 파일이 가짜 역할로 라운드에 실리면 안 된다."""
        (self.sd / "spec-proposal-auth.md").write_text("- **[WARNING]** 인용된 발견\n", encoding="utf-8")
        out = tool.build(str(self.sd))
        self.assertEqual([s["reviewer"]["role"] for s in out["submissions"]], ["scope", "security"])
        self.assertTrue(any("spec-proposal-auth.md" in w for w in out["warnings"]), out["warnings"])
        self.assertEqual(self.run_cli().returncode, 0)

    def test_an_output_file_ending_in_a_slash_still_submits_the_role(self):
        """`report_paths` 는 빈 basename 을 `<name>.md` 로 푼다. 도우미도 같아야 강제 역할이 안 빠진다."""
        state = json.loads((self.sd / "_retry_state.json").read_text(encoding="utf-8"))
        state["subagent_invocations"][0]["output_file"] = "/gone/wt/security/"
        (self.sd / "_retry_state.json").write_text(json.dumps(state), encoding="utf-8")
        out = tool.build(str(self.sd))
        self.assertEqual([s["reviewer"]["role"] for s in out["submissions"]], ["scope", "security"])
        self.assertEqual(out["missing_forced"], [])

    def test_a_whitespace_only_forced_report_fails(self):
        """`has_report` 는 0바이트만 빈 리포트로 본다. 공백뿐인 리포트는 묶음에서 빠지니 누락으로 센다."""
        (self.sd / "scope.md").write_text("\n  \n", encoding="utf-8")
        out = tool.build(str(self.sd))
        self.assertEqual(out["missing_forced"], ["scope"])
        self.assertEqual(self.run_cli().returncode, 1)

    def test_high_risk_without_blocking_findings_fails(self):
        (self.sd / "scope.md").write_text("- **[CRITICAL/HIGH]** 빠진 발견\n\n### 위험도\nHIGH\n", encoding="utf-8")
        r = self.run_cli()
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertTrue(any("scope.md" in e and "HIGH" in e for e in json.loads(r.stdout)["errors"]))

    def test_the_required_roles_match_the_router_constant(self):
        """같은 6역할을 router(`NERV_REQUIRED_REVIEWERS`)와 이 도구가 따로 든다. 둘이 갈리면 안 된다.
        router 모듈은 `_lib` 이름 충돌 때문에 불러오지 않고 소스에서 상수를 읽는다."""
        src = (_harness.CLAUDE_DIR / "skills" / "code-review-agents" / "lib" / "router_safety.py").read_text(
            encoding="utf-8")
        tree = ast.parse(src)
        def targets(n):
            return n.targets if isinstance(n, ast.Assign) else [n.target] if isinstance(n, ast.AnnAssign) else []

        value = next(ast.literal_eval(n.value) for n in tree.body
                     if any(getattr(t, "id", None) == "NERV_REQUIRED_REVIEWERS" for t in targets(n)))
        self.assertEqual(set(value), set(tool.NERV_REQUIRED_ROLES))

    def test_missing_nerv_roles_are_warned_in_a_code_session(self):
        """이 fixture 는 security · scope 만 돈다 — 나머지 넷이 빠졌다고 알린다(실패는 아니다)."""
        out = tool.build(str(self.sd))
        w = [x for x in out["warnings"] if "NERV 필수 역할" in x]
        self.assertEqual(len(w), 1, out["warnings"])
        for role in ("requirement", "side_effect", "maintainability", "testing"):
            self.assertIn(role, w[0])
        self.assertNotIn("security", w[0].split(":", 1)[1])

    def test_a_code_session_without_its_state_fails(self):
        for body in (None, "{broken", json.dumps({"agents_forced": ["security"]})):
            with self.subTest(body=body):
                state = self.sd / "_retry_state.json"
                if body is None:
                    state.unlink(missing_ok=True)
                else:
                    state.write_text(body, encoding="utf-8")
                r = self.run_cli()
                self.assertEqual(r.returncode, 1, r.stdout)
                self.assertTrue(any("_retry_state.json" in x for x in json.loads(r.stdout)["errors"]))

    def test_a_consistency_session_without_state_falls_back_to_every_report(self):
        d = self.tmp / ".review" / "consistency" / "2026" / "10" / "01" / "12_00_00"
        d.mkdir(parents=True)
        (d / "cross_spec.md").write_text(REPORT, encoding="utf-8")
        out = tool.build(str(d))
        self.assertEqual([s["reviewer"]["role"] for s in out["submissions"]], ["cross_spec"])
        self.assertEqual(out["errors"], [])
        self.assertTrue(out["warnings"])

    def test_a_merge_session_submits_each_analyzer(self):
        """merge 세션은 analyzer 마다 `<role>.md` 를 남긴다. 리뷰어와 같은 형식이라 같은 파서로 읽는다(전환 4e)."""
        d = self.tmp / ".review" / "merge" / "2026" / "10" / "01" / "12_00_00"
        d.mkdir(parents=True)
        roles = ("merge_conflict_analyzer", "semantic_conflict_analyzer")
        state = {"subagent_invocations": [
            {"name": r, "output_file": str(d / f"{r}.md")} for r in roles]}
        (d / "_retry_state.json").write_text(json.dumps(state), encoding="utf-8")
        for r in roles:
            (d / f"{r}.md").write_text(REPORT, encoding="utf-8")
        (d / "SUMMARY.md").write_text("# 통합 보고서\n**BLOCK: NO**\n", encoding="utf-8")
        out = tool.build(str(d))
        self.assertEqual(out["kind"], "merge")
        self.assertEqual(out["errors"], [])
        self.assertEqual(sorted(s["reviewer"]["role"] for s in out["submissions"]), sorted(roles))
        self.assertTrue(all(s["findings"] for s in out["submissions"]))

    COVERAGE = textwrap.dedent("""\
        # Spec Coverage Audit — 2026-10-03T00:00:00Z

        ## 요약

        - 모드: both
        - 후보 high: 1

        ## 후보 — high confidence

        ### 1. `spec/CLE-WF/CLE-WF-EDITOR.md` — [forward] H1 UI 키워드
        - **신호**: 본문 line 12 의 UI 키워드 `패널`
          이어지는 줄
        - **부재**: 구현 위치에 frontend 경로가 없다
        - **권고**: frontend 구현 Task 를 만든다

        ## 후보 — medium confidence

        ### 1. `spec/CLE-API/CLE-API-CONV.md:40` — [reverse] H4 route
        - **신호**: controller route `/x`

        ## 후보 — low confidence

        (없음)

        ## False-positive 검토 가이드

        ### 1. 이 줄은 후보가 아니다
        - **신호**: 가이드 절의 예시
        """)

    def test_a_spec_coverage_summary_becomes_info_findings(self):
        """감사기는 SUMMARY.md 하나를 쓴다. 후보 하나가 info 발견 하나다 — 보고형이라 라운드를 막지 않는다."""
        d = self.tmp / ".review" / "spec-coverage" / "2026" / "10" / "01" / "12_00_00"
        d.mkdir(parents=True)
        (d / "SUMMARY.md").write_text(self.COVERAGE, encoding="utf-8")
        out = tool.build(str(d))
        self.assertEqual(out["errors"], [])
        [sub] = out["submissions"]
        self.assertEqual(sub["reviewer"]["role"], "spec_coverage")
        self.assertIn("모드: both", sub["summary"])
        found = sub["findings"]
        self.assertEqual(len(found), 2, found)  # 가이드 절의 `### 1.` 은 후보가 아니다
        self.assertEqual({f["severity"] for f in found}, {"info"})
        high, medium = found
        self.assertEqual(high["file"], "spec/CLE-WF/CLE-WF-EDITOR.md")
        self.assertIn("confidence:high", high["tags"])
        self.assertIn("forward", high["tags"])
        self.assertIn("이어지는 줄", high["body"])
        self.assertIn("부재: 구현 위치에", high["body"])
        self.assertEqual(high["suggestion"], "frontend 구현 Task 를 만든다")
        self.assertEqual((medium["file"], medium["line"]), ("spec/CLE-API/CLE-API-CONV.md", 40))
        self.assertIn("confidence:medium", medium["tags"])
        self.assertIn("reverse", medium["tags"])
        self.assertNotIn("suggestion", medium)

    def _coverage_session(self, text):
        d = self.tmp / ".review" / "spec-coverage" / "2026" / "10" / "01" / "12_00_00"
        d.mkdir(parents=True, exist_ok=True)
        (d / "SUMMARY.md").write_text(text, encoding="utf-8")
        return tool.build(str(d))

    def test_the_auditor_definition_example_parses(self):
        """파서는 감사기 정의(`spec-impl-coverage-auditor.md` §출력 형식)의 예시를 읽어야 한다.

        손으로 쓴 fixture 만 쓰면 정의의 형식이 바뀌어도 초록이고, 실제 SUMMARY 는 "후보 0건" 으로 조용히
        통과한다."""
        agent = (_harness.CLAUDE_DIR / "agents" / "spec-impl-coverage-auditor.md").read_text(encoding="utf-8")
        section = agent.split("## 출력 형식", 1)[1]
        example = re.search(r"```markdown\n(.*?)\n```", section, re.S)
        self.assertIsNotNone(example, "감사기 정의에서 출력 형식 예시를 찾지 못했다")
        sub = tool.parse_coverage_summary(example.group(1))
        self.assertTrue(sub["findings"], "정의의 예시에서 후보를 하나도 읽지 못했다")
        first = sub["findings"][0]
        self.assertIn("confidence:high", first["tags"])
        self.assertIn("신호:", first["body"])
        self.assertIn("부재:", first["body"])
        self.assertTrue(first.get("suggestion"))
        self.assertIn("후보 high", sub.get("summary", ""))

    def test_candidates_the_summary_counts_but_the_parser_misses_are_warned(self):
        """요약이 센 후보보다 적게 읽었으면 형식이 어긋난 것이다. 조용히 0건으로 내지 않는다."""
        text = textwrap.dedent("""\
            ## 요약

            - 후보 high: 2

            ## 후보 — high confidence

            1. `spec/CLE-A.md` — 번호 목록으로 쓴 후보
            2. `spec/CLE-B.md` — 번호 목록으로 쓴 후보
            """)
        out = self._coverage_session(text)
        self.assertEqual(out["submissions"][0]["findings"], [])
        self.assertTrue(any("high" in w and "2" in w for w in out["warnings"]), out["warnings"])

    def test_no_candidates_and_no_counts_is_warned(self):
        out = self._coverage_session("## 요약\n\n- 모드: forward\n")
        self.assertTrue(any("후보를 하나도" in w for w in out["warnings"]), out["warnings"])

    def test_a_clean_audit_is_not_warned(self):
        out = self._coverage_session("## 요약\n\n- 후보 high: 0\n- 후보 medium: 0\n- 후보 low: 0\n")
        self.assertEqual(out["warnings"], [])
        self.assertEqual(out["submissions"][0]["findings"], [])

    def test_a_low_candidate_without_a_signal_keeps_its_absence(self):
        text = textwrap.dedent("""\
            ## 후보 — low confidence

            ### 1. `spec/CLE-X.md` — H3 시나리오
            - **부재**: e2e 가 없다
            """)
        [f] = self._coverage_session(text)["submissions"][0]["findings"]
        self.assertIn("confidence:low", f["tags"])
        self.assertEqual(f["body"], "부재: e2e 가 없다")
        self.assertNotIn("suggestion", f)

    def test_a_spec_coverage_session_without_its_summary_fails(self):
        d = self.tmp / ".review" / "spec-coverage" / "2026" / "10" / "01" / "12_00_00"
        d.mkdir(parents=True)
        r = subprocess.run([sys.executable, str(TOOL_PATH), str(d)], capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertTrue(any("SUMMARY.md" in e for e in json.loads(r.stdout)["errors"]))

    def test_nothing_to_submit_fails(self):
        d = self.tmp / ".review" / "consistency" / "2026" / "10" / "01" / "12_00_00"
        d.mkdir(parents=True)
        (d / "SUMMARY.md").write_text("# 요약\n", encoding="utf-8")
        r = subprocess.run([sys.executable, str(TOOL_PATH), str(d)], capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 1, r.stdout)
        out = json.loads(r.stdout)
        self.assertEqual(out["submissions"], [])
        self.assertTrue(any("리포트가 없다" in x for x in out["errors"]), out["errors"])

    def test_the_changeset_comes_from_meta(self):
        """오케스트레이터가 쓰는 운영 형태(`{"file_path", "change_type", …}`)에서 경로만 뽑는다."""
        self.assertNotIn("changeset", tool.build(str(self.sd)))
        meta = {"files": [{"file_path": "a.ts", "change_type": "modified", "file_extension": ".ts"},
                          {"file_path": "b.md", "change_type": "added", "file_extension": ".md"}]}
        (self.sd / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
        self.assertEqual(tool.build(str(self.sd))["changeset"], ["a.ts", "b.md"])
        (self.sd / "meta.json").write_text(json.dumps({"files": ["a.ts", "b.md"]}), encoding="utf-8")
        self.assertEqual(tool.build(str(self.sd))["changeset"], ["a.ts", "b.md"])
        for bad in ([1], [{"file_path": ""}], [{"other": "x"}]):
            (self.sd / "meta.json").write_text(json.dumps({"files": bad}), encoding="utf-8")
            self.assertNotIn("changeset", tool.build(str(self.sd)))

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


class OutFileTest(unittest.TestCase):
    """`--out` — 기록 서브에이전트(`nerv-recorder`)가 그대로 낼 제출 인자를 파일에 쓴다(NERV Task `CLE-T-CD9131`).

    main 은 묶음 전문을 읽지 않고 짧은 요약만 받는다. SHA 는 git 이 풀어 준 전체 값만 싣고, 멱등 키는
    도구가 code-review-agents SKILL §4 형식으로 만든다. LLM 이 옮겨 적다 틀리는 자리를 없앤다.
    """

    def setUp(self):
        self.tmp = Path(os.path.realpath(tempfile.mkdtemp()))
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.repo = _harness.make_temp_git_repo(self.tmp / "repo")
        self.base = _harness.git_in(self.repo, "rev-parse", "HEAD").stdout.strip()
        (self.repo / "codebase").mkdir()
        (self.repo / "codebase" / "a.ts").write_text("a\n", encoding="utf-8")
        _harness.git_in(self.repo, "add", "-A")
        _harness.git_in(self.repo, "commit", "-qm", "change")
        self.head = _harness.git_in(self.repo, "rev-parse", "HEAD").stdout.strip()
        self.sd = self.repo / ".review" / "code" / "2026" / "10" / "01" / "12_00_00"
        self.sd.mkdir(parents=True)
        (self.sd / "security.md").write_text(REPORT, encoding="utf-8")
        (self.sd / "scope.md").write_text("### 위험도\nLOW\n", encoding="utf-8")
        (self.sd / "_retry_state.json").write_text(json.dumps({
            "agents_forced": ["security", "scope"],
            "subagent_invocations": [{"name": "security", "output_file": "security.md"},
                                     {"name": "scope", "output_file": "scope.md"}],
        }), encoding="utf-8")
        self.out = self.sd / "_nerv_payload.json"

    def run_cli(self, *args):
        return subprocess.run([sys.executable, str(TOOL_PATH), str(self.sd), *args], cwd=self.repo,
                              capture_output=True, text=True, timeout=60)

    def submit_args(self, *extra, base=None, head=None):
        return ["--out", str(self.out), "--branch", "feature", "--base", base or self.base[:7],
                "--head", head or "HEAD", "--mode", "review", *extra]

    def test_writes_ready_to_send_arguments_and_prints_a_short_summary(self):
        r = self.run_cli(*self.submit_args("--task", "CLE-T-ABC123"))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        doc = json.loads(self.out.read_text(encoding="utf-8"))
        self.assertTrue(doc["ok"])
        self.assertEqual(doc["submit"], {"kind": "code", "branch": "feature", "base_sha": self.base,
                                         "head_sha": self.head, "changeset": ["codebase/a.ts"],
                                         "task_id": "CLE-T-ABC123"})
        keys = {s["reviewer"]["role"]: s["idempotency_key"] for s in doc["submissions"]}
        prefix = f"CLE-T-ABC123:code:review:{self.head[:9]}"
        self.assertEqual(keys, {"scope": prefix + ":scope", "security": prefix + ":security"})
        summary = json.loads(r.stdout)
        self.assertEqual(summary["out"], str(self.out))
        self.assertEqual(summary["roles"], ["scope", "security"])
        self.assertEqual(summary["findings"], {"critical": 1, "warning": 1})
        self.assertEqual(summary["info_in_summary"], 1)
        # 발견 본문은 요약에 싣지 않는다. main 이 묶음 전문을 읽지 않게 하는 것이 이 모드의 목적이다.
        self.assertNotIn("submissions", summary)
        self.assertNotIn("토큰이 로그에 남는다", r.stdout)

    def test_a_rerun_and_a_session_without_a_task_get_their_keys(self):
        r = self.run_cli(*self.submit_args("--run", "2"))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        doc = json.loads(self.out.read_text(encoding="utf-8"))
        self.assertIsNone(doc["submit"]["task_id"])
        self.assertEqual(doc["submissions"][0]["idempotency_key"],
                         f"20261001-120000:code:review:{self.head[:9]}:scope:2")

    def test_changeset_prefers_the_flag_then_meta_then_git(self):
        (self.sd / "meta.json").write_text(json.dumps({"files": [{"file_path": "m.ts"}]}), encoding="utf-8")
        self.assertEqual(self.run_cli(*self.submit_args()).returncode, 0)
        self.assertEqual(json.loads(self.out.read_text())["submit"]["changeset"], ["m.ts"])
        r = self.run_cli(*self.submit_args("--changeset", "spec/X/X.md", "--changeset", "y.md"))
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertEqual(json.loads(self.out.read_text())["submit"]["changeset"], ["spec/X/X.md", "y.md"])

    def test_an_empty_changeset_is_an_error(self):
        r = self.run_cli(*self.submit_args(base="HEAD"))
        self.assertEqual(r.returncode, 1)
        self.assertIn("changeset", json.loads(r.stdout)["errors"][-1])
        self.assertFalse(json.loads(self.out.read_text())["ok"])

    def test_an_unknown_revision_is_an_error_not_a_guess(self):
        r = self.run_cli(*self.submit_args(head="0123456789abcdef0123456789abcdef01234567"))
        self.assertEqual(r.returncode, 1)
        self.assertTrue(any("--head" in e for e in json.loads(r.stdout)["errors"]), r.stdout)
        doc = json.loads(self.out.read_text())
        self.assertFalse(doc["ok"])
        self.assertNotIn("submit", doc)

    def test_a_failed_build_is_written_as_not_ok(self):
        (self.sd / "scope.md").unlink()
        r = self.run_cli(*self.submit_args())
        self.assertEqual(r.returncode, 1)
        self.assertEqual(json.loads(r.stdout)["missing_forced"], ["scope"])
        self.assertFalse(json.loads(self.out.read_text())["ok"])

    def test_out_needs_the_submit_context(self):
        r = self.run_cli("--out", str(self.out), "--branch", "feature")
        self.assertEqual(r.returncode, 2)
        self.assertFalse(self.out.exists())
        r = self.run_cli(*self.submit_args("--mode", "nope"))
        self.assertEqual(r.returncode, 2)

    def test_without_out_the_old_stdout_shape_stays(self):
        r = self.run_cli()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("submissions", json.loads(r.stdout))
        self.assertFalse(self.out.exists())


class RealSessionShapeTest(unittest.TestCase):
    """리뷰어 정의가 문서로 정한 형식이 실제 정의 파일과 맞는지 — 형식이 바뀌면 이 도구도 바뀐다."""

    _FIELD_LINE = re.compile(r"^\s+- ([^`:：*\s][^`:：*]{0,19}?)\s*[:：]")

    def test_every_sub_field_name_in_the_definitions_is_known(self):
        """정의가 쓰는 하위 항목 이름이 파서 어휘에 없으면 그 줄이 앞 항목에 붙어 버린다(2026-10-01
        consistency 리뷰 실측: naming_collision 리포트의 두 줄이 통째로 버려졌다)."""
        agents = _harness.CLAUDE_DIR / "agents"
        seen: dict[str, str] = {}
        for path in sorted(agents.glob("*.md")):
            if not path.name.endswith(("-reviewer.md", "-checker.md", "-analyzer.md")):
                continue
            for ln in path.read_text(encoding="utf-8").splitlines():
                m = self._FIELD_LINE.match(ln)
                if m:
                    seen.setdefault(m.group(1).strip(), path.name)
        self.assertGreaterEqual(len(seen), 5, seen)  # 공허 방지: 위치 · 상세 · 제안 등은 있다
        unknown = {k: v for k, v in seen.items() if k not in tool.FIELD_NAMES}
        self.assertEqual(unknown, {})

    def test_labeled_fields_reach_the_body(self):
        text = ("- **[WARNING]** 규약 위반\n  - target 위치: `spec/a.md:3`\n  - 위반 규약: CLE-ENG-X 규칙 2\n"
                "  - 상세: 본문\n")
        sub, w = tool.parse_report(text, "convention_compliance")
        f = sub["findings"][0]
        self.assertEqual((f["file"], f["line"]), ("spec/a.md", 3))
        self.assertIn("위반 규약: CLE-ENG-X 규칙 2", f["body"])
        self.assertIn("본문", f["body"])
        self.assertNotIn("CLE-ENG-X", f.get("file", ""))

    def test_reviewer_and_checker_definitions_still_use_the_parsed_shape(self):
        agents = _harness.CLAUDE_DIR / "agents"
        for name in ("security-reviewer.md", "testing-reviewer.md", "cross-spec-checker.md"):
            with self.subTest(agent=name):
                text = (agents / name).read_text(encoding="utf-8")
                self.assertIn("- **[CRITICAL/WARNING/INFO]**", text)
                self.assertIn("### 요약", text)
                self.assertIn("### 위험도", text)



class InfoFoldTest(unittest.TestCase):
    """kind=code · consistency 의 INFO 는 발견 대신 summary 에 싣는다(NERV Task `CLE-T-ZTTHXD`).

    열린 발견은 다른 브랜치의 제출 응답에 `carried_over` 로 따라붙고 처분은 한 건씩이라, INFO 를 발견으로
    내면 처분 호출이 늘거나 응답이 커진다. `[SPEC-DRIFT]` INFO 는 스펙 초안 처분이 필요해 남긴다.
    """

    setUp = BuildTest.setUp
    run_cli = BuildTest.run_cli

    def security(self, out):
        return next(s for s in out["submissions"] if s["reviewer"]["role"] == "security")

    def test_plain_info_moves_to_summary_and_blocking_findings_stay(self):
        out = tool.build(str(self.sd))
        sec = self.security(out)
        self.assertEqual([f["severity"] for f in sec["findings"]], ["critical", "warning"])
        self.assertIn("참고(INFO) 1건: 참고 사항", sec["summary"])
        self.assertTrue(sec["summary"].startswith("보안 관점에서 한 건이 막는다."))
        self.assertEqual(out["info_in_summary"], 1)

    def test_spec_drift_info_stays_a_finding(self):
        (self.sd / "scope.md").write_text(
            "- **[INFO]** [SPEC-DRIFT] 스펙 문장이 낡았다\n  - 위치: `a.ts:3`\n"
            "- **[INFO]** 그냥 참고\n  - 위치: `b.ts:9`\n### 위험도\nLOW\n", encoding="utf-8")
        scope = next(s for s in tool.build(str(self.sd))["submissions"] if s["reviewer"]["role"] == "scope")
        self.assertEqual([(f["severity"], f.get("tags")) for f in scope["findings"]], [("info", ["spec_drift"])])
        self.assertEqual(scope["summary"], "참고(INFO) 1건: 그냥 참고 (b.ts:9)")

    def test_keep_info_restores_the_old_shape(self):
        sec = self.security(tool.build(str(self.sd), keep_info=True))
        self.assertEqual([f["severity"] for f in sec["findings"]], ["critical", "warning", "info"])
        self.assertNotIn("참고(INFO)", sec["summary"])
        r = self.run_cli("--keep-info")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout)["info_in_summary"], 0)

    def test_merge_kind_keeps_info_findings(self):
        sd = self.tmp / ".review" / "merge" / "2026" / "10" / "01" / "12_00_00"
        sd.mkdir(parents=True)
        (sd / "semantic.md").write_text("- **[INFO]** 통합 참고\n### 위험도\nLOW\n", encoding="utf-8")
        out = tool.build(str(sd))
        self.assertEqual(out["kind"], "merge")
        self.assertEqual([f["severity"] for f in out["submissions"][0]["findings"]], ["info"])
        self.assertEqual(out["info_in_summary"], 0)

    def test_long_summary_keeps_both_caps(self):
        """요약 자체가 상한까지 차도 INFO 줄이 잘려 나가지 않는다. 합계는 두 상한의 합 안이다."""
        many = "".join(f"- **[INFO]** 참고 {i}\n" for i in range(5))
        (self.sd / "scope.md").write_text(many + "### 요약\n" + "가" * 3000 + "\n### 위험도\nLOW\n",
                                          encoding="utf-8")
        scope = next(s for s in tool.build(str(self.sd))["submissions"] if s["reviewer"]["role"] == "scope")
        base, note = scope["summary"].split("\n\n", 1)
        self.assertEqual(len(base), tool.MAX_SUMMARY)
        self.assertTrue(note.startswith("참고(INFO) 5건: "))
        self.assertLessEqual(len(scope["summary"]), tool.MAX_SUMMARY + 2 + tool.MAX_INFO_NOTE)

    def test_every_kind_reports_the_count(self):
        self.assertIn("info_in_summary", tool._result("spec_coverage", str(self.sd)))

    def test_note_is_capped(self):
        many = "".join(f"- **[INFO]** {'긴 제목 ' * 20}{i}\n" for i in range(40))
        (self.sd / "scope.md").write_text(many + "### 위험도\nLOW\n", encoding="utf-8")
        scope = next(s for s in tool.build(str(self.sd))["submissions"] if s["reviewer"]["role"] == "scope")
        self.assertEqual(scope["findings"], [])
        self.assertLessEqual(len(scope["summary"]), tool.MAX_INFO_NOTE)
        self.assertTrue(scope["summary"].startswith("참고(INFO) 40건: "))


if __name__ == "__main__":
    unittest.main()
