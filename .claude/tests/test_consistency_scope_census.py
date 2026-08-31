"""`--impl-done` head census — telling "the diff was cut" from "there is no diff".

The implementation diff is a *named chunk in the body*, so `truncate_file_bundle`
can drop its content while its label survives. Measured 2026-08-06 across three
sessions: 15 prompts (5 checkers x 3 sessions) carried ` ```diff ` fences **0**
times and the 28 changed files appeared **0** times — five checkers judged
"spec vs implementation" having seen no implementation, and one misdiagnosed the
surviving label as an unsubstituted placeholder.

From inside a truncated prompt those two states are indistinguishable, and they
lead to opposite conclusions. `_scope_delta_census` states the measured numbers
in the HEAD section, which truncation never treats as a drop candidate.

The suite pins three things: the counter is right, each of the four message
branches says the thing that removes the wrong inference, and — the one that
actually matters — the census **survives a budget that eats the whole body**.
"""

from __future__ import annotations

import unittest
from pathlib import Path

import _harness
from _harness import REPO_ROOT

ORCH = (
    Path(REPO_ROOT) / ".claude" / "skills" / "consistency-checker" / "scripts"
    / "consistency_orchestrator.py"
)

_PREAMBLE = _harness.orchestrator_preamble(ORCH)


def run(snippet: str, arg=None):
    return _harness.run_in_orchestrator(_PREAMBLE, snippet, arg)


ONE_FILE_DIFF = (
    "diff --git a/codebase/backend/src/a.ts b/codebase/backend/src/a.ts\n"
    "--- a/codebase/backend/src/a.ts\n"
    "+++ b/codebase/backend/src/a.ts\n"
    "@@ -1 +1,2 @@\n"
    " x\n"
    "+y\n"
)


class CountDiffFiles(unittest.TestCase):
    """`diff --git` headers, not `+++` lines."""

    def test_empty_and_blank(self):
        self.assertEqual(run("emit(orch._count_diff_files(''))"), 0)
        self.assertEqual(run("emit(orch._count_diff_files('   \\n'))"), 0)

    def test_counts_leading_header_without_newline_prefix(self):
        # The first file's header has no preceding "\n" — a naive
        # `.count("\ndiff --git ")` alone would return 0 here.
        self.assertEqual(run("emit(orch._count_diff_files(ARG))", ONE_FILE_DIFF), 1)

    def test_counts_three(self):
        three = ONE_FILE_DIFF + ONE_FILE_DIFF.replace("a.ts", "b.ts") + \
            ONE_FILE_DIFF.replace("a.ts", "c.ts")
        self.assertEqual(run("emit(orch._count_diff_files(ARG))", three), 3)

    def test_added_file_counts_once_not_twice(self):
        """`/dev/null` + `+++` would double-count on a `+++`-based counter."""
        added = (
            "diff --git a/x.ts b/x.ts\n"
            "new file mode 100644\n"
            "--- /dev/null\n"
            "+++ b/x.ts\n"
            "@@ -0,0 +1 @@\n"
            "+hello\n"
        )
        self.assertEqual(run("emit(orch._count_diff_files(ARG))", added), 1)


class ScopeDeltaCensus(unittest.TestCase):
    SNIPPET = (
        "emit(orch._scope_delta_census("
        "ARG['root'], ARG['scope'], set(ARG['changed']), ARG['diff']))"
    )

    def _census(self, *, scope="spec/5-system", changed=(), diff=""):
        return run(self.SNIPPET, {
            "root": "/tmp/wt", "scope": scope,
            "changed": list(changed), "diff": diff,
        })

    # Assertions name the SUBJECT, never a bare count. A first cut asserted
    # `"0개 파일"` and passed under a mutant that broke the scope filter — the
    # string was matching the *diff* line, which also reads "0개 파일". The
    # sibling-leak mutant survived until the subject was spelled out.
    def _scope_says(self, out, n):
        return f"scope(`spec/5-system`) 델타: {n}개 파일" in out

    def test_scope_hits_are_listed_by_path(self):
        out = self._census(changed=[
            "spec/5-system/6-websocket-protocol.md",
            "codebase/backend/src/a.ts",          # outside scope — must not count
        ])
        self.assertIn("spec/5-system/6-websocket-protocol.md", out)
        self.assertTrue(self._scope_says(out, 1), out)
        self.assertNotIn("codebase/backend/src/a.ts", out)

    def test_trailing_slash_scope_matches_the_same_files(self):
        with_slash = self._census(
            scope="spec/5-system/", changed=["spec/5-system/x.md"])
        self.assertTrue(self._scope_says(with_slash, 1), with_slash)

    def test_prefix_does_not_leak_to_sibling_directory(self):
        """`spec/5-system` must not swallow `spec/5-system-extra/`."""
        out = self._census(changed=["spec/5-system-extra/x.md"])
        self.assertTrue(self._scope_says(out, 0), out)
        self.assertNotIn("spec/5-system-extra/x.md", out)

    def test_zero_scope_delta_says_it_is_not_a_void_premise(self):
        """The exact inference four rounds of a real review got wrong."""
        out = self._census(changed=["codebase/backend/src/a.ts"])
        self.assertIn("검토 전제가 무효라는 뜻이 아니다", out)
        self.assertIn("CRITICAL 을 내지 말 것", out)

    def test_present_diff_warns_that_absence_below_means_truncation(self):
        out = self._census(diff=ONE_FILE_DIFF)
        self.assertIn("1개 파일", out)
        self.assertIn("예산에 잘렸다", out)
        self.assertIn("/tmp/wt", out)      # absolute-path escape hatch

    def test_absent_diff_does_not_claim_truncation(self):
        out = self._census(diff="")
        self.assertIn("구현 diff: 0개 파일", out)
        self.assertNotIn("예산에 잘렸다", out)


class CensusIsWiredIntoImplDone(unittest.TestCase):
    """A helper that nobody calls is a helper that guards nothing.

    Every other case here exercises `_scope_delta_census` directly, so deleting
    its call site in `collect_context` would leave them all GREEN — the exact
    "헬퍼 테스트 ≠ 호출부 테스트" shape this repo has been bitten by. Source
    inspection is coarse, but it is the axis those cases cannot reach.
    """

    def test_collect_context_calls_the_census(self):
        out = run("""
import inspect
src = inspect.getsource(orch.collect_context)
emit({
    'calls_census': '_scope_delta_census(' in src,
    # ...and in the impl-done branch, not some unrelated one.
    'near_impl_done': 'args.impl_done' in src,
})
""")
        self.assertTrue(out["near_impl_done"], "impl_done 분기가 사라졌으면 단언이 공허하다")
        self.assertTrue(out["calls_census"])


class CensusSurvivesTruncation(unittest.TestCase):
    """The point of the whole change: the body can go, the census cannot."""

    def test_head_census_survives_a_budget_that_drops_every_body_chunk(self):
        out = run("""
census = orch._scope_delta_census(
    '/tmp/wt', 'spec/5-system',
    {'spec/5-system/6-websocket-protocol.md'},
    ARG,
)
body = orch.format_file_bundle.__doc__ or ''
huge = ''.join(
    orch._BUNDLE_FILE_SENTINEL + '#### `f%d`\\n```\\n%s\\n```\\n' % (i, 'x' * 4000)
    for i in range(20)
)
cut = orch.truncate_file_bundle(census + huge, len(census) + 500)
emit({
    'census_survived': '예산에 잘렸다' in cut and '6-websocket-protocol.md' in cut,
    'body_was_cut': cut.count('x' * 4000) < 20,
})
""", ONE_FILE_DIFF)
        self.assertTrue(out["body_was_cut"], "본문이 안 잘렸으면 이 단언은 공허하다")
        self.assertTrue(out["census_survived"])


if __name__ == "__main__":
    unittest.main()
