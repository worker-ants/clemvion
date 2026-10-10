"""`_shared/session.py` 의 작은 도우미 세 개: `truncate_to_budget` · `save_metadata` · `make_debug_logger`.

세 오케스트레이터가 모두 이 모듈을 쓴다. `truncate_to_budget` 은 docstring 이 「결과가 budget 자 안에
든다」고 했지만 접미사보다 작은 budget 에서는 접미사를 통째로 붙여 그 약속을 어겼다
(`truncate_to_budget("x" * 100, 10)` 이 39자). 단위 테스트가 하나도 없어 드러나지 않았다
(NERV Task `CLE-T-QY5AZ3`, PR #1523 리뷰 후속).
"""

from __future__ import annotations

import json
import os
import shutil
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


if __name__ == "__main__":
    unittest.main()
