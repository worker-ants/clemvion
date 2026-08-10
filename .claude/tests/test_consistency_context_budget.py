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
import re
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
    imports="os, shutil, subprocess, tempfile",
    extra="""\
class ArgsFor:
    spec = plan = impl_done = diff_base = None
    def __init__(self, area):
        self.impl_prep = REPO_ROOT + "/" + area
""",
)


def run_in_orchestrator(snippet: str, arg=None):
    return _harness.run_in_orchestrator(_PREAMBLE, snippet, arg)


# The real boundary sentinel, fetched from the module rather than retyped.
# This helper reproduces the writer's format, and a hand-copied marker silently
# stops matching the day the writer changes — which is exactly what happened
# when the boundary moved off `#### \`` onto a sentinel.
_SENTINEL = run_in_orchestrator("emit(orch._BUNDLE_FILE_SENTINEL)")


def bundle(*pairs):
    """Build a bundle the way `format_file_bundle` does, without touching disk."""
    parts = ["### 라벨\n"]
    for rel, body in pairs:
        parts.append(f"{_SENTINEL}#### `{rel}`\n```\n{body}\n```\n")
    return "".join(parts)


class ContentCannotForgeAFileBoundaryTest(unittest.TestCase):
    r"""A level-4 heading inside a file body is not a file boundary.

    (Raw docstring: the backtick escapes below are not escapes at all, and a
    plain string makes them a DeprecationWarning that becomes a SyntaxError in
    a later Python.)

    The splitter used to cut on ``\n#### \`` — the same characters a spec body
    legitimately writes. `spec/5-system/5-expression-language.md` really does
    define ``#### \`$trigger\```, ``#### \`$env\``` and ``#### \`_selectedPort\```,
    and measured on `--impl-prep spec/5-system/` the omission notice listed 21
    entries of which **three were those headings**, not files.

    The wrong count was the visible half. The dangerous half: one file split
    into several chunks, so dropping "a file" could drop only its TAIL and leave
    the head rendered as though complete — the property this suite exists to
    guarantee. These tests assert conservation (kept + dropped == input), which
    a per-file assertion would not have caught.

    A third test ("a kept file keeps its tail") was written here and then
    removed: no fixture could make it fail under the old boundary. A small
    file's fragments are all cheap enough to survive together, and enlarging it
    until they straddle the budget made the case turn on arithmetic rather than
    on the property. Conservation already covers it — a file that lost its tail
    shows up as an extra name on one side of the equation. A test that cannot
    fail is worse than no test; it reads as coverage.
    """

    @staticmethod
    def _truncate(text, budget):
        return run_in_orchestrator(
            "emit(orch.truncate_file_bundle(ARG[0], ARG[1]))", [text, budget]
        )

    # A body that forges the OLD marker on every line shape the real writer uses.
    _FORGED = "\n#### `$trigger`\n설명\n\n#### `$env`\n설명\n\n#### `_selectedPort`\n설명\n"

    def test_forged_headings_never_reach_the_omission_list(self):
        text = bundle(("a.md", self._FORGED), ("b.md", "B" * 600),
                      ("c.md", "C" * 600))
        out = self._truncate(text, 900)
        heading = run_in_orchestrator("emit(orch.OMITTED_FILES_HEADING)")
        listed = re.findall(r"^- `([^`]+)`", out[out.index(heading):], re.M)
        self.assertTrue(listed, "nothing was dropped — case is vacuous")
        self.assertTrue(all(x.endswith(".md") for x in listed),
                        f"non-file entries leaked into the notice: {listed}")

    def test_every_input_file_is_either_kept_whole_or_named(self):
        rels = ["a.md", "b.md", "c.md"]
        text = bundle(("a.md", self._FORGED), ("b.md", "B" * 600),
                      ("c.md", "C" * 600))
        out = self._truncate(text, 900)
        heading = run_in_orchestrator("emit(orch.OMITTED_FILES_HEADING)")
        i = out.index(heading)
        # 드롭된 파일은 이제 **자리에 표식**을 남기므로 sentinel 헤딩만 세면 그 파일이
        # "본문이 실린 파일" 로 중복 계상된다. 표식 여부로 갈라야 계정이 맞는다.
        chunks = out[:i].split(_SENTINEL)[1:]
        name_of = lambda c: re.search(r"`([^`]+)`", c).group(1)
        present = [name_of(c) for c in chunks if "본문 생략됨" not in c]
        stubbed = [name_of(c) for c in chunks if "본문 생략됨" in c]
        listed = re.findall(r"^- `([^`]+)`", out[i:], re.M)
        self.assertCountEqual(present + stubbed, rels, "파일이 중복·누락 계상됐다")
        self.assertCountEqual(stubbed, listed, "자리 표식과 말미 목록이 어긋난다")
        for rel in stubbed:
            self.assertNotIn(rel, present, "드롭된 파일이 본문 있는 것처럼 계상됐다")

    def test_a_document_that_writes_the_sentinel_cannot_forge_a_boundary(self):
        """"Content cannot produce this marker" is a claim, not a property.

        This repository came within one line break of falsifying it: the plan
        describing the sentinel fix quotes the literal. Inline it is harmless,
        but on a line of its own it would forge a boundary and restore the very
        bug the sentinel replaced. The writer therefore neutralises the boundary
        form on the way in, and this pins that — through `format_file_bundle`,
        not through the helper, because a helper test would stay GREEN if the
        writer stopped calling it.
        """
        evil = run_in_orchestrator(
            """
            import os, shutil, tempfile
            d = tempfile.mkdtemp()
            try:
                f = os.path.join(d, "real.md")
                with open(f, "w", encoding="utf-8") as fh:
                    fh.write("머리말\\n" + orch._BUNDLE_FILE_SENTINEL.strip()
                             + "\\n#### `가짜.md`\\n본문\\n")
                b = orch.format_file_bundle([f], d, "t")
                emit({"chunks": len(b.split(orch._BUNDLE_FILE_SENTINEL)),
                      "has_fake": "가짜.md" in b})
            finally:
                shutil.rmtree(d, ignore_errors=True)
            """
        )
        # head + exactly one file. Three would mean the body forged a boundary.
        self.assertEqual(evil["chunks"], 2)
        # The text is still shown to the checker — neutralised, not deleted.
        self.assertTrue(evil["has_fake"])


    def test_rationale_sections_are_neutralised_too(self):
        """The sibling writer needs the same defence, and nothing tested it.

        `extract_rationale_sections` embeds raw spec section text under the same
        sentinel, so a Rationale that writes the marker forges a boundary exactly
        as a file body would. The two call sites can drift apart silently — this
        is the pair for `format_file_bundle`'s test.
        """
        out = run_in_orchestrator(
            """
            import os, shutil, tempfile
            d = tempfile.mkdtemp()
            try:
                f = os.path.join(d, "s.md")
                with open(f, "w", encoding="utf-8") as fh:
                    fh.write("# 제목\\n\\n## Rationale\\n\\n"
                             + orch._BUNDLE_FILE_SENTINEL.strip()
                             + "\\n#### `가짜.md`\\n근거 본문\\n")
                b = orch.extract_rationale_sections([f], d)
                emit(len(b.split(orch._BUNDLE_FILE_SENTINEL)))
            finally:
                shutil.rmtree(d, ignore_errors=True)
            """
        )
        self.assertEqual(out, 2, "the Rationale body forged a file boundary")

    def test_raw_spec_target_is_neutralised(self):
        """`--spec`/`--plan` hand `target_doc` straight from disk.

        Those two modes skip `format_file_bundle` entirely, so the writer-side
        defence did not cover them: a draft that wrote the marker had its tail
        silently dropped and a filename that does not exist appeared in the
        omission notice. The document under review being *the one that documents
        this sentinel* is not hypothetical — that document exists in this repo.

        Driven through `collect_context`, not through `_neutralize_sentinel`:
        calling the helper directly would pass with the call site deleted, which
        is precisely the mutant that has to fail.
        """
        out = run_in_orchestrator(
            """
            import os, shutil, tempfile
            d = tempfile.mkdtemp()
            try:
                f = os.path.join(d, "draft.md")
                with open(f, "w", encoding="utf-8") as fh:
                    fh.write("앞\\n" + orch._BUNDLE_FILE_SENTINEL.strip()
                             + "\\n#### `가짜파일.md`\\n" + "X" * 3000 + "\\n뒤\\n")

                class A:
                    plan = impl_prep = impl_done = diff_base = None
                    spec = f
                ctx = orch.collect_context(A(), REPO_ROOT)
                td = ctx["target_doc"]
                cut = orch.truncate_file_bundle(td, 1500)
                emit({"chunks": len(td.split(orch._BUNDLE_FILE_SENTINEL)),
                      "fake_listed": "가짜파일.md" in cut
                                     and orch.OMITTED_FILES_HEADING in cut})
            finally:
                shutil.rmtree(d, ignore_errors=True)
            """
        )
        self.assertEqual(out["chunks"], 1, "raw target forged a file boundary")
        self.assertFalse(out["fake_listed"], "a non-existent file was 'omitted'")


    def test_impl_done_diff_is_its_own_named_chunk(self):
        """The diff must be droppable BY NAME, not swallowed with a spec file.

        Before it carried a boundary of its own it rode on the last spec chunk,
        so a budget cut took it away while the notice named only the spec file —
        a checker then compared "spec vs implementation" with no implementation
        in front of it and nothing saying so.

        Note what is NOT asserted here. `_neutralize_sentinel` is also applied to
        the diff text, but a git diff cannot forge a boundary in the first place:
        every content line carries a `+`/`-`/space prefix, so the marker comes out
        as `+<!-- @bundle-file -->` and never starts a line (measured). The
        neutralisation stays as defence-in-depth for a future change in how the
        diff is embedded; writing a test for it would mean building an input that
        `git diff` cannot produce, and it would pass for the wrong reason.
        """
        out = run_in_orchestrator(
            """
            import os, shutil, subprocess, tempfile
            d = tempfile.mkdtemp()
            try:
                # 공용 헬퍼 — `-C` + ceiling + 임시경로 단언. 예전엔 raw subprocess 였고
                # 그건 **AST 가드가 볼 수 없는 자리**였다(문자열 안이라 호출로 파싱되지
                # 않는다). preamble 이 `_harness` 를 실어 보내며 그 사각이 닫혔다.
                def git(*a):
                    _harness.git_in(d, *a)
                _harness.make_temp_git_repo(d, initial_commit=False)
                os.makedirs(os.path.join(d, "spec", "area"))
                os.makedirs(os.path.join(d, "codebase"))
                with open(os.path.join(d, "spec", "area", "a.md"), "w") as fh:
                    fh.write("spec 본문\\n")
                with open(os.path.join(d, "codebase", "x.ts"), "w") as fh:
                    fh.write("const a = 1\\n")
                git("add", "-A"); git("commit", "-qm", "base")
                git("checkout", "-qb", "work")
                with open(os.path.join(d, "codebase", "x.ts"), "w") as fh:
                    fh.write("const a = 2\\n")
                git("add", "-A"); git("commit", "-qm", "work")

                class A:
                    spec = plan = impl_prep = None
                    diff_base = "main"
                    impl_done = os.path.join(d, "spec", "area")
                td = orch.collect_context(A(), d)["target_doc"]
                emit({"chunks": len(td.split(orch._BUNDLE_FILE_SENTINEL)),
                      "diff_named": "git diff" in td})
            finally:
                shutil.rmtree(d, ignore_errors=True)
            """
        )
        # head + one spec file + the diff. Two would mean the diff is riding on
        # the spec chunk again, which is the regression.
        self.assertEqual(out["chunks"], 3)
        self.assertTrue(out["diff_named"])

    def test_plan_mode_target_is_neutralised(self):
        """`--plan` shares the raw-read path with `--spec` and was equally open."""
        out = run_in_orchestrator(
            """
            import os, shutil, tempfile
            d = tempfile.mkdtemp()
            try:
                f = os.path.join(d, "task.md")
                with open(f, "w", encoding="utf-8") as fh:
                    fh.write("앞\\n" + orch._BUNDLE_FILE_SENTINEL.strip()
                             + "\\n#### `가짜plan.md`\\n뒤\\n")

                class A:
                    spec = impl_prep = impl_done = diff_base = None
                    plan = f
                ctx = orch.collect_context(A(), REPO_ROOT)
                emit(len(ctx["target_doc"].split(orch._BUNDLE_FILE_SENTINEL)))
            finally:
                shutil.rmtree(d, ignore_errors=True)
            """
        )
        self.assertEqual(out, 1, "the plan body forged a file boundary")


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
        # 850: 드롭된 파일이 자리 표식을 남기게 된 뒤 실측한 값이다(하나만 살아남는
        # 최소 예산 805). 헐거우면 아무것도 안 잘려 vacuous 해지는데, 아래 두 부정
        # 단언이 그걸 막는다 — B·C 는 반드시 드롭돼야 한다.
        text = bundle(("a.md", "A" * 400), ("b.md", "B" * 400), ("c.md", "C" * 400))
        out = self._truncate(text, 850)
        self.assertIn("A" * 400, out, "the first file should survive intact")
        self.assertNotIn("B" * 10, out)
        self.assertNotIn("C" * 10, out)

    def test_the_dropped_files_are_named(self):
        text = bundle(("a.md", "A" * 400), ("keep/b.md", "B" * 400),
                      ("keep/c.md", "C" * 400))
        out = self._truncate(text, 700)
        self.assertIn("keep/b.md", out)
        self.assertIn("keep/c.md", out)

    def test_a_dropped_chunk_leaves_a_stub_where_it_was(self):
        """이름 목록만으로는 "잘렸다" 와 "조립이 실패했다" 가 구분되지 않는다.

        실제로 한 checker 가 살아남은 이름표를 "미치환 placeholder" 로 오진해 CRITICAL 을
        냈다(2026-08-06). 자리에 잘린 사실이 남아 있으면 그 오진이 불가능하다.
        """
        text = bundle(("a.md", "A" * 400), ("gone/b.md", "B" * 400))
        out = self._truncate(text, 800)
        self.assertIn("A" * 400, out, "첫 파일은 온전히 살아야 한다")
        self.assertNotIn("B" * 10, out, "드롭된 파일의 본문은 없어야 한다")
        # 자리 표식: 경로 + "생략" 사실 + 원래 크기
        self.assertIn("gone/b.md", out)
        self.assertIn("본문 생략됨", out, "잘렸다는 사실이 본문 자리에 없다")
        self.assertIn("조립 실패가 아니라", out, "오진을 막는 문구가 없다")

    def test_the_stub_reports_the_original_size(self):
        """크기가 없으면 "얼마나 잘렸나" 를 읽는 쪽이 알 수 없다."""
        text = bundle(("a.md", "A" * 400), ("gone/b.md", "B" * 400))
        out = self._truncate(text, 800)
        # 청크는 헤더 포함이라 400 보다 크다 — 자리수 구분 쉼표 표기까지 확인한다.
        import re
        m = re.search(r"원래 ([\d,]+) 자", out)
        self.assertIsNotNone(m, "원래 크기가 표식에 없다")
        self.assertGreater(int(m.group(1).replace(",", "")), 400)

    def test_stubs_are_counted_against_the_budget(self):
        """표식도 길이를 차지한다. 계상하지 않으면 이 함수가 스스로 상한을 넘긴다 —
        이 저장소가 안내문 길이를 빠뜨려 반복해 데인 지점이다."""
        text = bundle(*[(f"d/f{i}.md", "X" * 300) for i in range(8)])
        for budget in (400, 700, 1200, 2000, 3000):
            out = self._truncate(text, budget)
            self.assertLessEqual(
                len(out), budget, f"budget={budget} 에서 상한 초과 ({len(out)} 자)"
            )

    def test_a_stub_never_costs_more_than_the_body_it_replaces(self):
        """표식이 청크보다 크면 드롭이 총량을 **늘린다** — 루프가 역행한다.

        작은 파일이 잔뜩인 번들이 그 형태다. 표식을 무조건 남기면 하나씩 드롭할수록
        길이가 늘어 **끝내 아무것도 안 맞고** fallback 절단으로 떨어진다.

        실측(파일 30개 × 본문 1자, 예산 900): 가드가 있으면 본문 11개가 실려 883자를
        쓰고, 가드를 빼면 본문 0개에 487자 — 예산의 절반을 남긴 채 실을 수 있던 11개를
        버린다. 손상은 계정(30/30)이 아니라 **내용 보존**에서 난다. 계정만 세면 이
        결함이 통과한다 — 실제로 처음 쓴 이 테스트가 그렇게 통과했다.

        미살해 뮤턴트 1건을 밝혀둔다: 비용 가드의 `<` 를 `<=` 로 바꾸면 살아남는다.
        표식과 본문 길이가 **정확히 같을 때만** 갈리는 경계라 출력 길이가 동일하고,
        그 픽스처는 경로 길이·자리수까지 맞춰야 나온다. 값이 아니라 억지를 재게 되므로
        테스트를 만들지 않았다.
        """
        tiny = bundle(*[(f"t/{i}.md", "x") for i in range(30)])
        out = self._truncate(tiny, 900)
        self.assertLessEqual(len(out), 900)

        heading = run_in_orchestrator("emit(orch.OMITTED_FILES_HEADING)")
        self.assertIn(heading, out, "이름 목록이 통째로 잘려 나갔다")
        chunks = out.split(_SENTINEL)[1:]
        present = [c for c in chunks if "```" in c and "본문 생략됨" not in c]
        self.assertGreater(
            len(present), 0,
            "표식이 자기 본문보다 비싼데도 남아, 실을 수 있던 파일을 전부 밀어냈다",
        )
        # 그 작은 파일 자리에는 표식을 남기지 않는다 — 본문보다 비싸기 때문이다.
        self.assertNotIn("본문 생략됨", out)

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


class PlanFilesAreReadOncePerRunTest(unittest.TestCase):
    """같은 파일을 한 실행 안에서 두 번 읽지 않는다 (백로그 §7).

    `collect_context` 는 `plan/in-progress/` 전체를 랭킹 신호용으로 읽고, 곧이어
    `format_file_bundle` 이 같은 디렉터리를 처음부터 다시 읽었다 — 세션당 2배 I/O.
    실측 규모는 30개 430,929 bytes(≈3.5ms)라 아프지는 않았지만 이 브랜치가 만든 회귀였다.

    **호출 횟수로 잰다.** "빨라졌다" 는 기계 상태에 흔들리고, 이 규모에서는 측정 잡음에
    묻힌다 — 캐시가 통째로 빠져도 초록일 수 있다. `open` 을 세면 그 축이 사라진다.
    """

    def test_the_same_path_opens_once(self):
        out = run_in_orchestrator(
            """
            import builtins, os, tempfile
            d = tempfile.mkdtemp()
            f = os.path.join(d, "a.md")
            with open(f, "w") as fh:
                fh.write("x")
            n = {"c": 0}
            _open = builtins.open
            def counting(path, *a, **k):
                if str(path) == f:
                    n["c"] += 1
                return _open(path, *a, **k)
            builtins.open = counting
            try:
                first = orch.read_text_file(f)
                second = orch.read_text_file(f)
            finally:
                builtins.open = _open
            emit({"opens": n["c"], "same": first == second == "x"})
            """
        )
        self.assertTrue(out["same"], "캐시가 내용을 바꾸면 안 된다")
        self.assertEqual(out["opens"], 1,
                         "같은 경로를 두 번 열었다 — 읽기 캐시가 빠졌다")

    def test_clearing_the_cache_re_reads(self):
        """캐시를 비우면 다시 읽는다 — 테스트 격리가 가능해야 한다.

        이게 없으면 한 테스트가 심은 내용이 다음 테스트로 새고, 그 새는 방향이
        '통과' 쪽이라 조용하다.
        """
        out = run_in_orchestrator(
            """
            import os, tempfile
            d = tempfile.mkdtemp()
            f = os.path.join(d, "a.md")
            with open(f, "w") as fh:
                fh.write("first")
            a = orch.read_text_file(f)
            with open(f, "w") as fh:
                fh.write("second")
            stale = orch.read_text_file(f)
            orch._READ_CACHE.clear()
            fresh = orch.read_text_file(f)
            emit({"a": a, "stale": stale, "fresh": fresh})
            """
        )
        self.assertEqual(out["a"], "first")
        self.assertEqual(out["stale"], "first", "한 실행 안에서는 첫 읽기를 유지한다")
        self.assertEqual(out["fresh"], "second")
