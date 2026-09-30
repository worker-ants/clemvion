"""Tests for `.claude/hooks/guard_nerv_owned_paths.py` — NERV 가 정본인 경로의 도구 편집 차단.

NERV 정본 전환 단계 1부터 `spec/` 은 `pull.py` 만 쓰는 미러다(옛 `spec/<영역>/` 트리도 동결).
훅은 실제 서브프로세스로 돌리고 PreToolUse 페이로드를 stdin 으로 넣는다(하네스가 부르는
모양 그대로).

고정하는 것:
- main checkout 과 워크트리 모두 `<루트>/spec/…` 는 exit 2. 실제 저장소에서도 그렇다(표지 파일이
  옮겨지면 훅이 조용히 꺼지므로 실제 저장소의 표지를 따로 본다).
- 상대 경로는 페이로드 `cwd` 기준으로 푼다. `..` 와 심볼릭 링크는 풀어서 판정한다.
  첫 경로 조각은 대소문자를 무시한다(macOS 기본 APFS 에서 `SPEC/` 은 `spec/` 과 같은 폴더).
- 표지 파일(`.claude/tools/nerv-mirror/pull.py`)이 없는 다른 git 저장소의 `spec/` 은 막지 않는다.
- 더 깊은 곳의 `spec` 이름(`codebase/…/spec/…`)과 저장소 밖(scratchpad)은 막지 않는다.
- `review/` · `plan/` 은 아직 막지 않는다. 거버넌스 문서가 단계 2 · 3 전까지 그 쓰기를
  안내한다. 그 단계 PR 이 이 테스트의 기대를 바꾼다.
- `BYPASS_NERV_OWNED_PATHS=1` 이면 통과(다른 값은 우회가 아니다).
- fail-open: 모양이 틀린 페이로드(최상위 · `tool_input` · 경로 값)는 조용히 통과하고, 예상 밖
  런타임 오류도 exit 0 이다(traceback 은 stderr 에 남긴다). exit 2 는 차단이라 오류에서 내면 안 된다.
- `settings.json` 의 등록 명령은 훅 파일이 없는 `$CLAUDE_PROJECT_DIR` 에서 exit 0 이다.
  pull 하지 않은 main checkout 에서 python 이 "can't open file" 로 exit 2 를 내면 모든 편집이
  막힌다(2026-10-01 실측, Task `CLE-T-VA4YA1` 작업 세션).
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
hook = _harness.load_module_by_path("guard_nerv_owned_paths_under_test", HOOK)
MARKER = hook.MARKER

# 훅 모듈을 `__main__` 으로 돌리되 `json.loads` 가 예상 밖 오류를 내게 한다. 조기 반환 경로가
# 아니라 `except Exception` 분기를 밟는 유일한 결정적 방법이다.
RUNTIME_ERROR_PROBE = """
import json, runpy, sys
def boom(*a, **k):
    raise RuntimeError("probe")
json.loads = boom
runpy.run_path(sys.argv[1], run_name="__main__")
"""


def _registered_command() -> tuple[str, str]:
    """(matcher, command) — 이 훅을 부르는 PreToolUse 등록 하나."""
    doc = json.loads(SETTINGS.read_text(encoding="utf-8"))
    wired = [
        (entry.get("matcher", ""), h.get("command", ""))
        for entry in doc["hooks"]["PreToolUse"] for h in entry.get("hooks", [])
        if "guard_nerv_owned_paths.py" in h.get("command", "")
    ]
    assert len(wired) == 1, wired
    return wired[0]


class GuardTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        self.tmp = Path(os.path.realpath(tmp))
        self.main = self.tmp / "repo"
        _harness.make_temp_git_repo(self.main)
        marker = self.main / MARKER
        marker.parent.mkdir(parents=True)
        marker.write_text("# marker\n", encoding="utf-8")
        _harness.git_in(self.main, "add", str(MARKER))
        _harness.git_in(self.main, "commit", "-q", "-m", "marker")
        self.wt = self.main / ".claude" / "worktrees" / "task-x"
        _harness.git_in(self.main, "worktree", "add", "-q", str(self.wt), "-b", "claude/task-x")

    def payload(self, file_path, *, cwd=None, tool="Write"):
        return json.dumps({
            "tool_name": tool, "cwd": str(cwd or self.main),
            "tool_input": {"file_path": str(file_path)},
        })

    def run_hook(self, file_path=None, *, cwd=None, tool="Write", env_extra=None, raw=None):
        payload = raw if raw is not None else self.payload(file_path, cwd=cwd, tool=tool)
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
                    self.assertIn("source_paths", r.stderr)  # 옛 경로에서 키를 찾는 법

    def test_the_real_repository_is_guarded(self):
        # 표지(미러 도구)를 옮기면 훅이 조용히 꺼진다. 실제 저장소에서 표지와 차단을 함께 본다.
        self.assertTrue((_harness.REPO_ROOT / MARKER).is_file(), "표지 파일이 옮겨졌다 — 훅의 MARKER 도 고친다")
        r = self.run_hook(_harness.REPO_ROOT / "spec" / "CLE-VISION.md", cwd=_harness.REPO_ROOT)
        self.assertEqual(r.returncode, 2, r.stderr)

    def test_relative_path_is_resolved_against_the_payload_cwd(self):
        self.assertEqual(self.run_hook("spec/x.md", cwd=self.wt).returncode, 2)
        self.assertEqual(self.run_hook("codebase/x.ts", cwd=self.wt).returncode, 0)

    def test_dot_dot_segments_are_resolved_before_judging(self):
        # 하위 폴더에서 `../spec/…` 를 쓰는 것이 에이전트가 실제로 만드는 모양이다.
        # 정규화하지 않으면 첫 조각이 `codebase` 라 통과한다.
        self.assertEqual(self.run_hook("../spec/x.md", cwd=self.wt / "codebase").returncode, 2)
        self.assertEqual(self.run_hook(f"{self.wt}/codebase/../spec/x.md").returncode, 2)
        self.assertEqual(self.run_hook(f"{self.wt}/spec/../codebase/x.ts").returncode, 0)

    def test_case_and_symlinks_do_not_slip_past(self):
        for rel in ("SPEC/x.md", "Spec/x.md"):
            with self.subTest(rel=rel):
                self.assertEqual(self.run_hook(self.main / rel).returncode, 2)
        (self.main / "spec").mkdir()
        (self.main / "docs").symlink_to(self.main / "spec")
        self.assertEqual(self.run_hook(self.main / "docs" / "x.md").returncode, 2)

    def test_other_repositories_are_not_this_guards_business(self):
        other = self.tmp / "other-repo"
        _harness.make_temp_git_repo(other)
        self.assertEqual(self.run_hook(other / "spec" / "x.md").returncode, 0)
        # 표지만 심으면 같은 경로가 막힌다 — 통과가 표지 때문임을 보인다.
        (other / MARKER).parent.mkdir(parents=True)
        (other / MARKER).write_text("", encoding="utf-8")
        self.assertEqual(self.run_hook(other / "spec" / "x.md").returncode, 2)

    def test_every_edit_tool_is_checked(self):
        for tool in ("Write", "Edit", "MultiEdit"):
            with self.subTest(tool=tool):
                self.assertEqual(self.run_hook(self.main / "spec/x.md", tool=tool).returncode, 2)
        nb = json.dumps({"tool_name": "NotebookEdit", "cwd": str(self.main),
                         "tool_input": {"notebook_path": str(self.main / "spec/n.ipynb")}})
        self.assertEqual(self.run_hook(raw=nb).returncode, 2)
        alias = json.dumps({"tool_name": "Write", "cwd": str(self.main),
                            "input": {"file_path": str(self.main / "spec/x.md")}})
        self.assertEqual(self.run_hook(raw=alias).returncode, 2)

    def test_other_paths_are_allowed(self):
        for target in (self.main / "codebase/frontend/src/lib/spec/x.ts",
                       self.main / ".claude/tools/x.py",
                       self.main / "specs/x.md",
                       self.main / "review/code/2026/SUMMARY.md",   # 단계 2 에서 막는다
                       self.main / "plan/in-progress/x.md",        # 단계 3 에서 막는다
                       self.tmp / "scratch" / "spec" / "x.md"):
            with self.subTest(target=str(target)):
                self.assertEqual(self.run_hook(target).returncode, 0)

    def test_bypass_env_is_exactly_one(self):
        target = self.main / "spec/x.md"
        self.assertEqual(
            self.run_hook(target, env_extra={"BYPASS_NERV_OWNED_PATHS": "1"}).returncode, 0)
        self.assertEqual(
            self.run_hook(target, env_extra={"BYPASS_NERV_OWNED_PATHS": "0"}).returncode, 2)

    def test_malformed_payloads_pass_quietly(self):
        spec_path = str(self.main / "spec/x.md")
        malformed = (
            "", "{not json", "[]", "null", json.dumps({"tool_name": "Write"}),
            json.dumps({"tool_input": "x"}),
            json.dumps({"tool_input": ["x"]}),
            json.dumps({"tool_input": {"file_path": 5}}),
            json.dumps({"tool_input": {"file_path": [spec_path]}}),
            json.dumps({"tool_input": {"file_path": spec_path + "\x00"}}),
            json.dumps({"tool_input": {"path": spec_path}}),  # 편집 도구가 쓰지 않는 키
        )
        for raw in malformed:
            with self.subTest(raw=raw[:30]):
                r = self.run_hook(raw=raw)
                self.assertEqual(r.returncode, 0, r.stderr)
                # 모양이 틀린 페이로드는 런타임 오류가 아니라 "대상 없음" 이다(traceback 없음).
                self.assertEqual(r.stderr, "")
        # `cwd` 가 문자열이 아니면 프로세스 cwd 로 푼다(상대 경로 판정은 그대로 한다).
        odd_cwd = json.dumps({"cwd": 5, "tool_input": {"file_path": "spec/x.md"}})
        r = subprocess.run([sys.executable, str(HOOK)], input=odd_cwd, cwd=self.main,
                           capture_output=True, text=True,
                           env={k: v for k, v in os.environ.items() if k != "BYPASS_NERV_OWNED_PATHS"})
        self.assertEqual(r.returncode, 2, r.stderr)

    def test_runtime_errors_fail_open(self):
        # 이 PR 을 부른 사고가 "훅이 exit 2 로 죽어 모든 편집이 막힘" 이다. 예상 밖 오류는 통과시킨다.
        env = {k: v for k, v in os.environ.items() if k != "BYPASS_NERV_OWNED_PATHS"}
        r = subprocess.run([sys.executable, "-c", RUNTIME_ERROR_PROBE, str(HOOK)],
                           input=self.payload(self.main / "spec/x.md"), env=env,
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("RuntimeError: probe", r.stderr)

    def test_wired_for_every_edit_tool_in_settings(self):
        matcher, _ = _registered_command()
        for tool in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
            self.assertIn(tool, matcher.split("|"))

    def test_registered_command_passes_when_the_hook_file_is_missing(self):
        _, command = _registered_command()
        target = self.main / "spec/x.md"

        def run(project_dir):
            env = dict(os.environ, CLAUDE_PROJECT_DIR=str(project_dir))
            env.pop("BYPASS_NERV_OWNED_PATHS", None)
            return subprocess.run(["bash", "-c", command], input=self.payload(target),
                                  env=env, capture_output=True, text=True)

        missing = run(self.tmp / "stale-main-checkout")
        self.assertEqual(missing.returncode, 0, missing.stderr)
        present = run(_harness.REPO_ROOT)
        self.assertEqual(present.returncode, 2, present.stderr)


if __name__ == "__main__":
    unittest.main()
