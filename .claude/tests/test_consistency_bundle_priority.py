"""Which files survive the context budget — ordering, targets and corpora on the NERV mirror.

`test_consistency_context_budget` pinned the *visibility* half of this problem:
truncation cuts on file boundaries and names what it dropped. This file pins the
half that decides **which** files get dropped, and since NERV cutover 4e (NERV Task
`CLE-T-VP5KDJ`) also what the target and the corpora ARE.

`truncate_file_bundle` drops from the tail, so ordering by name alone let the work
target lose its budget to alphabetically earlier files — **eight times** across
separate sessions, twice with no checker covering the target at all, so `BLOCK: NO`
meant "never looked". Ordering is the part the harness can guarantee.

Since 4e the target and both corpora are the NERV spec mirror (`spec/CLE-*`), the
frozen old tree is out, and the ranking signals are the branch's own changes, the
claim's keys (`--focus`), the documents whose `## 구현 위치` covers a changed file
(`--impl-done`) and the keys the target mentions. The plan-name signals left with
`plan/` (cutover stage 3).

Most cases run on a small mirror built in a temp git repo (`mini_mirror`), not on
this checkout's `spec/`: the real mirror changes with every pull, and the old tree
these tests used to read is deleted in cutover stage 5.

Fresh-interpreter convention as in `test_consistency_context_budget`: importing
the orchestrator in-process collides on the name `_lib`.
"""

from __future__ import annotations

import tempfile
import textwrap
import unittest
from pathlib import Path

import _harness
from _harness import REPO_ROOT

ORCH = (
    REPO_ROOT / ".claude" / "skills" / "consistency-checker" / "scripts"
    / "consistency_orchestrator.py"
)

_PREAMBLE = _harness.orchestrator_preamble(
    ORCH,
    imports="os",
    extra=textwrap.dedent(
        """
        class Args:
            spec = impl_prep = impl_done = diff_base = focus = diff_paths = None
            def __init__(self, **kw):
                for k, v in kw.items():
                    setattr(self, k, v)

        IMPL_ONE = "## 구현 위치\\n\\n- `codebase/a/**` (A 모듈)\\n- `recoverStuck` 같은 식별자\\n\\n" \\
                   "## Rationale\\n\\n### 결정 하나\\n\\n근거 ONE\\n"

        def mini_mirror(tmp):
            '''main 에 미러 · 옛 트리 · 코드를 커밋하고 `work` 브랜치로 옮긴 임시 저장소.'''
            root = os.path.join(tmp, "repo")
            _harness.make_temp_git_repo(root)
            w = _harness.write_mirror_doc
            w(root, "CLE-AAA", area="CLE-AAA", type_="area")
            w(root, "CLE-AAA-ONE", area="CLE-AAA", body=IMPL_ONE)
            w(root, "CLE-AAA-TWO", area="CLE-AAA",
              body="[규칙](../CLE-ENG/CLE-ENG-RULE.md) 과 CLE-BBB-X 를 부른다. 폴더 ../CLE-BBB/ 는 언급이 아니다.\\n")
            w(root, "CLE-AAA-2", area="CLE-AAA")
            w(root, "CLE-AAA-10", area="CLE-AAA")
            w(root, "CLE-BBB-X", area="CLE-BBB")
            w(root, "CLE-BBB-Y", area="CLE-BBB")
            w(root, "CLE-ENG-RULE", area="CLE-ENG", type_="convention")
            w(root, "CLE-ENG-OTHER", area="CLE-ENG", type_="convention")
            w(root, "CLE-RESEARCH-R", area="CLE-RESEARCH")
            w(root, "CLE-VISION", type_="vision")
            files = {
                "spec/README.md": "미러 안내\\n",
                "spec/5-system/old.md": "옛 트리\\n",
                "spec/conventions/old-conv.md": "옛 규약\\n",
                "codebase/a/x.ts": "export const x = 1;\\n",
                "codebase/b/y.ts": "export const y = 1;\\n",
                "codebase/api-catalogs/cafe24/order.md": "색인\\n",
                "codebase/api-catalogs/cafe24/order/list.md": "필드\\n",
            }
            for rel, body in files.items():
                path = os.path.join(root, rel)
                os.makedirs(os.path.dirname(path), exist_ok=True)
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(body)
            _harness.git_in(root, "add", "-A")
            _harness.git_in(root, "commit", "-qm", "base")
            _harness.git_in(root, "update-ref", "refs/remotes/origin/main", "HEAD")
            _harness.git_in(root, "checkout", "-qb", "work")
            return root

        def heads(bundle):
            import re
            return re.findall(r"^#### `([^`]+)`", bundle, re.M)

        def mirror_copy(tmp):
            return str(_harness.make_temp_repo_copy(os.path.join(tmp, "repo"), "spec/CLE-ENG"))
        """
    ),
)


def run_in_orchestrator(snippet: str, arg=None):
    return _harness.run_in_orchestrator(_PREAMBLE, snippet, arg)


def _prioritize(rels, *, changed=(), focus=(), mentioned=()):
    """Return `prioritize_bundle_files` output as repo-relative paths."""
    return run_in_orchestrator(
        """
        paths = [os.path.join(ROOT, r) for r in ARG["rels"]]
        out = orch.prioritize_bundle_files(
            paths, ROOT, changed_rels=ARG["changed"], focus_rels=ARG["focus"],
            mentioned_rels=ARG["mentioned"])
        emit([os.path.relpath(p, ROOT) for p in out])
        """,
        {"rels": list(rels), "changed": list(changed), "focus": list(focus),
         "mentioned": list(mentioned)},
    )


_AREA = [
    "spec/CLE-X/CLE-X-1.md",
    "spec/CLE-X/CLE-X-10.md",
    "spec/CLE-X/CLE-X-2.md",
    "spec/CLE-X/CLE-X-3.md",
]


class PrioritizeBundleFilesTest(unittest.TestCase):
    def test_tiers_are_changed_then_focus_then_mentioned_then_rest(self):
        out = _prioritize(_AREA, changed=["spec/CLE-X/CLE-X-3.md"],
                          focus=["spec/CLE-X/CLE-X-10.md"], mentioned=["spec/CLE-X/CLE-X-2.md"])
        self.assertEqual(out, ["spec/CLE-X/CLE-X-3.md", "spec/CLE-X/CLE-X-10.md",
                               "spec/CLE-X/CLE-X-2.md", "spec/CLE-X/CLE-X-1.md"])

    def test_a_changed_file_outranks_its_own_focus_and_mention(self):
        both = "spec/CLE-X/CLE-X-2.md"
        out = _prioritize(_AREA, changed=[both], focus=["spec/CLE-X/CLE-X-10.md", both],
                          mentioned=[both])
        self.assertEqual(out[:2], [both, "spec/CLE-X/CLE-X-10.md"])

    def test_ties_use_natural_order_not_lexicographic(self):
        out = _prioritize(_AREA)
        self.assertEqual(out, ["spec/CLE-X/CLE-X-1.md", "spec/CLE-X/CLE-X-2.md",
                               "spec/CLE-X/CLE-X-3.md", "spec/CLE-X/CLE-X-10.md"])

    def test_reordering_never_drops_or_invents(self):
        out = _prioritize(_AREA, changed=["spec/CLE-X/CLE-X-10.md"], focus=["nope.md"])
        self.assertCountEqual(out, _AREA)


class KeyMentionTest(unittest.TestCase):
    """A key mention must start and end where the key does.

    `CLE-ENG` is a prefix of `CLE-ENG-MIGRATION`, and a mirror link
    `../CLE-ENG/CLE-ENG-RULE.md` carries the area folder name. Neither is a
    mention of the area document — counting them would promote area documents
    into tier 2 for every link into their area.
    """

    def _mentions(self, text, keys):
        return set(run_in_orchestrator(
            "emit(sorted(orch.mentioned_keys(ARG[0], set(ARG[1]))))", [text, keys]))

    def test_a_longer_key_is_not_a_mention_of_its_prefix(self):
        self.assertEqual(self._mentions("CLE-ENG-MIGRATION 을 본다", ["CLE-ENG", "CLE-ENG-MIGRATION"]),
                         {"CLE-ENG-MIGRATION"})

    def test_a_mirror_link_names_the_document_not_its_folder(self):
        self.assertEqual(self._mentions("[x](../CLE-ENG/CLE-ENG-RULE.md#a)", ["CLE-ENG", "CLE-ENG-RULE"]),
                         {"CLE-ENG-RULE"})

    def test_key_link_and_prose_forms_count(self):
        self.assertEqual(self._mentions("[a](CLE-VISION#개요), (CLE-ACCT). CLE-OBS 끝",
                                        ["CLE-VISION", "CLE-ACCT", "CLE-OBS"]),
                         {"CLE-VISION", "CLE-ACCT", "CLE-OBS"})

    def test_keys_outside_the_mirror_are_ignored(self):
        self.assertEqual(self._mentions("CLE-C24-CATALOG 와 CLE-ENG", ["CLE-ENG"]), {"CLE-ENG"})


class ImplLocationTest(unittest.TestCase):
    """`## 구현 위치` — what a document says implements it, and what that covers."""

    def test_the_section_yields_repository_paths_only(self):
        got = run_in_orchestrator(
            """
            import tempfile
            with tempfile.TemporaryDirectory() as d:
                for top in ("codebase", "scripts", ".github"):
                    os.makedirs(os.path.join(d, top))
                text = ("## 개요\\n\\n- `codebase/not/this.ts` 는 다른 절이다\\n\\n"
                        "## 구현 위치\\n\\n"
                        "- `codebase/a/**` (`recoverStuck`, `x.ts`)\\n"
                        "- `scripts/check.py:12`, `./.github/workflows/w.yml`\\n"
                        "- `spec/CLE-X/CLE-X-1.md` 는 스펙 자신이다\\n"
                        "- `nowhere/y.ts` 는 최상위 폴더가 없다\\n"
                        "- `codebase/with space.ts`\\n\\n"
                        "## Rationale\\n\\n- `codebase/later.ts`\\n")
                emit(orch.impl_location_patterns(text, d))
            """
        )
        self.assertEqual(got, ["codebase/a/**", "scripts/check.py", ".github/workflows/w.yml"])

    def test_a_document_without_the_section_has_no_patterns(self):
        self.assertEqual(run_in_orchestrator(
            "emit(orch.impl_location_patterns('## 개요\\n\\n- `codebase/a.ts`\\n', ROOT))"), [])

    def test_pattern_matching(self):
        cases = [
            ("codebase/a/", "codebase/a/x.ts", True),
            ("codebase/a/**", "codebase/a/deep/x.ts", True),
            ("codebase/a/**", "codebase/ab/x.ts", False),
            ("codebase/a/*.dto.ts", "codebase/a/b.dto.ts", True),
            ("codebase/a/*.dto.ts", "codebase/a/b.ts", False),
            ("codebase/a/x.ts", "codebase/a/x.ts", True),
            ("codebase/a", "codebase/a/x.ts", True),
            ("codebase/a", "codebase/ab/x.ts", False),
        ]
        got = run_in_orchestrator(
            "emit([orch.impl_pattern_matches(p, r) for p, r, _ in ARG])", cases)
        self.assertEqual(got, [want for _, _, want in cases])


class CollectContextOnTheMirrorTest(unittest.TestCase):
    """`collect_context` builds the target and both corpora from the mirror, ranked."""

    def _ctx(self, setup="", **kw):
        return run_in_orchestrator(
            """
            import tempfile
            with tempfile.TemporaryDirectory() as tmp:
                root = mini_mirror(tmp)
                exec(ARG["setup"])
                args = Args(**ARG["kw"])
                if args.spec:
                    args.spec = os.path.join(tmp, args.spec)
                ctx = orch.collect_context(args, root)
                emit({k: (heads(v) if k != "mode" and k != "target_path" else v)
                      for k, v in ctx.items()} | {"raw": ctx})
            """,
            {"setup": textwrap.dedent(setup), "kw": kw},
        )

    def test_the_corpora_are_the_mirror_split_by_type(self):
        ctx = self._ctx(impl_prep="CLE-AAA-TWO")
        self.assertEqual(ctx["target_doc"], ["spec/CLE-AAA/CLE-AAA-TWO.md"])
        self.assertEqual(sorted(ctx["conventions"]),
                         ["spec/CLE-ENG/CLE-ENG-OTHER.md", "spec/CLE-ENG/CLE-ENG-RULE.md"])
        related = ctx["related_specs"]
        self.assertIn("spec/CLE-VISION.md", related)
        self.assertNotIn("spec/CLE-AAA/CLE-AAA-TWO.md", related, "the target is not its own corpus")
        self.assertNotIn("spec/CLE-ENG/CLE-ENG-RULE.md", related, "conventions are their own corpus")
        for absent in ("spec/CLE-RESEARCH/CLE-RESEARCH-R.md", "spec/README.md",
                       "spec/5-system/old.md", "spec/conventions/old-conv.md"):
            with self.subTest(absent=absent):
                self.assertNotIn(absent, related + ctx["conventions"])

    def test_focus_then_mentions_lead_the_corpora(self):
        ctx = self._ctx(impl_prep="CLE-AAA-TWO", focus="CLE-BBB-Y")
        self.assertEqual(ctx["related_specs"][:2], ["spec/CLE-BBB/CLE-BBB-Y.md", "spec/CLE-BBB/CLE-BBB-X.md"])
        self.assertEqual(ctx["conventions"][0], "spec/CLE-ENG/CLE-ENG-RULE.md")
        # The folder name in `../CLE-BBB/` is not a mention: no area document jumps the queue.
        self.assertNotIn("spec/CLE-AAA/CLE-AAA.md", ctx["related_specs"][:2])

    def test_an_uncommitted_edit_reaches_the_top_tier(self):
        """검토 대상이 아직 커밋되지 않았다는 이유로 예산에서 탈락하면 안 된다(2026-08-10 실측)."""
        ctx = self._ctx(
            setup="""
                with open(os.path.join(root, "spec/CLE-BBB/CLE-BBB-Y.md"), "a", encoding="utf-8") as fh:
                    fh.write("\\n미커밋\\n")
            """,
            impl_prep="CLE-AAA-TWO", focus="CLE-AAA-10",
        )
        self.assertEqual(ctx["related_specs"][0], "spec/CLE-BBB/CLE-BBB-Y.md")

    def test_a_scope_of_several_forms_is_one_target(self):
        ctx = self._ctx(impl_prep="CLE-BBB-X, spec/CLE-ENG/ ,spec/CLE-AAA/CLE-AAA-ONE.md")
        self.assertEqual(sorted(ctx["target_doc"]), [
            "spec/CLE-AAA/CLE-AAA-ONE.md", "spec/CLE-BBB/CLE-BBB-X.md",
            "spec/CLE-ENG/CLE-ENG-OTHER.md", "spec/CLE-ENG/CLE-ENG-RULE.md"])
        self.assertEqual(ctx["conventions"], [], "convention docs in the target leave the corpus")

    def test_a_spec_draft_replaces_its_own_mirror_version_but_keeps_its_rationale(self):
        ctx = self._ctx(
            setup="""
                with open(os.path.join(tmp, "CLE-AAA-ONE.md"), "w", encoding="utf-8") as fh:
                    fh.write("새 초안\\n")
            """,
            spec="CLE-AAA-ONE.md",
        )
        self.assertNotIn("spec/CLE-AAA/CLE-AAA-ONE.md", ctx["related_specs"])
        self.assertIn("근거 ONE", ctx["raw"]["rationale_excerpts"])


class ImplDoneCoveringDocumentsTest(unittest.TestCase):
    """`--impl-done` adds the documents whose `## 구현 위치` covers a changed file.

    This is the file-level guarantee the old push gate gave (`code:` globs →
    `--impl-done` required) and NERV cutover stage 2 retired: a change to a file a
    document names as its implementation is checked against that document, through
    the consistency round the NERV done gate requires for every Task.
    """

    def _done(self, rel, body="export const x = 2;\n", scope="CLE-AAA-TWO", **kw):
        return run_in_orchestrator(
            """
            import tempfile
            with tempfile.TemporaryDirectory() as tmp:
                root = mini_mirror(tmp)
                for rel, body in ARG["files"]:
                    path = os.path.join(root, rel)
                    os.makedirs(os.path.dirname(path), exist_ok=True)
                    with open(path, "w", encoding="utf-8") as fh:
                        fh.write(body)
                _harness.git_in(root, "add", "-A")
                _harness.git_in(root, "commit", "-qm", "work")
                args = Args(impl_done=ARG["scope"], diff_base="origin/main", **ARG["kw"])
                td = orch.collect_context(args, root)["target_doc"]
                emit({"heads": heads(td), "text": td})
            """,
            {"files": [[rel, body]] if isinstance(rel, str) else rel, "scope": scope, "kw": kw},
        )

    def test_the_covering_document_joins_the_target_and_the_census_says_why(self):
        out = self._done("codebase/a/x.ts")
        self.assertIn("spec/CLE-AAA/CLE-AAA-ONE.md", out["heads"])
        self.assertIn("구현 위치 대조로 더한 문서: 1개", out["text"])
        self.assertIn("`spec/CLE-AAA/CLE-AAA-ONE.md` ← `codebase/a/x.ts`", out["text"])

    def test_a_change_outside_every_section_adds_nothing(self):
        out = self._done("codebase/b/y.ts")
        self.assertNotIn("spec/CLE-AAA/CLE-AAA-ONE.md", out["heads"])
        self.assertNotIn("구현 위치 대조", out["text"])

    def test_the_diff_sits_right_after_the_on_topic_documents(self):
        """맨 뒤면 가장 먼저 잘리고(2026-08-09 실측), 맨 앞이면 대상 문서보다 먼저 예산을 쓴다."""
        out = self._done("codebase/a/x.ts")
        diff = next(h for h in out["heads"] if h.startswith("<git diff"))
        order = [h for h in out["heads"] if h.startswith(("spec/", "<git diff"))]
        self.assertEqual(order, ["spec/CLE-AAA/CLE-AAA-ONE.md", diff, "spec/CLE-AAA/CLE-AAA-TWO.md"])

    def test_catalog_field_files_leave_the_diff_and_are_counted(self):
        out = self._done([["codebase/api-catalogs/cafe24/order.md", "색인 2\n"],
                          ["codebase/api-catalogs/cafe24/order/list.md", "필드 2\n"]])
        self.assertIn("api-catalogs/cafe24/order.md", out["text"])
        self.assertNotIn("api-catalogs/cafe24/order/list.md", out["text"].split("```diff")[-1])
        self.assertIn("API 카탈로그 필드 파일 1개", out["text"])

    def test_diff_paths_override_the_code_areas(self):
        out = self._done([["codebase/a/x.ts", "export const x = 3;\n"], ["scripts/s.py", "x = 1\n"]],
                         diff_paths=["scripts"])
        diff = out["text"].split("```diff")[-1]
        self.assertIn("scripts/s.py", diff)
        self.assertNotIn("codebase/a/x.ts", diff)


class CollectMarkdownFilesOrderTest(unittest.TestCase):
    """`collect_markdown_files` sorts naturally — pinned directly.

    Downstream `prioritize_bundle_files` re-sorts, so this function's own order
    is invisible from every other test here: mutation showed reverting it to
    `files.sort()` left the suite GREEN. Callers that do NOT prioritize still get
    the order this asserts, so it is a contract, not an implementation detail.
    """

    def test_returns_natural_order(self):
        order = run_in_orchestrator(
            """
            import tempfile
            with tempfile.TemporaryDirectory() as d:
                for name in ("10-b.md", "2-a.md", "1-z.md", "11-c.md"):
                    open(os.path.join(d, name), "w").close()
                emit([os.path.basename(f) for f in orch.collect_markdown_files(d)])
            """
        )
        self.assertEqual(order, ["1-z.md", "2-a.md", "10-b.md", "11-c.md"])


class PriorityThenTruncationTest(unittest.TestCase):
    """The two halves together — the property the eight recurrences violated."""

    def test_changed_target_survives_a_budget_that_fits_one_file(self):
        kept = run_in_orchestrator(
            """
            paths = [os.path.join(ROOT, r) for r in ARG["rels"]]
            ordered = orch.prioritize_bundle_files(paths, ROOT, changed_rels=ARG["changed"])
            parts = ["### 대상\\n"]
            for p in ordered:
                parts.append(orch._BUNDLE_FILE_SENTINEL + "#### `" + os.path.relpath(p, ROOT)
                             + "`\\n```\\n" + ("x" * 400) + "\\n```\\n")
            emit({"text": orch.truncate_file_bundle("".join(parts), 700),
                  "heading": orch.OMITTED_FILES_HEADING})
            """,
            {"rels": _AREA, "changed": ["spec/CLE-X/CLE-X-3.md"]},
        )
        self.assertIn("spec/CLE-X/CLE-X-3.md", kept["text"])
        self.assertIn(kept["heading"], kept["text"])
        body = kept["text"].split(kept["heading"])[0]
        self.assertNotIn("spec/CLE-X/CLE-X-1.md", body)


class BranchChangedRelsAgainstRealGitTest(unittest.TestCase):
    """`_branch_changed_rels` is the ONLY source of tier 0 — test it on real git.

    A mutant returning `set()` would leave tier 0 permanently empty — silently
    reverting the main fix — and a lambda-replaced ranker would stay GREEN.
    """

    def _repo(self):
        import os
        import shutil
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)

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
            "emit(sorted(orch._branch_changed_rels(ARG['base'], ARG['root'])))",
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
        self.assertEqual(self._changed(d, "main"), {"spec/added.md", "spec/kept.md"})

    def test_rename_reports_both_sides(self):
        """`--no-renames` is deliberate: a renamed spec is two paths the bundle
        may need to rank, and rename detection would surface only one."""
        d, git = self._repo()
        git("mv", "spec/renamed-from.md", "spec/renamed-to.md")
        git("commit", "-qm", "rename")
        self.assertEqual(self._changed(d, "main"), {"spec/renamed-from.md", "spec/renamed-to.md"})

    def test_unknown_base_yields_empty_not_an_exception(self):
        d, _ = self._repo()
        self.assertEqual(self._changed(d, "no-such-ref"), set())


class TheRepoCopyFixtureTest(unittest.TestCase):
    """`_harness.make_temp_repo_copy` 의 계약 — 갓 만든 사본의 변경 집합은 비어 있고, 사본에서
    **커밋한** 변경은 브랜치 diff 로 보인다. `origin/main` 을 HEAD 에 두는 줄을 지워도 미커밋 프로브는
    초록이었다(뮤턴트 생존, 2026-09-25). 그 줄이 지키는 것을 여기서 직접 잰다."""

    def test_a_commit_in_the_copy_is_in_the_branch_diff(self):
        got = run_in_orchestrator(
            """
            import tempfile
            rel = "spec/CLE-ENG/CLE-ENG-MIGRATION.md"
            with tempfile.TemporaryDirectory() as tmp:
                root = mirror_copy(tmp)
                before = sorted(orch._edited_rels("origin/main", root))
                with open(os.path.join(root, rel), "a", encoding="utf-8") as fh:
                    fh.write("\\n<!-- committed probe -->\\n")
                _harness.git_in(root, "commit", "-qam", "probe")
                emit({"before": before,
                      "branch": sorted(orch._branch_changed_rels("origin/main", root))})
            """
        )
        self.assertEqual(got["before"], [], "갓 만든 사본의 변경 집합이 비어 있지 않다")
        self.assertEqual(got["branch"], ["spec/CLE-ENG/CLE-ENG-MIGRATION.md"])

    def test_no_subtrees_is_an_empty_copy_not_an_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = _harness.make_temp_repo_copy(Path(tmp) / "repo")
            head = _harness.git_in(repo, "rev-parse", "HEAD").stdout.strip()
            ref = _harness.git_in(repo, "rev-parse", "origin/main").stdout.strip()
            tracked = _harness.git_in(repo, "ls-files").stdout.split()
        self.assertEqual(ref, head)
        self.assertEqual(tracked, [".gitkeep"])


class SpliceHelperTest(unittest.TestCase):
    def test_splice_lands_on_a_chunk_boundary(self):
        """헬퍼 계약. 경계를 벗어나면 한 파일의 본문이 둘로 갈린다."""
        placed = run_in_orchestrator(
            """
            import re
            S = orch._BUNDLE_FILE_SENTINEL
            bundle = "### 라벨\\n" + "".join(
                f"{S}#### `f{i}.md`\\n```\\nbody{i}\\n```\\n" for i in range(4))
            chunk = f"{S}#### `<diff>`\\n\\n```diff\\n+x\\n```\\n"
            emit([re.findall(r"^#### `([^`]+)`", orch._splice_chunk(bundle, chunk, n), re.M)
                  for n in ARG])
            """,
            [0, 2, 4],
        )
        self.assertEqual(placed[0], ["<diff>", "f0.md", "f1.md", "f2.md", "f3.md"])
        self.assertEqual(placed[1], ["f0.md", "f1.md", "<diff>", "f2.md", "f3.md"])
        self.assertEqual(placed[2], ["f0.md", "f1.md", "f2.md", "f3.md", "<diff>"])

    def test_an_empty_bundle_still_carries_the_diff(self):
        out = run_in_orchestrator("emit(orch._splice_chunk('### 라벨\\n(없음)\\n', 'DIFF', 3))")
        self.assertIn("DIFF", out)


class MirrorPredicateTest(unittest.TestCase):
    def test_is_nerv_mirror(self):
        out = run_in_orchestrator(
            """
            cases = ["spec/README.md", "spec/CLE-VISION.md", "spec/CLE-ACCT/CLE-ACCT.md",
                     "spec/0-overview.md", "spec/5-system/1-auth.md",
                     "spec/conventions/README.md", "spec/5-system/CLE-x.md"]
            emit([orch.is_nerv_mirror(ROOT + "/" + c, ROOT + "/spec") for c in cases])
            """
        )
        self.assertEqual(out, [True, True, True, False, False, False, False])

    def test_the_real_mirror_is_found(self):
        """미러가 비면 위 단언이 모두 공허해진다 — 이 체크아웃의 미러를 실제로 읽는다."""
        keys = run_in_orchestrator(
            "emit(sorted(orch.mirror_key(p) for p in orch.collect_mirror_files(ROOT + '/spec')))")
        self.assertIn("CLE-ENG-SPECEVIDENCE", keys)
        self.assertNotIn("README", keys)
        self.assertGreater(len(keys), 100)


if __name__ == "__main__":
    unittest.main()
