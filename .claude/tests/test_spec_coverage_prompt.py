"""`/spec-coverage` 감사기 프롬프트가 적용 대상의 정본을 그대로 옮기는가.

감사기(`spec-impl-coverage-auditor`)는 오케스트레이터가 쓴 `_prompt.md` 의 INCLUDE 목록대로 스펙을
훑는다. 정본은 `CLE-ENG-SPECEVIDENCE` 「적용 대상」이다. 전환 4d 리뷰에서 두 어긋남이 나왔다.
템플릿이 옛 경로 `spec/conventions/spec-impl-evidence.md §1` 을 인용했고, 정본에 있는
`spec/7-channel-web-chat/**.md` 가 INCLUDE 에 없었다(4d 이전부터). 둘 다 문장으로만 맞추면 다시
갈라지므로 프롬프트를 실제로 만들어 미러 본문과 대조한다(전환 4e).

`main()` 을 돌려 만든 프롬프트를 본다. 템플릿 상수만 보면 호출부가 다른 값을 넘겨도 초록이다.
세션 디렉터리는 임시 폴더로 바꾼다(이 체크아웃의 `.review/` 에 쓰지 않는다).

전환 단계 5 에서 감사 대상을 옛 트리에서 미러로 옮겼다. 포함 목록과 함께 `## 구현 위치` 조건과
제외 항목(미러 안내 · 카탈로그 영역)도 정본과 대조한다. 그 전에는 EXCLUDE 줄이 템플릿 문장이라
정본과 갈라져도 알 수 없었다.

`SameSecondSessionTest` 는 세션 디렉터리를 본다. 같은 초에 두 번 돌면 두 번째가 `_2` 를 받고 앞 실행의
파일이 남는다. 새 이름은 제출 도구(`nerv_review_payload.py`)가 서로 다른 앞자리와 `spec_coverage` 로 읽는다.
"""

from __future__ import annotations

import io
import json
import os
import re
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import _harness

ORCH_PATH = (_harness.CLAUDE_DIR / "skills" / "spec-coverage" / "scripts"
             / "spec_coverage_orchestrator.py")
orch = _harness.load_module_by_path("spec_coverage_orchestrator_under_test", ORCH_PATH)
payload = _harness.load_module_by_path("nerv_review_payload_for_spec_coverage",
                                       _harness.CLAUDE_DIR / "tools" / "nerv_review_payload.py")

SOT = _harness.REPO_ROOT / "spec" / "CLE-ENG" / "CLE-ENG-SPECEVIDENCE.md"


def _sot_section() -> str:
    """정본 「적용 대상」 절 본문."""
    text = SOT.read_text(encoding="utf-8")
    start = text.index("\n## 적용 대상\n")
    end = text.index("\n## ", start + 1)
    return text[start:end]


def _sot_include() -> list[str]:
    """정본 「적용 대상」 절의 포함 목록(첫 목록의 백틱 경로)."""
    return re.findall(r"^- `(spec/[^`]+)`\s*$", _sot_section(), re.MULTILINE)


def _prompt_codes(prompt: str, label: str) -> list[str]:
    line = next(ln for ln in prompt.splitlines() if ln.startswith(f"- {label}:"))
    return re.findall(r"`([^`]+)`", line)


class SpecCoveragePromptTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        with mock.patch.object(orch, "session_dir", lambda root: self.tmp), \
                mock.patch.object(sys, "argv", ["spec_coverage_orchestrator.py", "--mode", "both"]), \
                mock.patch("sys.stdout"):
            self.assertEqual(orch.main(), 0)
        self.prompt = (self.tmp / "_prompt.md").read_text(encoding="utf-8")

    def test_the_prompt_cites_the_mirror_sot(self):
        self.assertTrue(SOT.is_file(), "정본 미러 파일이 없다 — 경로를 확인한다")
        self.assertEqual(orch.SOT_DOC, str(SOT.relative_to(_harness.REPO_ROOT)))
        self.assertIn(f"`{orch.SOT_DOC}`", self.prompt)
        self.assertNotIn("spec-impl-evidence.md", self.prompt)

    def test_the_include_list_is_the_sot_include_list(self):
        sot = _sot_include()
        self.assertGreaterEqual(len(sot), 2, "정본에서 포함 목록을 읽지 못했다. 절 모양을 확인한다")
        self.assertEqual(_prompt_codes(self.prompt, "INCLUDE"), sot)

    def test_the_section_condition_is_the_sot_condition(self):
        self.assertEqual(_prompt_codes(self.prompt, "SECTION"), [orch.IMPL_SECTION])
        self.assertIn(f"`{orch.IMPL_SECTION}`", _sot_section())

    def test_the_exclusions_are_the_sot_exclusions(self):
        section = _sot_section()
        self.assertEqual(_prompt_codes(self.prompt, "EXCLUDE"), list(orch.EXCLUDE_PATHS))
        self.assertEqual(_prompt_codes(self.prompt, "EXCLUDED AREAS"), list(orch.EXCLUDED_AREAS))
        # 정본 절이 백틱으로 적은 `spec/` 경로 가운데 포함 목록이 아닌 것이 제외 목록이다. 양쪽을 다
        # 본다. 상수만 보면 제외 목록을 통째로 비워도 프롬프트와 상수가 같아 초록이다.
        spec_codes = set(re.findall(r"`(spec/[^`]+)`", section)) - set(_sot_include())
        self.assertEqual(set(orch.EXCLUDE_PATHS), spec_codes)
        area_codes = set(re.findall(r"`(CLE-[A-Z0-9]+)`", section))
        self.assertEqual(set(orch.EXCLUDED_AREAS), area_codes)
        # 카탈로그 영역 목록의 정본은 미러 도구다. 제외 범위가 바뀌면 이 목록도 함께 바뀐다.
        if str(_harness.CLAUDE_DIR) not in sys.path:
            sys.path.insert(0, str(_harness.CLAUDE_DIR))
        from _shared.nerv_read import load_pull

        self.assertEqual(tuple(orch.EXCLUDED_AREAS), tuple(load_pull().EXCLUDED_AREAS))

    def test_the_path_roots_are_the_build_guard_roots(self):
        # 프롬프트는 "빌드 가드와 같은 읽기" 라고 적는다. 가드의 루트 목록과 갈라지면 감사기가
        # 다른 경로를 구현 위치로 읽는다.
        guard_roots = _harness.impl_location_roots()
        self.assertGreaterEqual(len(guard_roots), 4)
        self.assertEqual(tuple(orch.IMPL_ROOTS), tuple(guard_roots))
        line = next(ln for ln in self.prompt.splitlines() if ln.startswith("section (starting with"))
        self.assertEqual(re.findall(r"`([^`]+)`", line), guard_roots)

    def test_the_direction_reaches_the_prompt(self):
        self.assertIn("MODE=both", self.prompt)


class SameSecondSessionTest(unittest.TestCase):
    """같은 초에 두 번 돌면 세션 디렉터리를 따로 받는다(NERV Task `CLE-T-B866CD`).

    옛 `session_dir()` 는 `%H_%M_%S` 이름을 `exist_ok=True` 로 만들어 두 실행이 한 디렉터리를 같이 썼고 뒤
    실행이 앞 실행의 `_prompt.md` · `meta.json` 을 덮었다. 시계를 멈춘다. 실제 시계로 두 번 부르면 초가 넘어가
    결함이 살아 있어도 초록이다."""

    def setUp(self):
        self.root = Path(os.path.realpath(tempfile.mkdtemp()))
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)

    def run_main(self, mode: str) -> Path:
        out = io.StringIO()
        with mock.patch.object(orch, "repo_root", lambda: self.root), \
                mock.patch.object(sys, "argv", ["spec_coverage_orchestrator.py", "--mode", mode]), \
                mock.patch("sys.stdout", out):
            self.assertEqual(orch.main(), 0)
        return Path(out.getvalue().splitlines()[-1])

    def test_two_runs_in_the_same_second_keep_their_own_files(self):
        session_mod = orch.session
        clock = mock.MagicMock(wraps=session_mod.datetime)
        clock.now.return_value = session_mod.datetime(2026, 10, 10, 13, 40, 14)
        with mock.patch.object(session_mod, "datetime", clock):
            first = self.run_main("forward")
            second = self.run_main("reverse")
        self.assertEqual(first.relative_to(self.root).parts,
                         (".review", "spec-coverage", "2026", "10", "10", "13_40_14"))
        self.assertEqual(second, first.parent / "13_40_14_2")
        # 앞 실행의 파일이 남는다. 원래 피해는 이름이 아니라 덮인 파일이었다.
        for d, direction in ((first, "forward"), (second, "reverse")):
            with self.subTest(session=d.name):
                meta = json.loads((d / "meta.json").read_text(encoding="utf-8"))
                self.assertEqual((meta["direction"], meta["session_dir"]), (direction, str(d)))
                self.assertIn(f"- MODE={direction}\n", (d / "_prompt.md").read_text(encoding="utf-8"))
        # 제출 도구가 두 세션을 서로 다른 멱등 키 앞자리와 spec_coverage 로 읽는다.
        self.assertEqual([payload.session_stamp(str(d)) for d in (first, second)],
                         ["20261010-134014", "20261010-134014-2"])
        self.assertEqual({payload.kind_of(str(d)) for d in (first, second)}, {"spec_coverage"})


if __name__ == "__main__":
    unittest.main()
