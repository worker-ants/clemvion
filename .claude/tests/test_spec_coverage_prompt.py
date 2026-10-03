"""`/spec-coverage` 감사기 프롬프트가 적용 대상의 정본을 그대로 옮기는가.

감사기(`spec-impl-coverage-auditor`)는 오케스트레이터가 쓴 `_prompt.md` 의 INCLUDE 목록대로 스펙을
훑는다. 정본은 `CLE-ENG-SPECEVIDENCE` 「적용 대상」이다. 전환 4d 리뷰에서 두 어긋남이 나왔다.
템플릿이 옛 경로 `spec/conventions/spec-impl-evidence.md §1` 을 인용했고, 정본에 있는
`spec/7-channel-web-chat/**.md` 가 INCLUDE 에 없었다(4d 이전부터). 둘 다 문장으로만 맞추면 다시
갈라지므로 프롬프트를 실제로 만들어 미러 본문과 대조한다(전환 4e).

`main()` 을 돌려 만든 프롬프트를 본다. 템플릿 상수만 보면 호출부가 다른 값을 넘겨도 초록이다.
세션 디렉터리는 임시 폴더로 바꾼다(이 체크아웃의 `.review/` 에 쓰지 않는다).
"""

from __future__ import annotations

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

SOT = _harness.REPO_ROOT / "spec" / "CLE-ENG" / "CLE-ENG-SPECEVIDENCE.md"


def _sot_include() -> list[str]:
    """정본 「적용 대상」 절의 포함 목록(첫 목록의 백틱 경로)."""
    text = SOT.read_text(encoding="utf-8")
    start = text.index("\n## 적용 대상\n")
    end = text.index("\n## ", start + 1)
    section = text[start:end]
    return re.findall(r"^- `(spec/[^`]+)`\s*$", section, re.MULTILINE)


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
        self.assertGreaterEqual(len(sot), 5, "정본에서 포함 목록을 읽지 못했다 — 절 모양을 확인한다")
        line = next(ln for ln in self.prompt.splitlines() if ln.startswith("- INCLUDE:"))
        self.assertEqual(re.findall(r"`([^`]+)`", line), sot)

    def test_the_direction_reaches_the_prompt(self):
        self.assertIn("MODE=both", self.prompt)


if __name__ == "__main__":
    unittest.main()
