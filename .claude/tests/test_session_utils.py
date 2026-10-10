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
import tempfile
import unittest

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


if __name__ == "__main__":
    unittest.main()
