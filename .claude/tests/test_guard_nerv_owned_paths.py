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
- 단계 2(NERV Task `CLE-T-4ABTG7`)부터 `review/` 도 막는다. 리뷰 결과는 NERV 레코드이고
  오케스트레이터 산출물은 gitignore 대상 `.review/` 에 쓴다(그 경로는 막지 않는다).
- 단계 3(NERV Task `CLE-T-FN2JWK`)부터 `plan/` 도 막는다. 작업 추적은 NERV Task 이고 옛 `plan/`
  · `review/` 는 그 단계에서 지웠다. 두 차단은 지운 트리가 다시 생기지 않게 한다.
- `BYPASS_NERV_OWNED_PATHS=1` 이면 통과(다른 값은 우회가 아니다).
- 경로 키는 형제 훅과 같은 `file_path` · `path` · `notebook_path`(`tool_input` 또는 `input`)다.
- 짝 없는 서로게이트가 든 경로도 판정한다. 파일 시스템에 넘기지 못하는 문자라 예외가 나면
  fail-open 으로 통과했다(2026-10-01 보안 리뷰 실측).
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
hook_module = _harness.load_module_by_path("guard_nerv_owned_paths_under_test", HOOK)
MARKER = hook_module.MARKER

# 훅 모듈을 `__main__` 으로 돌리되 `json.loads` 가 예상 밖 오류를 내게 한다. 조기 반환 경로가
# 아니라 `except Exception` 분기를 밟는 결정적 방법 한 가지다. 훅이 페이로드를 `json.loads` 로
# 읽는다는 구현에 기댄다. 훅이 읽는 방법을 바꾸면 이 프로브도 바꾼다.
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


def _clean_env(**extra) -> dict:
    """우회 변수가 없는 환경. 테스트를 돌리는 셸에 우회가 켜져 있어도 판정을 본다."""
    env = {k: v for k, v in os.environ.items() if k != "BYPASS_NERV_OWNED_PATHS"}
    env.update(extra)
    return env


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

    def run_hook(self, file_path=None, *, cwd=None, tool="Write", env_extra=None, raw=None,
                 proc_cwd=None):
        payload = raw if raw is not None else self.payload(file_path, cwd=cwd, tool=tool)
        return subprocess.run([sys.executable, str(HOOK)], input=payload, cwd=proc_cwd,
                              env=_clean_env(**(env_extra or {})), capture_output=True, text=True)

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

    def test_review_is_blocked_and_the_local_artifact_root_is_not(self):
        for root in (self.main, self.wt):
            with self.subTest(root=root.name):
                r = self.run_hook(root / "review/code/2026/10/01/00_00_00/SUMMARY.md")
                self.assertEqual(r.returncode, 2, r.stderr)
                self.assertIn("nerv_review_submit", r.stderr)
                self.assertIn(".review/", r.stderr)
                self.assertEqual(self.run_hook("REVIEW/x.md", cwd=root).returncode, 2)
                for rel in (".review/code/2026/10/01/00_00_00/security.md",
                            ".review/consistency/2026/10/01/00_00_00/SUMMARY.md"):
                    self.assertEqual(self.run_hook(root / rel).returncode, 0, rel)

    def test_plan_is_blocked_from_stage_3(self):
        for root in (self.main, self.wt):
            with self.subTest(root=root.name):
                r = self.run_hook(root / "plan/in-progress/x.md")
                self.assertEqual(r.returncode, 2, r.stderr)
                self.assertIn("nerv_task_create", r.stderr)
                self.assertEqual(self.run_hook("PLAN/x.md", cwd=root).returncode, 2)

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
        # 형제 훅과 같은 키 집합. `path` 도 막는 쪽으로 읽는다.
        path_key = json.dumps({"tool_name": "Write", "cwd": str(self.main),
                               "tool_input": {"path": str(self.main / "spec/x.md")}})
        self.assertEqual(self.run_hook(raw=path_key).returncode, 2)

    def test_lone_surrogates_do_not_fail_open(self):
        # Python 은 이 문자가 든 경로를 파일 시스템에 넘기지 못한다. 예외가 나면 fail-open 이다.
        for rel in ("spec/\ud800/x.md", "spec/CLE-X\udfff.md"):
            with self.subTest(rel=ascii(rel)):
                r = self.run_hook(raw=json.dumps({"tool_name": "Write", "cwd": str(self.main),
                                                  "tool_input": {"file_path": f"{self.main}/{rel}"}}))
                self.assertEqual(r.returncode, 2, r.stderr)
        r = self.run_hook(raw=json.dumps({"tool_name": "Write", "cwd": f"{self.main}/\ud800/..",
                                          "tool_input": {"file_path": "spec/x.md"}}))
        self.assertEqual(r.returncode, 2, r.stderr)
        # 링크 폴더를 거쳐도 판정한다. 치환 없이 경로를 모양으로만 보면 첫 조각이 `docs` 라 통과한다.
        (self.main / "spec").mkdir()
        (self.main / "docs").symlink_to(self.main / "spec")
        r = self.run_hook(raw=json.dumps({"tool_name": "Write", "cwd": str(self.main),
                                          "tool_input": {"file_path": f"{self.main}/docs/\ud800.md"}}))
        self.assertEqual(r.returncode, 2, r.stderr)

    def test_other_paths_are_allowed(self):
        for target in (self.main / "codebase/frontend/src/lib/spec/x.ts",
                       self.main / ".claude/tools/x.py",
                       self.main / "specs/x.md",
                       self.main / "plans/x.md",                   # 첫 조각이 `plan` 이 아니다
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
        )
        for raw in malformed:
            with self.subTest(raw=raw[:30]):
                r = self.run_hook(raw=raw)
                self.assertEqual(r.returncode, 0, r.stderr)
                # 모양이 틀린 페이로드는 런타임 오류가 아니라 "대상 없음" 이다(traceback 없음).
                self.assertEqual(r.stderr, "")

    def test_non_string_cwd_falls_back_to_process_cwd(self):
        # 페이로드 `cwd` 가 문자열이 아니면 훅 프로세스의 cwd 로 푼다. 상대 경로 판정은 그대로 한다.
        odd_cwd = json.dumps({"cwd": 5, "tool_input": {"file_path": "spec/x.md"}})
        self.assertEqual(self.run_hook(raw=odd_cwd, proc_cwd=self.main).returncode, 2)
        self.assertEqual(self.run_hook(raw=odd_cwd, proc_cwd=self.tmp).returncode, 0)

    def test_runtime_errors_fail_open(self):
        # 2026-10-01 사고는 "훅이 exit 2 로 죽어 모든 편집이 막힘" 이었다. 예상 밖 오류는 통과시킨다.
        r = subprocess.run([sys.executable, "-c", RUNTIME_ERROR_PROBE, str(HOOK)],
                           input=self.payload(self.main / "spec/x.md"), env=_clean_env(),
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("RuntimeError: probe", r.stderr,
                      "프로브가 훅의 읽기 경로를 밟지 못했다 — 훅이 json.loads 로 읽는지 본다")

    def test_wired_for_every_edit_tool_in_settings(self):
        matcher, _ = _registered_command()
        for tool in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
            self.assertIn(tool, matcher.split("|"))

    def test_registered_command_passes_when_the_hook_file_is_missing(self):
        _, command = _registered_command()
        target = self.main / "spec/x.md"

        def run(project_dir):
            return subprocess.run(["bash", "-c", command], input=self.payload(target),
                                  env=_clean_env(CLAUDE_PROJECT_DIR=str(project_dir)),
                                  capture_output=True, text=True)

        missing = run(self.tmp / "stale-main-checkout")
        self.assertEqual(missing.returncode, 0, missing.stderr)
        present = run(_harness.REPO_ROOT)
        self.assertEqual(present.returncode, 2, present.stderr)


class RetiredReviewTreeIgnoreTest(unittest.TestCase):
    """실제 `.gitignore` 가 루트의 옛 `review/` 잔재만 무시하는지 본다.

    단계 3 에서 처음 넣은 `review/` 는 앞에 `/` 가 없어 저장소 어느 깊이의 `review` 디렉터리든
    무시했다(코드 리뷰 여섯 역할이 같은 지적, 2026-10-02). 나중에 `codebase/**/review/` 모듈이나
    라우트를 만들면 `git add` 가 말없이 건너뛰고 push 게이트도 그 변경을 보지 못한다.
    """

    def setUp(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        self.repo = _harness.make_temp_git_repo(Path(os.path.realpath(tmp)) / "repo")
        shutil.copy(_harness.REPO_ROOT / ".gitignore", self.repo / ".gitignore")

    def ignored(self, rel):
        # 사용자 전역 ignore 는 끈다. 그 덕에 초록이 되면 다른 머신에서 깨진다.
        r = _harness.git_in(self.repo, "-c", "core.excludesFile=/dev/null",
                            "check-ignore", "-q", rel, check=False)
        self.assertIn(r.returncode, (0, 1), r.stderr)
        return r.returncode == 0

    def test_root_leftovers_are_ignored(self):
        for rel in ("review/code/2026/10/01/00_00_00/_prompts/security.md",
                    "review/consistency/2026/10/01/00_00_00/SUMMARY.md",
                    ".review/code/2026/10/02/00_00_00/SUMMARY.md"):
            with self.subTest(rel=rel):
                self.assertTrue(self.ignored(rel))

    def test_a_nested_review_directory_is_not_ignored(self):
        for rel in ("codebase/frontend/src/app/review/page.tsx",
                    "codebase/backend/src/modules/review/review.service.ts",
                    "spec/review/x.md"):
            with self.subTest(rel=rel):
                self.assertFalse(self.ignored(rel), f"{rel} 가 무시된다 — 패턴이 루트에 고정되지 않았다")


if __name__ == "__main__":
    unittest.main()
