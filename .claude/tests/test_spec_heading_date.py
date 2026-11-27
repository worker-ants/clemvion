"""Tests for the spec heading date guard — `.claude/hooks/guard_spec_heading_date.py` and
`.claude/hooks/_lib/spec_heading.py` (NERV Task `CLE-T-6YGW3B`, 규약 CLE-ENG-SPECHEADING 규칙 1).

고정하는 것:
- 판정: ATX 제목 문구의 `YYYY-MM-DD`(괄호 표기 포함)만 날짜 제목이다. 코드 블록(``` · ~~~, 닫는 울타리는
  같은 문자 · 같거나 긴 길이) 안의 `#` 줄, 본문 줄 `결정일: YYYY-MM-DD`, 숫자가 이어진 꼴은 세지 않는다.
  닫히지 않은 울타리 뒤의 날짜 제목은 센다. info 문자열에 백틱이 있는 백틱 줄은 울타리가 아니다.
- 기준(`baseline_headings`): `spec_id` 키는 미러, `spec_id` 없이 미러에 있는 `key` 도 미러, 새 문서는 [].
- 훅(래칫): 기존 문서는 미러 `spec/**/<KEY>.md` 의 날짜 제목 수보다 늘면 exit 2, 같거나 줄면 exit 0.
  새 문서(`spec_id` 없음)는 기준 0 이다. UUID · 미러에 없는 문서 · 본문 없는 호출은 통과한다.
  차단 메시지에 새로 생긴 제목이 나온다. 우회는 `BYPASS_SPEC_HEADING_GUARD=1` 만. 모양이 틀린
  페이로드와 런타임 오류는 통과한다(fail-open).
- `settings.json` 이 NERV 초안 도구 두 이름에 훅을 걸고, 훅 파일이 없는 체크아웃에서 통과한다.
- 실제 저장소 미러의 문서를 그대로 다시 저장하는 초안은 막히지 않는다(날짜 제목이 남은 미러가 없으면 건너뛴다).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import _harness

HOOK = _harness.REPO_ROOT / ".claude" / "hooks" / "guard_spec_heading_date.py"
SETTINGS = _harness.REPO_ROOT / ".claude" / "settings.json"

hook = _harness.load_module_by_path("guard_spec_heading_date_under_test", HOOK)
spec_heading = _harness.load_module_by_path(
    "spec_heading_under_test", _harness.REPO_ROOT / ".claude" / "hooks" / "_lib" / "spec_heading.py")

TOOL_NAME = "mcp__nerv__nerv_spec_draft_upsert"
KEY = "CLE-T-DOC"
OLD = "### 옛 결정 (2026-10-18)"
MIRROR_BODY = f"# 문서\n\n## Rationale\n\n{OLD}\n\n본문.\n\n### 날짜 없는 결정\n\n결정일: 2026-11-01\n"


def run_hook(payload, root, env_extra=None):
    env = {k: v for k, v in os.environ.items() if k != "BYPASS_SPEC_HEADING_GUARD"}
    env["CLAUDE_PROJECT_DIR"] = str(root)
    env.update(env_extra or {})
    raw = payload if isinstance(payload, str) else json.dumps(payload)
    return subprocess.run([sys.executable, str(HOOK)], input=raw, text=True,
                          capture_output=True, env=env, timeout=30)


def draft(body, spec_id=KEY, **extra):
    tool_input = {"body_md": body, **extra}
    if spec_id is not None:
        tool_input["spec_id"] = spec_id
    return {"tool_name": TOOL_NAME, "tool_input": tool_input}


class DateHeadingsTest(unittest.TestCase):
    f = staticmethod(spec_heading.date_headings)

    def test_heading_with_date_counts(self):
        body = "## A (2026-10-18)\n### B 2026-11-26 결정\n# C 2025-01-01\n"
        self.assertEqual(len(self.f(body)), 3)

    def test_heading_without_date_and_body_lines_do_not_count(self):
        body = "## A\n\n결정일: 2026-10-18\n\n본문 2026-10-18 에 정했다.\n- 2026-10-18 항목\n"
        self.assertEqual(self.f(body), [])

    def test_up_to_three_spaces_indent_is_heading(self):
        self.assertEqual(len(self.f("   ## A (2026-10-18)\n")), 1)
        self.assertEqual(self.f("    ## A (2026-10-18)\n"), [])  # 4칸이면 코드 블록 줄

    def test_hash_without_space_is_not_heading(self):
        self.assertEqual(self.f("##A 2026-10-18\n#2026-10-18\n"), [])

    def test_digits_around_are_not_dates(self):
        self.assertEqual(self.f("## 버전 12026-10-180\n## 2026-1-1\n"), [])

    def test_fenced_code_ignored(self):
        body = ("```bash\n# 2026-10-18 에 돌린 명령\n```\n"
                "~~~\n## 2026-10-18\n~~~\n"
                "## 바깥 (2026-10-18)\n")
        self.assertEqual(self.f(body), ["## 바깥 (2026-10-18)"])

    def test_fence_closes_only_with_same_char_and_length(self):
        body = ("````\n```\n# 안 2026-10-18\n````\n"   # 짧은 울타리는 닫지 못한다
                "```\n~~~\n# 안 2026-10-18\n```\n"     # 다른 문자는 닫지 못한다
                "# 밖 2026-10-18\n")
        self.assertEqual(self.f(body), ["# 밖 2026-10-18"])

    def test_fence_with_trailing_text_does_not_close(self):
        body = "```\n``` not a close\n# 안 2026-10-18\n```\n"
        self.assertEqual(self.f(body), [])

    def test_unclosed_fence_still_counts_headings_after_it(self):
        body = "## 앞 (2026-10-18)\n```\n## 안 (2026-10-19)\n## 뒤 (2026-10-20)\n"
        self.assertEqual(self.f(body), ["## 앞 (2026-10-18)", "## 안 (2026-10-19)", "## 뒤 (2026-10-20)"])

    def test_backtick_in_info_string_is_not_fence(self):
        self.assertEqual(self.f("``` a`b\n## 밖 (2026-10-18)\n"), ["## 밖 (2026-10-18)"])
        self.assertEqual(self.f("~~~ a`b\n## 안 (2026-10-18)\n~~~\n"), [])

    def test_indented_fences(self):
        body = "   ```\n## 안 (2026-10-18)\n   ```\n## 밖 (2026-10-19)\n"
        self.assertEqual(self.f(body), ["## 밖 (2026-10-19)"])
        body = "    ```\n## 밖 (2026-10-18)\n"  # 4칸이면 울타리가 아니다
        self.assertEqual(self.f(body), ["## 밖 (2026-10-18)"])

    def test_crlf_and_bare_hash(self):
        self.assertEqual(self.f("## A (2026-10-18)\r\n#\r\n##\r\n본문\r\n"), ["## A (2026-10-18)"])

    def test_strip_frontmatter(self):
        self.assertEqual(spec_heading.strip_frontmatter('---\nid: "X"\n---\n## A\n'), "## A\n")
        self.assertEqual(spec_heading.strip_frontmatter("## A\n"), "## A\n")


class BaselineTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        for area in ("CLE-A", "CLE-Z"):
            (self.root / "spec" / area).mkdir(parents=True)
        (self.root / "spec" / "CLE-A" / f"{KEY}.md").write_text(MIRROR_BODY, encoding="utf-8")
        (self.root / "spec" / "CLE-Z" / f"{KEY}.md").write_text("## a (2026-01-01)\n## b (2026-01-02)\n",
                                                               encoding="utf-8")

    def tearDown(self):
        self._tmp.cleanup()

    def base(self, **tool_input):
        return hook.baseline_headings(tool_input, self.root)

    def test_new_doc_is_zero(self):
        for spec_id in (None, "", 3, ["x"]):
            with self.subTest(spec_id=spec_id):
                self.assertEqual(self.base(spec_id=spec_id), [])
        self.assertEqual(self.base(key="CLE-T-NEW"), [])

    def test_key_without_spec_id_uses_mirror(self):
        self.assertEqual(self.base(key=KEY), [OLD])

    def test_duplicate_mirror_takes_first_path(self):
        self.assertEqual(self.base(spec_id=KEY), [OLD])

    def test_unknown_is_none(self):
        self.assertIsNone(self.base(spec_id="01a1dcc3-2ee1-731f-a225-724290a8a858"))
        self.assertIsNone(self.base(spec_id="CLE-T-NOT-MIRRORED"))


class HookTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        area = self.root / "spec" / "CLE-T"
        area.mkdir(parents=True)
        (area / f"{KEY}.md").write_text(f'---\nid: "{KEY}"\n---\n{MIRROR_BODY}', encoding="utf-8")

    def tearDown(self):
        self._tmp.cleanup()

    def test_same_headings_pass(self):
        self.assertEqual(run_hook(draft(MIRROR_BODY), self.root).returncode, 0)

    def test_fewer_headings_pass(self):
        body = MIRROR_BODY.replace(OLD, "### 옛 결정\n\n결정일: 2026-10-18")
        self.assertEqual(run_hook(draft(body), self.root).returncode, 0)

    def test_added_heading_blocks_and_lists_it(self):
        body = MIRROR_BODY + "\n### 새 결정 (2026-11-27)\n\n본문.\n"
        r = run_hook(draft(body), self.root)
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertIn("guard_spec_heading_date", r.stderr)
        self.assertIn(KEY, r.stderr)
        self.assertIn("### 새 결정 (2026-11-27)", r.stderr)
        self.assertNotIn(OLD, r.stderr.split("new:")[1].split("instead:")[0])
        self.assertIn("1개에서 2개", r.stderr)

    def test_duplicated_heading_blocks_and_lists_it(self):
        r = run_hook(draft(MIRROR_BODY + f"\n{OLD}\n"), self.root)
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertIn(OLD, r.stderr.split("new:")[1].split("instead:")[0])

    def test_swapped_heading_same_count_passes(self):
        body = MIRROR_BODY.replace(OLD, "### 다른 결정 (2026-11-27)")
        self.assertEqual(run_hook(draft(body), self.root).returncode, 0)

    def test_listing_caps_at_five(self):
        def added(n):
            return MIRROR_BODY + "".join(f"\n## 새 {i} (2026-11-27)\n" for i in range(n))
        r = run_hook(draft(added(5)), self.root)
        self.assertEqual(r.returncode, 2)
        self.assertIn("## 새 4 (2026-11-27)", r.stderr)
        self.assertNotIn("외", r.stderr.split("new:")[1].split("instead:")[0])
        r = run_hook(draft(added(6)), self.root)
        self.assertIn("## 새 4 (2026-11-27)", r.stderr)
        self.assertNotIn("## 새 5 (2026-11-27)", r.stderr)
        self.assertIn("… 외 1개", r.stderr)

    def test_existing_key_without_spec_id_uses_mirror(self):
        self.assertEqual(run_hook(draft(MIRROR_BODY, spec_id=None, key=KEY), self.root).returncode, 0)

    def test_code_block_heading_added_passes(self):
        body = MIRROR_BODY + "\n```\n# 2026-11-27 로그\n```\n"
        self.assertEqual(run_hook(draft(body), self.root).returncode, 0)

    def test_new_doc_baseline_is_zero(self):
        payload = draft("## 결정 (2026-11-27)\n", spec_id=None, key="CLE-T-NEW", parent_id="CLE-T")
        r = run_hook(payload, self.root)
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertIn("CLE-T-NEW", r.stderr)
        self.assertIn("0개에서 1개", r.stderr)
        self.assertEqual(run_hook(draft("## 결정\n\n결정일: 2026-11-27\n", spec_id=None),
                                  self.root).returncode, 0)

    def test_unknown_baseline_passes(self):
        body = "## 결정 (2026-11-27)\n" * 3
        for spec_id in ("01a1dcc3-2ee1-731f-a225-724290a8a858", "CLE-T-NOT-MIRRORED"):
            with self.subTest(spec_id=spec_id):
                self.assertEqual(run_hook(draft(body, spec_id=spec_id), self.root).returncode, 0)

    def test_no_body_passes(self):
        payload = {"tool_name": TOOL_NAME, "tool_input": {
            "spec_id": KEY, "revert_to_version": 3, "base_hash": "x"}}
        self.assertEqual(run_hook(payload, self.root).returncode, 0)

    def test_body_markdown_field(self):
        payload = {"tool_name": TOOL_NAME, "tool_input": {
            "spec_id": KEY, "body_markdown": MIRROR_BODY + "## 새 (2026-11-27)\n"}}
        self.assertEqual(run_hook(payload, self.root).returncode, 2)

    def test_bypass_only_on_one(self):
        bad = draft(MIRROR_BODY + "## 새 (2026-11-27)\n")
        self.assertEqual(run_hook(bad, self.root, {"BYPASS_SPEC_HEADING_GUARD": "1"}).returncode, 0)
        for value in ("0", "true", "yes", ""):
            with self.subTest(value=value):
                r = run_hook(bad, self.root, {"BYPASS_SPEC_HEADING_GUARD": value})
                self.assertEqual(r.returncode, 2)

    def test_malformed_payload_passes(self):
        for raw in ("", "not json", "[]", json.dumps({"tool_input": "x"})):
            with self.subTest(raw=raw):
                self.assertEqual(run_hook(raw, self.root).returncode, 0)

    def test_runtime_error_fails_open(self):
        probe = (
            "import runpy, sys, pathlib\n"
            "def boom(*a, **k): raise RuntimeError('probe')\n"
            "pathlib.Path.rglob = boom\n"
            f"sys.argv = [{str(HOOK)!r}]\n"
            f"runpy.run_path({str(HOOK)!r}, run_name='__main__')\n"
        )
        r = subprocess.run([sys.executable, "-c", probe], input=json.dumps(draft("## a (2026-11-27)\n")),
                           text=True, capture_output=True, timeout=30,
                           env={**os.environ, "CLAUDE_PROJECT_DIR": str(self.root)})
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("probe", r.stderr)


class RealMirrorTest(unittest.TestCase):
    def test_resaving_real_mirror_docs_passes(self):
        # 날짜 제목이 가장 많은 문서 몇 편을 그대로 다시 저장하는 초안은 막히지 않는다(래칫).
        counted = []
        for path in (_harness.REPO_ROOT / "spec").rglob("CLE-*.md"):
            body = spec_heading.strip_frontmatter(path.read_text(encoding="utf-8"))
            counted.append((len(spec_heading.date_headings(body)), path.stem, body))
        counted = sorted((c for c in counted if c[0] > 0), reverse=True)
        if not counted:
            self.skipTest("날짜 제목이 남은 미러 문서가 없다(옮겨 가기가 끝났다)")
        for _, key, body in counted[:3]:
            with self.subTest(key=key):
                r = run_hook(draft(body, spec_id=key), _harness.REPO_ROOT)
                self.assertEqual(r.returncode, 0, r.stderr)


class SettingsTest(unittest.TestCase):
    def _entry(self):
        data = json.loads(SETTINGS.read_text(encoding="utf-8"))
        for entry in data["hooks"]["PreToolUse"]:
            for h in entry["hooks"]:
                if "guard_spec_heading_date.py" in h["command"]:
                    return entry, h["command"]
        self.fail("guard_spec_heading_date.py 가 PreToolUse 에 등록되지 않았다")

    def test_registered_for_both_tool_names(self):
        entry, _ = self._entry()
        self.assertEqual(set(entry["matcher"].split("|")), {
            "mcp__nerv__nerv_spec_draft_upsert", "mcp__plugin_nerv_nerv__nerv_spec_draft_upsert"})

    def test_registered_command_passes_without_hook_file(self):
        _, command = self._entry()
        with tempfile.TemporaryDirectory() as d:
            r = subprocess.run(["bash", "-c", command], input=json.dumps(draft("## a (2026-11-27)\n")),
                               text=True, capture_output=True, timeout=30,
                               env={**os.environ, "CLAUDE_PROJECT_DIR": d})
        self.assertEqual(r.returncode, 0, r.stderr)


if __name__ == "__main__":
    unittest.main()
