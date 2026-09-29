"""Tests for `.claude/hooks/guard_nerv_owned_paths.py` — NERV 가 정본인 경로의 도구 편집 차단.

NERV 정본 전환 단계 1부터 `spec/` 은 `pull.py` 만 쓰는 미러다(옛 `spec/<영역>/` 트리도 동결).
훅은 실제 서브프로세스로 돌리고 PreToolUse 페이로드를 stdin 으로 넣는다(하네스가 부르는
모양 그대로).

고정하는 것:
- main checkout 과 워크트리 모두 `<루트>/spec/…` 는 exit 2.
- 상대 경로는 페이로드 `cwd` 기준으로 푼다.
- 더 깊은 곳의 `spec` 이름(`codebase/…/spec/…`)과 저장소 밖(scratchpad)은 막지 않는다.
- `review/` · `plan/` 은 아직 막지 않는다 — 거버넌스 문서가 단계 2 · 3 전까지 그 쓰기를
  안내한다. 그 단계 PR 이 이 테스트의 기대를 바꾼다.
- `BYPASS_NERV_OWNED_PATHS=1` 이면 통과. 페이로드가 비거나 깨져도 세션을 막지 않는다.
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

HOOK = _harness.REPO_ROOT / ".claude" / "hooks" / "guard_nerv_owned_paths.py"
SETTINGS = _harness.REPO_ROOT / ".claude" / "settings.json"


class GuardTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        self.tmp = Path(os.path.realpath(tmp))
        self.main = self.tmp / "repo"
        _harness.make_temp_git_repo(self.main)
        self.wt = self.main / ".claude" / "worktrees" / "task-x"
        _harness.git_in(self.main, "worktree", "add", "-q", str(self.wt), "-b", "claude/task-x")

    def run_hook(self, file_path, *, cwd=None, tool="Write", env_extra=None, raw=None):
        payload = raw if raw is not None else json.dumps({
            "tool_name": tool, "cwd": str(cwd or self.main),
            "tool_input": {"file_path": str(file_path)},
        })
        env = dict(os.environ)
        env.pop("BYPASS_NERV_OWNED_PATHS", None)
        env.update(env_extra or {})
        return subprocess.run([sys.executable, str(HOOK)], input=payload, env=env,
                              capture_output=True, text=True)

    def test_spec_is_blocked_in_main_and_worktree(self):
        for root in (self.main, self.wt):
            for rel in ("spec/CLE-VISION.md", "spec/5-system/1-auth.md", "spec/new.md",
                        "spec/CLE-ACCT/CLE-ACCT.md"):
                with self.subTest(root=root.name, rel=rel):
                    r = self.run_hook(root / rel)
                    self.assertEqual(r.returncode, 2, r.stderr)
                    self.assertIn("NERV", r.stderr)

    def test_relative_path_is_resolved_against_the_payload_cwd(self):
        self.assertEqual(self.run_hook("spec/x.md", cwd=self.wt).returncode, 2)
        self.assertEqual(self.run_hook("codebase/x.ts", cwd=self.wt).returncode, 0)

    def test_every_edit_tool_is_checked(self):
        for tool in ("Write", "Edit", "MultiEdit"):
            with self.subTest(tool=tool):
                self.assertEqual(self.run_hook(self.main / "spec/x.md", tool=tool).returncode, 2)
        nb = json.dumps({"tool_name": "NotebookEdit", "cwd": str(self.main),
                         "tool_input": {"notebook_path": str(self.main / "spec/n.ipynb")}})
        self.assertEqual(self.run_hook(None, raw=nb).returncode, 2)

    def test_other_paths_are_allowed(self):
        for target in (self.main / "codebase/frontend/src/lib/spec/x.ts",
                       self.main / ".claude/tools/x.py",
                       self.main / "specs/x.md",
                       self.main / "review/code/2026/SUMMARY.md",   # 단계 2 에서 막는다
                       self.main / "plan/in-progress/x.md",        # 단계 3 에서 막는다
                       self.tmp / "scratch" / "spec" / "x.md"):
            with self.subTest(target=str(target)):
                self.assertEqual(self.run_hook(target).returncode, 0)

    def test_bypass_env(self):
        r = self.run_hook(self.main / "spec/x.md", env_extra={"BYPASS_NERV_OWNED_PATHS": "1"})
        self.assertEqual(r.returncode, 0)

    def test_empty_or_broken_payload_fails_open(self):
        for raw in ("", "{not json", json.dumps({"tool_name": "Write"})):
            with self.subTest(raw=raw[:10]):
                self.assertEqual(self.run_hook(None, raw=raw).returncode, 0)

    def test_wired_for_every_edit_tool_in_settings(self):
        doc = json.loads(SETTINGS.read_text(encoding="utf-8"))
        commands = [
            (entry.get("matcher", ""), hook.get("command", ""))
            for entry in doc["hooks"]["PreToolUse"] for hook in entry.get("hooks", [])
        ]
        wired = [m for m, c in commands if "guard_nerv_owned_paths.py" in c]
        self.assertEqual(len(wired), 1, commands)
        for tool in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
            self.assertIn(tool, wired[0].split("|"))


if __name__ == "__main__":
    unittest.main()
