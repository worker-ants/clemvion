#!/usr/bin/env python3
"""NERV 쓰기 도구는 기록 서브에이전트 `nerv-recorder` 하나에만 준다(결정 D9 개정, NERV Task `CLE-T-CD9131`).

리뷰어 · checker · analyzer · applier 가 NERV 에 직접 쓰면 제출과 처분이 main 의 검사(제출 도구의 `ok`,
인계 도구의 `check`)를 건너뛴다. `nerv-recorder` 는 셸이 없어야 환경 변수 `NERV_TOKEN` 을 읽지 못하고, 파일
쓰기 도구가 없어야 저장소를 바꾸지 못한다. 에이전트 정의에 `tools` 가 없으면 main 의 도구를 모두 물려받아
NERV MCP 쓰기 도구까지 갖게 되므로 모든 정의가 도구를 적어야 한다.

이 테스트가 보장하는 범위는 도구 목록까지다. `Read` 에는 경로 제한이 없어서 `nerv-recorder` 는 토큰이 든 설정
파일을 읽을 수 있고, 막는 장치는 정의의 규칙 문장 하나다. 그 문장이 있는지는 보지만 지켜지는지는 보지 못한다.
`settings.json` 에 `permissions.deny` 가 없는 동안에는 정의가 그 사실을 적어야 한다.

frontmatter 의 `tools` 는 한 줄 쉼표 목록(`tools: Read, Bash`)으로 적는다. 저장소의 정의 전부가 그 모양이고, 파서는
YAML 목록(`tools:` 아래 `- Read`)도 읽지만 Claude Code 로더가 그 모양을 같은 뜻으로 읽는지 이 테스트는 증명하지
못한다. 로더가 읽지 못하면 에이전트는 모든 도구를 물려받고 테스트는 초록인 채로 가드가 꺼진다.
"""

from __future__ import annotations

import json
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

    def test_every_agent_writes_tools_as_one_comma_separated_line(self):
        # YAML 목록은 파서만 읽는다. 로더가 같은 뜻으로 읽는지는 증명되지 않았고, 틀리면 에이전트가 모든 도구를 받는다.
        for name, (_, text) in self.agents.items():
            front = frontmatter(text) or ""
            with self.subTest(agent=name):
                self.assertRegex(front, r"(?m)^tools:[ \t]*\S", f"{name}.md 의 tools 가 한 줄 쉼표 목록이 아니다")

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


    def test_the_recorder_does_not_claim_more_than_the_tools_enforce(self):
        # `Read` 는 경로를 좁히지 못한다. 설정에 deny 규칙이 없으면 정의는 토큰 파일을 읽을 수 없다고 말하지 못한다.
        settings = json.loads((_harness.REPO_ROOT / ".claude" / "settings.json").read_text(encoding="utf-8"))
        deny = (settings.get("permissions") or {}).get("deny") or []
        token_files = (".claude/settings.local.json", ".mcp.json")
        blocked = all(any(rule.startswith("Read") and f in rule for rule in deny) for f in token_files)
        if blocked:
            self.skipTest("settings.json 이 두 토큰 파일의 읽기를 막는다 — 정의가 남은 위험을 적을 필요가 없다")
        _, text = self.agents[RECORDER]
        claude_md = (_harness.REPO_ROOT / "CLAUDE.md").read_text(encoding="utf-8")
        self.assertIn("막는 장치는 아래 규칙 1 하나다", text, "deny 규칙이 없는데 정의가 남은 위험을 적지 않았다")
        for name, body in ((f"{RECORDER}.md", text), ("CLAUDE.md", claude_md)):
            with self.subTest(doc=name):
                # 환경 변수에 닿지 않는다는 말은 맞다. 다만 토큰 파일까지 막는다는 말로 읽히면 안 된다.
                self.assertNotRegex(body, r"`NERV_TOKEN` 에 닿지\s+않", f"{name} 가 토큰 격리를 실제보다 넓게 적었다")
        section = claude_md.split("## Skill 체계", 1)[1].split("\n## ", 1)[0]
        self.assertIn(".mcp.json", section, "CLAUDE.md 가 Read 로 닿는 토큰 파일을 적지 않았다")


class GovernanceTest(unittest.TestCase):
    def skill_section(self):
        text = (_harness.REPO_ROOT / "CLAUDE.md").read_text(encoding="utf-8")
        self.assertIn("## Skill 체계", text)
        return text.split("## Skill 체계", 1)[1].split("\n## ", 1)[0]

    def test_claude_md_names_both_writers(self):
        # 규칙 제목을 문자열로 찾지 않는다. 제목 문구를 고칠 때마다 테스트가 깨지는 결합을 피한다.
        section = self.skill_section()
        self.assertIn(RECORDER, section)
        self.assertIn("nerv:nerv-spec-writer", section)

    def test_claude_md_does_not_keep_the_old_main_only_title(self):
        # 리뷰 기록은 이제 `nerv-recorder` 가 한다. 제목이 "main 세션의 MCP 호출로만" 이면 본문과 반대다.
        self.assertNotIn("NERV 쓰기는 main 세션의 MCP 호출로만 한다", self.skill_section())


if __name__ == "__main__":
    unittest.main()
