"""`.claude/hooks/pretooluse_bash.py` 와 그 등록 — Bash 훅 셋을 한 프로세스로 돌린다(NERV Task `CLE-T-ZTTHXD`).

PreToolUse:Bash 에는 push 게이트(`guard_review_before_push.py`)가 걸려 있다. 등록을 잘못 바꾸면 게이트가
조용히 꺼지거나(exit 0) 모든 Bash 가 막힌다(파일이 없어 exit 2). 그래서 다음을 고정한다.

  - 디스패처: 훅마다 같은 stdin 을 받고, 셋 다 돌고, 하나라도 2 면 2, 예외 · 모듈 수준 `sys.exit` 는 그
    훅만의 결과로 처리한다.
  - 등록: `settings.json` 의 PreToolUse:Bash 명령은 하나다. 디스패처가 있으면 디스패처를, 없으면(main 에
    머지되기 전) 예전 훅 셋을 따로 돌린다. 두 경로 모두 차단(2)을 그대로 돌려준다.
  - 대비 경로의 훅 목록 = 디스패처의 `HOOKS`.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path

import _harness

DISPATCHER_PATH = _harness.HOOKS_DIR / "pretooluse_bash.py"
SETTINGS_PATH = _harness.CLAUDE_DIR / "settings.json"
dispatcher = _harness.load_module_by_path("pretooluse_bash_under_test", DISPATCHER_PATH)

PAYLOAD = json.dumps({"tool_name": "Bash", "tool_input": {"command": "git push"}})


def fake_hook(body: str) -> str:
    return textwrap.dedent("""\
        import os, sys
        LOG = os.environ["HOOK_LOG"]
        NAME = os.path.splitext(os.path.basename(__file__))[0]
        def main():
            raw = sys.stdin.read()
            with open(LOG, "a") as fh:
                fh.write(NAME + ":" + str(len(raw)) + "\\n")
        """) + textwrap.dedent(body) + textwrap.dedent("""\
        if __name__ == "__main__":
            sys.exit(main())
        """)


def bash_command() -> str:
    settings = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    entries = [e for e in settings["hooks"]["PreToolUse"] if e.get("matcher") == "Bash"]
    assert len(entries) == 1, entries
    hooks = entries[0]["hooks"]
    assert len(hooks) == 1, hooks
    return hooks[0]["command"]


class DispatcherTest(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp(prefix="pretooluse-bash-"))
        self.addCleanup(shutil.rmtree, self.dir)
        self.log = self.dir / "log"
        os.environ["HOOK_LOG"] = str(self.log)
        self.addCleanup(os.environ.pop, "HOOK_LOG", None)

    def write(self, name, body):
        (self.dir / f"{name}.py").write_text(fake_hook(body), encoding="utf-8")

    def ran(self):
        return self.log.read_text().split() if self.log.exists() else []

    def test_every_hook_gets_the_full_stdin_and_all_run(self):
        for n in ("a", "b", "c"):
            self.write(n, "")
        self.assertEqual(dispatcher.dispatch(PAYLOAD, self.dir, ("a", "b", "c")), 0)
        self.assertEqual(self.ran(), [f"{n}:{len(PAYLOAD)}" for n in ("a", "b", "c")])

    def test_block_from_any_hook_wins_and_later_hooks_still_run(self):
        # 앞 훅의 차단하지 않는 오류(1)가 뒤 훅의 차단(2)을 가리면 안 된다.
        self.write("a", "_m = main\ndef main():\n    _m()\n    return 1\n")
        self.write("b", "_m = main\ndef main():\n    _m()\n    return 2\n")
        self.write("c", "")
        self.assertEqual(dispatcher.dispatch(PAYLOAD, self.dir, ("a", "b", "c")), 2)
        self.assertEqual(len(self.ran()), 3)

    def test_non_blocking_error_is_kept_when_nothing_blocks(self):
        self.write("a", "")
        self.write("b", "_m = main\ndef main():\n    _m()\n    return 1\n")
        self.assertEqual(dispatcher.dispatch(PAYLOAD, self.dir, ("a", "b")), 1)

    def test_exception_and_module_exit_affect_only_that_hook(self):
        (self.dir / "boom.py").write_text("raise RuntimeError('x')\n", encoding="utf-8")
        (self.dir / "quit.py").write_text("import sys\nsys.exit(0)\n", encoding="utf-8")
        self.write("c", "")
        self.assertEqual(dispatcher.dispatch(PAYLOAD, self.dir, ("boom", "quit", "c")), 1)
        self.assertEqual(self.ran(), [f"c:{len(PAYLOAD)}"])

    def test_missing_hook_file_is_a_non_blocking_failure(self):
        self.write("c", "")
        self.assertEqual(dispatcher.dispatch(PAYLOAD, self.dir, ("nope", "c")), 1)


class RegistrationTest(unittest.TestCase):
    """settings.json 의 명령을 `bash -c` 로 실제로 돌린다."""

    def setUp(self):
        self.project = Path(tempfile.mkdtemp(prefix="pretooluse-project-"))
        self.addCleanup(shutil.rmtree, self.project)
        self.hooks = self.project / ".claude" / "hooks"
        self.hooks.mkdir(parents=True)
        self.log = self.project / "log"

    def run_registered(self):
        env = {**os.environ, "CLAUDE_PROJECT_DIR": str(self.project), "HOOK_LOG": str(self.log)}
        return subprocess.run(["bash", "-c", bash_command()], input=PAYLOAD, text=True,
                              capture_output=True, env=env, timeout=30)

    def write_old_hooks(self, push_code):
        for name in dispatcher.HOOKS:
            code = push_code if name == "guard_review_before_push" else 0
            body = f"_m = main\ndef main():\n    _m()\n    return {code}\n"
            (self.hooks / f"{name}.py").write_text(fake_hook(body), encoding="utf-8")

    def test_fallback_runs_each_old_hook_with_full_stdin_and_keeps_the_block(self):
        self.write_old_hooks(push_code=2)
        r = self.run_registered()
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertEqual(self.log.read_text().split(),
                         [f"{n}:{len(PAYLOAD)}" for n in dispatcher.HOOKS])

    def test_fallback_allows_when_push_guard_allows(self):
        self.write_old_hooks(push_code=0)
        self.assertEqual(self.run_registered().returncode, 0)

    def test_dispatcher_is_used_when_present(self):
        self.write_old_hooks(push_code=2)
        shutil.copy(DISPATCHER_PATH, self.hooks / "pretooluse_bash.py")
        r = self.run_registered()
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertEqual(len(self.log.read_text().split()), 3)

    def test_fallback_hook_list_matches_dispatcher(self):
        fallback = re.findall(r'\$d/(\w+)\.py', bash_command())
        self.assertEqual(fallback[0], "pretooluse_bash")
        self.assertEqual(tuple(fallback[2:]), dispatcher.HOOKS)

    def test_real_hooks_exist_for_every_name(self):
        for name in dispatcher.HOOKS:
            self.assertTrue((_harness.HOOKS_DIR / f"{name}.py").is_file(), name)


if __name__ == "__main__":
    unittest.main()
