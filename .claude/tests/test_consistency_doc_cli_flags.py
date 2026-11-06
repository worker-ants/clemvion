"""consistency 검토 문서에 적힌 `--flag` 와 예시 scope 가 실제 CLI 와 맞는지 대조한다.

`/consistency-check` 명령 문서 · consistency-checker SKILL · developer SKILL 은 main 이 읽고 그대로
따라 치는 절차다. 문서에만 있는 플래그를 치면 argparse 가 거절하고, 미러에 없는 키를 scope 로 주면
도구가 종료 코드 2 로 멈춘다. 둘 다 리뷰 Workflow 를 띄우는 자리에서 드러난다. NERV Task
`CLE-T-MGN4NZ`(출처: 전환 4e 거버넌스 PR 리뷰의 testing INFO 두 건)가 이 대조를 고정한다.

무엇을 보는가:

  - **호출 구간**: 코드 구간(인라인 백틱 · 펜스 블록의 한 명령)에 `/consistency-check` 나
    `consistency_orchestrator.py` 가 있으면 그 뒤의 `--flag` 는 모두 CLI 옵션이어야 한다. 세 문서를 다 본다.
  - **플래그로 시작하는 구간**: consistency 전용 문서 둘(명령 문서 · consistency-checker SKILL)에서
    ```--spec <path>``` 처럼 플래그로 시작하는 구간도 CLI 옵션이어야 한다. 다른 도구의 플래그를 맨 구간으로
    적은 자리는 `OTHER_TOOL_FLAGS` 에 그 도구와 함께 올린다. 그 도구에 정말 그 옵션이 있는지도 본다.
    developer SKILL 은 여러 도구(`git` · `pull.py` · 제출 도구)의 플래그를 맨 구간으로 적어서 이 규칙을
    걸지 않는다.
  - **예시 scope**: 호출 구간의 `--impl-prep` · `--impl-done` · `--focus` 인자와, consistency 전용 문서에서
    키 · 미러 경로만으로 된 구간(`CLE-ENG-SPECEVIDENCE,spec/CLE-API/` 등)은 오케스트레이터의
    `resolve_scope` · `resolve_focus` 가 받아야 한다. `<scope>` 처럼 꺾쇠가 든 자리 표시와 `--spec` 의
    인자(새 초안은 미러에 없을 수 있다)는 보지 않는다.

보지 않는 것: 문장 속에서 플래그를 백틱 없이 쓴 자리, 다른 도구 이름으로 시작하는 구간
(`python3 … pull.py --task …` 등)의 플래그. CLI 옵션 목록은 `--help` 출력에서 읽는다(사람과 같은 입구).
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import unittest

from _harness import CLAUDE_DIR, REPO_ROOT

ORCH_PATH = CLAUDE_DIR / "skills" / "consistency-checker" / "scripts" / "consistency_orchestrator.py"

COMMAND_DOC = CLAUDE_DIR / "commands" / "consistency-check.md"
CHECKER_SKILL = CLAUDE_DIR / "skills" / "consistency-checker" / "SKILL.md"
DEVELOPER_SKILL = CLAUDE_DIR / "skills" / "developer" / "SKILL.md"

# consistency 전용 문서: 플래그로 시작하는 구간과 키 · 경로 구간까지 본다.
CONSISTENCY_DOCS = (COMMAND_DOC, CHECKER_SKILL)
# 호출 구간만 보는 문서.
INVOCATION_ONLY_DOCS = (DEVELOPER_SKILL,)

# consistency 전용 문서에 맨 구간으로 적힌 다른 도구의 플래그. (문서, 플래그) → 그 플래그를 가진 도구.
OTHER_TOOL_FLAGS = {
    # SKILL §제출의 「`task_id` 규칙과 한계」: "도구의 `--task` 는 `--mode done` 일 때만 준다".
    (CHECKER_SKILL, "--task"): CLAUDE_DIR / "tools" / "nerv_review_payload.py",
    (CHECKER_SKILL, "--mode"): CLAUDE_DIR / "tools" / "nerv_review_payload.py",
}

_FLAG = re.compile(r"(?<![\w-])--[a-z][a-z0-9-]*")
_INVOKE = re.compile(r"/consistency-check\b|consistency_orchestrator\.py")
# NERV 키(Task 키 `CLE-T-…` 는 뺀다) · 미러 영역 폴더 · 미러 파일. `spec/README.md` 같은 미러 안내 파일은
# scope 예시가 아니라서 이 모양에 들지 않는다.
_KEY = r"CLE-(?!T-)[A-Z0-9]+(?:-[A-Z0-9]+)*"
_SCOPE_ITEM = rf"(?:{_KEY}|spec/{_KEY}/(?:{_KEY}\.md)?|spec/{_KEY}\.md)"
_SCOPE_SPAN = re.compile(rf"{_SCOPE_ITEM}(?:,{_SCOPE_ITEM})*")
_SCOPE_FLAGS = ("--impl-prep", "--impl-done", "--focus")


def code_spans(text: str) -> list[tuple[int, str]]:
    """문서의 코드 구간을 (줄 번호, 내용)으로 돌려준다.

    펜스 블록(인용 `>` 안의 것도)은 한 줄을 한 구간으로 보고 `\\` 로 이어진 줄은 하나로 합친다.
    그 밖의 줄에서는 백틱 한 쌍 안을 한 구간으로 본다."""
    spans: list[tuple[int, str]] = []
    in_fence = False
    pending: tuple[int, str] | None = None
    for no, raw in enumerate(text.splitlines(), 1):
        line = re.sub(r"^\s*(?:>\s?)*", "", raw)
        if line.lstrip().startswith("```"):
            if in_fence and pending is not None:
                spans.append(pending)
                pending = None
            in_fence = not in_fence
            continue
        if in_fence:
            body = line.split("#", 1)[0].rstrip() if " #" in line else line.rstrip()
            start_no = pending[0] if pending else no
            joined = ((pending[1] + " ") if pending else "") + body.rstrip("\\").strip()
            if body.endswith("\\"):
                pending = (start_no, joined)
            else:
                spans.append((start_no, joined))
                pending = None
            continue
        spans.extend((no, m.group(1)) for m in re.finditer(r"`([^`\n]+)`", raw))
    return spans


def invocation_tail(span: str) -> str | None:
    """`/consistency-check` · `consistency_orchestrator.py` 뒤의 글. 호출 구간이 아니면 None."""
    hits = list(_INVOKE.finditer(span))
    return span[hits[-1].end():] if hits else None


def flag_args(tail: str) -> list[tuple[str, str | None]]:
    """호출 뒤 글에서 (플래그, 바로 뒤 인자) 목록. 인자가 없거나 다음 플래그면 None."""
    words = tail.split()
    out = []
    for i, w in enumerate(words):
        if _FLAG.fullmatch(w):
            nxt = words[i + 1] if i + 1 < len(words) else None
            out.append((w, None if nxt is None or nxt.startswith("--") else nxt))
    return out


def cli_flags() -> set[str]:
    r = subprocess.run([sys.executable, str(ORCH_PATH), "--help"], capture_output=True, text=True,
                       cwd=str(REPO_ROOT))
    if r.returncode != 0:
        raise AssertionError(f"--help 가 실패했다: {r.stderr}")
    return set(_FLAG.findall(r.stdout))


def tool_has_flag(tool, flag: str) -> bool:
    text = tool.read_text(encoding="utf-8")
    return re.search(r"add_argument\(\s*['\"]" + re.escape(flag) + r"['\"]", text) is not None


# 오케스트레이터는 `from _lib import project_config` 로 skills 의 `_lib` 를 들인다. 훅 테스트가 같은 이름의
# 훅 `_lib` 를 먼저 들인 프로세스에서는 그 import 가 깨진다. 그래서 scope 해석은 하위 프로세스에서 돌린다.
_PROBE = """
import contextlib, io, json, os, sys
sys.path.insert(0, sys.argv[1])
import consistency_orchestrator as m
root, pairs = sys.argv[2], json.loads(sys.argv[3])
cfg = m.project_config.load(root)
spec_dir = os.path.join(root, cfg["corpora"]["spec"].rstrip("/"))
by_key = {m.mirror_key(p): p for p in m.collect_mirror_files(spec_dir)}
out = []
for flag, value in pairs:
    err = io.StringIO()
    try:
        with contextlib.redirect_stderr(err):
            if flag == "--focus":
                m.resolve_focus(value, by_key)
            else:
                m.resolve_scope(value, flag, spec_dir, by_key, root)
        out.append(None)
    except SystemExit:
        lines = err.getvalue().strip().splitlines()
        out.append(lines[0] if lines else "exit")
print(json.dumps({"keys": len(by_key), "refusals": out}))
"""


def refusals(pairs: list[tuple[str, str]]) -> tuple[int, list[str | None]]:
    """오케스트레이터의 `resolve_scope` · `resolve_focus` 로 (플래그, 값)을 해석한다.

    돌려주는 값은 (미러 키 수, 항목마다 거절 이유 또는 None)이다. 거절은 도구가 종료 코드 2 로 멈추는
    경우다."""
    r = subprocess.run(
        [sys.executable, "-c", _PROBE, str(ORCH_PATH.parent), str(REPO_ROOT), json.dumps(pairs)],
        capture_output=True, text=True, cwd=str(REPO_ROOT),
    )
    if r.returncode != 0:
        raise AssertionError(f"scope 해석 프로세스가 실패했다: {r.stderr}")
    data = json.loads(r.stdout.strip().splitlines()[-1])
    return data["keys"], data["refusals"]


class CodeSpanParserTest(unittest.TestCase):
    """구간 파서가 조용히 아무것도 못 찾으면 아래 대조가 빈 집합으로 통과한다. 그 모양을 고정한다."""

    def test_inline_spans_and_fenced_commands_are_found(self):
        text = (
            "앞 `--spec <path>` 과 `/consistency-check --impl-done spec/CLE-ENG/` 뒤\n"
            "> ```bash\n"
            "> python3 x/consistency_orchestrator.py \\\n"
            ">   --resume <session_dir>     # 주석 --not-a-flag\n"
            "> ```\n"
        )
        spans = [s for _, s in code_spans(text)]
        self.assertIn("--spec <path>", spans)
        self.assertIn("/consistency-check --impl-done spec/CLE-ENG/", spans)
        self.assertIn("python3 x/consistency_orchestrator.py --resume <session_dir>", spans)
        self.assertFalse(any("--not-a-flag" in s for s in spans), spans)

    def test_flag_args_pairs_each_flag_with_its_value(self):
        self.assertEqual(
            flag_args(" --impl-prep spec/CLE-CHAT/ --focus CLE-CHAT-CORE --diff-path"),
            [("--impl-prep", "spec/CLE-CHAT/"), ("--focus", "CLE-CHAT-CORE"), ("--diff-path", None)],
        )

    def test_every_doc_has_invocations(self):
        for doc in CONSISTENCY_DOCS + INVOCATION_ONLY_DOCS:
            with self.subTest(doc=doc.name):
                spans = code_spans(doc.read_text(encoding="utf-8"))
                self.assertTrue(any(invocation_tail(s) is not None for _, s in spans))

    def test_cli_flags_are_read(self):
        flags = cli_flags()
        self.assertTrue({"--spec", "--impl-prep", "--impl-done", "--focus"} <= flags, flags)


class DocFlagsAreCliFlagsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.flags = cli_flags()

    def test_invocation_flags_exist(self):
        bad = []
        for doc in CONSISTENCY_DOCS + INVOCATION_ONLY_DOCS:
            for no, span in code_spans(doc.read_text(encoding="utf-8")):
                tail = invocation_tail(span)
                if tail is None:
                    continue
                bad += [f"{doc.relative_to(REPO_ROOT)}:{no} {f}" for f, _ in flag_args(tail)
                        if f not in self.flags]
        self.assertEqual(bad, [], "문서의 호출에 CLI 에 없는 플래그가 있다")

    def test_bare_flag_spans_in_consistency_docs_exist(self):
        bad = []
        for doc in CONSISTENCY_DOCS:
            for no, span in code_spans(doc.read_text(encoding="utf-8")):
                if invocation_tail(span) is not None or not span.lstrip().startswith("--"):
                    continue
                for f in _FLAG.findall(span):
                    if f in self.flags or (doc, f) in OTHER_TOOL_FLAGS:
                        continue
                    bad.append(f"{doc.relative_to(REPO_ROOT)}:{no} {f}")
        self.assertEqual(bad, [], "consistency 문서의 플래그 구간에 CLI 에 없는 플래그가 있다")

    def test_other_tool_flags_are_real_and_not_consistency_flags(self):
        for (doc, flag), tool in OTHER_TOOL_FLAGS.items():
            with self.subTest(doc=doc.name, flag=flag):
                self.assertTrue(tool_has_flag(tool, flag), f"{tool.name} 에 {flag} 가 없다")
                self.assertNotIn(flag, self.flags, "consistency CLI 옵션이면 예외로 둘 이유가 없다")
                self.assertIn(f"`{flag}", doc.read_text(encoding="utf-8"), "문서에서 사라진 예외다")


class DocExampleScopesResolveTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cases: list[tuple[str, str, str]] = []  # (위치, 플래그, 값)
        for doc in CONSISTENCY_DOCS + INVOCATION_ONLY_DOCS:
            rel = doc.relative_to(REPO_ROOT)
            for no, span in code_spans(doc.read_text(encoding="utf-8")):
                tail = invocation_tail(span)
                if tail is not None:
                    cls.cases += [(f"{rel}:{no}", f, v) for f, v in flag_args(tail)
                                  if f in _SCOPE_FLAGS and v is not None and "<" not in v]
                elif doc in CONSISTENCY_DOCS and _SCOPE_SPAN.fullmatch(span.strip()):
                    cls.cases.append((f"{rel}:{no}", "--impl-prep", span.strip()))
        probes = [("--impl-prep", "CLE-NO-SUCH-KEY"), ("--focus", "CLE-NO-SUCH-KEY"),
                  ("--impl-prep", "spec/CLE-ENG/")]
        cls.keys, out = refusals([(f, v) for _, f, v in cls.cases] + probes)
        cls.results, cls.probe_results = out[:len(cls.cases)], out[len(cls.cases):]

    def test_the_mirror_is_loaded(self):
        self.assertGreater(self.keys, 50)

    def test_invocation_and_bare_scope_examples_are_found(self):
        kinds = {loc.split(":")[0] for loc, _, _ in self.cases}
        self.assertIn(str(COMMAND_DOC.relative_to(REPO_ROOT)), kinds)
        self.assertIn(str(CHECKER_SKILL.relative_to(REPO_ROOT)), kinds)
        self.assertIn("--focus", {f for _, f, _ in self.cases})

    def test_the_tool_accepts_every_example_scope(self):
        bad = [f"{loc} {flag} {value} — {why}"
               for (loc, flag, value), why in zip(self.cases, self.results) if why]
        self.assertEqual(bad, [], "문서 예시의 scope · 키를 도구가 거절한다")

    def test_a_missing_key_is_refused(self):
        """해석이 늘 None 을 돌려주면 위 테스트가 빈 손으로 통과한다."""
        missing_scope, missing_focus, area = self.probe_results
        self.assertIsNotNone(missing_scope)
        self.assertIsNotNone(missing_focus)
        self.assertIsNone(area)


if __name__ == "__main__":
    unittest.main()
