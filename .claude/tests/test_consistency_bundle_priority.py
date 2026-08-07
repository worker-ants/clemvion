"""Which files survive the context budget — ordering, not just truncation.

`test_consistency_context_budget` pinned the *visibility* half of this problem:
truncation cuts on file boundaries and names what it dropped. This file pins the
half that decides **which** files get dropped.

`collect_markdown_files` used to return plain lexicographic order (its
tie-break is natural sort now — see `_natural_key`) and
`truncate_file_bundle` drops from the tail, so for `spec/5-system/` the budget
went to `1-auth.md` / `10-graph-rag.md` / `11-mcp-client.md` while
`4-execution-engine.md` — the file every one of those sessions was actually
about — fell off the end. That happened **eight times** across separate
sessions (`plan/in-progress/harness-consistency-summary-downgrade-rule.md`).
Twice it mattered: on 2026-07-28 three of five checkers had no coverage of the
target at all, so their `BLOCK: NO` meant "never looked", not "looks fine".

Checkers sometimes rescue themselves by reading the file directly, but that is
per-checker and unreliable — in the 7th recurrence exactly one of five did.
Ordering is the part the harness can guarantee.

Fresh-interpreter convention as in `test_consistency_context_budget`: importing
the orchestrator in-process collides on the name `_lib`.
"""

from __future__ import annotations

import json
import subprocess
import sys
import textwrap
import unittest

import _harness
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
    ROOT = {str(REPO_ROOT)!r}

    def emit(value):
        sys.stdout.write("<<<" + json.dumps(value) + ">>>")

    ARG = json.loads(sys.stdin.read() or "null")
    """
)


def run_in_orchestrator(snippet: str, arg=None):
    proc = subprocess.run(
        [sys.executable, "-c", _PREAMBLE + textwrap.dedent(snippet)],
        input=json.dumps(arg), cwd=str(REPO_ROOT),
        capture_output=True, text=True,
        # Sibling suites set one too — without it a hang in the target code
        # blocks the run forever instead of failing.
        timeout=30.0,
    )
    if proc.returncode != 0:
        raise AssertionError(proc.stderr[-3000:])
    out = proc.stdout
    return json.loads(out[out.index("<<<") + 3:out.rindex(">>>")])


def _prioritize(rels, *, changed=(), plan_text=""):
    """Return `prioritize_bundle_files` output as repo-relative paths."""
    return run_in_orchestrator(
        """
        import os
        rels, changed, plan_text = ARG["rels"], ARG["changed"], ARG["plan_text"]
        paths = [os.path.join(ROOT, r) for r in rels]
        out = orch.prioritize_bundle_files(
            paths, ROOT, changed_rels=changed, plan_text=plan_text)
        emit([os.path.relpath(p, ROOT) for p in out])
        """,
        {"rels": list(rels), "changed": list(changed), "plan_text": plan_text},
    )


# The real `spec/5-system/` head, in the alphabetical order that caused the bug.
_FIVE_SYSTEM = [
    "spec/5-system/1-auth.md",
    "spec/5-system/10-graph-rag.md",
    "spec/5-system/11-mcp-client.md",
    "spec/5-system/4-execution-engine.md",
]


class PrioritizeBundleFilesTest(unittest.TestCase):
    def test_branch_changed_file_leads(self):
        """The 8-times-observed case, with the signal `--impl-done` has."""
        out = _prioritize(_FIVE_SYSTEM,
                          changed=["spec/5-system/4-execution-engine.md"])
        self.assertEqual(out[0], "spec/5-system/4-execution-engine.md")

    def test_plan_named_file_leads_when_nothing_changed_yet(self):
        """`--impl-prep` runs before the spec is edited — tier 0 is empty there,
        so the plan-name signal is the only thing keeping the target in budget."""
        out = _prioritize(
            _FIVE_SYSTEM,
            plan_text="작업 대상: spec/5-system/4-execution-engine.md 의 retry 재진입",
        )
        self.assertEqual(out[0], "spec/5-system/4-execution-engine.md")

    def test_basename_mention_is_enough(self):
        out = _prioritize(_FIVE_SYSTEM,
                          plan_text="`4-execution-engine.md` 를 고친다")
        self.assertEqual(out[0], "spec/5-system/4-execution-engine.md")

    def test_catalog_bulk_sinks_below_everything(self):
        """~230 auto-generated catalog files used to lead the conventions bundle
        and push out every convention the target actually cites."""
        rels = [
            "spec/conventions/cafe24-api-catalog/product/fields.md",
            "spec/conventions/cafe24-api-catalog/order/fields.md",
            "spec/conventions/error-codes.md",
            "spec/conventions/node-output.md",
        ]
        out = _prioritize(rels)
        self.assertEqual(out[-2:], [
            "spec/conventions/cafe24-api-catalog/order/fields.md",
            "spec/conventions/cafe24-api-catalog/product/fields.md",
        ])
        self.assertEqual(out[0], "spec/conventions/error-codes.md")

    def test_catalog_demotion_beats_a_plan_mention(self):
        """A plan naming one catalog page must not drag the whole dump forward."""
        out = _prioritize(
            ["spec/conventions/cafe24-api-catalog/product/fields.md",
             "spec/conventions/error-codes.md"],
            plan_text="cafe24-api-catalog/product/fields.md 참고",
        )
        self.assertEqual(out[0], "spec/conventions/error-codes.md")

    def test_branch_change_beats_catalog_demotion(self):
        """A PR that edits a catalog page IS about that page.

        Demoting it would reproduce this function's own bug class for exactly
        those PRs — the changed file falls off the tail and the checkers judge
        it without ever seeing it. Tier 0 therefore outranks the demotion, while
        the weaker plan-mention signal (above) does not.
        """
        out = _prioritize(
            ["spec/conventions/cafe24-api-catalog/product/fields.md",
             "spec/conventions/error-codes.md"],
            changed=["spec/conventions/cafe24-api-catalog/product/fields.md"],
        )
        self.assertEqual(out[0],
                         "spec/conventions/cafe24-api-catalog/product/fields.md")

    def test_catalog_top_level_index_is_not_demoted(self):
        """R-7 keeps the catalog's top-level index files as 정식 spec.

        `spec-impl-evidence.md` R-7 excludes only paths with **one or more**
        segments after the catalog directory; the `<resource>.md` indexes carry
        `id`/`status` and stay in scope. The first version of the regex matched
        the catalog directory alone and demoted those too — measured 27 index
        files wrongly pushed behind everything, the opposite of what R-7 asks.
        """
        out = _prioritize([
            "spec/conventions/cafe24-api-catalog/product/fields.md",  # nested
            "spec/conventions/cafe24-api-catalog/product.md",         # index
            "spec/conventions/error-codes.md",
        ])
        self.assertEqual(out[-1],
                         "spec/conventions/cafe24-api-catalog/product/fields.md")
        self.assertIn("spec/conventions/cafe24-api-catalog/product.md", out[:2])

    def test_reordering_never_drops_or_invents(self):
        """This function reorders only — dropping is `truncate_file_bundle`'s job,
        and only it emits the omission notice checkers rely on."""
        out = _prioritize(_FIVE_SYSTEM,
                          changed=["spec/5-system/4-execution-engine.md"],
                          plan_text="10-graph-rag.md")
        self.assertCountEqual(out, _FIVE_SYSTEM)

    def test_ties_use_natural_order_not_lexicographic(self):
        """Within a tier, `4-` comes before `10-`.

        This is the residual half of the 8-times-recurring bug: tiers 0/1 rescue
        a target the branch touched or a plan names, but a session where the
        target is neither still filled the budget front-to-back in
        lexicographic order — `"1" < "10" < "11" < "2" < "4"` — and dropped from
        the tail. Measured on `spec/5-system/` (18 files):
        `4-execution-engine.md` sat at position 12 and now sits at 4.

        The earlier version of this test pinned the lexicographic order as
        intended behaviour, which is why the plan still listed natural sort as
        open while a test asserted the opposite.
        """
        out = _prioritize(_FIVE_SYSTEM)
        self.assertEqual(out, [
            "spec/5-system/1-auth.md",
            "spec/5-system/4-execution-engine.md",
            "spec/5-system/10-graph-rag.md",
            "spec/5-system/11-mcp-client.md",
        ])


class CollectMarkdownFilesOrderTest(unittest.TestCase):
    """`collect_markdown_files` sorts naturally — pinned directly.

    Downstream `prioritize_bundle_files` re-sorts, so this function's own order
    is invisible from every other test here: mutation showed reverting it to
    `files.sort()` left the suite GREEN. Callers that do NOT prioritize (and any
    future one) still get the order this asserts, so it is a contract, not an
    implementation detail — and an untested one is indistinguishable from dead
    code, which is how it would get "cleaned up" later.
    """

    def test_returns_natural_order(self):
        order = run_in_orchestrator(
            """
            import os
            fs = orch.collect_markdown_files(os.path.join(ROOT, "spec/5-system"))
            emit([os.path.basename(f) for f in fs[:5]])
            """
        )
        self.assertEqual(order[:5], [
            "1-auth.md", "2-api-convention.md", "3-error-handling.md",
            "4-execution-engine.md", "5-expression-language.md",
        ])


class PriorityThenTruncationTest(unittest.TestCase):
    """The two halves together — the property the eight recurrences violated."""

    def test_changed_target_survives_a_budget_that_fits_one_file(self):
        kept = run_in_orchestrator(
            """
            import os
            rels = ARG["rels"]
            paths = [os.path.join(ROOT, r) for r in rels]
            ordered = orch.prioritize_bundle_files(
                paths, ROOT, changed_rels=ARG["changed"])
            ordered_rels = [os.path.relpath(p, ROOT) for p in ordered]

            parts = ["### 구현 대상 spec 영역\\n"]
            for rel in ordered_rels:
                parts.append(orch._BUNDLE_FILE_SENTINEL + "#### `" + rel
                             + "`\\n```\\n" + ("x" * 400) + "\\n```\\n")
            text = "".join(parts)

            out = orch.truncate_file_bundle(text, 700)
            emit({"text": out, "order": ordered_rels})
            """,
            {"rels": _FIVE_SYSTEM,
             "changed": ["spec/5-system/4-execution-engine.md"]},
        )
        # The one file that fits is the branch's actual subject...
        self.assertIn("spec/5-system/4-execution-engine.md", kept["text"])
        # ...and the alphabetical head that used to win is gone from the body,
        # named in the omission notice instead.
        self.assertIn(orch_omitted_heading(), kept["text"])
        body = kept["text"].split(orch_omitted_heading())[0]
        self.assertNotIn("spec/5-system/1-auth.md", body)


def orch_omitted_heading():
    return run_in_orchestrator("emit(orch.OMITTED_FILES_HEADING)")


class BranchChangedRelsAgainstRealGitTest(unittest.TestCase):
    """`_branch_changed_rels` is the ONLY source of tier 0 — test it on real git.

    Everything else here replaces `prioritize_bundle_files` with a lambda, so the
    function that decides "did this branch change the file" was never asserted:
    a mutant returning `set()` would leave tier 0 permanently empty — silently
    reverting the main fix — and every other test would stay GREEN.
    """

    def _repo(self):
        import os
        import shutil
        import tempfile
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)

        # 공용 헬퍼 — `git -C` + ceiling + 임시경로 단언. 2026-08-06 공유 `.git/config`
        # 오염 사고의 방어이고, 사고 당시 이 파일이 미경화 5곳 중 하나였다.
        def git(*args):
            return _harness.git_in(d, *args)

        _harness.make_temp_git_repo(d, initial_commit=False)
        os.makedirs(os.path.join(d, "spec"), exist_ok=True)
        for name in ("kept.md", "renamed-from.md"):
            with open(os.path.join(d, "spec", name), "w") as f:
                f.write("base\n")
        git("add", "-A")
        git("commit", "-qm", "base")
        git("checkout", "-qb", "work")
        return d, git

    def _changed(self, root, base):
        return set(run_in_orchestrator(
            """
            emit(sorted(orch._branch_changed_rels(ARG["base"], ARG["root"])))
            """,
            {"base": base, "root": root},
        ))

    def test_reports_edits_and_additions_relative_to_the_base(self):
        import os
        d, git = self._repo()
        with open(os.path.join(d, "spec", "kept.md"), "a") as f:
            f.write("edit\n")
        with open(os.path.join(d, "spec", "added.md"), "w") as f:
            f.write("new\n")
        git("add", "-A")
        git("commit", "-qm", "work")
        self.assertEqual(self._changed(d, "main"),
                         {"spec/added.md", "spec/kept.md"})

    def test_rename_reports_both_sides(self):
        """`--no-renames` is deliberate: a renamed spec is two paths the bundle
        may need to rank, and rename detection would surface only one."""
        d, git = self._repo()
        git("mv", "spec/renamed-from.md", "spec/renamed-to.md")
        git("commit", "-qm", "rename")
        self.assertEqual(self._changed(d, "main"),
                         {"spec/renamed-from.md", "spec/renamed-to.md"})

    def test_unknown_base_yields_empty_not_an_exception(self):
        d, _ = self._repo()
        self.assertEqual(self._changed(d, "no-such-ref"), set())


class CollectContextUsesPriorityTest(unittest.TestCase):
    """`collect_context` must USE the ranker's result — for BOTH gate modes.

    Every test above exercises `prioritize_bundle_files` directly, so removing
    the call sites leaves them all GREEN while the bug is fully back.

    Asserting the ranker was *called* is not enough either: a pass-through
    mutant (`scope_files = prioritize_bundle_files(...) and scope_files`) keeps
    the call and discards the return, and a call-count spy stays GREEN. Both
    mutants survived that version of this test. So the spy imposes a sentinel
    order (reverse-alphabetical) and we assert the bundle actually comes out in
    it — the effect, not the call.
    """

    @staticmethod
    def _order(mode, key):
        return run_in_orchestrator(
            """
            import re
            orch.prioritize_bundle_files = (
                lambda file_paths, root, **kw: sorted(file_paths, reverse=True))

            class Args:
                spec = plan = impl_prep = impl_done = diff_base = None
            args = Args()
            setattr(args, ARG["mode"], ROOT + "/spec/5-system")

            ctx = orch.collect_context(args, ROOT)
            # Strip the fenced file bodies first: spec documents contain their
            # own `#### \x60...\x60` headings, and matching those pulled content
            # tokens (`integration_expired`) into what should be a list of
            # bundle entries. The bundle wraps every file in a fence, so what
            # survives the strip is exactly its own headers.
            text = re.sub(r"```.*?```", "", ctx[ARG["key"]], flags=re.S)
            emit(re.findall(r"^#### `([^`]+)`", text, re.M))
            """,
            {"mode": mode, "key": key},
        )

    def _assert_sentinel_order(self, mode, key):
        order = self._order(mode, key)
        self.assertGreater(len(order), 1, f"{key} bundle did not render")
        self.assertEqual(order, sorted(order, reverse=True),
                         f"collect_context ignored the ranker's ordering for {key}")
        # Guard against the assertion passing because the natural order already
        # happens to be reverse-alphabetical.
        self.assertNotEqual(order, sorted(order))

    def test_impl_prep_uses_the_ranked_order(self):
        self._assert_sentinel_order("impl_prep", "target_doc")

    def test_impl_done_uses_the_ranked_order(self):
        self._assert_sentinel_order("impl_done", "target_doc")

    # The scope bundle is not the only ranked one. A reviewer predicted these
    # two call sites were unlocked; mutating both to discard the ranker's return
    # left the suite GREEN, so the prediction was right — these pin them.
    def test_related_specs_uses_the_ranked_order(self):
        self._assert_sentinel_order("impl_done", "related_specs")

    def test_conventions_uses_the_ranked_order(self):
        self._assert_sentinel_order("impl_done", "conventions")

    def test_plan_in_progress_uses_the_ranked_order(self):
        """`plan_coherence`'s ONLY corpus — the one that needs ranking most.

        Measured on this repo it is roughly 10x its own budget share, so the
        alphabetical tail-drop is the normal case there, not an edge case. It
        was the one bundle left unranked, with nothing documenting a reason.
        """
        self._assert_sentinel_order("impl_done", "plan_in_progress")


if __name__ == "__main__":
    unittest.main()
