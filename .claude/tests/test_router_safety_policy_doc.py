"""`router_safety.py`'s policy matrix (and README's mirror of it) must agree
with the constants they claim to describe.

The module docstring calls itself "정책의 단일 진실 원천" and README says
"정책 변경 시 두 곳을 같이 갱신하라" — a manual-sync obligation that nothing
enforced. It had already slipped: the table advertised "24 extensions" while
`_SOURCE_CODE_EXTENSIONS` held **44**, stale since the set grew after
2026-05-16. Found by `/ai-review` on 2026-07-23 (INFO 3, session
`review/code/2026/07/23/15_59_54`) and fixed with this guard so the next
divergence fails a test instead of waiting for a reviewer to count by hand.

Prose-checking on purpose — the documented exception in `.claude/tests/README.md`
for documents that *are* the specification rather than a rendering of one. This
docstring is the stated SSOT for a policy that decides which reviewers run, so
its numbers and lists are load-bearing, not decoration.

Driven by subprocess: `router_safety` imports `skills/_lib.project_config`
while `_harness` binds `_lib` to the *hooks* package, and the two cannot both
own that name in one interpreter.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import unittest
from pathlib import Path

from _harness import REPO_ROOT

SKILL_DIR = REPO_ROOT / ".claude" / "skills" / "code-review-agents"
ROUTER_SAFETY = SKILL_DIR / "lib" / "router_safety.py"
README = SKILL_DIR / "README.md"
ORCH = SKILL_DIR / "scripts" / "code_review_orchestrator.py"


def _router_safety_values() -> dict:
    """Read the live constants out of `router_safety` via its own interpreter."""
    script = (
        f"import sys, json\n"
        f"sys.path.insert(0, {str(SKILL_DIR)!r})\n"
        f"sys.path.insert(0, {str(SKILL_DIR.parent)!r})\n"
        f"from lib import router_safety as rs\n"
        f"print(json.dumps({{"
        f"'extensions': sorted(rs._SOURCE_CODE_EXTENSIONS),"
        f"'source_forced': list(rs._SOURCE_FORCED_REVIEWERS)}}))\n"
    )
    r = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True, text=True, cwd=str(REPO_ROOT),
    )
    if r.returncode != 0:
        raise AssertionError(f"could not load router_safety: {r.stderr[-1500:]}")
    return json.loads(r.stdout.strip().splitlines()[-1])


def _all_agents() -> list:
    r = subprocess.run(
        [sys.executable, "-c",
         f"import runpy, sys, json; sys.argv=['x'];"
         f"m=runpy.run_path({str(ORCH)!r}); print(json.dumps(m['ALL_AGENTS']))"],
        capture_output=True, text=True, cwd=str(REPO_ROOT),
    )
    if r.returncode != 0:
        raise AssertionError(f"could not load ALL_AGENTS: {r.stderr[-1500:]}")
    return json.loads(r.stdout.strip().splitlines()[-1])


def _tokens(text: str) -> set:
    """Extension/reviewer tokens out of a `a b · c d` style list."""
    return set(re.findall(r"[a-z0-9_]+", text.replace("·", " ")))


class PolicyMatrixMatchesConstantsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.values = _router_safety_values()
        cls.doc = ROUTER_SAFETY.read_text(encoding="utf-8")
        cls.readme = README.read_text(encoding="utf-8")

    def _doc_extension_list(self) -> set:
        m = re.search(
            r"Source-code extensions counted by `_SOURCE_FORCED_REVIEWERS`:\n"
            r"((?:  .*\n)+)",
            self.doc,
        )
        self.assertIsNotNone(m, "docstring lost its source-extension list")
        return _tokens(m.group(1))

    def _readme_extension_list(self) -> set:
        m = re.search(r"소스 코드 확장자: `([^`]+)`", self.readme)
        self.assertIsNotNone(m, "README lost its source-extension list")
        return _tokens(m.group(1))

    def test_table_states_the_real_extension_count(self):
        """The exact drift this file exists for: the table said 24, the set had 44."""
        m = re.search(r"\| Source-code file \((\d+) extensions below\)", self.doc)
        self.assertIsNotNone(m, "policy table lost its source-code row")
        self.assertEqual(
            int(m.group(1)), len(self.values["extensions"]),
            "the policy table's extension count no longer matches "
            "_SOURCE_CODE_EXTENSIONS",
        )

    def test_docstring_list_is_exactly_the_constant(self):
        self.assertEqual(
            self._doc_extension_list(), set(self.values["extensions"]),
            "the docstring's spelled-out extension list drifted from "
            "_SOURCE_CODE_EXTENSIONS",
        )

    def test_readme_list_is_exactly_the_constant(self):
        self.assertEqual(
            self._readme_extension_list(), set(self.values["extensions"]),
            "README's spelled-out extension list drifted from "
            "_SOURCE_CODE_EXTENSIONS",
        )

    def test_readme_and_docstring_lists_agree(self):
        """README declares itself a mirror of the docstring; hold it to that."""
        self.assertEqual(self._doc_extension_list(), self._readme_extension_list())

    def test_table_row_names_the_real_forced_reviewers(self):
        m = re.search(
            r"\| Source-code file \(\d+ extensions below\)\s*\|([^|]+)\|", self.doc
        )
        self.assertIsNotNone(m)
        self.assertEqual(
            _tokens(m.group(1)), set(self.values["source_forced"]),
            "the policy table's forced-reviewer list drifted from "
            "_SOURCE_FORCED_REVIEWERS",
        )

    def test_reviewer_roster_count_and_names_match_the_orchestrator(self):
        agents = _all_agents()
        m = re.search(
            r"Reviewer codes \(default (\d+);[^)]*\):\n((?:  .*\n)+)", self.doc
        )
        self.assertIsNotNone(m, "docstring lost its reviewer roster")
        self.assertEqual(
            int(m.group(1)), len(agents),
            "the docstring's reviewer count drifted from ALL_AGENTS",
        )
        self.assertEqual(
            _tokens(m.group(2)), set(agents),
            "the docstring's reviewer names drifted from ALL_AGENTS",
        )


if __name__ == "__main__":
    unittest.main()
