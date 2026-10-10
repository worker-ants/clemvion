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

import ast
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

import _harness  # noqa: F401  — side effect: puts .claude/hooks on sys.path
from _lib import branch_guard as bg
from _lib import hook_input

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
        # 저장소 밖 디렉터리를 주는 케이스가 위쪽 어딘가의 저장소를 찾아 그것으로 판정되지 않게 한다.
        env["GIT_CEILING_DIRECTORIES"] = self.tmp
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


class UnusableCwdTest(_Fixture):
    """`cwd` 가 문자열이지만 판정에 쓸 수 없는 경우(없는 경로 · 디렉터리가 아님 · 상대 경로)는 프로세스 디렉터리로 판정한다.

    그대로 넘기면 `evaluate()` 가 들어갈 수 없는 디렉터리에서 git 을 돌려 「저장소 밖」으로 통과시킨다. 세션의
    작업 트리가 지워진 뒤처럼 위치를 잃은 순간에 보호가 조용해지므로, 고치기 전과 같은 쪽(프로세스 디렉터리)으로
    되돌린다. 실제 디렉터리인데 저장소 밖이면 판정할 기본 브랜치가 없으니 통과한다.
    """

    def assertJudgedByTheProcessDirectory(self, hook: str, cwd: str, *, main: bool = True, worktree: bool = True):
        if main:
            with self.subTest(hook=hook, cwd=cwd, process="main"):
                self.assertFires(hook, self.run_hook(hook, process_cwd=self.main,
                                                     stdin=self.payload(hook, cwd=cwd)))
        if worktree:
            with self.subTest(hook=hook, cwd=cwd, process="worktree"):
                self.assertSilent(hook, self.run_hook(hook, process_cwd=self.worktree,
                                                      stdin=self.payload(hook, cwd=cwd)))

    def test_a_cwd_that_does_not_exist_is_judged_by_the_process_directory(self):
        gone = os.path.join(self.tmp, "deleted-worktree")
        self.assertFalse(os.path.exists(gone))
        for hook in HOOKS:
            self.assertJudgedByTheProcessDirectory(hook, gone)

    def test_a_cwd_that_is_a_file_is_judged_by_the_process_directory(self):
        # linked worktree 의 `.git` 은 디렉터리가 아니라 `gitdir: ...` 한 줄짜리 파일이다.
        a_file = os.path.join(self.worktree, ".git")
        self.assertTrue(os.path.isfile(a_file))
        for hook in HOOKS:
            self.assertJudgedByTheProcessDirectory(hook, a_file)

    def test_a_relative_cwd_is_judged_by_the_process_directory_not_resolved_against_it(self):
        # 상대 경로를 프로세스 디렉터리 기준으로 풀면 `../wt` 는 main 에서 worktree 를, `../main` 은 worktree 에서
        # main 을 가리킨다. 풀지 않으니 두 방향 모두 프로세스 디렉터리의 판정이 나온다.
        self.assertTrue(os.path.samefile(os.path.join(self.main, "..", "wt"), self.worktree))
        for hook in HOOKS:
            with self.subTest(hook=hook, cwd="../wt", process="main"):
                self.assertFires(hook, self.run_hook(hook, process_cwd=self.main,
                                                     stdin=self.payload(hook, cwd="../wt")))
            with self.subTest(hook=hook, cwd="../main", process="worktree"):
                self.assertSilent(hook, self.run_hook(hook, process_cwd=self.worktree,
                                                      stdin=self.payload(hook, cwd="../main")))

    def test_an_existing_directory_outside_any_repository_is_allowed(self):
        outside = os.path.join(self.tmp, "outside")
        os.makedirs(outside, exist_ok=True)
        for hook in HOOKS:
            with self.subTest(hook=hook):
                # 프로세스는 막는 곳에 있다. 폴백했다면 여기서 막는다.
                self.assertSilent(hook, self.run_hook(hook, process_cwd=self.main,
                                                      stdin=self.payload(hook, cwd=outside)))


class UnreadableInputTest(_Fixture):
    """입력을 읽지 못하면 입력이 없는 것처럼 다룬다. 판정은 프로세스 디렉터리가 한다.

    세 훅 모두 같은 규칙이다(`hook_input.read_payload`). 대부분은 고치기 전에도 이렇게 동작했고, UTF-8 이 아닌
    입력만 달라졌다. 그 케이스는 바뀐 동작이라 따로 이름을 붙였다.
    """

    def assertReadsAsNoInput(self, stdin: str | bytes):
        """입력이 없는 것과 같은 결과다. 프로세스가 막는 곳(main)에 있으면 edit 만 막고, 아니면 셋 다 조용하다.

        세 훅을 막는 곳에서 모두 돌린다. 막지 않는 곳에서는 훅이 입력의 나머지를 보기 전에 끝나서, 읽은 값이
        객체가 아닐 때의 방어가 있어도 없어도 같은 결과가 나온다.
        """
        # edit 는 무엇을 고치려는지 몰라도 막는다. prompt · bash 는 볼 문장 · 명령이 없어 조용하다.
        edit = "guard_default_branch_edit.py"
        proc = self.run_hook(edit, process_cwd=self.main, stdin=stdin)
        self.assertFires(edit, proc)
        self.assertIn("(unknown tool) on (target unknown)", proc.stderr)
        for hook in ("guard_default_branch_prompt.py", "guard_default_branch_bash.py"):
            self.assertSilent(hook, self.run_hook(hook, process_cwd=self.main, stdin=stdin))
        for hook in HOOKS:
            self.assertSilent(hook, self.run_hook(hook, process_cwd=self.worktree, stdin=stdin))

    def test_empty_or_unparsable_input_is_judged_by_the_process_directory(self):
        for stdin in ("{not json", ""):
            with self.subTest(stdin=stdin):
                self.assertReadsAsNoInput(stdin)

    def test_non_utf8_input_is_now_read_as_empty_not_a_crash(self):
        # 바뀐 동작이다. `b"\xff"` 는 UTF-8 로 읽히지 않는다. 고치기 전 edit 훅은 막는 곳에서만 입력을 읽었고 strict
        # 로 읽으면 UnicodeDecodeError 로 죽어 통과시켰다(exit 1). 지금은 입력이 없는 것처럼 읽어 막는다.
        self.assertReadsAsNoInput(b"\xff")

    def test_json_that_is_not_an_object_reads_as_an_empty_payload(self):
        for stdin in ("[]", '"x"', "3"):
            with self.subTest(stdin=stdin):
                self.assertReadsAsNoInput(stdin)


class HookInputTest(unittest.TestCase):
    """세 훅이 입력을 읽고 판정 디렉터리를 꺼내는 규칙. `_lib/hook_input.py` 한 곳에 두어 셋이 갈리지 않게 한다."""

    def test_only_a_non_empty_string_is_taken(self):
        here = os.path.dirname(os.path.abspath(__file__))
        self.assertEqual(hook_input.payload_cwd({"cwd": here}), here)
        for payload in ({}, {"cwd": ""}, {"cwd": None}, {"cwd": 0}, {"cwd": [here]}, {"cwd": {"p": here}}):
            with self.subTest(payload=payload):
                self.assertIsNone(hook_input.payload_cwd(payload))

    def test_a_payload_that_is_not_a_dict_has_no_cwd(self):
        for payload in (None, [], "cwd", 3):
            with self.subTest(payload=payload):
                self.assertIsNone(hook_input.payload_cwd(payload))

    def test_a_cwd_that_cannot_be_judged_is_not_taken(self):
        here = os.path.dirname(os.path.abspath(__file__))
        self.assertEqual(hook_input.payload_cwd({"cwd": here}), here)
        for cwd in (os.path.join(here, "no-such-directory"), os.path.abspath(__file__), "tests", ".", "..",
                    "bad\0path"):
            with self.subTest(cwd=cwd):
                self.assertIsNone(hook_input.payload_cwd({"cwd": cwd}))

    def test_an_object_is_read_as_it_is(self):
        self.assertEqual(hook_input.read_payload(io.StringIO('{"cwd": "/w", "n": 1}')), {"cwd": "/w", "n": 1})

    def test_anything_that_is_not_a_readable_object_reads_as_empty(self):
        for raw in ("", "  \n", "{not json", "[]", '"x"', "3", "null"):
            with self.subTest(raw=raw):
                self.assertEqual(hook_input.read_payload(io.StringIO(raw)), {})

    def test_a_stream_that_cannot_be_decoded_or_read_reads_as_empty(self):
        # 실제 stdin 이 UTF-8 이 아닌 바이트에서 내는 오류(`UnicodeDecodeError`)와 읽기 실패(`OSError`).
        class Broken:
            def __init__(self, exc):
                self.exc = exc

            def read(self):
                raise self.exc

        for exc in (UnicodeDecodeError("utf-8", b"\xff", 0, 1, "invalid start byte"), OSError("closed")):
            with self.subTest(exc=type(exc).__name__):
                self.assertEqual(hook_input.read_payload(Broken(exc)), {})

    def test_a_programming_error_in_the_stream_is_not_swallowed(self):
        # 좁게 잡는다. `ValueError` · `OSError` 밖의 예외는 입력 문제가 아니라 버그이므로 그대로 올라온다.
        class Buggy:
            def read(self):
                raise RuntimeError("bug")

        with self.assertRaises(RuntimeError):
            hook_input.read_payload(Buggy())

    def test_without_a_stream_it_reads_the_current_stdin(self):
        # 호출 시점의 `sys.stdin` 을 읽는다(import 시점에 묶지 않는다). 훅은 stdin 을 이 경로로 읽는다.
        old, sys.stdin = sys.stdin, io.StringIO('{"cwd": "/w"}')
        try:
            self.assertEqual(hook_input.read_payload(), {"cwd": "/w"})
        finally:
            sys.stdin = old


class HooksShareTheInputRulesTest(unittest.TestCase):
    """세 훅이 입력 규칙을 제 사본으로 다시 들이지 않는다. 사본이 셋이면 규칙을 고칠 때마다 셋을 같이 고쳐야 한다."""

    def test_no_hook_defines_its_own_read_payload_or_cwd_rule(self):
        for hook in HOOKS:
            with self.subTest(hook=hook):
                tree = ast.parse((_harness.HOOKS_DIR / hook).read_text(encoding="utf-8"))
                defined = {n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
                self.assertFalse(defined & {"_read_payload", "read_payload", "hook_cwd", "payload_cwd"}, defined)
                imported = {(n.module, a.name) for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)
                            for a in n.names}
                self.assertIn(("_lib.hook_input", "read_payload"), imported)
                self.assertIn(("_lib.hook_input", "payload_cwd"), imported)


if __name__ == "__main__":
    unittest.main()
