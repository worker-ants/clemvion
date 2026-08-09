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

_PREAMBLE = _harness.orchestrator_preamble(
    ORCH,
)


def run_in_orchestrator(snippet: str, arg=None):
    return _harness.run_in_orchestrator(_PREAMBLE, snippet, arg)


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
        # `--impl-done` splices the code diff between the on-topic files and the
        # rest of the folder dump, so it is deliberately NOT in the ranker's
        # alphabetical order. Its placement is pinned by `TheDiffOutranksTheFolderDumpTest`;
        # here it is dropped so the spec files' ordering stays testable.
        order = [e for e in order if not e.startswith("<git diff")]
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


class ThisBranchsPlanOutranksEveryOtherPlanTest(unittest.TestCase):
    """"어느 in-progress plan 이든 언급하면 tier 1" 은 신호이길 그만뒀다.

    실측 2026-08-09: in-progress plan 63개를 이어 붙이면 755,385자가 되고, 그 텍스트는
    `spec/5-system/` 18개 중 **14개**를 tier 1로 태그한다 — 이 함수가 애초에 구하려던
    바로 그 스코프다. 이 브랜치가 건드린 plan 으로 좁히면 같은 스코프가 5개가 되고,
    그 5개가 실제 작업 대상이다. 디렉터리의 77% 에서 켜지는 건 신호가 아니다.

    `spec_impact:` frontmatter 가 이 tier 로 들어오는 경로다 — plan 전문을 넘기므로
    별도 파서가 필요 없다.
    """

    def test_a_branch_plan_mention_outranks_any_other_plan_mention(self):
        order = run_in_orchestrator(
            """
            import os
            files = [ROOT + "/spec/5-system/a.md", ROOT + "/spec/5-system/b.md"]
            out = orch.prioritize_bundle_files(
                files, ROOT,
                changed_rels=(),
                plan_text="a.md 와 b.md 를 모두 언급하는 다른 plan",
                branch_plan_text="이 브랜치의 plan 은 b.md 만 언급한다",
            )
            emit([os.path.basename(p) for p in out])
            """
        )
        # 자연순서는 a, b 다 — b 가 앞서면 브랜치-plan tier 가 실제로 작동한 것이다.
        self.assertEqual(order, ["b.md", "a.md"])

    def test_a_branch_plan_mention_still_loses_to_the_catalog_demotion(self):
        """언급 하나가 자동생성 덤프 ~230개를 앞으로 끌고 오면 안 된다 — 그 성질은
        tier 를 하나 더 끼워 넣어도 유지돼야 한다(브랜치가 **직접 고친** 경우만 예외).

        경로가 **중첩**인 것이 중요하다: R-7 은 `<name>-api-catalog/<resource>.md`
        최상위 인덱스를 정식 spec 으로 남기므로 강등 대상이 아니다(실측 222 강등 /
        27 유지). 처음 쓴 픽스처가 최상위였고, 그래서 틀린 건 코드가 아니라 픽스처였다.
        """
        order = run_in_orchestrator(
            """
            import os
            cat = ROOT + "/spec/conventions/cafe24-api-catalog/order/x.md"
            plain = ROOT + "/spec/conventions/zzz.md"
            out = orch.prioritize_bundle_files(
                [cat, plain], ROOT,
                changed_rels=(),
                plan_text="",
                branch_plan_text="이 브랜치 plan 이 x.md 를 언급한다",
            )
            emit([os.path.basename(p) for p in out])
            """
        )
        self.assertEqual(order, ["zzz.md", "x.md"])

    def test_collect_context_ranks_with_this_branchs_plans_only(self):
        """호출부 계약. 헬퍼가 두 텍스트를 구분해도 호출부가 같은 값을 두 번 넘기면
        결함은 그대로다 — 그 뮤턴트가 실제로 살아남았다."""
        sizes = run_in_orchestrator(
            """
            seen = {}
            real = orch.prioritize_bundle_files
            def spy(file_paths, root, **kw):
                seen.setdefault("plan", kw.get("plan_text", ""))
                seen.setdefault("branch", kw.get("branch_plan_text", ""))
                return real(file_paths, root, **kw)
            orch.prioritize_bundle_files = spy

            class Args:
                spec = plan = impl_prep = diff_base = None
                impl_done = None
            args = Args()
            args.impl_done = ROOT + "/spec/5-system"
            orch.collect_context(args, ROOT)
            emit({"plan": len(seen["plan"]), "branch": len(seen["branch"])})
            """
        )
        self.assertGreater(sizes["plan"], 0, "plan 코퍼스가 비었다 — 단언이 vacuous")
        self.assertLess(
            sizes["branch"], sizes["plan"],
            "branch_plan_text 가 전체 plan 과 같다 — 좁히는 효과가 없다",
        )


class TheDiffOutranksTheFolderDumpTest(unittest.TestCase):
    """`--impl-done` 의 코드 diff 가 folder dump 뒤에 붙으면 **가장 먼저** 잘린다.

    실측(2026-08-09, `spec/5-system/` dump 1,215,279 B): 기본 예산 262,144 에서도
    상향한 650,000 에서도 diff 는 매번 통째로 생략됐고, checker 5명이 구현을 한 줄도
    못 본 채 "spec vs 구현" 을 판정했다. 마지막 청크라는 위치 자체가 원인이다.
    """

    def test_the_diff_is_not_the_last_chunk(self):
        """호출부 계약. 헬퍼가 옳아도 호출부가 안 쓰면 결함은 그대로다."""
        order = CollectContextUsesPriorityTest._order("impl_done", "target_doc")
        diffs = [i for i, e in enumerate(order) if e.startswith("<git diff")]
        self.assertEqual(len(diffs), 1, f"diff 청크가 1개가 아니다: {order}")
        self.assertLess(
            diffs[0], len(order) - 1,
            "diff 가 여전히 마지막 청크다 — 예산 절단이 가장 먼저 가져간다",
        )

    def test_the_diff_sits_right_after_the_on_topic_files(self):
        """맨 뒤가 아니면 그만인 게 아니다 — 맨 앞도 틀렸다.

        이 브랜치가 실제로 고치는 spec 은 diff 보다 앞서야 한다. 그 파일들이야말로
        "구현이 spec 을 따랐나" 를 diff 와 **대조할 대상**이라, 둘 중 하나만 남으면
        판정이 성립하지 않는다.

        변경 집합을 실제 브랜치에서 읽으면 main 에 머지된 뒤 0건이 되어 단언이 조용히
        무의미해지므로, 여기서는 고정한다.
        """
        order = run_in_orchestrator(
            """
            import re
            orch._branch_changed_rels = lambda base, root: {
                "spec/5-system/9-rag-search.md"}

            class Args:
                spec = plan = impl_prep = diff_base = None
                impl_done = None
            args = Args()
            args.impl_done = ROOT + "/spec/5-system"
            ctx = orch.collect_context(args, ROOT)
            text = re.sub(r"```.*?```", "", ctx["target_doc"], flags=re.S)
            emit(re.findall(r"^#### `([^`]+)`", text, re.M))
            """
        )
        self.assertEqual(
            order[0], "spec/5-system/9-rag-search.md",
            "이 브랜치가 고친 파일이 맨 앞이 아니다",
        )
        self.assertTrue(
            order[1].startswith("<git diff"),
            f"diff 가 대상 파일 바로 뒤가 아니다: {order[:3]}",
        )

    def test_splice_lands_on_a_chunk_boundary(self):
        """헬퍼 계약. 경계를 벗어나면 한 파일의 본문이 둘로 갈린다."""
        placed = run_in_orchestrator(
            """
            S = orch._BUNDLE_FILE_SENTINEL
            bundle = "### 라벨\\n" + "".join(
                f"{S}#### `f{i}.md`\\n```\\nbody{i}\\n```\\n" for i in range(4))
            chunk = f"{S}#### `<diff>`\\n\\n```diff\\n+x\\n```\\n"
            import re
            out = []
            for n in ARG:
                spliced = orch._splice_chunk(bundle, chunk, n)
                out.append(re.findall(r"^#### `([^`]+)`", spliced, re.M))
            emit(out)
            """,
            [0, 2, 4],
        )
        self.assertEqual(placed[0], ["<diff>", "f0.md", "f1.md", "f2.md", "f3.md"])
        self.assertEqual(placed[1], ["f0.md", "f1.md", "<diff>", "f2.md", "f3.md"])
        self.assertEqual(placed[2], ["f0.md", "f1.md", "f2.md", "f3.md", "<diff>"])

    def test_an_empty_bundle_still_carries_the_diff(self):
        """빈 스코프(`(없음)`)에는 sentinel 이 없다. 거기서 diff 를 잃으면
        "구현을 못 봤다" 가 조용히 재현된다."""
        out = run_in_orchestrator(
            "emit(orch._splice_chunk('### 라벨\\n(없음)\\n', 'DIFF', 3))"
        )
        self.assertIn("DIFF", out)


if __name__ == "__main__":
    unittest.main()
