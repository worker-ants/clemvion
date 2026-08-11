"""Line-number gutter for reviewer prompt payloads (`lib/line_anchors.py`).

Why this exists: reviewer prompts used to be bare code fences with no line
numbers, so a finding's "위치" was whatever the model counted from the top of
the assembled `_prompts/<agent>.md`. Measured on
`review/code/2026/07/17/20_06_14/`, all seven cited line numbers decoded as
offsets into that 1,385-line document and landed inside the full-context block
of the file they were attributed to — "hydration-coverage.test.ts line 1362"
was that document's L1362, i.e. the file's line 79, in a 99-line file.

The load-bearing property is **not** "it emits numbers" but "every number it
emits points at the right text, and it emits none when it cannot be sure".
`GutterCorrectnessAgainstRealGitTest` therefore replays real repository
history: it annotates actual `git show` output and checks each gutter number
against the real file at that commit. A pure-fixture test would only assert our
model of unified diff; this asserts git's.
"""

from __future__ import annotations

import re
import subprocess
import sys
import unittest
from pathlib import Path

import _harness
from _harness import REPO_ROOT, load_module_by_path

la = load_module_by_path(
    "line_anchors",
    REPO_ROOT / ".claude" / "skills" / "code-review-agents" / "lib" / "line_anchors.py",
)

ORCH = (
    REPO_ROOT / ".claude" / "skills" / "code-review-agents" / "scripts"
    / "code_review_orchestrator.py"
)


def _git(*args: str, cwd=None) -> str:
    # `errors="replace"`: this walks whatever the real repository happens to
    # contain, and `git show <commit>:<path>` on a binary blob hands back raw
    # bytes. With the default strict decoding the harness dies with
    # `UnicodeDecodeError: … byte 0x89 …` (the PNG magic) instead of reporting a
    # test result — which is exactly what the first CI run this repo ever did
    # produced on 2026-08-06. Callers must still skip binaries for correctness
    # (see the `Binary files` guard below); this only keeps the failure mode a
    # test outcome rather than a crash.
    return subprocess.run(
        ["git", *args], capture_output=True, text=True, errors="replace",
        cwd=str(cwd or REPO_ROOT)
    ).stdout


# How far back the fixture search looks, and how much diff a commit must carry
# to be usable. The minimum sits comfortably above the `assertGreater(checked,
# 20)` the callers make, since some changed lines belong to files the
# cross-check skips. Module level so the regression test below can drive the
# same selection against a purpose-built repository.
FIXTURE_SEARCH_DEPTH = 40
MIN_FIXTURE_CHANGED_LINES = 80


def _is_shallow_boundary(sha, cwd=None) -> bool:
    """Is `sha` a commit whose parents were cut away by a shallow clone?

    Such a commit reports its ENTIRE TREE as changed, because git's graft makes
    it look parentless to the diff machinery. Selecting it hands `--prepare` a
    changeset the prompt budget cannot hold — see `pick_commit_fixture`.

    Told apart from a genuine root commit by comparing the two views git offers:
    `rev-list --parents` honours the graft (no parents), while `cat-file commit`
    prints the raw object, whose `parent` headers survive it. Both empty means a
    real root commit, which is fine to select and which the purpose-built
    fixtures below depend on being selectable.
    """
    grafted = len(_git("rev-list", "--parents", "-n", "1", sha, cwd=cwd).split()) <= 1
    if not grafted:
        return False
    return any(
        line.startswith("parent ")
        for line in _git("cat-file", "commit", sha, cwd=cwd).split("\n")
    )


def pick_commit_fixture(cwd=None) -> str:
    """Most recent commit `--prepare` can actually build a diff payload from.

    Not hard-coded to `HEAD` — it may well pick HEAD, but only when HEAD
    qualifies. This suite replays real git history rather than fixtures (unified
    diff is git's format, not ours — see the class notes), but that only works
    if the commit under test actually contains a diff. Pinning HEAD tied the
    result to something the test does not measure: a small doc-only last commit
    yielded 13 annotated lines against a `> 20` assertion, so the suite went RED
    for a change that never touched the gutter — and would have "healed" on the
    next unrelated commit. A threshold low enough for any commit would have been
    the mirror failure: green whether or not the gutter works.

    The file list comes from the SAME command the orchestrator uses, and the
    changed-line count is summed only over those files. Asking `--numstat` on
    its own was a proxy, and on MERGE commits the proxy disagrees with the
    consumer: `git show --numstat` falls back to the diff against the FIRST
    PARENT, while `git show --name-only` prints the combined diff, which is
    empty whenever the merge resolved to one parent for every file. So a routine
    "merge origin/main into my branch" commit reported plenty of changed lines,
    got selected, and then `--prepare` found no reviewable files and wrote no
    prompts at all — the suite went RED on any branch that had merged main in,
    which is most of them. Measured on this repository: one such merge reported
    1,390 changed lines and 0 files.

    Third variant, 2026-08-10 — a **deletion-only** commit. It clears the
    threshold with room to spare and then cross-checks nothing: the consumers
    resolve source via `git show <sha>:<path>`, which is empty for every path the
    commit removed, so every diff line is skipped and `checked` lands at 0.
    Measured on `e4ce8adf8` (9 files, 627 deletions) — the suite went RED for a
    commit that never touched the gutter. Selection therefore requires at least
    one path that still resolves to content at `sha`.
    `CommitFixtureSelectionTest._make_deletion_only_repo` pins it against a
    purpose-built repository, for the same reason the merge case is: the commit
    that exposed it drops out of the search window as history accumulates, and a
    guard that is only green by accident of history is not a guard.

    Fourth variant, 2026-08-11 — the **shallow boundary** commit. The sentence
    that stood here claimed a shallow CI clone was "harmless, because a shallow
    root has no parent and lists its whole tree, clearing the threshold easily".
    Clearing the threshold was never the question. Listing the WHOLE TREE is:
    measured on this repository, `actions/checkout`'s default `fetch-depth: 1`
    makes the boundary commit report **19,591 files**, and `build_files_section`
    then hits the branch it documents itself ("past enough files, headers alone
    consume the cap, nothing gets content"), collapsing to a single aggregate
    omission note. Zero diff lines reach the prompt and `checked` lands at 0 —
    green locally, RED in CI only, which is how `#1131` merged with this suite
    already failing and every later PR inherited it.

    The real fix is upstream — `harness-checks.yml` now checks out enough history
    (measured: depth 1 → RED and >20 min for this module; depth 50 → 40 tests OK
    in 10.9s), and `CheckoutDepthCoversFixtureSearchTest` pins that against
    `FIXTURE_SEARCH_DEPTH`. This filter is the fail-safe underneath it: a shallow
    repository can no longer produce a false RED, only an honest skip.

    A shallow boundary is NOT the same shape as a true root commit, and the
    difference is what this can key off: git's graft hides the parents from
    `rev-list` while the commit OBJECT still carries its `parent` lines. A real
    root commit has neither. That distinction is load-bearing — the purpose-built
    fixtures below rely on their first commit staying selectable.
    """
    log = _git("log", "-n", str(FIXTURE_SEARCH_DEPTH), "--format=%H", cwd=cwd)
    for sha in filter(None, (line.strip() for line in log.split("\n"))):
        if _is_shallow_boundary(sha, cwd=cwd):
            continue
        files = {
            f for f in _git(
                "show", "--no-renames", "--name-only", "--pretty=format:", sha, cwd=cwd
            ).split("\n") if f
        }
        if not files:
            continue
        changed = 0
        for row in _git("show", "--numstat", "--format=", sha, cwd=cwd).split("\n"):
            cols = row.split("\t")
            # "-" marks a binary file; it contributes no gutter lines.
            if len(cols) >= 3 and cols[2] in files:
                changed += sum(int(c) for c in cols[:2] if c.isdigit())
        if changed < MIN_FIXTURE_CHANGED_LINES:
            continue
        # A deletion-only commit clears the threshold with room to spare and then
        # cross-checks nothing: the consumers resolve source via `git show
        # <sha>:<path>`, which is empty for every path the commit removed, so
        # every diff line is skipped and `checked` lands at 0. Measured on
        # `e4ce8adf8` (9 files, 627 deletions) — the suite went RED for a commit
        # that never touched the gutter, the same shape as the doc-only and merge
        # cases above. Require at least one path that still exists at `sha`.
        # `any()` short-circuits, so the usual cost is one `git show`.
        if any(_git("show", f"{sha}:{f}", cwd=cwd).strip() for f in sorted(files)):
            return sha
    return ""


class NumberSourceLinesTest(unittest.TestCase):
    def test_numbers_are_one_based_and_sequential(self):
        out = la.number_source_lines("alpha\nbravo\ncharlie")
        self.assertEqual(
            out.split("\n"),
            ["  1|alpha", "  2|bravo", "  3|charlie"],
        )

    def test_content_after_the_bar_is_verbatim(self):
        """Indentation must survive — reviewers judge nesting from it."""
        out = la.number_source_lines("def f():\n    if x:\n        return 1")
        self.assertTrue(out.split("\n")[2].endswith("        return 1"))

    def test_gutter_widens_with_file_length_and_stays_aligned(self):
        out = la.number_source_lines("x\n" * 1200).split("\n")
        widths = {len(line.split(la.GUTTER_SEP, 1)[0]) for line in out}
        self.assertEqual(len(widths), 1, "gutter column must not jag")
        self.assertEqual(widths.pop(), 4)

    def test_empty_text_is_untouched(self):
        self.assertEqual(la.number_source_lines(""), "")

    def test_start_offset_numbers_a_slice_correctly(self):
        out = la.number_source_lines("a\nb", start=97)
        self.assertEqual(out.split("\n"), [" 97|a", " 98|b"])


class AnnotateUnifiedDiffTest(unittest.TestCase):
    DIFF = (
        "diff --git a/f.py b/f.py\n"
        "index 111..222 100644\n"
        "--- a/f.py\n"
        "+++ b/f.py\n"
        "@@ -10,4 +10,5 @@ def g():\n"
        " ctx_a\n"
        "-gone\n"
        "+added_one\n"
        "+added_two\n"
        " ctx_b\n"
        " ctx_c\n"
    )

    def _gutters(self, annotated):
        """[(gutter_text, payload)] for every emitted line."""
        out = []
        for line in annotated.split("\n"):
            cell, _, rest = line.partition(la.GUTTER_SEP)
            out.append((cell.strip(), rest))
        return out

    def test_context_and_added_lines_carry_new_file_numbers(self):
        g = self._gutters(la.annotate_unified_diff(self.DIFF))
        body = [(n, p) for n, p in g if p and p[0] in " +-" and not p.startswith("--- ")]
        self.assertIn(("10", " ctx_a"), body)
        self.assertIn(("11", "+added_one"), body)
        self.assertIn(("12", "+added_two"), body)
        self.assertIn(("13", " ctx_b"), body)
        self.assertIn(("14", " ctx_c"), body)

    def test_removed_lines_have_a_blank_gutter(self):
        """A deleted line has no line number in the new file. Blank, not wrong."""
        g = self._gutters(la.annotate_unified_diff(self.DIFF))
        removed = [(n, p) for n, p in g if p == "-gone"]
        self.assertEqual(removed, [("", "-gone")])

    def test_file_header_lines_are_not_numbered(self):
        g = self._gutters(la.annotate_unified_diff(self.DIFF))
        for cell, payload in g:
            if payload.startswith(("diff --git", "index ", "--- ", "+++ ", "@@")):
                self.assertEqual(cell, "", f"header must not be numbered: {payload}")

    def test_payload_after_the_gutter_is_byte_identical_to_the_input(self):
        """The gutter is additive: strip it and the original diff returns."""
        annotated = la.annotate_unified_diff(self.DIFF)
        stripped = "\n".join(
            line.partition(la.GUTTER_SEP)[2] for line in annotated.split("\n")
        )
        self.assertEqual(stripped, self.DIFF.rstrip("\n"))

    def test_multi_hunk_restarts_numbering_from_each_header(self):
        diff = (
            "--- a/f\n+++ b/f\n"
            "@@ -1,2 +1,2 @@\n ka\n kb\n"
            "@@ -80,2 +90,2 @@\n kc\n kd\n"
        )
        g = [(n, p) for n, p in self._gutters(la.annotate_unified_diff(diff)) if p.startswith(" k")]
        self.assertEqual(g, [("1", " ka"), ("2", " kb"), ("90", " kc"), ("91", " kd")])

    def test_multiple_files_in_one_payload_each_restart(self):
        """`get_git_diff_content` concatenates the cached and unstaged diffs."""
        diff = (
            "diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -5,1 +5,1 @@\n one\n"
            "diff --git a/b b/b\n--- a/b\n+++ b/b\n@@ -70,1 +70,1 @@\n two\n"
        )
        g = [(n, p) for n, p in self._gutters(la.annotate_unified_diff(diff)) if p in (" one", " two")]
        self.assertEqual(g, [("5", " one"), ("70", " two")])

    def test_omitted_count_defaults_to_one(self):
        """`@@ -3 +3 @@` is legal shorthand for a single-line range."""
        diff = "--- a/f\n+++ b/f\n@@ -3 +3 @@\n solo\n"
        g = [(n, p) for n, p in self._gutters(la.annotate_unified_diff(diff)) if p == " solo"]
        self.assertEqual(g, [("3", " solo")])

    def test_no_newline_marker_consumes_no_line_number(self):
        diff = "--- a/f\n+++ b/f\n@@ -1,1 +1,2 @@\n keep\n+tail\n\\ No newline at end of file\n"
        g = self._gutters(la.annotate_unified_diff(diff))
        marker = [(n, p) for n, p in g if p.startswith("\\ No newline")]
        self.assertEqual(marker, [("", "\\ No newline at end of file")])
        self.assertIn(("2", "+tail"), g)


class FailOpenTest(unittest.TestCase):
    """The invariant that makes the gutter trustworthy: when unsure, say nothing.

    A confidently wrong anchor is the exact defect this module removes, so every
    degraded path must return the input verbatim rather than guess.
    """

    def test_body_disagreeing_with_declared_counts_is_left_verbatim(self):
        """Header promises 5 context lines, body has 2 → annotate nothing."""
        diff = "--- a/f\n+++ b/f\n@@ -1,5 +1,5 @@\n a\n b\n"
        out = la.annotate_unified_diff(diff)
        self.assertNotIn("1|", out)
        self.assertIn(" a", out)

    def test_combined_merge_diff_is_left_verbatim(self):
        """`@@@` (merge) hunks carry two old sides; we do not model them."""
        diff = "diff --cc f\n@@@ -1,2 -1,2 +1,2 @@@\n  a\n++b\n"
        self.assertEqual(la.annotate_unified_diff(diff), diff)

    def test_non_diff_text_is_left_verbatim(self):
        text = "just some prose\nwith no hunks at all\n"
        self.assertEqual(la.annotate_unified_diff(text), text)

    def test_empty_input_is_left_verbatim(self):
        self.assertEqual(la.annotate_unified_diff(""), "")

    def test_a_broken_hunk_does_not_poison_a_good_one(self):
        """Fail-open is per hunk — one malformed hunk must not disarm the rest."""
        diff = (
            "--- a/f\n+++ b/f\n"
            "@@ -1,9 +1,9 @@\n bad\n"          # counts lie
            "@@ -40,2 +40,2 @@\n good_a\n good_b\n"
        )
        g = dict(
            (p, n) for n, _, p in
            (line.partition(la.GUTTER_SEP) for line in la.annotate_unified_diff(diff).split("\n"))
        )
        self.assertEqual(g[" bad"].strip(), "")
        self.assertEqual(g[" good_a"].strip(), "40")


class TruncateToLineBoundaryTest(unittest.TestCase):
    def test_never_splits_a_line(self):
        """A half-sliced gutter would be a wrong anchor — the thing we forbid."""
        text = la.number_source_lines("\n".join(f"line{i}" for i in range(100)))
        kept, n, total = la.truncate_to_line_boundary(text, 137)
        self.assertEqual(total, 100)
        self.assertLessEqual(len(kept), 137)
        for line in kept.split("\n"):
            self.assertRegex(line, r"^\s*\d+\|line\d+$")
        self.assertEqual(n, len(kept.split("\n")))

    def test_text_under_the_cap_is_returned_whole(self):
        kept, n, total = la.truncate_to_line_boundary("a\nb\nc", 1000)
        self.assertEqual((kept, n, total), ("a\nb\nc", 3, 3))

    def test_reports_how_many_lines_were_dropped(self):
        kept, n, total = la.truncate_to_line_boundary("aaaa\nbbbb\ncccc\ndddd", 9)
        self.assertEqual(total, 4)
        self.assertEqual(n, 2)
        self.assertEqual(kept, "aaaa\nbbbb")

    def test_zero_budget_keeps_nothing_but_still_reports_the_total(self):
        kept, n, total = la.truncate_to_line_boundary("a\nb\nc", 0)
        self.assertEqual((kept, n, total), ("", 0, 3))


class GutterCorrectnessAgainstRealGitTest(unittest.TestCase):
    """Replay real history: does every gutter number point at the real line?

    Deliberately not fixture-based (cf. `.claude/tests/README.md` — the same
    exception `test_review_guard_hardening` takes for rebase dates). Unified
    diff is git's format, not ours; fixtures would only confirm our model of it.
    """

    MAX_COMMITS = 12

    def test_every_gutter_number_matches_the_real_source_line(self):
        commits = _git("log", "--format=%h", f"-{self.MAX_COMMITS}").split()
        if not commits:
            self.skipTest("no git history available")

        checked = annotated_files = 0
        for commit in commits:
            names = [
                f for f in _git(
                    "show", "--no-renames", "--name-only", "--pretty=format:", commit
                ).split("\n") if f
            ]
            for path in names:
                diff = _git("show", "--no-renames", "--pretty=format:", commit, "--", path)
                if not diff.strip():
                    continue
                # A binary blob has no line numbers to anchor, and its bytes are
                # not source. git says so itself rather than emitting hunks.
                if any(ln.startswith("Binary files ") or ln.startswith("GIT binary patch")
                       for ln in diff.split("\n")):
                    continue
                source = _git("show", f"{commit}:{path}")
                if not source:
                    continue  # deleted at this commit — no new side to check
                new_lines = source.split("\n")
                out = la.annotate_unified_diff(diff)
                if out == diff:
                    continue  # failed open; it claimed nothing, so nothing to check
                annotated_files += 1
                for line in out.split("\n"):
                    cell, sep, rest = line.partition(la.GUTTER_SEP)
                    if not sep or not cell.strip().isdigit():
                        continue
                    n = int(cell.strip())
                    marker, content = rest[:1], rest[1:]
                    self.assertIn(
                        marker, (" ", "+"),
                        f"{path}: numbered a line absent from the new file: {rest[:60]!r}",
                    )
                    self.assertLessEqual(
                        n, len(new_lines),
                        f"{path}: gutter {n} exceeds the file's {len(new_lines)} lines",
                    )
                    self.assertEqual(
                        new_lines[n - 1], content,
                        f"{path}: gutter says line {n} but the source has "
                        f"{new_lines[n - 1][:60]!r}, not {content[:60]!r}",
                    )
                    checked += 1

        self.assertGreater(annotated_files, 0, "no diffs were annotated — test is vacuous")
        self.assertGreater(checked, 100, "too few numbers checked to be meaningful")


class PromptPayloadIntegrationTest(unittest.TestCase):
    """The orchestrator must actually put the gutter into `_prompts/<agent>.md`.

    Guards the wiring, not just the helper: an earlier version of this defect
    was invisible precisely because the helper-level behaviour was never the
    thing that reached the reviewer.
    """

    GUTTER = re.compile(r"^(\s*\d+)\|")

    # Two fixtures, because the two block kinds need different inputs:
    #   - diff blocks need an actual diff  → a commit
    #   - whole-file blocks need to fit the prompt budget → a short file list
    # Keying whole-file assertions off `--commit HEAD` made them pass or fail
    # with whatever the repo's last commit happened to be (a large merge commit
    # starved every whole-file block and failed the suite on an unrelated
    # change). These two files are small, tracked, and always present.
    FILES = (
        ".claude/skills/code-review-agents/lib/line_anchors.py",
        ".claude/skills/code-review-agents/lib/router_safety.py",
    )

    def _run_prepare(self, *orch_args):
        import os
        import shutil
        import tempfile

        tmp = tempfile.mkdtemp()
        try:
            r = subprocess.run(
                [sys.executable, str(ORCH), "--prepare", *orch_args],
                capture_output=True, text=True, cwd=str(REPO_ROOT),
                env=dict(os.environ, REVIEW_OUTPUT_DIR=tmp),
            )
            self.assertEqual(r.returncode, 0, r.stderr[-2000:])
            session_dir = Path(r.stdout.strip().split("\n")[-1])
            prompts = sorted((session_dir / "_prompts").glob("*.md"))
            self.assertTrue(prompts, "prepare wrote no prompts")
            return {p.name: p.read_text(encoding="utf-8") for p in prompts}
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def _prepare_commit(self):
        """Prepare over a real commit; cross-check against that commit's blobs."""
        if not _git("rev-parse", "HEAD").strip():
            self.skipTest("no git history available")
        sha = pick_commit_fixture()
        if not sha:
            self.skipTest(
                f"no commit in the last {FIXTURE_SEARCH_DEPTH} with "
                f">={MIN_FIXTURE_CHANGED_LINES} changed lines"
            )
        return (lambda p: _git("show", f"{sha}:{p}")), self._run_prepare("--commit", sha)

    def _prepare_files(self):
        """Prepare over FILES; cross-check against the working tree.

        No cleanliness gate on purpose: `--prepare <files>` reads whole-file
        content straight off disk, and so does this cross-check, so both see the
        same bytes whether or not the file is committed. An earlier version
        skipped when those paths were dirty — which silently disabled the test
        precisely while someone was editing them.
        """

        def read(p):
            try:
                return (REPO_ROOT / p).read_text(encoding="utf-8")
            except OSError:
                return ""

        return read, self._run_prepare(*self.FILES)

    def _walk(self, body):
        """Yield (file_path, block_kind, lineno, content) for every gutter line."""
        current = block = None
        for ln in body.split("\n"):
            if ln.startswith("### 파일 "):
                current, block = ln.split(": ", 1)[1].strip(), None
                continue
            if ln.startswith("#### 변경된 코드"):
                block = "diff"
                continue
            if ln.startswith("#### 전체 파일 컨텍스트"):
                block = "full"
                continue
            m = self.GUTTER.match(ln)
            if not m or current is None or block is None:
                continue
            rest = ln[len(m.group(1)) + 1:]
            if block == "diff":
                # A diff line keeps its own ' '/'+'/'-' marker after the gutter;
                # a whole-file line has no marker at all.
                if rest[:1] not in (" ", "+"):
                    continue
                rest = rest[1:]
            yield current, block, int(m.group(1)), rest

    def test_every_reviewer_prompt_carries_the_legend(self):
        """Not just the router's — the reviewer path builds its header separately."""
        _, prompts = self._prepare_commit()
        reviewer_prompts = [n for n in prompts if n != "_router.md"]
        self.assertGreater(len(reviewer_prompts), 3, "no reviewer prompts to check")
        for name in reviewer_prompts:
            self.assertIn(
                "위치 표기 규약", prompts[name],
                f"{name}: reviewer prompt is missing the gutter legend",
            )
        self.assertIn("위치 표기 규약", prompts.get("_router.md", ""))

    def test_diff_blocks_are_annotated_and_correct(self):
        """Asserted separately from whole-file numbering: measured as a pair, one
        being wired up masks the other being dropped."""
        source_of, prompts = self._prepare_commit()
        name = next(n for n in prompts if n != "_router.md")
        checked = 0
        for path, block, n, content in self._walk(prompts[name]):
            if block != "diff":
                continue
            src = source_of(path)
            if not src:
                continue
            lines = src.split("\n")
            self.assertLessEqual(n, len(lines), f"{path}: gutter {n} past EOF")
            self.assertEqual(
                lines[n - 1], content,
                f"{path}: diff gutter {n} disagrees with the source",
            )
            checked += 1
        self.assertGreater(checked, 20, "no annotated diff lines reached the prompt")

    def test_whole_file_blocks_are_numbered_and_correct(self):
        source_of, prompts = self._prepare_files()
        name = next(n for n in prompts if n != "_router.md")
        checked = 0
        for path, block, n, content in self._walk(prompts[name]):
            if block != "full":
                continue
            src = source_of(path)
            if not src:
                continue
            lines = src.split("\n")
            self.assertLessEqual(n, len(lines), f"{path}: gutter {n} past EOF")
            self.assertEqual(
                lines[n - 1], content,
                f"{path}: whole-file gutter {n} disagrees with the source",
            )
            checked += 1
        self.assertGreater(checked, 20, "no numbered whole-file lines reached the prompt")

    def test_prompt_stays_within_the_size_cap(self):
        """The gutter must not push the payload past the budget it is measured in.

        The cap is read out of the orchestrator itself (via its own interpreter,
        to dodge the two-`_lib` collision) so raising it there cannot silently
        leave this assertion checking a stale number.
        """
        cap = int(subprocess.run(
            [sys.executable, "-c",
             f"import runpy,sys; sys.argv=['x'];"
             f"m=runpy.run_path({str(ORCH)!r}); print(m['DEFAULT_MAX_PROMPT_SIZE'])"],
            capture_output=True, text=True, cwd=str(REPO_ROOT),
        ).stdout.strip() or 0)
        self.assertGreater(cap, 0, "could not read DEFAULT_MAX_PROMPT_SIZE")

        _, prompts = self._prepare_commit()
        for name, body in prompts.items():
            # Slack covers the per-file wrapper overhead the budget accounts for
            # approximately; the point is that the gutter did not blow the cap.
            self.assertLessEqual(
                len(body), cap + 2048,
                f"{name}: {len(body)} chars exceeds the {cap}-char cap",
            )


class CommitFixtureSelectionTest(unittest.TestCase):
    """The fixture search must not pick a commit `--prepare` cannot use.

    Built against a purpose-made repository rather than this one, because the
    shape that broke it is absent from `main`: PRs land squashed, so the last
    merge commit here is hundreds of commits back and the search never reaches
    it. It appears the moment anyone merges `origin/main` into a working branch
    — which is the routine way to refresh one — and then this whole suite goes
    RED for a reason that has nothing to do with the gutter. A guard nobody can
    keep green stops being a guard: "one is always red" is the same outcome as
    deleting it.
    """

    @staticmethod
    def _git(repo, *args):
        return _git(*args, cwd=repo)

    def _new_repo(self):
        """An empty, initialised, self-cleaning temp repo + a bound `git`.

        Shared because both fixtures below need exactly this and nothing more —
        the commit sequences that follow are entirely different, which is why
        only the setup is extracted.

        Writes go through `_harness.git_in`, the hardened path built after the
        2026-08-06 incident where a fixture of exactly this shape rewrote the
        **shared** `.git/config` (five worktrees read it; other sessions' fetches
        broke with no signal). `cwd=` alone does not stop git walking upward when
        the target is not a repository yet — `git -C` + `GIT_CEILING_DIRECTORIES`
        + the temp-dir assertion only work together.

        Both fixtures here predated that helper and kept the unprotected `cwd=`
        shape; extracting the setup is what made it fixable in one place rather
        than two. Reads still use `self._git` (plain `cwd=`), which is correct —
        `git_in` is for the mutating calls that can escape.
        """
        import shutil
        import tempfile

        repo = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, repo, ignore_errors=True)
        env = ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false"]

        def git(*args):
            return _harness.git_in(repo, *env, *args).stdout

        git("init", "-q", "-b", "main", ".")
        return repo, git

    def _make_repo(self):
        """A clean merge: each side touches a DIFFERENT file.

        That is what produces the asymmetry — `git show --numstat` reports the
        diff against the first parent (200 changed lines here), while
        `git show --name-only` reports the COMBINED diff, which is empty because
        every file matches one parent exactly.
        """
        import os

        repo, git = self._new_repo()

        def write(name, prefix):
            with open(os.path.join(repo, name), "w", encoding="utf-8") as fh:
                fh.write("".join(f"{prefix}{i}\n" for i in range(100)))

        write("f.txt", "f")
        write("g.txt", "g")
        git("add", "-A")
        git("commit", "-qm", "base")
        git("checkout", "-qb", "side")
        write("f.txt", "SIDE")
        git("commit", "-qam", "side-change")
        git("checkout", "-q", "main")
        write("g.txt", "MAIN")
        git("commit", "-qam", "main-change")
        git("merge", "--no-ff", "-q", "-m", "merge side", "side")
        return repo

    def test_the_repo_really_has_the_asymmetry(self):
        """Non-vacuity: if git ever stops reporting a merge this way, the test
        below would pass for the wrong reason."""
        repo = self._make_repo()
        self.assertEqual(
            len(self._git(repo, "log", "-1", "--format=%P").split()), 2,
            "HEAD is not a merge commit — the fixture repo was built wrong",
        )
        numstat = [r for r in self._git(
            repo, "show", "--numstat", "--format=", "HEAD").split("\n") if r]
        names = [f for f in self._git(
            repo, "show", "--no-renames", "--name-only", "--pretty=format:",
            "HEAD").split("\n") if f]
        self.assertTrue(numstat, "no numstat rows — the old filter had nothing to trip on")
        self.assertEqual(names, [], "the combined diff is not empty — wrong merge shape")

    def test_a_merge_commit_is_never_selected(self):
        repo = self._make_repo()
        picked = pick_commit_fixture(cwd=repo)
        self.assertTrue(picked, "nothing was selected at all")
        self.assertEqual(
            len(self._git(repo, "log", "-1", "--format=%P", picked).split()), 1,
            "the fixture search selected a merge commit; `--prepare` finds no "
            "files there and writes no prompts",
        )

    def test_the_selected_commit_has_files_prepare_can_see(self):
        """The property that actually matters — stated directly rather than
        via "is not a merge", so a future non-merge shape with the same defect
        is caught too."""
        repo = self._make_repo()
        picked = pick_commit_fixture(cwd=repo)
        names = [f for f in self._git(
            repo, "show", "--no-renames", "--name-only", "--pretty=format:",
            picked).split("\n") if f]
        self.assertTrue(names, "the selected commit exposes no files to --prepare")

    # -- third variant: deletion-only (2026-08-10) ------------------------------
    #
    # Same class as the merge case and given the same treatment. A deletion-only
    # commit clears the changed-line threshold easily and then cross-checks
    # nothing: the consumers resolve source via `git show <sha>:<path>`, which is
    # empty for every path the commit removed, so `checked` lands at 0 and
    # `test_diff_blocks_are_annotated_and_correct` goes RED for a commit that
    # never touched the gutter.
    #
    # Built here rather than leaned on this repo's history for the reason the
    # class docstring gives: the commit that exposed it (`e4ce8adf8`) drops out
    # of the FIXTURE_SEARCH_DEPTH window as commits accumulate, and a guard that
    # is only green by accident of history is not a guard.

    def _make_deletion_only_repo(self):
        """HEAD removes every file the previous commit added."""
        import os
        import shutil
        import tempfile

        repo = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, repo, ignore_errors=True)
        env = ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false"]

        def git(*args):
            return self._git(repo, *env, *args)

        git("init", "-q", "-b", "main", ".")
        # A first commit that must stay selectable — it is the answer.
        with open(os.path.join(repo, "keep.txt"), "w", encoding="utf-8") as fh:
            fh.write("".join(f"keep{i}\n" for i in range(120)))
        for name in ("a.txt", "b.txt"):
            with open(os.path.join(repo, name), "w", encoding="utf-8") as fh:
                fh.write("".join(f"{name}{i}\n" for i in range(120)))
        git("add", "-A")
        git("commit", "-qm", "base with content")
        git("rm", "-q", "a.txt", "b.txt")
        git("commit", "-qm", "delete only")
        return repo

    def test_the_repo_really_is_deletion_only(self):
        """Non-vacuity: HEAD must clear the threshold *and* expose no content.

        Without this, a fixture that quietly kept a file would make the test
        below pass for the wrong reason — the shape it is meant to reject would
        never have existed.
        """
        repo = self._make_deletion_only_repo()
        head = self._git(repo, "rev-parse", "HEAD").strip()
        names = [f for f in self._git(
            repo, "show", "--no-renames", "--name-only", "--pretty=format:",
            head).split("\n") if f]
        self.assertTrue(names, "HEAD lists no files — wrong fixture shape")
        changed = 0
        for row in self._git(repo, "show", "--numstat", "--format=", head).split("\n"):
            cols = row.split("\t")
            if len(cols) >= 3 and cols[2] in names:
                changed += sum(int(c) for c in cols[:2] if c.isdigit())
        self.assertGreaterEqual(
            changed, MIN_FIXTURE_CHANGED_LINES,
            "HEAD does not clear the threshold — it would be skipped for the "
            "wrong reason and the guard under test never runs",
        )
        for f in names:
            self.assertEqual(
                self._git(repo, "show", f"{head}:{f}").strip(), "",
                f"{f} still has content at HEAD — not a deletion-only commit",
            )

    def test_a_deletion_only_commit_is_never_selected(self):
        repo = self._make_deletion_only_repo()
        head = self._git(repo, "rev-parse", "HEAD").strip()
        picked = pick_commit_fixture(cwd=repo)
        self.assertTrue(picked, "nothing was selected at all")
        self.assertNotEqual(
            picked, head,
            "the fixture search selected a deletion-only commit; every diff "
            "line then resolves to empty source and the gutter test goes RED "
            "for a change that never touched the gutter",
        )

    def test_the_selected_commit_still_has_resolvable_content(self):
        """The property, stated directly — not "is not the deletion commit"."""
        repo = self._make_deletion_only_repo()
        picked = pick_commit_fixture(cwd=repo)
        names = [f for f in self._git(
            repo, "show", "--no-renames", "--name-only", "--pretty=format:",
            picked).split("\n") if f]
        self.assertTrue(
            any(self._git(repo, "show", f"{picked}:{f}").strip() for f in names),
            "the selected commit resolves to no content at all",
        )

    def _make_shallow_repo(self):
        """A depth-1 clone — exactly what `actions/checkout` produces by default.

        The source needs TWO commits, because the whole point is a commit that
        *has* a parent which the graft then hides. One commit would produce a
        real root commit, which is a different shape and must stay selectable
        (`test_a_real_root_commit_is_still_selected`).
        """
        import os
        import shutil
        import tempfile

        src, git = self._new_repo()

        def write(name, prefix):
            with open(os.path.join(src, name), "w", encoding="utf-8") as fh:
                fh.write("".join(f"{prefix}{i}\n" for i in range(120)))

        write("base.txt", "base")
        git("add", "-A")
        git("commit", "-qm", "base")
        write("later.txt", "later")
        git("add", "-A")
        git("commit", "-qm", "later")

        parent = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, parent, ignore_errors=True)
        dest = os.path.join(parent, "shallow")
        _harness.git_in(parent, "clone", "-q", "--depth", "1", f"file://{src}", dest)
        return dest

    def test_the_clone_really_is_a_shallow_boundary(self):
        """Non-vacuity: the graft must be present AND the old filters must all
        wave it through, or the test below passes for the wrong reason."""
        repo = self._make_shallow_repo()
        head = self._git(repo, "rev-parse", "HEAD").strip()
        self.assertEqual(
            self._git(repo, "rev-parse", "--is-shallow-repository").strip(), "true",
            "the clone is not shallow — wrong fixture shape",
        )
        # The asymmetry the filter keys on: rev-list honours the graft, the raw
        # object does not.
        self.assertEqual(
            len(self._git(repo, "rev-list", "--parents", "-n", "1", head).split()), 1,
            "rev-list still reports a parent — the graft is not in effect",
        )
        self.assertIn(
            "parent ", self._git(repo, "cat-file", "commit", head),
            "the commit object carries no parent header — this is a real root "
            "commit, not a shallow boundary",
        )
        # It lists its WHOLE tree — including the file it did not touch — which
        # is what starves the prompt budget downstream.
        names = sorted(f for f in self._git(
            repo, "show", "--no-renames", "--name-only", "--pretty=format:",
            head).split("\n") if f)
        self.assertEqual(
            names, ["base.txt", "later.txt"],
            "the boundary commit does not report its whole tree — the shape "
            "this rejects would never have existed",
        )
        changed = 0
        for row in self._git(repo, "show", "--numstat", "--format=", head).split("\n"):
            cols = row.split("\t")
            if len(cols) >= 3 and cols[2] in names:
                changed += sum(int(c) for c in cols[:2] if c.isdigit())
        self.assertGreaterEqual(
            changed, MIN_FIXTURE_CHANGED_LINES,
            "the boundary does not clear the threshold — it would be skipped "
            "for the wrong reason and the guard under test never runs",
        )
        self.assertTrue(
            any(self._git(repo, "show", f"{head}:{f}").strip() for f in names),
            "the boundary resolves to no content — the deletion-only filter "
            "would have caught it and this guard would be untested",
        )

    def test_a_shallow_boundary_commit_is_never_selected(self):
        repo = self._make_shallow_repo()
        self.assertEqual(
            pick_commit_fixture(cwd=repo), "",
            "the fixture search selected a shallow boundary commit; --prepare "
            "then gets the entire tree as its changeset, the prompt budget "
            "drops every file's content, and the gutter test goes RED in CI "
            "only — the shape that let #1131 merge red",
        )

    def test_a_real_root_commit_is_still_selected(self):
        """Over-rejection would be just as bad, and silent.

        `_make_deletion_only_repo`'s answer IS a root commit. Keying the filter
        on "has no parents" instead of "has parents that were grafted away"
        would make that fixture select nothing, and
        `test_a_deletion_only_commit_is_never_selected` would pass on
        `assertTrue(picked)` failing instead of on the property it names.
        """
        import os

        repo, git = self._new_repo()
        with open(os.path.join(repo, "only.txt"), "w", encoding="utf-8") as fh:
            fh.write("".join(f"only{i}\n" for i in range(120)))
        git("add", "-A")
        git("commit", "-qm", "the one and only")
        head = self._git(repo, "rev-parse", "HEAD").strip()
        self.assertFalse(
            _is_shallow_boundary(head, cwd=repo),
            "a real root commit was classified as a shallow boundary",
        )
        self.assertEqual(
            pick_commit_fixture(cwd=repo), head,
            "a real root commit is no longer selectable — the filter is keying "
            "on parentlessness rather than on the graft",
        )


class CheckoutDepthCoversFixtureSearchTest(unittest.TestCase):
    """CI must check out more history than the fixture search walks.

    Without this the two halves of the 2026-08-11 fix drift apart silently, and
    the failure mode is the worse direction: `pick_commit_fixture` now refuses a
    shallow boundary, so a regressed `fetch-depth` does not go RED — it makes
    `_prepare_commit` call `skipTest` and the gutter guard evaporates. Green,
    and no evidence behind it.
    """

    WORKFLOW = REPO_ROOT / ".github/workflows/harness-checks.yml"

    def _checkout_steps(self):
        import yaml

        doc = yaml.safe_load(self.WORKFLOW.read_text(encoding="utf-8"))
        steps = [
            step
            for job in doc["jobs"].values()
            for step in job.get("steps", [])
            if str(step.get("uses", "")).startswith("actions/checkout@")
        ]
        self.assertTrue(steps, "no actions/checkout step found — did the job move?")
        return steps

    def test_every_checkout_fetches_past_the_fixture_search_window(self):
        for step in self._checkout_steps():
            depth = (step.get("with") or {}).get("fetch-depth")
            self.assertIsNotNone(
                depth,
                "actions/checkout has no fetch-depth, so it defaults to 1. A "
                "depth-1 checkout grafts away every parent, the boundary commit "
                "reports the entire tree, and the gutter suite cannot run "
                "(measured on this repository: 19,591 files).",
            )
            # 0 means "everything", which trivially covers the window.
            self.assertTrue(
                int(depth) == 0 or int(depth) > FIXTURE_SEARCH_DEPTH,
                f"fetch-depth {depth} does not exceed FIXTURE_SEARCH_DEPTH "
                f"({FIXTURE_SEARCH_DEPTH}) — the search would run out of "
                f"history and hit the shallow boundary",
            )


class ReviewerDefinitionContractTest(unittest.TestCase):
    """A sub-agent definition is the system prompt the model executes, so its
    wording is behaviour — the exception `.claude/tests/README.md` grants and
    `test_summary_agent_contract.py` already relies on.

    Every reviewer that reports a `위치` must be told where line numbers come
    from; otherwise the orchestrator's gutter is a fact no one was told to use.
    """

    AGENTS_DIR = REPO_ROOT / ".claude" / "agents"

    def _reviewers_reporting_a_location(self):
        found = []
        for path in sorted(self.AGENTS_DIR.glob("*-reviewer.md")):
            text = path.read_text(encoding="utf-8")
            if "- 위치:" in text:
                found.append((path, text))
        return found

    def test_every_location_reporting_reviewer_is_told_to_use_the_gutter(self):
        reviewers = self._reviewers_reporting_a_location()
        self.assertGreaterEqual(len(reviewers), 13, "reviewer set shrank unexpectedly")
        for path, text in reviewers:
            self.assertIn(
                "게이트", text,
                f"{path.name}: must point the reviewer at the line-number gutter",
            )

    def test_every_such_reviewer_is_warned_off_counting_the_prompt(self):
        """The actual failure mode: counting lines in the assembled document."""
        for path, text in self._reviewers_reporting_a_location():
            self.assertTrue(
                "조립" in text and "세면 안 된다" in text,
                f"{path.name}: must forbid counting lines within the prompt document",
            )

    def test_every_such_reviewer_is_told_not_to_invent_a_number(self):
        for path, text in self._reviewers_reporting_a_location():
            self.assertIn(
                "지어내지", text,
                f"{path.name}: must forbid inventing a line number when unsure",
            )

    def test_the_location_block_is_byte_identical_across_all_reviewers(self):
        """No generator renders these 13 files — the block is hand-copied.

        The substring assertions above would still pass if one file's wording
        drifted from the rest, which is precisely how a hand-maintained
        duplicate rots. Pin the whole block instead: edit it in one file and
        this fails until all of them agree.
        """
        blocks = {}
        for path, text in self._reviewers_reporting_a_location():
            lines = text.split("\n")
            start = next(i for i, ln in enumerate(lines) if ln.startswith("  - 위치:"))
            end = start + 1
            while end < len(lines) and lines[end].startswith("    "):
                end += 1
            blocks[path.name] = "\n".join(lines[start:end])

        distinct = set(blocks.values())
        if len(distinct) > 1:
            sample = sorted(blocks.items())
            detail = "\n\n".join(f"--- {n} ---\n{b}" for n, b in sample[:3])
            self.fail(
                f"the 위치 block has drifted across reviewer definitions "
                f"({len(distinct)} variants among {len(blocks)} files):\n{detail}"
            )


class LegendAndDefinitionAgreementTest(unittest.TestCase):
    """The gutter rule is stated twice: once in the prompt the orchestrator
    builds (`LINE_ANCHOR_LEGEND`) and once in each reviewer definition.

    Nothing renders one from the other, so they can drift apart while each side
    stays internally consistent — and a reviewer that is told two different
    things about where line numbers come from is exactly the ambiguity this
    whole change removes. Pin the load-bearing rules on both sides.
    """

    RULES = {
        "게이트": "names the gutter",
        "지어내지": "forbids inventing a number when unsure",
        "조립": "says the prompt is an assembled document",
    }

    def _legend(self):
        text = ORCH.read_text(encoding="utf-8")
        start = text.index("LINE_ANCHOR_LEGEND = (")
        end = text.index('\n)\n', start)
        return text[start:end]

    def test_legend_states_every_load_bearing_rule(self):
        legend = self._legend()
        for token, why in self.RULES.items():
            self.assertIn(
                token, legend,
                f"LINE_ANCHOR_LEGEND no longer {why} — it and the reviewer "
                f"definitions would then disagree",
            )

    def test_reviewer_definitions_state_the_same_rules_as_the_legend(self):
        legend = self._legend()
        agents_dir = REPO_ROOT / ".claude" / "agents"
        blocks = [
            p.read_text(encoding="utf-8")
            for p in sorted(agents_dir.glob("*-reviewer.md"))
            if "- 위치:" in p.read_text(encoding="utf-8")
        ]
        self.assertGreaterEqual(len(blocks), 13)
        for token, why in self.RULES.items():
            in_legend = token in legend
            for text in blocks:
                self.assertEqual(
                    in_legend, token in text,
                    f"the prompt legend and the reviewer definitions disagree "
                    f"on the rule that {why}",
                )


class DocumentedDefaultsMatchTheCodeTest(unittest.TestCase):
    """`REVIEW_MAX_FILE_SIZE` / `REVIEW_MAX_PROMPT_SIZE` defaults are printed as
    literal numbers in two docs but computed from `_GUTTER_OVERHEAD` in code.

    Re-tuning the overhead would silently leave both tables stating a number
    the orchestrator no longer uses. Same class of binding as
    `test_doc_sync_matrix`: a value duplicated across languages/formats that
    only a test can hold together.
    """

    DOCS = (
        REPO_ROOT / ".claude" / "skills" / "code-review-agents" / "SKILL.md",
        REPO_ROOT / ".claude" / "skills" / "code-review-agents" / "README.md",
    )

    def _code_defaults(self):
        out = subprocess.run(
            [sys.executable, "-c",
             f"import runpy,sys; sys.argv=['x'];"
             f"m=runpy.run_path({str(ORCH)!r});"
             f"print(m['DEFAULT_MAX_FILE_SIZE'], m['DEFAULT_MAX_PROMPT_SIZE'])"],
            capture_output=True, text=True, cwd=str(REPO_ROOT),
        ).stdout.split()
        self.assertEqual(len(out), 2, "could not read the orchestrator defaults")
        return out[0], out[1]

    def test_docs_quote_the_defaults_the_code_actually_uses(self):
        file_default, prompt_default = self._code_defaults()
        for doc in self.DOCS:
            text = doc.read_text(encoding="utf-8")
            for var, value in (
                ("REVIEW_MAX_FILE_SIZE", file_default),
                ("REVIEW_MAX_PROMPT_SIZE", prompt_default),
            ):
                row = next(
                    (ln for ln in text.split("\n") if f"`{var}`" in ln and ln.startswith("|")),
                    None,
                )
                self.assertIsNotNone(row, f"{doc.name}: no table row for {var}")
                self.assertIn(
                    f"`{value}`", row,
                    f"{doc.name}: {var} documents a stale default — the code now "
                    f"uses {value}",
                )


if __name__ == "__main__":
    unittest.main()
