"""PreToolUse 훅이 허용(exit 0)할 때 모델에 닿는 출력은 JSON 객체 하나다 (NERV Task `CLE-T-QBNJ81`).

Claude Code 는 PreToolUse exit 0 의 평문 stdout 을 디버그 로그에만 남긴다. 모델에 닿는 것은
`hookSpecificOutput.additionalContext` 다. 2026-10-10 버린 `claude -p` 세션(2.1.296)으로 쟀다.
평문은 닿지 않았고, 서로 다른 훅 둘의 envelope 는 둘 다 닿았다. 한 프로세스가 envelope 를 두 번
찍으면 JSON 파싱이 실패해 둘 다 사라졌다. 자세한 근거는 `.claude/hooks/_lib/hook_output.py` 에 있다.

그 전까지 `guard_default_branch_bash.py` 의 세션당 1회 안내와 `guard_review_before_push.py` 의
fail-open 배너 · notes 는 평문으로 찍혀 모델에 닿지 않았다. 기존 테스트는 `r.stdout` 에 문구가
있는지만 봐서 평문이어도 통과했다. 그래서 여기서는 `_harness.pretooluse_context` 로 stdout 을
envelope 로 읽는다. 평문이나 객체 두 개면 그 자리에서 실패한다.

훅은 서브프로세스로 띄운다. 하네스가 부르는 모양 그대로 stdin 에 JSON 을 넣는다.
"""

from __future__ import annotations

import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

import _harness  # noqa: F401  — side effect: puts .claude/hooks on sys.path
from _lib import hook_output

_NOTE = "⚠️  세션X: 하향 감지"

# 정상 판정에 note 하나를 싣는 게이트 스텁. 실제 `ReviewDecision` 처럼 `push_blocks` 를 둔다.
# 없으면 훅이 AttributeError 로 fail-open 경로에 들어가 엉뚱한 이유로 통과한다.
_REVIEW_STUB = (
    "from dataclasses import dataclass\n"
    "@dataclass\n"
    "class _D:\n"
    "    blocked: bool = False\n"
    "    reason: str = 'clean'\n"
    f"    notes: tuple = ({_NOTE!r},)\n"
    "    @property\n"
    "    def push_blocks(self):\n"
    "        return self.blocked\n"
    "def evaluate_review(cwd=None, **_kw):\n"
    "    return _D()\n"
)

_TARGETS_DEF = "def _push_targets(command: str, cwd: str) -> list[str]:\n"


class EnvelopeTest(unittest.TestCase):
    def test_round_trips_through_the_reader(self):
        text = "첫 줄\n둘째 줄 ⚠️"
        self.assertEqual(_harness.pretooluse_context(hook_output.context_json(text)), text)

    def test_is_one_line_and_keeps_korean_readable(self):
        line = hook_output.context_json("가\n나")
        self.assertNotIn("\n", line)
        self.assertIn("가", line, "ensure_ascii=False 가 빠지면 디버그 로그에서 읽을 수 없다")

    def test_carries_no_permission_decision(self):
        # "allow" 는 권한 확인을 건너뛴다. 가드가 명령을 승인하게 된다.
        hso = json.loads(hook_output.context_json("x"))["hookSpecificOutput"]
        self.assertEqual(set(hso), {"hookEventName", "additionalContext"})
        self.assertEqual(hso["hookEventName"], "PreToolUse")

    def test_blank_text_prints_nothing(self):
        for text in ("", "\n", "  \n\t"):
            with self.subTest(text=text):
                buf = io.StringIO()
                self.assertFalse(hook_output.emit_context(text, stream=buf))
                self.assertEqual(buf.getvalue(), "")

    def test_surrounding_newlines_are_trimmed(self):
        buf = io.StringIO()
        self.assertTrue(hook_output.emit_context("\nbanner\n\n", stream=buf))
        self.assertEqual(_harness.pretooluse_context(buf.getvalue()), "banner")


class ReaderRejectsWhatClaudeCodeDropsTest(unittest.TestCase):
    """테스트 쪽 판독기가 실험에서 사라진 모양을 실제로 거절하는지 본다.

    판독기가 무엇이든 받아 주면 위 · 아래 단언은 아무것도 증명하지 않는다.
    """

    def test_plain_text(self):
        with self.assertRaises(AssertionError):
            _harness.pretooluse_context("banner\n")

    def test_two_objects_from_one_process(self):
        line = hook_output.context_json("a")
        with self.assertRaises(AssertionError):
            _harness.pretooluse_context(f"{line}\n{line}\n")

    def test_a_permission_decision(self):
        obj = {"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                      "permissionDecision": "allow",
                                      "additionalContext": "x"}}
        with self.assertRaises(AssertionError):
            _harness.pretooluse_context(json.dumps(obj))

    def test_empty_stdout_is_no_context(self):
        self.assertEqual(_harness.pretooluse_context(""), "")


class PushHookSpeaksInOneObjectTest(unittest.TestCase):
    """fail-open 배너와 gate note 가 함께 나와도 stdout 은 envelope 하나다.

    두 보고 함수가 각자 envelope 를 찍으면 객체가 둘이 되고 Claude Code 는 둘 다 버린다.
    대상 선정을 깨서 TARGET_SELECTION 을 degraded 로 만들고, 게이트 스텁은 note 를 싣는다.
    """

    def _run(self, *, with_hook_output: bool) -> subprocess.CompletedProcess:
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        hooks = os.path.join(tmp, "hooks")
        shutil.copytree(str(_harness.HOOKS_DIR), hooks,
                        ignore=shutil.ignore_patterns("__pycache__"))
        with open(os.path.join(hooks, "_lib", "review_guard.py"), "w", encoding="utf-8") as f:
            f.write(_REVIEW_STUB)
        hook = os.path.join(hooks, "guard_review_before_push.py")
        with open(hook, encoding="utf-8") as f:
            source = f.read()
        broken = source.replace(
            _TARGETS_DEF,
            _TARGETS_DEF + '    raise RuntimeError("simulated target selection failure")\n', 1)
        self.assertNotEqual(broken, source, "주입 지점이 옮겨졌다")
        with open(hook, "w", encoding="utf-8") as f:
            f.write(broken)
        if not with_hook_output:
            os.unlink(os.path.join(hooks, "_lib", "hook_output.py"))
        env = {k: v for k, v in os.environ.items() if k != "BYPASS_REVIEW_GUARD"}
        env["CLAUDE_PROJECT_DIR"] = tmp  # fail-open 연속 횟수 파일을 임시 디렉터리에 둔다
        return subprocess.run(
            [sys.executable, hook],
            input=json.dumps({"tool_input": {"command": "git push origin HEAD"}, "cwd": tmp}),
            capture_output=True, text=True, timeout=30, env=env, cwd=tmp,
        )

    def test_banner_and_note_share_one_object(self):
        r = self._run(with_hook_output=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        context = _harness.pretooluse_context(r.stdout)
        self.assertIn("TARGET_SELECTION", context)
        self.assertIn("fail-open", context)
        self.assertIn("하향 감지", context)

    def test_fallback_envelope_matches_the_module(self):
        """`hook_output.py` 가 없어도 배너는 같은 바이트로 모델에 간다.

        훅에는 import 가 실패할 때 쓰는 envelope 사본이 있다. 사본이 모듈과 달라지면
        이 테스트가 잡는다.
        """
        with_module = self._run(with_hook_output=True)
        without = self._run(with_hook_output=False)
        self.assertEqual(without.returncode, 0, without.stderr)
        self.assertIn("fail-open", _harness.pretooluse_context(without.stdout))
        self.assertEqual(without.stdout, with_module.stdout)


class DefaultBranchReminderReachesTheModelTest(unittest.TestCase):
    """기본 브랜치 Bash 안내가 envelope 로 한 번 나오고 같은 세션에서는 다시 나오지 않는다."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = os.path.realpath(tempfile.mkdtemp())
        origin = _harness.make_temp_git_repo(os.path.join(cls.tmp, "origin"))
        cls.main = os.path.join(cls.tmp, "main")
        _harness.git_in(cls.tmp, "clone", "-q", str(origin), cls.main)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def _run(self, session_id: str) -> subprocess.CompletedProcess:
        env = {k: v for k, v in os.environ.items()
               if k != "BYPASS_DEFAULT_BRANCH_GUARD" and not k.startswith("GIT_")}
        env["CLAUDE_PROJECT_DIR"] = self.tmp  # 세션당 1회 표식을 임시 디렉터리에 둔다
        env["GIT_CEILING_DIRECTORIES"] = self.tmp
        payload = {"tool_input": {"command": "mkdir foo"}, "cwd": self.main,
                   "session_id": session_id}
        return subprocess.run(
            [sys.executable, str(_harness.HOOKS_DIR / "guard_default_branch_bash.py")],
            input=json.dumps(payload), capture_output=True, text=True, timeout=60,
            env=env, cwd=self.main,
        )

    def test_reminder_is_one_envelope_once_per_session(self):
        first = self._run("session-a")
        self.assertEqual(first.returncode, 0, first.stderr)
        context = _harness.pretooluse_context(first.stdout)
        self.assertIn("ensure-worktree.sh", context)
        # Claude Code 가 additionalContext 를 system reminder 로 감싼다. 훅이 태그를 또 넣으면
        # 바깥 지시처럼 보여 프롬프트 인젝션 방어에 걸릴 수 있다(hooks 문서).
        self.assertNotIn("<system-reminder>", context)

        again = self._run("session-a")
        self.assertEqual((again.returncode, again.stdout), (0, ""))

        other = self._run("session-b")
        self.assertIn("ensure-worktree.sh", _harness.pretooluse_context(other.stdout))


if __name__ == "__main__":
    unittest.main()
