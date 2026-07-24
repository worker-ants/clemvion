"""How much of the target spec actually reaches a consistency checker.

`--impl-prep spec/<area>/` is a BLOCKING gate: a `BLOCK: YES` stops implementation
and a `BLOCK: NO` is taken as evidence that the area was examined. That second
half is the one worth pinning, because it fails quietly.

Measured on 2026-07-24 before this suite existed: the target bundle for
`spec/2-navigation/` is 376,294 characters and the budget handed it 78,643, so
**9 of the area's 18 files never reached any checker** — and the payload said so
only as a generic `... (truncated due to size limit) ...` line at the very end,
after content that had itself been cut mid-file. A checker cannot distinguish
"this area does not mention X" from "the part that mentions X was dropped", so
it answers the first question while believing it answered the second.

Two things follow, and this file pins both:

1. **The split was sized for a payload that does not exist.** Five corpora shared
   `max_context_size` as though one prompt carried them all. It does not:
   `build_checker_prompt_body` sends `target_doc` plus exactly ONE corpus, so
   roughly half the window went unused by anybody while the target was cut to
   21% of itself.
2. **Truncation must name what it dropped.** Checkers have `Read`; an omission
   they can see is a directed instruction, an omission they cannot see is a
   wrong verdict. Cutting on FILE boundaries is what makes that list possible —
   and it also stops a half-file from being presented as if it were whole.

Everything here runs the orchestrator in a FRESH interpreter. Importing it into
this process collides on the name `_lib`: the hook suites put
`.claude/hooks/_lib` on `sys.path`, and the orchestrator's
`from _lib import project_config` then resolves to that package instead of its
own. `test_line_anchors` dodges the same collision the same way.
"""

from __future__ import annotations

import json
import subprocess
import sys
import textwrap
import unittest

from _harness import REPO_ROOT

ORCH = (
    REPO_ROOT / ".claude" / "skills" / "consistency-checker" / "scripts"
    / "consistency_orchestrator.py"
)

_PREAMBLE = textwrap.dedent(
    f"""
    import importlib.util, json, sys
    spec = importlib.util.spec_from_file_location("orch", {str(ORCH)!r})
    orch = importlib.util.module_from_spec(spec)
    sys.modules["orch"] = orch
    spec.loader.exec_module(orch)
    REPO_ROOT = {str(REPO_ROOT)!r}

    class ArgsFor:
        spec = plan = impl_done = diff_base = None
        def __init__(self, area):
            self.impl_prep = REPO_ROOT + "/" + area

    def emit(value):
        sys.stdout.write("<<<" + json.dumps(value) + ">>>")

    ARG = json.loads(sys.stdin.read() or "null")
    """
)


def run_in_orchestrator(snippet: str, arg=None):
    """Execute `snippet` with `orch`, `ArgsFor`, `emit` and `ARG` in scope."""
    proc = subprocess.run(
        [sys.executable, "-c", _PREAMBLE + textwrap.dedent(snippet)],
        input=json.dumps(arg), cwd=str(REPO_ROOT),
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        raise AssertionError(proc.stderr[-3000:])
    out = proc.stdout
    return json.loads(out[out.index("<<<") + 3:out.rindex(">>>")])


def bundle(*pairs):
    """Build a bundle the way `format_file_bundle` does, without touching disk."""
    parts = ["### 라벨\n"]
    for rel, body in pairs:
        parts.append(f"\n#### `{rel}`\n```\n{body}\n```\n")
    return "".join(parts)


class FileBundleTruncationTest(unittest.TestCase):
    @staticmethod
    def _truncate(text, budget):
        return run_in_orchestrator(
            "emit(orch.truncate_file_bundle(ARG[0], ARG[1]))", [text, budget]
        )

    def test_a_bundle_under_budget_is_returned_verbatim(self):
        text = bundle(("a.md", "x"), ("b.md", "y"))
        self.assertEqual(self._truncate(text, 10_000), text)

    def test_zero_budget_means_unlimited(self):
        """Same convention as `session.truncate_to_budget`, which this replaces
        for bundles — a caller that disables the cap must not silently get an
        empty payload instead."""
        text = bundle(("a.md", "x" * 500))
        self.assertEqual(self._truncate(text, 0), text)

    def test_files_are_dropped_whole(self):
        """The old behaviour cut mid-file, so the last file present looked
        complete while ending in the middle of a sentence."""
        text = bundle(("a.md", "A" * 400), ("b.md", "B" * 400), ("c.md", "C" * 400))
        out = self._truncate(text, 700)
        self.assertIn("A" * 400, out, "the first file should survive intact")
        self.assertNotIn("B" * 10, out)
        self.assertNotIn("C" * 10, out)

    def test_the_dropped_files_are_named(self):
        text = bundle(("a.md", "A" * 400), ("keep/b.md", "B" * 400),
                      ("keep/c.md", "C" * 400))
        out = self._truncate(text, 700)
        self.assertIn("keep/b.md", out)
        self.assertIn("keep/c.md", out)

    def test_the_notice_tells_the_checker_what_to_do(self):
        """Naming the files is only half of it — the checker also has to be told
        that absence here is not evidence of absence."""
        heading = run_in_orchestrator("emit(orch.OMITTED_FILES_HEADING)")
        out = self._truncate(bundle(("a.md", "A" * 400), ("b.md", "B" * 400)), 500)
        self.assertIn(heading, out)
        self.assertIn("Read", out, "the checker is not told how to recover")

    def test_the_result_respects_the_budget_including_the_notice(self):
        """The notice grows with the number of dropped files, so a naive
        implementation overshoots exactly when it drops the most."""
        text = bundle(*[(f"dir/file-{i:03}.md", "x" * 200) for i in range(60)])
        for budget in (400, 1_000, 4_000):
            with self.subTest(budget=budget):
                self.assertLessEqual(len(self._truncate(text, budget)), budget)

    def test_a_single_oversized_file_still_reports_itself(self):
        """Nothing fits, so nothing is kept — but silence here would be the
        worst case of all, since the checker would see an empty area."""
        out = self._truncate(bundle(("huge.md", "x" * 5_000)), 300)
        self.assertIn("huge.md", out)
        self.assertLessEqual(len(out), 300)

    def test_text_without_file_markers_falls_back_to_plain_truncation(self):
        """`target_doc` is not always a bundle — `--spec` / `--plan` pass a
        single document, and `--impl-done` appends a diff section."""
        out = self._truncate("y" * 5_000, 200)
        self.assertLessEqual(len(out), 200)
        self.assertTrue(out.startswith("y"))


_SYNTHETIC_CONTEXT = {
    "mode": "m",
    "target_path": "spec/x/",
    "target_doc": "T" * 400_000,
    "related_specs": "R" * 400_000,
    "rationale_excerpts": "E" * 400_000,
    "conventions": "C" * 400_000,
    "plan_in_progress": "P" * 400_000,
}


class PerCheckerBudgetTest(unittest.TestCase):
    """The window is split for the payload each checker actually receives."""

    @staticmethod
    def _lengths(checker, window=100_000):
        return run_in_orchestrator(
            """
            subs = orch.budget_substitutions(ARG["context"], ARG["window"], ARG["checker"])
            emit({k: len(v) for k, v in subs.items()})
            """,
            {"context": _SYNTHETIC_CONTEXT, "window": window, "checker": checker},
        )

    def test_the_target_gets_the_larger_share(self):
        self.assertGreater(self._lengths("cross_spec")["target_doc"], 50_000)

    def test_a_checker_only_pays_for_the_corpus_it_reads(self):
        """The corpora a checker never sees must not shrink its target.

        This is the whole defect: `cross_spec` reads `related_specs` and nothing
        else, yet the target was sized as if `conventions`, `plan_in_progress`
        and `rationale_excerpts` were also in its prompt.
        """
        lengths = self._lengths("cross_spec")
        for unread in ("rationale_excerpts", "conventions", "plan_in_progress"):
            with self.subTest(key=unread):
                self.assertEqual(lengths.get(unread, 0), 0)

    def test_the_whole_prompt_stays_within_the_window(self):
        sizes = run_in_orchestrator(
            """
            out = {}
            for checker in ARG["checkers"]:
                subs = orch.budget_substitutions(ARG["context"], ARG["window"], checker)
                out[checker] = len(orch.build_checker_prompt_body(checker, subs))
            emit(out)
            """,
            {
                "context": _SYNTHETIC_CONTEXT, "window": 100_000,
                "checkers": ["cross_spec", "rationale_continuity",
                             "convention_compliance", "plan_coherence",
                             "naming_collision"],
            },
        )
        for checker, size in sizes.items():
            with self.subTest(checker=checker):
                # Slack for the fixed instruction preamble, which is not part of
                # the corpus budget.
                self.assertLessEqual(size, 108_000, checker)

    def test_naming_collision_still_receives_all_three_corpora(self):
        present = run_in_orchestrator(
            """
            subs = orch.budget_substitutions(ARG["context"], ARG["window"], "naming_collision")
            corpus = orch._checker_corpus("naming_collision", subs)
            emit([m for m in ("R", "P", "C") if m * 100 in corpus])
            """,
            {"context": _SYNTHETIC_CONTEXT, "window": 100_000},
        )
        self.assertEqual(sorted(present), ["C", "P", "R"])

    def test_zero_means_unlimited(self):
        self.assertEqual(self._lengths("cross_spec", window=0)["target_doc"], 400_000)

    def test_the_new_split_is_strictly_more_target_than_the_old_one(self):
        """Guards the point of the change with a number, not a description.

        The old split gave `target_doc` 30% of the window regardless of which
        checker was being built. Anything at or below that would leave the
        measured defect (9 of 18 files dropped) exactly where it was.
        """
        self.assertGreater(self._lengths("cross_spec")["target_doc"], 30_000 * 1.5)


class RealAreaTargetSurvivalTest(unittest.TestCase):
    """End to end, on a real spec area rather than synthetic strings."""

    _AREA = "spec/2-navigation"

    def _target(self):
        return run_in_orchestrator(
            """
            context = orch.collect_context(ArgsFor(ARG), REPO_ROOT)
            subs = orch.budget_substitutions(context, 262144, "cross_spec")
            emit({"target": subs["target_doc"],
                  "heading": orch.OMITTED_FILES_HEADING})
            """,
            self._AREA,
        )

    def test_every_area_file_is_either_present_whole_or_named_as_omitted(self):
        """The property that makes a `BLOCK: NO` trustworthy.

        Not "everything fits" — it does not, and pretending otherwise is how the
        silent version shipped. Every file must be accounted for one way or the
        other.
        """
        names = sorted(p.name for p in (REPO_ROOT / self._AREA).glob("*.md"))
        self.assertGreater(len(names), 5, "fixture area shrank — check the path")
        target = self._target()["target"]
        for name in names:
            with self.subTest(name=name):
                self.assertIn(
                    name, target,
                    "the file is neither included nor listed as omitted",
                )

    def test_something_is_actually_omitted_here(self):
        """Non-vacuity: this area really does overflow, so the test above is
        exercising the omission path rather than the everything-fits path."""
        result = self._target()
        self.assertIn(result["heading"], result["target"])


if __name__ == "__main__":
    unittest.main()
