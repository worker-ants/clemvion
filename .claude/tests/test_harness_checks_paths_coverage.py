"""Guard: `harness-checks.yml`'s relevance pathspecs must cover every non-test
file the harness suite guards.

`.github/workflows/harness-checks.yml` runs this whole suite, but only when a
changed file matches one of its filters. Every test file lives under
`.claude/tests/**`, which is listed, so editing a test always triggers. The gap
is the other direction: a test guards some NON-test file — a hook, a tool, a
workflow script, a CI file — and that file is edited ALONE. If no filter matches
it, the suite that protects it never runs. A guard that is present but does not
fire is worse than none, because everyone believes it is watching.

WHERE THE LIST LIVES — it moved, and the guard followed it (2026-08-09).

The workflow used to carry the list as `on.pull_request.paths`. It was converted
to the required-check skip-job pattern (`test_required_check_skip_jobs.py`), so
`paths:` is gone — the workflow now runs on every PR and a `changes` job decides
whether the steps do any work. The same list therefore lives in that job's
`pathspecs:` block scalar, and that is what this file reads. Had this guard kept
reading `paths:`, it would have parsed an empty list and every coverage
assertion below would have passed vacuously — the exact silent-disable it
exists to prevent. The non-vacuity floors (`_MIN_FILTERS`) are what turn that
into a loud failure instead.

The entries are now **git pathspecs**, not GitHub path filters, and git's
default wildcard rules are LOOSER (a bare `*` crosses `/`). This file keeps
matching them with the stricter GitHub rules on purpose: strict-covered implies
git-covered, so demanding coverage under the stricter reading can only ask for
MORE explicit entries, never fewer. Being conservative in the direction of "list
it explicitly" is the whole point of the list.

This exact class has leaked **six** times, each patched by hand afterward:

    .githooks/**            .claude/_shared/**       .claude/workflows/**
    .github/dependabot.yml  .github/workflows/e2e.yml  .claude/config/**

The sixth (`.claude/config/**`, guarding `doc-sync-matrix.json`) was found by
this file on its first run. The same sentence — "absent from the list, so the file
that guards it never triggered" — is written verbatim next to four of the
entries, and it recurred anyway. A hand-maintained list does not hold;
a test does.

WHAT COUNTS AS A GUARDED FILE — the boundary, which is most of the work.

A file is in scope when editing it in isolation SHOULD run this suite. Three
rules draw that line, and each exists to stop a specific false positive that
would otherwise disable the guard:

  1. **Module-level path constants only.** `harness_target_paths` reads the
     `ROOT / "a" / "b"` chains at a test file's module scope — the stable "this
     is the file I guard" declarations. Chains built inside a method
     (`root / "codebase" / …` while scanning the product, a tempdir under
     construction) are runtime operations, not guard targets, and are skipped.

  2. **Tracked files, not directories or phantoms.** A relevance filter can
     only ever match a tracked, changed FILE. So an intermediate directory root
     (`.claude`, `.github`, `scripts`) is NOT itself a target — requiring it to
     be "covered" would force an over-broad `.github/**` or `scripts/**` filter
     that pulls in non-harness files, which is precisely the false positive that
     kills a guard. The guarded LEAVES under those roots (`.github/dependabot.yml`,
     `scripts/report_playwright_flaky.py`) are named individually and checked as
     files. Untracked (`.claude/state`) and phantom (`does-not-exist.json`) paths
     drop out for free.

  3. **Product paths are excluded.** A test may name a `codebase/**` or `spec/**`
     file to check a harness↔product binding (`test_doc_sync_matrix`). Those must
     NOT force this suite to run on every product change, so anything under
     `codebase/ spec/ plan/ review/` is dropped. Requiring them would be the
     loudest false positive of all.

KNOWN LIMITATION, stated rather than hidden: a test that iterates a directory of
files at runtime, naming none of them as a module-level constant, guards those
files without this check seeing them. The coverage unit is files, and a bare
directory reference maps legitimately to specific-file filters (only
`.github/dependabot.yml` is guarded under `.github/`, not all of it), so there is
no sound way to demand subtree coverage from a directory reference alone. The six
recurrences were all file-level, which is the case this catches.

Parsing is stdlib-only (`.claude/tests/README.md`). Both the `pathspecs:` parser and
the path extractor take TEXT, so `BoundaryTest` pins their edges on injected
source before any real file is read, and both assert they found something so a
silently-empty parse fails loudly instead of passing vacuously — the sibling
`test_e2e_exemption_paths_sync` takes the same shape for the same reasons.
"""

from __future__ import annotations

import ast
import re
import subprocess
import unittest

import _harness  # noqa: F401  — side effect: harness path setup

REPO_ROOT = _harness.REPO_ROOT
HARNESS_CHECKS = REPO_ROOT / ".github" / "workflows" / "harness-checks.yml"
TESTS_DIR = REPO_ROOT / ".claude" / "tests"

# Repo-relative prefixes a `ROOT / …` chain can start from, mapped to the path
# each stands for. Seeded from `_harness` (`REPO_ROOT`, `CLAUDE_DIR`, `HOOKS_DIR`);
# a test's own aliases (`CLAUDE = REPO_ROOT / ".claude"`) are resolved on top of
# these per file. Both bare (`from _harness import REPO_ROOT`) and attribute
# (`_harness.REPO_ROOT`) spellings appear, so both are recognised.
_SEED_ROOTS = {
    "REPO_ROOT": "",
    "CLAUDE_DIR": ".claude",
    "HOOKS_DIR": ".claude/hooks",
}

# A path under one of these is a product/artifact reference (a harness↔product
# binding check), never a file this suite must run for.
PRODUCT_PREFIXES = ("codebase/", "spec/", "plan/", "review/")

# Non-vacuity floors. The suite guards dozens of harness files; a count far below
# this means the extractor stopped matching rather than the tree shrinking.
_MIN_TARGETS = 20
_MIN_FILTERS = 10

# For each load-bearing filter, a tracked file only it covers. Removing the
# filter must make that file uncovered — this is what proves the guard would
# actually catch each historical leak, not merely pass today. The first five are
# the recurrences that were patched by hand; the sixth this file added.
# e2e.yml 의 등재는 2026-08-01 에 `.github/workflows/**` 로 넓혀졌다 —
# test_workflow_yaml_structure.py 가 파일 무관하게 모든 워크플로를 보기 때문이다.
# 예시 파일은 그대로 두어 원래의 leak(그 파일 단독 수정)이 여전히 잡히는지 본다.
KNOWN_COVERAGE_DEPENDENCIES = {
    ".githooks/**": ".githooks/pre-commit",
    ".claude/_shared/**": ".claude/_shared/report_paths.py",
    ".claude/workflows/**": ".claude/workflows/ai-review.js",
    ".github/dependabot.yml": ".github/dependabot.yml",
    ".github/workflows/**": ".github/workflows/e2e.yml",
    ".claude/config/**": ".claude/config/doc-sync-matrix.json",
    # 2026-08-09 — 공유 셋업 composite action. `.github/workflows/**` 는 이 경로를
    # 덮지 않으므로(형제 디렉터리다) 별도 필터가 필요하고, 그 사실을 여기서 증명한다.
    ".github/actions/**": ".github/actions/pnpm-workspace/action.yml",
}


# ---------------------------------------------------------------------------
# Parsing `pathspecs:` out of the workflow (text in, list out — see docstring)
# ---------------------------------------------------------------------------


def parse_pathspecs_block(text: str) -> list[str]:
    """The `changes` job's `pathspecs:` block scalar, one entry per line.

    Recognises exactly one shape — `pathspecs: |` followed by more-indented
    lines — and ends at the first non-blank line indented no deeper than the key.

    Blank lines and lines starting with `#` are dropped, which is not a YAML
    rule: inside a block scalar there ARE no comments, every line is content.
    The runtime (`_changed-paths.yml`) drops both before handing the list to
    git, precisely so each entry can carry its reason on the line above it, and
    this parser has to make the same two cuts. If it did not, a rationale
    comment would read as a pathspec here, the list would look wider than it is,
    and `test_no_filter_is_dead` would start flagging prose.
    """
    lines = text.split("\n")
    for i, line in enumerate(lines):
        header = re.match(r"^(\s*)pathspecs:\s*\|\s*$", line)
        if header is None:
            continue
        indent = len(header.group(1))
        items: list[str] = []
        for cur in lines[i + 1:]:
            if not cur.strip():
                continue
            if len(cur) - len(cur.lstrip()) <= indent:
                break
            entry = cur.strip()
            if entry.startswith("#"):
                continue
            items.append(entry)
        return items
    return []


# ---------------------------------------------------------------------------
# GitHub path-filter matching (`*` stays within a segment, `**` crosses `/`)
# ---------------------------------------------------------------------------


def _filter_to_regex(filt: str) -> re.Pattern:
    out = []
    i = 0
    while i < len(filt):
        if filt[i] == "*":
            if filt[i:i + 2] == "**":
                out.append(".*")
                i += 2
            else:
                out.append("[^/]*")
                i += 1
        else:
            out.append(re.escape(filt[i]))
            i += 1
    return re.compile("^" + "".join(out) + "$")


def filter_covers_file(filt: str, path: str) -> bool:
    """Does one entry match this repo-relative file?

    Not `fnmatch`: its `*` crosses `/`, which would make a root `*.md` filter
    appear to cover `.claude/x.md`. GitHub's `*` stops at a segment boundary and
    only `**` crosses it, so a filter is built into a regex by hand.
    """
    return _filter_to_regex(filt).match(path) is not None


# ---------------------------------------------------------------------------
# Extracting module-level `ROOT / "a" / "b"` path constants (text in, set out)
# ---------------------------------------------------------------------------


def _chain_root(node: ast.AST) -> str | None:
    """Leftmost operand of a `/`-chain: `REPO_ROOT` or `_harness.REPO_ROOT`."""
    if isinstance(node, ast.Name):
        return node.id
    if (isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name)
            and node.value.id == "_harness"):
        return node.attr
    return None


def _resolve_chain(node: ast.AST, roots: dict) -> str | None:
    """`root / 'a' / 'b'` → repo-relative path, or None if it is not a chain of
    string literals rooted at a known name."""
    parts: list[str] = []
    cur = node
    while isinstance(cur, ast.BinOp) and isinstance(cur.op, ast.Div):
        rhs = cur.right
        if not (isinstance(rhs, ast.Constant) and isinstance(rhs.value, str)):
            return None
        parts.append(rhs.value)
        cur = cur.left
    if not parts:
        return None
    name = _chain_root(cur)
    if name is None or name not in roots:
        return None
    parts.reverse()
    prefix = roots[name]
    return "/".join(p for p in [prefix, *parts] if p)


def harness_target_paths(source: str) -> set[str]:
    """Every repo-relative path a test file names via a module-level `ROOT / …`
    chain. Directory roots and product paths are included here verbatim; the
    caller narrows to tracked, non-product files (see module docstring)."""
    tree = ast.parse(source)
    roots = dict(_SEED_ROOTS)
    # Resolve module-level aliases to a fixpoint, so `FOO = CLAUDE / "x"` sees
    # `CLAUDE` regardless of statement order.
    changed = True
    while changed:
        changed = False
        for node in tree.body:
            if not isinstance(node, ast.Assign):
                continue
            rel = _resolve_chain(node.value, roots)
            if rel is None:
                continue
            for target in node.targets:
                if isinstance(target, ast.Name) and roots.get(target.id) != rel:
                    roots[target.id] = rel
                    changed = True

    targets: set[str] = set()
    for stmt in tree.body:
        # Skip function/class bodies: chains built there are runtime operations,
        # not "the file this suite guards".
        if isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            continue
        for node in ast.walk(stmt):
            if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div):
                rel = _resolve_chain(node, roots)
                if rel:
                    targets.add(rel)
    return targets


def _tracked_files() -> set[str]:
    out = subprocess.run(
        ["git", "ls-files"], cwd=str(REPO_ROOT),
        capture_output=True, text=True, check=True,
    ).stdout
    return {line for line in out.split("\n") if line}


def _guarded_files(all_targets: set[str], tracked: set[str]) -> set[str]:
    """Narrow raw targets to the files this suite must run for."""
    return {
        t for t in all_targets
        if t in tracked and not t.startswith(PRODUCT_PREFIXES)
    }


# ---------------------------------------------------------------------------
# Boundary tests — pinned on injected source, no real file involved
# ---------------------------------------------------------------------------


class PathspecsParserBoundaryTest(unittest.TestCase):
    def test_reads_a_simple_block(self):
        text = (
            "jobs:\n"
            "  changes:\n"
            "    with:\n"
            "      pathspecs: |\n"
            "        a/**\n"
            "        b/**\n"
        )
        self.assertEqual(parse_pathspecs_block(text), ["a/**", "b/**"])

    def test_drops_blank_lines_and_rationale_comments(self):
        """The reason each entry exists sits on the line above it — see the
        module docstring. Those lines are block-scalar CONTENT, so both this
        parser and the runtime have to drop them, and identically."""
        text = (
            "      pathspecs: |\n"
            "        a/**\n"
            "\n"
            "        # this one leaked six times\n"
            "        b/**\n"
        )
        self.assertEqual(parse_pathspecs_block(text), ["a/**", "b/**"])

    def test_a_hash_that_is_not_line_initial_is_kept(self):
        text = "      pathspecs: |\n        dir/a#b.txt\n"
        self.assertEqual(parse_pathspecs_block(text), ["dir/a#b.txt"])

    def test_entries_are_unquoted_literals(self):
        """Unlike a `paths:` list item, a block-scalar line is taken verbatim —
        a quote here would become part of the pathspec and match nothing."""
        text = "      pathspecs: |\n        'a/**'\n"
        self.assertEqual(parse_pathspecs_block(text), ["'a/**'"])

    def test_stops_at_the_next_key_at_or_below_indent(self):
        text = (
            "      pathspecs: |\n"
            "        a/**\n"
            "\n"
            "  unittest:\n"
            "    runs-on: ubuntu-latest\n"
        )
        self.assertEqual(parse_pathspecs_block(text), ["a/**"])

    def test_a_plain_scalar_is_not_a_block(self):
        """Only `pathspecs: |` is recognised. A one-line `pathspecs: a/**` would
        need different splitting, so it must fall through to empty and trip the
        non-vacuity floor rather than half-parse."""
        self.assertEqual(parse_pathspecs_block("      pathspecs: a/**\n"), [])

    def test_absent_key_yields_empty(self):
        self.assertEqual(parse_pathspecs_block("on:\n  pull_request:\n"), [])


class FilterMatchBoundaryTest(unittest.TestCase):
    def test_double_star_crosses_slashes(self):
        self.assertTrue(filter_covers_file(".claude/hooks/**", ".claude/hooks/x.py"))
        self.assertTrue(
            filter_covers_file(".claude/hooks/**", ".claude/hooks/_lib/y.py"))

    def test_single_star_does_not_cross_a_slash(self):
        """The `fnmatch` trap that a prior guard's blind spot reproduced."""
        self.assertTrue(filter_covers_file("*.md", "PROJECT.md"))
        self.assertFalse(filter_covers_file("*.md", ".claude/x.md"))

    def test_exact_filter_matches_only_itself(self):
        self.assertTrue(filter_covers_file(".github/dependabot.yml",
                                           ".github/dependabot.yml"))
        self.assertFalse(filter_covers_file(".github/dependabot.yml",
                                            ".github/other.yml"))

    def test_a_subtree_filter_does_not_match_the_bare_dir(self):
        """`.claude/hooks/**` covers files under the dir, not the dir token
        itself — which is why bare directory roots are not treated as targets."""
        self.assertFalse(filter_covers_file(".claude/hooks/**", ".claude/hooks"))


class ExtractorBoundaryTest(unittest.TestCase):
    def test_resolves_a_seed_root_chain(self):
        src = 'X = REPO_ROOT / ".claude" / "tools" / "run-test.sh"\n'
        self.assertIn(".claude/tools/run-test.sh", harness_target_paths(src))

    def test_resolves_the_harness_attribute_spelling(self):
        src = 'X = _harness.HOOKS_DIR / "guard.py"\n'
        self.assertIn(".claude/hooks/guard.py", harness_target_paths(src))

    def test_resolves_an_alias_defined_in_the_file(self):
        src = 'CLAUDE = REPO_ROOT / ".claude"\nX = CLAUDE / "config" / "m.json"\n'
        self.assertIn(".claude/config/m.json", harness_target_paths(src))

    def test_finds_a_chain_inside_a_module_level_call(self):
        """`test_report_paths_shared` names its target as a loader argument, not
        a bare assignment — the real reason this walks whole statements."""
        src = 'load("n", REPO_ROOT / ".claude" / "_shared" / "report_paths.py")\n'
        self.assertIn(".claude/_shared/report_paths.py", harness_target_paths(src))

    def test_ignores_chains_inside_a_function_body(self):
        src = 'def f(root):\n    return root / "codebase" / "x.ts"\n'
        self.assertEqual(harness_target_paths(src), set())

    def test_ignores_chains_inside_a_class_method(self):
        src = (
            "class T:\n"
            "    def m(self):\n"
            '        return REPO_ROOT / "codebase" / "x.ts"\n'
        )
        self.assertEqual(harness_target_paths(src), set())

    def test_ignores_a_chain_from_an_unknown_root(self):
        src = 'X = somewhere / "a" / "b"\n'
        self.assertEqual(harness_target_paths(src), set())

    def test_ignores_a_chain_with_a_non_literal_component(self):
        src = 'X = REPO_ROOT / name / "b"\n'
        self.assertEqual(harness_target_paths(src), set())

    def test_product_paths_are_extracted_then_filtered_out(self):
        """The extractor is honest about what it saw; `_guarded_files` is where
        a product path is dropped, so both halves are pinned."""
        src = 'X = REPO_ROOT / "codebase" / "frontend" / "playwright.config.ts"\n'
        raw = harness_target_paths(src)
        self.assertIn("codebase/frontend/playwright.config.ts", raw)
        tracked = {"codebase/frontend/playwright.config.ts"}
        self.assertEqual(_guarded_files(raw, tracked), set())

    def test_untracked_and_phantom_targets_are_dropped(self):
        src = 'A = REPO_ROOT / ".claude" / "state"\nB = REPO_ROOT / "gone.json"\n'
        raw = harness_target_paths(src)
        self.assertEqual(_guarded_files(raw, tracked=set()), set())


# ---------------------------------------------------------------------------
# The invariant, on the real repository
# ---------------------------------------------------------------------------


class PathsCoverageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.filters = parse_pathspecs_block(
            HARNESS_CHECKS.read_text(encoding="utf-8"))
        cls.tracked = _tracked_files()
        raw: set[str] = set()
        for path in sorted(TESTS_DIR.glob("*.py")):
            raw |= harness_target_paths(path.read_text(encoding="utf-8"))
        cls.raw_targets = raw
        cls.guarded = _guarded_files(raw, cls.tracked)

    def _covered(self, path: str, filters=None) -> bool:
        return any(filter_covers_file(f, path)
                   for f in (self.filters if filters is None else filters))

    def test_parsers_found_something(self):
        self.assertGreaterEqual(
            len(self.filters), _MIN_FILTERS,
            "suspiciously few pathspecs parsed — the parser probably stopped "
            "matching harness-checks.yml (did the list move again?) rather than "
            "the file shrinking")
        self.assertGreaterEqual(
            len(self.guarded), _MIN_TARGETS,
            "suspiciously few guarded files extracted — the extractor probably "
            "stopped matching the test sources")

    def test_every_guarded_file_is_covered(self):
        """The invariant. A file here means: a test names it as a module-level
        constant, git tracks it, and it is not product code — so editing it in
        isolation must run this suite."""
        uncovered = sorted(t for t in self.guarded if not self._covered(t))
        self.assertEqual(
            uncovered, [],
            "harness-checks.yml does not run for these files, but a test guards "
            f"each of them:\n  " + "\n  ".join(uncovered) + "\n"
            "Add a covering entry to the `changes` job's `pathspecs:` (this is "
            "the sixth "
            "time this class has leaked — see the module docstring).")

    def test_no_filter_is_dead(self):
        """Every `pathspecs:` entry must match at least one tracked file. A filter
        matching nothing is either a typo or a leftover, and it silently weakens
        the reader's trust that the list means what it says."""
        dead = [f for f in self.filters
                if not any(filter_covers_file(f, t) for t in self.tracked)]
        self.assertEqual(
            dead, [],
            f"pathspecs match no tracked file: {dead} — typo or stale entry")

    def test_each_historical_leak_is_load_bearing(self):
        """For every recurrence: the example file is a real guarded target,
        covered now, and UNCOVERED the moment its filter is removed. This is what
        makes the guard a guard rather than a tautology that passes regardless."""
        for filt, example in KNOWN_COVERAGE_DEPENDENCIES.items():
            with self.subTest(filter=filt):
                self.assertIn(
                    example, self.guarded,
                    f"{example} is no longer an extracted guarded target — the "
                    "regression fixture has gone stale")
                self.assertTrue(
                    self._covered(example),
                    f"{example} is not covered even with the full filter list")
                without = [f for f in self.filters if f != filt]
                self.assertFalse(
                    self._covered(example, without),
                    f"removing {filt!r} left {example} covered by another filter "
                    "— this fixture no longer proves that filter is load-bearing")


if __name__ == "__main__":
    unittest.main()
