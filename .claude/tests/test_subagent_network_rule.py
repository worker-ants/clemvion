"""셸이 있는 서브에이전트 정의는 네트워크 · 토큰 금지 줄을 그대로 담는다.

정의 본문은 서브에이전트가 받는 프롬프트다. 규칙을 계약 문서(`.claude/docs/subagent-call-contract.md`
§8)에만 두면 서브에이전트에 닿지 않는다. 그래서 §8 이 정의에 넣을 줄을 인용하고, `tools` 에 `Bash` 가
있는 정의마다 그 줄을 그대로 둔다(NERV Task `CLE-T-MGN4NZ`). 새 정의를 더하면서 줄을 빠뜨리거나 한
정의에서만 문구를 바꾸면 여기서 드러난다. 줄을 고칠 때는 §8 의 인용과 모든 정의를 함께 고친다.

서브에이전트가 실제로 네트워크를 부르지 않는지는 보지 않는다. 그 경로는 기계로 막지 않는다(§8
「기계 장치를 검토한 결과」).
"""

from __future__ import annotations

import re
import unittest

from _harness import CLAUDE_DIR

AGENTS_DIR = CLAUDE_DIR / "agents"
CONTRACT = CLAUDE_DIR / "docs" / "subagent-call-contract.md"

_RULE_QUOTE = re.compile(r"^> (\*\*네트워크 · 토큰 금지\*\*:.*)$", re.M)
_LINK = re.compile(r"\]\(([^)]+subagent-call-contract\.md)\)")

# 셸이 없어 금지 줄이 필요 없는 정의. 셸 없는 정의를 더하면 여기에도 더한다. 목록으로 고정하는 이유는
# 둘이다. 파서가 frontmatter 를 못 읽어 정의가 셸 없는 쪽으로 빠지면 여기서 드러나고, 금지 줄을 면제받는
# 정의가 생기는 일이 리뷰에 보인다.
NO_SHELL = {"nerv-recorder.md"}


def frontmatter_tools(text: str) -> list[str]:
    """정의 frontmatter 의 `tools:` 목록. frontmatter 나 `tools:` 가 없으면 빈 목록."""
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    if not m:
        return []
    line = re.search(r"^tools:\s*(.*)$", m.group(1), re.M)
    return [t.strip() for t in line.group(1).split(",") if t.strip()] if line else []


def section_8(text: str) -> str:
    m = re.search(r"^## 8\..*?(?=^## |\Z)", text, re.M | re.S)
    return m.group(0) if m else ""


def rule_line() -> str:
    found = _RULE_QUOTE.findall(section_8(CONTRACT.read_text(encoding="utf-8")))
    if len(found) != 1:
        raise AssertionError(f"계약 문서 §8 에 금지 줄 인용이 하나가 아니다: {len(found)}개")
    return found[0]


def shell_agents() -> list:
    return [p for p in sorted(AGENTS_DIR.glob("*.md"))
            if "Bash" in frontmatter_tools(p.read_text(encoding="utf-8"))]


class ParserTest(unittest.TestCase):
    """파서가 빈 목록을 돌려주면 아래 대조가 빈 손으로 통과한다. 알려진 정의 둘로 고정한다."""

    def test_tools_are_read_from_frontmatter(self):
        self.assertIn("Bash", frontmatter_tools((AGENTS_DIR / "security-reviewer.md").read_text(encoding="utf-8")))
        recorder = frontmatter_tools((AGENTS_DIR / "nerv-recorder.md").read_text(encoding="utf-8"))
        self.assertIn("Read", recorder)
        self.assertNotIn("Bash", recorder)

    def test_a_body_mention_of_bash_is_not_a_tool(self):
        text = "---\nname: x\ntools: Read, Grep\n---\n\nBash 로 git diff 를 본다.\n"
        self.assertEqual(frontmatter_tools(text), ["Read", "Grep"])

    def test_only_the_listed_definitions_lack_a_shell(self):
        shell = {p.name for p in shell_agents()}
        everyone = {p.name for p in AGENTS_DIR.glob("*.md")}
        self.assertEqual(everyone - shell, NO_SHELL)
        self.assertTrue(shell)


class NetworkRuleLineTest(unittest.TestCase):
    def test_the_contract_quotes_one_line_in_section_8(self):
        self.assertIn("NERV_TOKEN", rule_line())

    def test_every_shell_agent_carries_the_line_verbatim_once(self):
        line = rule_line()
        counts = {p.name: p.read_text(encoding="utf-8").splitlines().count(line) for p in shell_agents()}
        wrong = {name: n for name, n in counts.items() if n != 1}
        self.assertEqual(wrong, {}, "§8 의 금지 줄이 없거나 · 문구가 다르거나 · 두 번 이상 있는 정의(값은 줄 수)")

    def test_the_link_in_the_line_reaches_the_contract_from_the_agents_folder(self):
        targets = _LINK.findall(rule_line())
        self.assertEqual(len(targets), 1, targets)
        self.assertEqual((AGENTS_DIR / targets[0]).resolve(), CONTRACT.resolve())


if __name__ == "__main__":
    unittest.main()
