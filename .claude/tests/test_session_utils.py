"""`_shared/session.py` 의 작은 도우미 세 개: `truncate_to_budget` · `save_metadata` · `make_debug_logger`.

세 오케스트레이터가 모두 이 모듈을 쓴다. `truncate_to_budget` 은 docstring 이 「결과가 budget 자 안에
든다」고 했지만 접미사보다 작은 budget 에서는 접미사를 통째로 붙여 그 약속을 어겼다
(`truncate_to_budget("x" * 100, 10)` 이 39자). 단위 테스트가 하나도 없어 드러나지 않았다
(NERV Task `CLE-T-QY5AZ3`, PR #1523 리뷰 후속).
"""

from __future__ import annotations

import ast
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

import _harness

session = _harness.load_module_by_path("shared_session_utils", _harness.CLAUDE_DIR / "_shared" / "session.py")
SUFFIX = "\n\n... (truncated due to size limit) ..."


class TruncateToBudgetTest(unittest.TestCase):
    def test_the_default_suffix_is_the_one_measured_here(self):
        # 아래 경계값은 접미사 길이(39)에 기대어 있다. 기본값이 바뀌면 경계가 옮겨 간다.
        self.assertEqual(session.truncate_to_budget("x" * 100, 50)[-len(SUFFIX):], SUFFIX)
        self.assertEqual(len(SUFFIX), 39)

    def test_zero_or_negative_budget_means_unlimited(self):
        for budget in (0, -1, -100):
            with self.subTest(budget=budget):
                self.assertEqual(session.truncate_to_budget("x" * 100, budget), "x" * 100)

    def test_text_within_the_budget_is_unchanged(self):
        for budget in (100, 101, 10_000):
            with self.subTest(budget=budget):
                self.assertEqual(session.truncate_to_budget("x" * 100, budget), "x" * 100)
        self.assertEqual(session.truncate_to_budget("", 5), "")

    def test_a_longer_text_ends_with_the_suffix_at_exactly_the_budget(self):
        text = "".join(chr(ord("a") + i % 26) for i in range(100))
        out = session.truncate_to_budget(text, 60)
        self.assertEqual(out, text[:60 - len(SUFFIX)] + SUFFIX)
        self.assertEqual(len(out), 60)

    def test_budget_equal_to_the_suffix_leaves_only_the_suffix(self):
        self.assertEqual(session.truncate_to_budget("x" * 100, len(SUFFIX)), SUFFIX)

    def test_budget_shorter_than_the_suffix_cuts_without_it(self):
        # 고치기 전에는 접미사 39자를 그대로 붙였다.
        for budget in (1, 10, len(SUFFIX) - 1):
            with self.subTest(budget=budget):
                self.assertEqual(session.truncate_to_budget("y" * 100, budget), "y" * budget)

    def test_every_budget_fits(self):
        # 경계 몇 개가 아니라 가능한 budget 전부에서 약속을 본다.
        text = "z" * 100
        for suffix in (SUFFIX, "", "…"):
            for budget in range(1, 101):
                with self.subTest(suffix=suffix, budget=budget):
                    out = session.truncate_to_budget(text, budget, suffix=suffix)
                    self.assertLessEqual(len(out), budget)
                    if len(out) < len(text):
                        self.assertEqual(len(out), budget)


class SaveMetadataTest(unittest.TestCase):
    def setUp(self):
        self.tmp = os.path.realpath(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def test_writes_pretty_utf8_json(self):
        session.save_metadata(self.tmp, {"이름": "값"})
        with open(os.path.join(self.tmp, "meta.json"), encoding="utf-8") as f:
            text = f.read()
        self.assertEqual(json.loads(text), {"이름": "값"})
        self.assertIn("이름", text)  # ensure_ascii=False

    def test_an_unwritable_session_dir_does_not_raise(self):
        a_file = os.path.join(self.tmp, "not-a-dir")
        open(a_file, "w").close()
        for session_dir in (os.path.join(self.tmp, "missing"), a_file):
            with self.subTest(session_dir=session_dir):
                session.save_metadata(session_dir, {"k": 1})
        self.assertFalse(os.path.exists(os.path.join(self.tmp, "missing")))


class DebugLoggerUnwritableTest(unittest.TestCase):
    def setUp(self):
        self.tmp = os.path.realpath(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def test_an_unwritable_path_does_not_raise(self):
        a_file = os.path.join(self.tmp, "a-file")
        open(a_file, "w").close()
        for path in (self.tmp, os.path.join(a_file, "log.txt")):
            with self.subTest(path=path):
                session.make_debug_logger(path)("message")

    def test_appends_one_timestamped_line_per_call(self):
        path = os.path.join(self.tmp, "log.txt")
        log = session.make_debug_logger(path)
        log("first")
        log("second")
        with open(path, encoding="utf-8") as f:
            lines = f.read().splitlines()
        self.assertEqual([ln.split("] ", 1)[1] for ln in lines], ["first", "second"])
        self.assertRegex(lines[0], r"^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\] ")


@unittest.skipUnless(hasattr(os, "O_NOFOLLOW") and hasattr(os, "symlink"), "POSIX 전용")
class DebugLoggerDoesNotFollowSymlinksTest(unittest.TestCase):
    """디버그 로그는 `/tmp` 의 고정 이름이었다. 다른 사용자가 같은 이름의 링크를 먼저 만들어 두면 로그가 링크가
    가리키는 파일에 붙었다(NERV Task `CLE-T-QY5AZ3`)."""

    def setUp(self):
        self.tmp = os.path.realpath(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def test_a_symlink_at_the_log_path_is_not_followed(self):
        victim = os.path.join(self.tmp, "victim.txt")
        with open(victim, "w", encoding="utf-8") as f:
            f.write("victim\n")
        path = os.path.join(self.tmp, "log.txt")
        os.symlink(victim, path)
        session.make_debug_logger(path)("leaked")
        with open(victim, encoding="utf-8") as f:
            self.assertEqual(f.read(), "victim\n")
        self.assertTrue(os.path.islink(path))

    def test_a_dangling_symlink_does_not_create_its_target(self):
        target = os.path.join(self.tmp, "created-through-link.txt")
        path = os.path.join(self.tmp, "log.txt")
        os.symlink(target, path)
        session.make_debug_logger(path)("leaked")
        self.assertFalse(os.path.exists(target))

    def test_a_new_log_is_private_and_its_directory_is_made(self):
        path = os.path.join(self.tmp, "logs", "deep", "x.log")
        old = os.umask(0o022)
        try:
            session.make_debug_logger(path)("hello")
        finally:
            os.umask(old)
        self.assertEqual(stat.S_IMODE(os.stat(path).st_mode), 0o600)


class OrchestratorsLogInTheCheckoutTest(unittest.TestCase):
    ORCHESTRATORS = {
        "code-review-agents/scripts/code_review_orchestrator.py": "code-review-agents",
        "consistency-checker/scripts/consistency_orchestrator.py": "consistency-checker",
        "merge-coordinator/scripts/merge_coordinator_orchestrator.py": "merge-coordinator",
    }

    def test_debug_log_path_is_under_the_checkouts_review_directory(self):
        # 하네스는 로그 디렉터리를 임시 디렉터리로 돌려 두므로(`_harness.LOG_DIR`) 환경 변수를 치우고 기본값을 본다.
        with mock.patch.dict(os.environ):
            os.environ.pop(session.LOG_DIR_ENV, None)
            self.assertEqual(session.debug_log_path("x"),
                             str(_harness.REPO_ROOT / ".review" / "logs" / "x.log"))

    def test_each_orchestrator_takes_its_log_path_from_the_shared_module(self):
        # 구문 트리로 본다. 주석에 옛 `/tmp/...` 가 남아 있어도 판정은 대입문만 본다.
        for rel, name in self.ORCHESTRATORS.items():
            with self.subTest(orchestrator=rel):
                tree = ast.parse((_harness.CLAUDE_DIR / "skills" / rel).read_text(encoding="utf-8"))
                values = [n.value for n in ast.walk(tree) if isinstance(n, ast.Assign)
                          and any(isinstance(t, ast.Name) and t.id == "DEBUG_LOG_FILE" for t in n.targets)]
                self.assertEqual(len(values), 1, values)
                call = values[0]
                self.assertIsInstance(call, ast.Call)
                self.assertIsInstance(call.func, ast.Attribute)
                self.assertEqual((ast.unparse(call.func), [ast.literal_eval(a) for a in call.args]),
                                 ("session.debug_log_path", [name]))


class DebugLogDirOverrideTest(unittest.TestCase):
    """`ORCHESTRATOR_LOG_DIR` 가 로그 디렉터리를 옮긴다. 테스트가 실제 체크아웃의 로그를 쓰지 않게 하는 수단이다."""

    def setUp(self):
        self.tmp = os.path.realpath(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def log_path(self, value):
        with mock.patch.dict(os.environ):
            if value is None:
                os.environ.pop(session.LOG_DIR_ENV, None)
            else:
                os.environ[session.LOG_DIR_ENV] = value
            return session.debug_log_path("x")

    def test_a_directory_in_the_variable_replaces_the_checkouts_log_directory(self):
        self.assertEqual(self.log_path(self.tmp), os.path.join(self.tmp, "x.log"))

    def test_an_empty_variable_means_the_default(self):
        self.assertEqual(self.log_path(""), self.log_path(None))

    def test_a_relative_directory_is_made_absolute_when_the_path_is_read(self):
        old = os.getcwd()
        os.chdir(self.tmp)
        self.addCleanup(os.chdir, old)
        path = self.log_path("rel")
        self.assertEqual(path, os.path.join(self.tmp, "rel", "x.log"))
        os.chdir(old)
        self.assertEqual(path, os.path.join(self.tmp, "rel", "x.log"))  # 한 번 읽은 값은 cwd 를 따라가지 않는다

    def test_a_log_written_through_the_override_lands_there(self):
        path = self.log_path(os.path.join(self.tmp, "logs"))
        session.make_debug_logger(path)("hello")
        with open(os.path.join(self.tmp, "logs", "x.log"), encoding="utf-8") as f:
            self.assertIn("hello", f.read())


class TestRunsLogOutsideTheCheckoutTest(unittest.TestCase):
    """테스트를 돌려도 실제 체크아웃의 `.review/logs` 에 로그가 쌓이지 않는다.

    세 오케스트레이터는 import 할 때 로그 경로를 정한다. 그 경로가 어디로 가는지를, 테스트가 하는 대로 새
    인터프리터에서 오케스트레이터를 불러 확인한다. 하네스(`_harness`)가 환경 변수를 안 돌려 두거나 오케스트레이터가
    경로를 환경 변수 밖에서 정하면 RED 다. 이 확인이 없으면 테스트를 돌릴 때마다 임시 디렉터리 경로를 담은 줄이 실제
    로그에 섞여, 그 워크트리의 실제 `--prepare` 기록을 읽기 어려워진다.
    """

    CHECKOUT_LOGS = os.path.join(str(_harness.REPO_ROOT), ".review", "logs")

    def inside_checkout_logs(self, path: str) -> bool:
        logs = os.path.realpath(self.CHECKOUT_LOGS)
        return os.path.commonpath([os.path.realpath(path), logs]) == logs

    def probe(self, rel: str) -> dict:
        orch = _harness.CLAUDE_DIR / "skills" / rel
        preamble = _harness.orchestrator_preamble(orch)
        # 오케스트레이터를 불러온 인터프리터 안에서 로그를 쓰고 읽는다. 이 인터프리터도 `_harness` 를 불러 제 임시
        # 디렉터리를 만들고 끝날 때 지우므로, 밖에서 읽으면 이미 없다.
        return _harness.run_in_orchestrator(preamble, """
            orch.debug_log("log-isolation probe")
            with open(orch.DEBUG_LOG_FILE, encoding="utf-8") as f:
                emit({"path": orch.DEBUG_LOG_FILE, "text": f.read()})
        """)

    def test_the_harness_points_the_log_directory_at_a_temporary_one(self):
        self.assertEqual(os.environ.get("ORCHESTRATOR_LOG_DIR"), _harness.LOG_DIR)
        self.assertTrue(os.path.isdir(_harness.LOG_DIR))
        self.assertFalse(self.inside_checkout_logs(_harness.LOG_DIR), _harness.LOG_DIR)

    def test_each_orchestrator_logs_into_a_temporary_directory_not_into_the_checkout(self):
        for rel in OrchestratorsLogInTheCheckoutTest.ORCHESTRATORS:
            with self.subTest(orchestrator=rel):
                got = self.probe(rel)
                self.assertFalse(self.inside_checkout_logs(got["path"]), got["path"])
                self.assertEqual(os.path.basename(os.path.dirname(got["path"]))[:len("orchestrator-logs-")],
                                 "orchestrator-logs-", got["path"])
                self.assertIn("log-isolation probe", got["text"])

    def test_a_subprocess_that_does_not_load_the_harness_inherits_the_directory(self):
        # 오케스트레이터를 `_harness` 없이 직접 띄우는 테스트(`python orchestrator.py --prepare ...`)도 같은 디렉터리를 쓴다.
        code = ("import sys; sys.path.insert(0, sys.argv[1]); from _shared import session; "
                "print(session.debug_log_path('x'))")
        proc = subprocess.run([sys.executable, "-c", code, str(_harness.CLAUDE_DIR)],
                              capture_output=True, text=True, timeout=30, check=True)
        self.assertEqual(proc.stdout.strip(), os.path.join(_harness.LOG_DIR, "x.log"))


if __name__ == "__main__":
    unittest.main()
