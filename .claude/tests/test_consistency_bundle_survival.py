"""Whether the documents a review is about SURVIVE the budget — not where they rank.

`test_consistency_bundle_priority` pins the ranking: changed → `--focus` and
covering documents → mentioned → the rest. Ranking was never the failure. NERV
Task `CLE-T-TR583V` measured it on 2026-11-07 (main `18ea39e69`, default budget
262,144 characters, so a corpus share of 104,857):

- `--impl-prep CLE-ENG-SPECEVIDENCE`: `cross_spec` carried **0 of 134** related
  specs, `convention_compliance` 0 of 44, `naming_collision` 0 of 178. The first
  ranked document (`CLE-CHAT-CORE`, 101,434 characters) did not fit with the
  omission notice, so `kept.pop()` dropped everything behind it and then it.
- `--impl-done` replaying PR #1654 (four scope keys): the implementation diff
  (30,605 characters) was cut from all four prompts. It sat behind seven
  documents added by the `## 구현 위치` comparison.
- The 2026-09-10 case recorded on the Task: rank 1 was 82,740 characters, rank 2
  (29,470) did not fit the 22,078 left, and rank 3 (8,289) — which did — died
  with it, because truncation only ever drops the tail.

So the subject of every test here is survival: a file that fits is in the
prompt, an important file that does not fit is named where the checker will act
on it, and the window is never exceeded. Each canary is RED on the tail-drop
implementation.

Fresh-interpreter convention as in the sibling suites: importing the
orchestrator in-process collides on the name `_lib`.
"""

from __future__ import annotations

import json
import os
import random
import re
import subprocess
import sys
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
        """
    ),
)


def run_in_orchestrator(snippet: str, arg=None):
    return _harness.run_in_orchestrator(_PREAMBLE, snippet, arg)


_CONSTS = run_in_orchestrator(
    """
    emit({"sentinel": orch._BUNDLE_FILE_SENTINEL,
          "heading": orch.OMITTED_FILES_HEADING,
          "priority_heading": orch.PRIORITY_OMITTED_HEADING})
    """
)
_SENTINEL = _CONSTS["sentinel"]
HEADING = _CONSTS["heading"]
PRIORITY_HEADING = _CONSTS["priority_heading"]


def bundle(*pairs):
    """Build a bundle the way `format_file_bundle` does, without touching disk."""
    parts = ["### 라벨\n"]
    for rel, body in pairs:
        parts.append(f"{_SENTINEL}#### `{rel}`\n```\n{body}\n```\n")
    return "".join(parts)


def chunk_len(rel, body):
    return len(f"{_SENTINEL}#### `{rel}`\n```\n{body}\n```\n")


def fit(text, budget, priority=None):
    """`_fit_bundle` → {"text", "dropped"}. `priority=None` means every file is a priority."""
    return run_in_orchestrator(
        """
        text, dropped = orch._fit_bundle(ARG[0], ARG[1], ARG[2])
        emit({"text": text, "dropped": dropped})
        """,
        [text, budget, priority],
    )


def kept_bodies(text):
    """Paths whose BODY is in the output (a stub carries the path but no fence)."""
    return re.findall(r"^#### `([^`]+)`\n```\n", text, re.M)


def notice_sections(text):
    """{"priority", "unreadable", "other"} → the names listed under each notice heading."""
    sections = {"priority": [], "unreadable": [], "other": []}
    at = text.find(HEADING)
    if at < 0:
        return sections
    current = None
    for line in text[at:].splitlines():
        if line.startswith(PRIORITY_HEADING):
            current = "priority"
        elif line.startswith(UNREADABLE_MARK):
            current = "unreadable"
        elif line.startswith(OTHER_MARK):
            current = "other"
        else:
            m = re.match(r"^- `([^`]+)`$", line)
            if m and current:
                sections[current].append(m.group(1))
    return sections


OTHER_MARK = run_in_orchestrator("emit(orch.OTHER_OMITTED_HEADING)")
UNREADABLE_MARK = run_in_orchestrator("emit(orch.UNREADABLE_OMITTED_HEADING)")
DIFF_LABEL = "<git diff origin/main...HEAD -- codebase>"
# What `session.truncate_to_budget` leaves when it clips (the nothing-fits fallback).
CLIPPED = "truncated due to size limit"


class GreedyFillTest(unittest.TestCase):
    """A file that fits is carried even when one ranked ahead of it does not."""

    # The 2026-09-10 sizes recorded on the Task, as chunk lengths.
    SHARE = 104_857

    def _case(self):
        sizes = {"spec/CLE-A/CLE-A-1.md": 82_740, "spec/CLE-A/CLE-A-2.md": 29_470,
                 "spec/CLE-A/CLE-A-3.md": 8_289}
        pairs = []
        for rel, size in sizes.items():
            pairs.append((rel, "x" * (size - chunk_len(rel, ""))))
        # The rest of the corpus: many ordinary documents behind the three.
        for i in range(110):
            rel = f"spec/CLE-Z/CLE-Z-{i}.md"
            pairs.append((rel, "z" * 20_000))
        return pairs, list(sizes)

    def test_rank_three_survives_when_rank_two_does_not_fit(self):
        """Canary (i). Tail drop killed rank 3 together with rank 2."""
        pairs, ranked = self._case()
        out = fit(bundle(*pairs), self.SHARE, ranked)
        kept = kept_bodies(out["text"])
        self.assertIn("spec/CLE-A/CLE-A-1.md", kept)
        self.assertIn("spec/CLE-A/CLE-A-3.md", kept,
                      "rank 3 fits after rank 1 and must not die with rank 2")
        self.assertNotIn("spec/CLE-A/CLE-A-2.md", kept)
        self.assertIn("spec/CLE-A/CLE-A-2.md", notice_sections(out["text"])["priority"])
        self.assertLessEqual(len(out["text"]), self.SHARE)

    def test_an_oversized_first_document_does_not_empty_the_bundle(self):
        """Canary (ii). Measured: `CLE-CHAT-CORE` (101,434) led `cross_spec` and 0 of 134 survived."""
        first = "spec/CLE-CHAT/CLE-CHAT-CORE.md"
        pairs = [(first, "c" * 101_434)] + [
            (f"spec/CLE-Z/CLE-Z-{i}.md", "z" * 22_708) for i in range(133)]
        out = fit(bundle(*pairs), self.SHARE, [first])
        kept = kept_bodies(out["text"])
        self.assertNotIn(first, kept)
        self.assertGreaterEqual(len(kept), 3, "the documents behind the oversized one fit and were dropped")
        self.assertEqual(kept[:3], ["spec/CLE-Z/CLE-Z-0.md", "spec/CLE-Z/CLE-Z-1.md",
                                    "spec/CLE-Z/CLE-Z-2.md"], "the fill must follow bundle order")
        self.assertIn(first, notice_sections(out["text"])["priority"])

    def test_a_dropped_file_really_did_not_fit(self):
        """Greedy, not merely "something survives": no dropped file fits in what is left."""
        pairs, ranked = self._case()
        out = fit(bundle(*pairs), self.SHARE, ranked)
        room = self.SHARE - len(out["text"])
        sizes = {rel: chunk_len(rel, body) for rel, body in pairs}
        for rel in out["dropped"]:
            with self.subTest(rel=rel):
                self.assertGreater(sizes[rel], room)


class GeneratedBundleInvariantTest(unittest.TestCase):
    """The invariants the curated cases cannot cover, over generated bundles.

    Sizes, counts, budgets and priority sets come from a seeded generator so a
    failure reproduces. Invariants: never over budget; every file either whole
    in the body or named exactly once; kept files in bundle order; and no
    dropped file would have fit in the room left (greedy maximality).
    """

    def test_invariants_hold_for_generated_bundles(self):
        rng = random.Random(20261107)
        cases = []
        for _ in range(60):
            n = rng.randint(1, 40)
            pairs = [(f"spec/CLE-G/CLE-G-{i}.md", "g" * rng.choice(
                [1, 5, 40, 300, 2_000, 9_000, 30_000])) for i in range(n)]
            text = bundle(*pairs)
            budget = rng.randint(200, max(201, len(text) + 500))
            priority = None if rng.random() < 0.3 else [
                rel for rel, _ in pairs if rng.random() < 0.3]
            cases.append({"pairs": pairs, "text": text, "budget": budget, "priority": priority})
        results = run_in_orchestrator(
            """
            out = []
            for case in ARG:
                text, dropped = orch._fit_bundle(case["text"], case["budget"], case["priority"])
                out.append({"text": text, "dropped": dropped})
            emit(out)
            """,
            cases,
        )
        for i, (case, res) in enumerate(zip(cases, results)):
            with self.subTest(case=i):
                text, dropped = res["text"], res["dropped"]
                rels = [rel for rel, _ in case["pairs"]]
                self.assertLessEqual(len(text), case["budget"])
                kept = kept_bodies(text)
                self.assertEqual(kept, [r for r in rels if r in kept], "kept files out of order")
                self.assertEqual(sorted(kept + dropped), sorted(rels),
                                 "a file is neither kept whole nor reported dropped")
                if CLIPPED in text:
                    # Not even the notice fits (budgets of a few hundred characters):
                    # the pre-existing fallback clips it, so only the accounting holds.
                    continue
                if dropped:
                    self.assertIn(HEADING, text)
                    sections = notice_sections(text)
                    self.assertEqual(sorted(sections["priority"] + sections["other"]),
                                     sorted(dropped), "the notice does not name the drops")
                if HEADING in text and len(text) < case["budget"]:
                    room = case["budget"] - len(text)
                    for rel, body in case["pairs"]:
                        if rel in dropped:
                            self.assertGreater(chunk_len(rel, body), room, rel)


class PriorityNoticeTest(unittest.TestCase):
    """What the checker reads about the files it did not get."""

    def _out(self, priority):
        text = bundle(("spec/a.md", "A" * 400), ("spec/p.md", "P" * 3_000),
                      ("spec/q.md", "Q" * 3_000))
        return fit(text, 1_600, priority)["text"]

    def test_priority_drops_are_listed_apart_with_an_instruction(self):
        out = self._out(["spec/p.md"])
        sections = notice_sections(out)
        self.assertEqual(sections["priority"], ["spec/p.md"])
        self.assertEqual(sections["other"], ["spec/q.md"])
        self.assertIn("Read", out)
        self.assertIn("미검증 관점", out, "the checker is not told how to report what it did not read")

    def test_only_priority_drops_leave_a_stub_in_place(self):
        """Mechanism 2 on the Task: 112 stubs ≈ 13,400 characters, 18% of the share.

        A stub exists so a surviving label is not misread as an unsubstituted
        placeholder; the notice is the source of truth for names. Stubs for the
        unranked rest of the corpus buy nothing and cost the share.
        """
        out = self._out(["spec/p.md"])
        body = out.split(HEADING)[0]
        self.assertIn("#### `spec/p.md`", body, "a priority drop leaves its stub where it was")
        self.assertNotIn("#### `spec/q.md`", body, "an unranked drop is named only in the notice")

    def test_without_a_priority_set_every_drop_is_a_priority(self):
        """`target_doc`: everything in it is the review target."""
        out = self._out(None)
        sections = notice_sections(out)
        self.assertEqual(sorted(sections["priority"]), ["spec/p.md", "spec/q.md"])
        self.assertEqual(sections["other"], [])
        body = out.split(HEADING)[0]
        self.assertIn("#### `spec/q.md`", body)

    def test_an_empty_priority_set_has_no_priority_section(self):
        out = self._out([])
        self.assertNotIn(PRIORITY_HEADING, out)
        self.assertEqual(sorted(notice_sections(out)["other"]), ["spec/p.md", "spec/q.md"])


class FallbackTest(unittest.TestCase):
    """The two branches for budgets below "every body dropped"."""

    _SMALL = ("spec/CLE-F/CLE-F-small.md", "s" * 20)
    _PAIRS = [(f"spec/CLE-F/CLE-F-{i}.md", "f" * 2_000) for i in range(10)] + [_SMALL]

    def _floor(self):
        """(head length, notice length) with every file dropped."""
        return run_in_orchestrator(
            """
            text = ARG
            head = text.split(orch._BUNDLE_FILE_SENTINEL)[0]
            rels = [orch._chunk_rel(orch._BUNDLE_FILE_SENTINEL + c)
                    for c in text.split(orch._BUNDLE_FILE_SENTINEL)[1:]]
            emit([len(head), len(orch._omitted_notice(rels))])
            """,
            bundle(*self._PAIRS),
        )

    def test_stubs_are_given_up_before_the_names_and_the_files(self):
        """Ten stubs (~150 characters each) do not fit; the names and the small file do.

        Giving up the stubs is what leaves room for the small file. Going
        straight to the nothing-fits branch also drops the stubs, so only the
        small file tells the two apart.
        """
        head, notice = self._floor()
        budget = head + notice + chunk_len(*self._SMALL) + 30
        out = fit(bundle(*self._PAIRS), budget)
        big = [rel for rel, _ in self._PAIRS[:-1]]
        self.assertLessEqual(len(out["text"]), budget)
        self.assertNotIn(CLIPPED, out["text"], "the notice fits and must not be clipped")
        self.assertNotIn("본문 생략됨", out["text"], "stubs that do not fit were kept")
        self.assertEqual(kept_bodies(out["text"]), [self._SMALL[0]])
        self.assertEqual(sorted(notice_sections(out["text"])["priority"]), sorted(big))
        self.assertEqual(sorted(out["dropped"]), sorted(big))

    def test_nothing_fits_reports_every_file_dropped_within_the_budget(self):
        head, notice = self._floor()
        budget = head + notice // 2
        out = fit(bundle(*self._PAIRS), budget)
        self.assertLessEqual(len(out["text"]), budget)
        self.assertEqual(sorted(out["dropped"]), sorted(rel for rel, _ in self._PAIRS))
        self.assertIn(HEADING, out["text"], "the notice heading is the first thing to survive")


class UnreadableChunkTest(unittest.TestCase):
    """A dropped `--impl-done` diff is not a file: it must not be listed as one to `Read`.

    Code round 1 on `CLE-T-TR583V` caught the target bundle sending the diff
    label to the priority list with a `Read` instruction it cannot satisfy. The
    record must still carry it: losing the diff is the cut that matters most.
    """

    _TEXT = bundle((DIFF_LABEL, "D" * 3_000), ("spec/a.md", "A" * 400))

    def test_the_notice_lists_the_diff_apart_from_the_files_to_read(self):
        out = fit(self._TEXT, 1_600)
        self.assertEqual(out["dropped"], [DIFF_LABEL])
        sections = notice_sections(out["text"])
        self.assertEqual(sections["unreadable"], [DIFF_LABEL])
        self.assertEqual(sections["priority"], [])
        self.assertNotIn(PRIORITY_HEADING, out["text"])
        self.assertIn("git -C", out["text"], "the checker is not told how to see the diff")
        self.assertIn("미검증 관점", out["text"])

    def test_the_payload_record_and_stderr_name_the_diff(self):
        res = run_in_orchestrator(
            """
            import contextlib, io
            ctx = {"mode": "impl_done", "target_path": "x", "target_doc": ARG,
                   "related_specs": "", "priority_rels": []}
            subs, omissions = orch.fit_checker_payload(ctx, 2_600, "cross_spec")
            err = io.StringIO()
            with contextlib.redirect_stderr(err):
                orch._report_priority_omissions({"cross_spec": omissions})
            emit({"omissions": omissions, "stderr": err.getvalue()})
            """,
            self._TEXT,
        )
        record = res["omissions"]["target_doc"]
        self.assertEqual(record["priority"], [])
        self.assertEqual(record["unreadable"], [DIFF_LABEL])
        self.assertIn(DIFF_LABEL, res["stderr"], "prepare does not say the diff was cut")


class TargetShareRolloverTest(unittest.TestCase):
    """The share the target does not use goes to the corpora; the window stays the same."""

    _CTX = {
        "mode": "m", "target_path": "x",
        "target_doc": "T" * 10_000,
        "related_specs": "R" * 400_000,
        "rationale_excerpts": "E" * 400_000,
        "conventions": "C" * 400_000,
    }

    def _sizes(self, checker, ctx=None):
        return run_in_orchestrator(
            """
            subs = orch.budget_substitutions(ARG["ctx"], 100_000, ARG["checker"])
            emit({k: len(v) for k, v in subs.items()}
                 | {"prompt": len(orch.build_checker_prompt_body(ARG["checker"], subs))})
            """,
            {"ctx": ctx or self._CTX, "checker": checker},
        )

    def test_a_small_target_lends_its_share_to_the_corpus(self):
        """`--spec` drafts are tens of thousands of characters; 60% of the window sat unused."""
        sizes = self._sizes("cross_spec")
        self.assertGreater(sizes["related_specs"], 80_000)
        self.assertLessEqual(sizes["target_doc"] + sizes["related_specs"], 100_000)

    def test_naming_collision_splits_the_lent_share(self):
        sizes = self._sizes("naming_collision")
        self.assertGreater(sizes["related_specs"], 40_000)
        self.assertGreater(sizes["conventions"], 40_000)
        self.assertLessEqual(
            sizes["target_doc"] + sizes["related_specs"] + sizes["conventions"], 100_000)

    def test_a_window_too_small_to_split_does_not_carry_a_whole_corpus(self):
        """`_fit_bundle` reads a share of 0 as unlimited, so a share is at least 1."""
        ctx = dict(self._CTX, related_specs=bundle(("spec/r.md", "R" * 5_000)),
                   conventions=bundle(("spec/c.md", "C" * 5_000)))
        sizes = run_in_orchestrator(
            """
            subs = orch.budget_substitutions(ARG, 2, "naming_collision")
            emit({k: len(v) for k, v in subs.items()})
            """,
            ctx,
        )
        self.assertLessEqual(sizes["related_specs"], 2, sizes)
        self.assertLessEqual(sizes["conventions"], 2, sizes)

    def test_a_full_target_lends_nothing(self):
        ctx = dict(self._CTX, target_doc="T" * 400_000)
        sizes = self._sizes("cross_spec", ctx)
        self.assertLessEqual(sizes["related_specs"], 40_000)


_MINI = textwrap.dedent(
    """
    def big_mirror(tmp, sizes, *, extra_files=(), commit_after=True):
        '''sizes: {key: (area, type, chars)}. main has everything; `work` adds `extra_files`.'''
        root = os.path.join(tmp, "repo")
        _harness.make_temp_git_repo(root)
        for key, (area, type_, n, body) in sizes.items():
            _harness.write_mirror_doc(root, key, area=area, type_=type_, body=body + "x" * n + "\\n")
        _harness.git_in(root, "add", "-A")
        _harness.git_in(root, "commit", "-qm", "base")
        _harness.git_in(root, "update-ref", "refs/remotes/origin/main", "HEAD")
        _harness.git_in(root, "checkout", "-qb", "work")
        for rel, body in extra_files:
            path = os.path.join(root, rel)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(body)
        if extra_files and commit_after:
            _harness.git_in(root, "add", "-A")
            _harness.git_in(root, "commit", "-qm", "work")
        return root

    def heads(text):
        import re
        return re.findall(r"^#### `([^`]+)`\\n(?:```|\\n```diff)", text, re.M)
    """
)


class ImplDoneSurvivalTest(unittest.TestCase):
    """Canary (iii): the diff and the declared scope outlive the added documents.

    The order itself is pinned in `test_consistency_bundle_priority`
    (`test_the_diff_leads_then_the_scope_then_the_covering_documents`); this is
    what the order buys under a real budget.

    Replaying PR #1654 put seven `## 구현 위치` documents (tier 1) ahead of the
    diff, and the four scope documents filled the target share, so the diff was
    cut from every prompt. A dropped spec document can still be opened by path;
    the diff label is not a file, and the recorded incidents are checkers that
    judged "spec vs implementation" without the implementation.
    """

    def _run(self, budget):
        impl = "## 구현 위치\n\n- `codebase/a/**`\n\n"
        return _harness.run_in_orchestrator(
            _PREAMBLE + _MINI,
            """
            import tempfile
            with tempfile.TemporaryDirectory() as tmp:
                root = big_mirror(tmp, {
                    "CLE-AAA-SCOPE": ("CLE-AAA", "feature", 6_000, "범위 문서\\n"),
                    "CLE-BBB-COVER": ("CLE-BBB", "feature", 17_000, ARG["impl"]),
                }, extra_files=[("codebase/a/x.ts", "export const changed = 1;\\n")])
                ctx = orch.collect_context(Args(impl_done="CLE-AAA-SCOPE", diff_base="origin/main"), root)
                subs = orch.budget_substitutions(ctx, ARG["budget"], "cross_spec")
                emit({"all": heads(ctx["target_doc"]), "kept": heads(subs["target_doc"]),
                      "text": subs["target_doc"]})
            """,
            {"budget": budget, "impl": impl},
        )

    def test_a_large_covering_document_does_not_push_out_the_diff_or_the_scope(self):
        # target share = 60% of 40,000 = 24,000. The diff with either document fits,
        # all three do not: the cover (≈17K) goes in ahead of the scope (≈6K) only if
        # it is ranked first, which is the order this replaced.
        out = self._run(40_000)
        self.assertTrue(any(h.startswith("<git diff") for h in out["kept"]), out["kept"])
        self.assertIn("spec/CLE-AAA/CLE-AAA-SCOPE.md", out["kept"])
        self.assertNotIn("spec/CLE-BBB/CLE-BBB-COVER.md", out["kept"])
        self.assertIn("export const changed", out["text"])


class OmissionRecordTest(unittest.TestCase):
    """Item 5 on the Task: a cut is recorded mechanically, not left to a checker to mention."""

    def test_meta_records_the_priority_documents_each_checker_lost(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "repo"
            _harness.make_temp_git_repo(root)
            _harness.write_mirror_doc(root, "CLE-AAA-T", area="CLE-AAA",
                                      body="CLE-BBB-BIG 와 CLE-BBB-SMALL 을 부른다.\n")
            _harness.write_mirror_doc(root, "CLE-BBB-BIG", area="CLE-BBB", body="b" * 60_000 + "\n")
            _harness.write_mirror_doc(root, "CLE-BBB-SMALL", area="CLE-BBB", body="s" * 500 + "\n")
            for i in range(5):
                _harness.write_mirror_doc(root, f"CLE-CCC-{i}", area="CLE-CCC", body="c" * 3_000 + "\n")
            env = {k: v for k, v in os.environ.items() if k != "CONSISTENCY_OUTPUT_DIR"}
            env["CONSISTENCY_MAX_CONTEXT_SIZE"] = "40000"
            env["CONSISTENCY_AGENTS"] = "cross_spec"
            proc = subprocess.run(
                [sys.executable, str(ORCH), "--impl-prep", "CLE-AAA-T"],
                cwd=str(root), env=env, capture_output=True, text=True, timeout=60,
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)
            session = root / proc.stdout.strip().split("\n")[-1]
            meta = json.loads((session / "meta.json").read_text(encoding="utf-8"))
            prompt = (session / "_prompts" / "cross_spec.md").read_text(encoding="utf-8")

        record = meta.get("bundle_omissions", {}).get("cross_spec", {}).get("related_specs")
        self.assertIsNotNone(record, meta)
        self.assertEqual(record["priority"], ["spec/CLE-BBB/CLE-BBB-BIG.md"])
        self.assertGreaterEqual(record["omitted"], 1)
        self.assertIn("#### `spec/CLE-BBB/CLE-BBB-SMALL.md`\n```", prompt,
                      "the small mentioned document fits and must be carried")
        self.assertIn("CLE-BBB-BIG", proc.stderr, "prepare does not say a priority document was cut")


class RealMirrorSurvivalTest(unittest.TestCase):
    """On the real mirror: the largest document leading a corpus does not empty it.

    The 2026-11-07 measurement was exactly this shape (`CLE-CHAT-CORE` first, 0 of
    134). Asserted structurally — the largest file, whatever it is after the next
    pull — so the test does not pin today's mirror.
    """

    def test_the_largest_document_first_still_leaves_a_carried_corpus(self):
        out = run_in_orchestrator(
            """
            spec_dir = os.path.join(REPO_ROOT, "spec")
            files = [p for p in orch.collect_mirror_files(spec_dir)
                     if orch.mirror_doc_type(p) != orch.CONVENTION_TYPE]
            largest = max(files, key=lambda p: len(orch.read_text_file(p)))
            ordered = [largest] + [p for p in files if p != largest]
            text = orch.format_file_bundle(ordered, REPO_ROOT, "관련 스펙")
            share = int(262144 * orch.CHECKER_BUDGET_RATIO["corpus"])
            fitted, dropped = orch._fit_bundle(
                text, share, [os.path.relpath(largest, REPO_ROOT)])
            emit({"largest_len": len(orch.read_text_file(largest)), "share": share,
                  "files": len(files), "dropped": len(dropped), "len": len(fitted)})
            """
        )
        self.assertGreater(out["files"], 20, "the mirror shrank — revisit this test")
        self.assertLess(out["dropped"], out["files"], out)
        self.assertLessEqual(out["len"], out["share"])


if __name__ == "__main__":
    unittest.main()
