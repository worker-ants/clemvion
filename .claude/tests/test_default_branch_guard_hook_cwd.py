"""기본 브랜치 가드 훅 세 개가 훅 입력의 `cwd` 로 판정한다.

훅은 main checkout(`$CLAUDE_PROJECT_DIR`)에서 읽히고 훅 프로세스의 작업 디렉터리도 거기다. 세 훅이
`branch_guard.evaluate()` 를 인자 없이 부르던 동안은 그 프로세스 디렉터리로 판정했다. 그래서 앱이 만든
워크트리에서 일하는 세션도 「main worktree on default branch」로 막혔다. 2026-10-10 두 세션
(NERV Task `CLE-T-6SKVRM` 작업 세션, PR #1524 세션)에서 Edit · Write 와 리뷰어 · checker ·
resolution-applier 의 쓰기가 막혔고 UserPromptSubmit 훅도 같은 경고를 냈다(NERV Task `CLE-T-QY5AZ3`).

픽스처는 실제 저장소 두 벌이다. clone 은 기본 브랜치 `main` 을 받은 main checkout 이고(막히는 곳),
그 clone 의 linked worktree 는 다른 브랜치다(막히지 않는 곳). 훅은 서브프로세스로 띄워 프로세스
디렉터리와 입력 `cwd` 를 따로 준다. 판정 함수를 mock 하면 어느 디렉터리를 넘겼는지가 안 보인다.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

import _harness  # noqa: F401  — side effect: puts .claude/hooks on sys.path
from _lib import branch_guard as bg

HOOKS = ("guard_default_branch_edit.py", "guard_default_branch_prompt.py",
         "guard_default_branch_bash.py")

# 훅이 무엇을 보는지(작업 요청 · 파일 쓰기 · 상태를 바꾸는 명령)는 이 테스트의 관심이 아니다. 세 훅
# 모두 「막는 곳이면 반응한다」는 조건을 채우는 입력을 준다.
_PAYLOAD_BODY = {
    "guard_default_branch_edit.py": {"tool_name": "Write", "tool_input": {"file_path": "x.txt"}},
    "guard_default_branch_prompt.py": {"prompt": "기능을 구현해줘"},
    "guard_default_branch_bash.py": {"tool_input": {"command": "mkdir foo"}},
}


class _Fixture(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = os.path.realpath(tempfile.mkdtemp())
        origin = _harness.make_temp_git_repo(os.path.join(cls.tmp, "origin"))
        cls.main = os.path.join(cls.tmp, "main")
        _harness.git_in(cls.tmp, "clone", "-q", str(origin), cls.main)
        cls.worktree = os.path.join(cls.tmp, "wt")
        _harness.git_in(cls.main, "worktree", "add", "-q", "-b", "claude/x", cls.worktree)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def setUp(self):
        # 공허 방지: 픽스처가 두 판정을 실제로 가른다. 갈리지 않으면 아래 단언은 무엇도 증명하지 않는다.
        self.assertTrue(bg.evaluate(self.main).blocked, "clone 이 main checkout 의 기본 브랜치가 아니다")
        self.assertFalse(bg.evaluate(self.worktree).blocked, "worktree 가 막히는 곳으로 판정된다")

    def run_hook(self, hook: str, *, process_cwd: str, stdin: str | bytes) -> subprocess.CompletedProcess:
        env = {k: v for k, v in os.environ.items()
               if k != "BYPASS_DEFAULT_BRANCH_GUARD" and not k.startswith("GIT_")}
        # bash 훅의 세션당 1회 표식이 실제 저장소의 `.claude/state` 에 남지 않게 한다.
        env["CLAUDE_PROJECT_DIR"] = self.tmp
        # Python 은 UTF-8 로캘에서 stdin 을 strict 로, C 로캘에서 surrogateescape 로 읽는다. UTF-8 이 아닌
        # 입력이 UnicodeDecodeError 를 내는 쪽(strict)으로 고정해야 로캘과 상관없이 같은 경로를 잰다.
        env["PYTHONIOENCODING"] = "utf-8:strict"
        # 바이트로 보낸다. UTF-8 이 아닌 입력을 그대로 넣으려면 text 모드를 쓸 수 없다.
        raw = stdin.encode("utf-8") if isinstance(stdin, str) else stdin
        proc = subprocess.run([sys.executable, str(_harness.HOOKS_DIR / hook)], input=raw,
                              cwd=process_cwd, env=env, capture_output=True, timeout=60)
        return subprocess.CompletedProcess(proc.args, proc.returncode,
                                           proc.stdout.decode("utf-8", "replace"),
                                           proc.stderr.decode("utf-8", "replace"))

    def payload(self, hook: str, **extra) -> str:
        return json.dumps({**_PAYLOAD_BODY[hook], **extra})

    def assertFires(self, hook: str, proc: subprocess.CompletedProcess):
        if hook == "guard_default_branch_edit.py":
            self.assertEqual(proc.returncode, 2, proc.stderr)
            self.assertIn("BLOCKED", proc.stderr)
        else:
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertIn("<system-reminder>", proc.stdout)

    def assertSilent(self, hook: str, proc: subprocess.CompletedProcess):
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(proc.stdout, "")


class InputCwdDecidesTest(_Fixture):
    def test_worktree_cwd_passes_even_when_the_process_sits_on_the_default_branch(self):
        # 사고의 모양 그대로다. 고치기 전에는 edit 가 막고 prompt · bash 가 경고했다.
        for hook in HOOKS:
            with self.subTest(hook=hook):
                proc = self.run_hook(hook, process_cwd=self.main,
                                     stdin=self.payload(hook, cwd=self.worktree))
                self.assertSilent(hook, proc)

    def test_default_branch_cwd_fires_even_when_the_process_sits_in_a_worktree(self):
        # 반대 방향이다. 입력이 막히는 곳을 가리키면 프로세스 디렉터리가 어디든 막는다.
        for hook in HOOKS:
            with self.subTest(hook=hook):
                proc = self.run_hook(hook, process_cwd=self.worktree,
                                     stdin=self.payload(hook, cwd=self.main))
                self.assertFires(hook, proc)


class ProcessCwdFallbackTest(_Fixture):
    def test_without_cwd_the_process_directory_decides(self):
        for hook in HOOKS:
            with self.subTest(hook=hook, process="main"):
                self.assertFires(hook, self.run_hook(hook, process_cwd=self.main,
                                                     stdin=self.payload(hook)))
            with self.subTest(hook=hook, process="worktree"):
                self.assertSilent(hook, self.run_hook(hook, process_cwd=self.worktree,
                                                      stdin=self.payload(hook)))

    def test_empty_or_non_string_cwd_falls_back_to_the_process_directory(self):
        for hook in HOOKS:
            for bad in ("", None, 123, ["/x"]):
                with self.subTest(hook=hook, cwd=bad, process="main"):
                    self.assertFires(hook, self.run_hook(hook, process_cwd=self.main,
                                                         stdin=self.payload(hook, cwd=bad)))
                with self.subTest(hook=hook, cwd=bad, process="worktree"):
                    self.assertSilent(hook, self.run_hook(hook, process_cwd=self.worktree,
                                                          stdin=self.payload(hook, cwd=bad)))


class UnreadableInputTest(_Fixture):
    """입력을 읽지 못하면 고치기 전과 같다. 판정은 프로세스 디렉터리이고 입력이 없는 것처럼 다룬다."""

    def test_broken_json_keeps_the_previous_behaviour(self):
        # `b"\xff"` 는 UTF-8 로 읽히지 않는다. 고치기 전 edit 훅은 막는 곳에서만 입력을 읽었고 strict
        # 로 읽으면 UnicodeDecodeError 로 죽어 통과시켰다(exit 1). 지금은 입력이 없는 것처럼 막는다.
        for stdin in ("{not json", "", b"\xff"):
            with self.subTest(stdin=stdin):
                # edit 는 대상을 몰라도 막는다. prompt · bash 는 볼 문장 · 명령이 없어 조용하다.
                proc = self.run_hook("guard_default_branch_edit.py", process_cwd=self.main, stdin=stdin)
                self.assertFires("guard_default_branch_edit.py", proc)
                self.assertIn("(unknown tool) on (target unknown)", proc.stderr)
                for hook in ("guard_default_branch_prompt.py", "guard_default_branch_bash.py"):
                    self.assertSilent(hook, self.run_hook(hook, process_cwd=self.main, stdin=stdin))
                for hook in HOOKS:
                    self.assertSilent(hook, self.run_hook(hook, process_cwd=self.worktree, stdin=stdin))

    def test_json_that_is_not_an_object_reads_as_an_empty_payload(self):
        for stdin in ("[]", '"x"', "3"):
            with self.subTest(stdin=stdin):
                proc = self.run_hook("guard_default_branch_edit.py", process_cwd=self.main, stdin=stdin)
                self.assertFires("guard_default_branch_edit.py", proc)
                for hook in HOOKS:
                    self.assertSilent(hook, self.run_hook(hook, process_cwd=self.worktree, stdin=stdin))


class HookCwdTest(unittest.TestCase):
    """세 훅이 입력에서 판정 디렉터리를 꺼내는 규칙. 한 곳에 두어 셋이 갈리지 않게 한다."""

    def test_only_a_non_empty_string_is_taken(self):
        self.assertEqual(bg.hook_cwd({"cwd": "/w"}), "/w")
        for payload in ({}, {"cwd": ""}, {"cwd": None}, {"cwd": 0}, {"cwd": ["/w"]}, {"cwd": {"p": "/w"}}):
            with self.subTest(payload=payload):
                self.assertIsNone(bg.hook_cwd(payload))

    def test_a_payload_that_is_not_a_dict_has_no_cwd(self):
        for payload in (None, [], "cwd", 3):
            with self.subTest(payload=payload):
                self.assertIsNone(bg.hook_cwd(payload))


if __name__ == "__main__":
    unittest.main()
