#!/usr/bin/env python3
"""NERV 쓰기 도구는 기록 서브에이전트 `nerv-recorder` 하나에만 준다(결정 D9 개정, NERV Task `CLE-T-CD9131`).

리뷰어 · checker · analyzer · applier 가 NERV 에 직접 쓰면 제출과 처분이 main 의 검사(제출 도구의 `ok`,
인계 도구의 `check`)를 건너뛴다. `nerv-recorder` 는 셸이 없어야 세션 환경의 `NERV_TOKEN` 에 닿지 않고, 파일
쓰기 도구가 없어야 저장소를 바꾸지 못한다. 에이전트 정의에 `tools` 가 없으면 main 의 도구를 모두 물려받아
NERV MCP 쓰기 도구까지 갖게 되므로 모든 정의가 도구를 적어야 한다.

frontmatter 의 `tools` 는 두 모양을 읽는다. 한 줄 쉼표 목록(`tools: Read, Bash`)과 YAML 목록(`tools:` 아래 `- Read`)이다.
"""

from __future__ import annotations

import re
import unittest

import _harness

AGENTS_DIR = _harness.CLAUDE_DIR / "agents"
RECORDER = "nerv-recorder"
RECORDER_TOOLS = {
    "Read",
    "mcp__nerv__nerv_review_submit",
    "mcp__plugin_nerv_nerv__nerv_review_submit",
    "mcp__nerv__nerv_finding_resolve",
    "mcp__plugin_nerv_nerv__nerv_finding_resolve",
    "mcp__nerv__nerv_finding_list",
    "mcp__plugin_nerv_nerv__nerv_finding_list",
}
# NERV MCP 서버의 도구 이름 접두. 프로젝트 `.mcp.json` 의 서버와 nerv 플러그인의 서버 두 가지다.
NERV_PREFIXES = ("mcp__nerv__", "mcp__plugin_nerv_nerv__")


def frontmatter(text: str) -> str | None:
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    return m.group(1) if m else None


def tools_of(front: str) -> list[str] | None:
    """frontmatter 의 `tools` 값. 키가 없으면 None."""
    lines = front.split("\n")
    for i, line in enumerate(lines):
        m = re.match(r"^tools:\s*(.*)$", line)
        if not m:
            continue
        if m.group(1).strip():
            return [t.strip() for t in m.group(1).split(",") if t.strip()]
        items = []
        for nxt in lines[i + 1:]:
            mm = re.match(r"^\s+-\s+(\S.*?)\s*$", nxt)
            if not mm:
                break
            items.append(mm.group(1))
        return items
    return None


def agents() -> dict[str, tuple[list[str] | None, str]]:
    out = {}
    for path in sorted(AGENTS_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        front = frontmatter(text)
        out[path.stem] = (tools_of(front) if front is not None else None, text)
    return out


class ParserTest(unittest.TestCase):
    def test_reads_both_shapes(self):
        self.assertEqual(tools_of("name: a\ntools: Read, Bash\nmodel: x"), ["Read", "Bash"])
        self.assertEqual(tools_of("name: a\ntools:\n  - Read\n  - mcp__nerv__nerv_review_submit\nmodel: x"),
                         ["Read", "mcp__nerv__nerv_review_submit"])
        self.assertIsNone(tools_of("name: a\nmodel: x"))


class ToolScopeTest(unittest.TestCase):
    def setUp(self):
        self.agents = agents()

    def test_the_recorder_exists(self):
        self.assertIn(RECORDER, self.agents)

    def test_every_agent_declares_its_tools(self):
        for name, (tools, _) in self.agents.items():
            with self.subTest(agent=name):
                self.assertTrue(tools, f"{name}.md 에 tools 가 없다. 없으면 main 의 도구(NERV 쓰기 포함)를 모두 물려받는다")
                self.assertNotIn("*", tools, f"{name}.md 가 모든 도구를 받는다")

    def test_only_the_recorder_gets_nerv_tools(self):
        for name, (tools, _) in self.agents.items():
            if name == RECORDER:
                continue
            with self.subTest(agent=name):
                nerv = [t for t in tools or [] if t.startswith(NERV_PREFIXES) or "nerv" in t.lower()]
                self.assertEqual(nerv, [], f"{name}.md 에 NERV 도구가 있다. NERV 쓰기는 main 과 {RECORDER} 만 한다")

    def test_the_recorder_gets_exactly_read_and_the_review_tools(self):
        tools, _ = self.agents[RECORDER]
        for forbidden in ("Bash", "Edit", "Write", "NotebookEdit", "WebFetch", "Agent"):
            self.assertNotIn(forbidden, tools, f"{RECORDER} 에 {forbidden} 이 있다")
        self.assertEqual(set(tools), RECORDER_TOOLS)

    def test_the_recorder_is_told_not_to_read_the_token_files(self):
        _, text = self.agents[RECORDER]
        body = " ".join(line.strip() for line in text.split("\n---\n", 1)[1].split("\n"))
        sentences = [x for x in re.split(r"(?<=다)\.\s", body)
                     if ".claude/settings.local.json" in x and ".mcp.json" in x]
        self.assertTrue(sentences, "토큰이 든 두 파일을 함께 금지하는 문장이 없다")
        self.assertTrue(any(x.rstrip(".").endswith("읽지 않는다") for x in sentences), sentences)


class GovernanceTest(unittest.TestCase):
    def test_claude_md_names_both_exceptions(self):
        text = (_harness.REPO_ROOT / "CLAUDE.md").read_text(encoding="utf-8")
        bullet = next((line for line in text.split("\n")
                       if line.startswith("- **NERV 쓰기는 main 세션의 MCP 호출로만 한다**")), None)
        self.assertIsNotNone(bullet, "CLAUDE.md 에 NERV 쓰기 규칙 줄이 없다")
        self.assertIn(RECORDER, bullet)
        self.assertIn("nerv:nerv-spec-writer", bullet)


if __name__ == "__main__":
    unittest.main()
