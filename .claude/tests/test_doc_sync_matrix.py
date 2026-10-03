"""Drift guard for PROJECT.md's "변경 유형 → 갱신 위치 매핑" matrix.

The matrix is a hand-maintained binding between change types and the build-time
guards / conventions that enforce them. Its rows reference, by name, things that
live elsewhere in the repo:

  - `*.test.ts` build-time guards under `codebase/`
  - NERV spec mirror documents `spec/<area key>/<KEY>.md`

When one of those is renamed or removed, the matrix silently goes stale — the
exact failure mode this guard exists for. Two classes split the work:

  - `DocSyncMatrixReferencesTest` reads the human table in PROJECT.md and fails
    on a dangling `*.test.ts` or `spec/...md` pointer.
  - `MatrixJsonSsotTest` validates the machine-readable SSOT
    `.claude/config/doc-sync-matrix.json` and binds it to the table (same row
    count, every guard / convention_ref / spec target / trigger base resolves).

Only file existence is checked. A 「section title」 quoted after a mirror path
is not (NERV titles change on the web; see PROJECT.md 「매트릭스 참조 무결성 가드」).

`SPEC_PATH_RE` matches any `spec/...md` path, not only mirror-shaped ones, so a
path into a folder that is not the mirror (the old tree deleted in NERV cutover
step 5, Task CLE-T-7M4C4X) fails instead of slipping past a mirror-only regex.

Scope note: this is a harness self-test that deliberately reaches into product
paths (`codebase/`, `spec/`) because the matrix is precisely a harness↔product
binding. harness-checks runs it on PROJECT.md · `.claude/**` edits, not on
`spec/**`-only changes (rule 3 of test_harness_checks_paths_coverage.py).
"""

from __future__ import annotations

import fnmatch
import json
import re
import subprocess
import sys
import unittest

from _harness import CLAUDE_DIR, REPO_ROOT

PROJECT_MD = REPO_ROOT / "PROJECT.md"
MATRIX_JSON = CLAUDE_DIR / "config" / "doc-sync-matrix.json"
MATRIX_HEADING = "## 변경 유형 → 갱신 위치 매핑"

# Reference patterns the matrix carries, each anchored to a concrete file.
TEST_FILE_RE = re.compile(r"[A-Za-z0-9_-]+\.test\.ts")
# NERV mirror layout: `spec/<area key>/<KEY>.md`, or `spec/<KEY>.md` for
# documents outside any area (`CLE-VISION`). Deliberately looser than the key
# grammar in `pull.py` (`KEY_RE`): this only finds candidates in prose. Every
# cited key is then held to `KEY_RE` by `test_cited_mirror_keys_match_pull_key_grammar`,
# so the two cannot drift apart silently.
_MIRROR = r"CLE-[A-Z0-9-]+(?:/CLE-[A-Z0-9-]+)?"
MIRROR_PATH_RE = re.compile(rf"spec/{_MIRROR}\.md")
# Any `spec/...md` path. The lookbehind keeps `e2e-spec/x.md` and `a/spec/x.md`
# out; the first character after `spec/` excludes the prose placeholder
# `spec/...md`.
SPEC_PATH_RE = re.compile(r"(?<![\w./-])spec/[A-Za-z0-9_][A-Za-z0-9_./-]*\.md")
# Non-mirror `spec/` files PROJECT.md may name. `spec/README.md` is the mirror's
# guide page, written by `pull.py` next to the mirror documents.
NON_MIRROR_ALLOWED: frozenset[str] = frozenset({"spec/README.md"})


# Wildcards and placeholders. A path segment holding one ends the literal base.
_GLOB_META = frozenset("*?[{}<>")


def _literal_base(glob: str) -> list[str]:
    """Leading path segments of `glob` with no wildcard or placeholder."""
    base = []
    for seg in glob.split("/"):
        if not seg or not _GLOB_META.isdisjoint(seg):
            break
        base.append(seg)
    return base


def _expand_braces(glob: str) -> list[str]:
    m = re.search(r"\{([^{}]*)\}", glob)
    if not m:
        return [glob]
    head, tail = glob[:m.start()], glob[m.end():]
    return [x for alt in m.group(1).split(",") for x in _expand_braces(head + alt + tail)]


def _glob_matches_a_file(glob: str, files: list[str]) -> bool:
    """Does every brace alternative of `glob` match one of `files` (repo-relative)?

    A trailing `/` names a directory, so it matches the files under one.
    `fnmatch`'s `*` crosses `/`, which is how the matrix's `**.mdx` is meant to read.
    """
    for alt in _expand_braces(glob):
        pattern = alt + "*" if alt.endswith("/") else alt
        prefix = "/".join(_literal_base(alt))
        if not any(fnmatch.fnmatchcase(f, pattern) for f in files if f.startswith(prefix)):
            return False
    return True


def _tracked_files() -> list[str]:
    out = subprocess.run(["git", "ls-files"], cwd=REPO_ROOT, check=True,
                         capture_output=True, text=True).stdout
    return out.splitlines()


def _project_text() -> str:
    return PROJECT_MD.read_text(encoding="utf-8")


def _matrix_table_row_count() -> int:
    """Count data rows in the first markdown table under MATRIX_HEADING.

    A markdown table is `| ... |` lines; the first is the header, the second is
    the `|---|` separator. Data rows = total `|`-lines − 2, counted until the
    table ends (a non-`|` line after the table started)."""
    lines = _project_text().splitlines()
    in_section = False
    pipe_lines = 0
    started = False
    for line in lines:
        if line.startswith("## "):
            if line.strip() == MATRIX_HEADING:
                in_section = True
                continue
            if in_section and started:
                break  # next section after the table — stop
            in_section = line.strip() == MATRIX_HEADING
        if not in_section:
            continue
        if line.lstrip().startswith("|"):
            pipe_lines += 1
            started = True
        elif started:
            break  # table ended within the section
    return max(0, pipe_lines - 2)  # minus header + separator


def _load_matrix() -> dict:
    return json.loads(MATRIX_JSON.read_text(encoding="utf-8"))


class DocSyncMatrixReferencesTest(unittest.TestCase):
    def test_referenced_guard_tests_exist(self):
        """Every `*.test.ts` named in PROJECT.md must exist under codebase/."""
        tokens = sorted(set(TEST_FILE_RE.findall(_project_text())))
        self.assertTrue(tokens, "expected PROJECT.md to reference guard *.test.ts files")
        codebase = REPO_ROOT / "codebase"
        existing = {p.name for p in codebase.rglob("*.test.ts")}
        missing = [t for t in tokens if t not in existing]
        self.assertFalse(
            missing,
            f"PROJECT.md references guard test files that no longer exist under "
            f"codebase/: {missing}. Update the matrix or restore the guard.",
        )

    def test_referenced_spec_docs_exist(self):
        """Every `spec/...md` path named in PROJECT.md must exist."""
        paths = sorted(set(SPEC_PATH_RE.findall(_project_text())))
        self.assertTrue(paths, "expected PROJECT.md to reference spec/ documents")
        missing = [p for p in paths if not (REPO_ROOT / p).is_file()]
        self.assertFalse(
            missing,
            f"PROJECT.md references spec documents that do not exist: {missing}. "
            f"Update the matrix or restore the document.",
        )

    def test_project_md_cites_mirror_paths(self):
        """PROJECT.md points at spec documents through the NERV mirror.

        Two things this pins that the existence check above cannot:
          - mirror paths are cited at all, and SPEC_PATH_RE sees them (the two
            regexes are separate, so they could drift apart);
          - nothing else under `spec/` is cited: every non-mirror match must be
            in NON_MIRROR_ALLOWED."""
        text = _project_text()
        cited = set(SPEC_PATH_RE.findall(text))
        mirror = set(MIRROR_PATH_RE.findall(text))
        self.assertTrue(
            mirror,
            "expected PROJECT.md to reference NERV mirror documents "
            "(spec/<area key>/<KEY>.md)",
        )
        self.assertLessEqual(
            mirror, cited,
            f"SPEC_PATH_RE misses mirror paths (the two regexes diverged): "
            f"{sorted(mirror - cited)}",
        )
        other = cited - mirror
        self.assertLessEqual(
            other, NON_MIRROR_ALLOWED,
            f"PROJECT.md cites spec paths outside the NERV mirror: "
            f"{sorted(other - NON_MIRROR_ALLOWED)}. Point at the NERV mirror "
            f"(spec/<area key>/<KEY>.md) instead.",
        )


    def test_cited_mirror_keys_match_pull_key_grammar(self):
        """Every key in a cited mirror path is a key `pull.py` would write.

        `pull.py` names mirror files after NERV keys (`KEY_RE`). A path whose
        folder or file stem falls outside that grammar can never be produced by
        a pull, so a match there means the prose regex above has drifted."""
        if str(CLAUDE_DIR) not in sys.path:
            sys.path.insert(0, str(CLAUDE_DIR))
        from _shared.nerv_read import load_pull

        key_re = load_pull().KEY_RE
        cited = set(MIRROR_PATH_RE.findall(_project_text()))
        for row in _load_matrix()["rows"]:
            for value in [row["convention_ref"] or "", *row["targets"]]:
                cited.update(MIRROR_PATH_RE.findall(value))
        self.assertTrue(cited, "expected cited mirror paths")
        bad = sorted(
            path for path in cited
            if not all(key_re.fullmatch(part) for part in path[len("spec/"):-len(".md")].split("/"))
        )
        self.assertFalse(bad, f"mirror paths whose keys pull.py KEY_RE rejects: {bad}")


VALID_MATCH = {"glob", "semantic"}
ROW_KEYS = {"id", "change_type", "trigger", "targets", "verify", "guard_tests", "convention_ref"}


class MatrixJsonSsotTest(unittest.TestCase):
    """`.claude/config/doc-sync-matrix.json` is the machine-readable SSOT; this
    validates its shape and binds it to the PROJECT.md human table."""

    def test_json_shape(self):
        m = _load_matrix()
        rows = m.get("rows")
        self.assertIsInstance(rows, list)
        ids = set()
        for i, row in enumerate(rows):
            with self.subTest(row=i):
                self.assertEqual(
                    ROW_KEYS, set(row.keys()),
                    f"row {row.get('id', i)} keys != schema {ROW_KEYS}",
                )
                self.assertNotIn(row["id"], ids, f"duplicate id {row['id']}")
                ids.add(row["id"])
                self.assertIn(row["trigger"].get("match"), VALID_MATCH)
                self.assertIsInstance(row["trigger"].get("globs"), list)
                self.assertIsInstance(row["targets"], list)
                self.assertTrue(row["targets"], f"{row['id']}: empty targets")
                self.assertIsInstance(row["guard_tests"], list)

    def test_row_count_matches_project_md_table(self):
        """JSON rows and the PROJECT.md matrix table must stay 1:1 — the binding
        that stops the two representations from silently diverging."""
        json_n = len(_load_matrix()["rows"])
        table_n = _matrix_table_row_count()
        self.assertEqual(
            json_n, table_n,
            f"doc-sync-matrix.json has {json_n} rows but the PROJECT.md "
            f"'{MATRIX_HEADING}' table has {table_n}. Edit both together.",
        )

    def test_json_guard_tests_exist(self):
        existing = {p.name for p in (REPO_ROOT / "codebase").rglob("*.test.ts")}
        missing = {}
        for row in _load_matrix()["rows"]:
            absent = [g for g in row["guard_tests"] if g not in existing]
            if absent:
                missing[row["id"]] = absent
        self.assertFalse(
            missing, f"doc-sync-matrix.json guard_tests not found under codebase/: {missing}"
        )

    def test_json_convention_refs_exist(self):
        missing = {}
        for row in _load_matrix()["rows"]:
            ref = row["convention_ref"]
            if ref and not (REPO_ROOT / ref).is_file():
                missing[row["id"]] = ref
        self.assertFalse(
            missing, f"doc-sync-matrix.json convention_ref paths do not exist: {missing}"
        )

    def test_json_convention_refs_point_to_nerv_mirror(self):
        """A convention_ref names the rule's SoT, and the SoT is the NERV spec.

        The old `spec/<n>-<area>/` · `spec/conventions/` tree was deleted in
        cutover step 5, so the existence check above now catches a ref into it.
        This check says more: a ref must be a mirror path, because any other
        `spec/` file, even one re-created by hand, is not a NERV document."""
        rows = _load_matrix()["rows"]
        self.assertTrue(
            any(row["convention_ref"] for row in rows),
            "expected at least one non-null convention_ref",
        )
        non_mirror = {
            row["id"]: row["convention_ref"]
            for row in rows
            if row["convention_ref"] and not MIRROR_PATH_RE.fullmatch(row["convention_ref"])
        }
        self.assertFalse(
            non_mirror,
            f"doc-sync-matrix.json convention_ref must be a NERV mirror path "
            f"spec/<area key>/<KEY>.md: {non_mirror}",
        )

    def test_json_target_spec_paths_resolve_to_mirror(self):
        """Spec paths inside `targets` strings resolve, through the mirror.

        user-guide-sync-reviewer reads the JSON before the prose table, and the
        two are bound only by row count — so a target naming a moved or deleted
        document would otherwise go unnoticed."""
        bad = {}
        seen = 0
        for row in _load_matrix()["rows"]:
            for target in row["targets"]:
                for path in SPEC_PATH_RE.findall(target):
                    seen += 1
                    if not MIRROR_PATH_RE.fullmatch(path) or not (REPO_ROOT / path).is_file():
                        bad.setdefault(row["id"], []).append(path)
        self.assertTrue(seen, "expected some targets to name spec documents")
        self.assertFalse(
            bad,
            f"doc-sync-matrix.json targets name spec paths that are not existing "
            f"NERV mirror files: {bad}",
        )

    def test_json_concrete_globs_have_existing_base(self):
        """The leading wildcard-free path segments of every trigger glob must
        name a real directory. Catches a typo'd or relocated trigger path
        (e.g. `src/auth/**` when auth actually lives at `src/modules/auth/`)."""
        bad = {}
        for row in _load_matrix()["rows"]:
            for g in row["trigger"]["globs"]:
                concrete = _literal_base(g)
                if not concrete:
                    continue
                if not REPO_ROOT.joinpath(*concrete).exists():
                    bad.setdefault(row["id"], []).append(g)
        self.assertFalse(
            bad, f"doc-sync-matrix.json trigger globs with non-existent base path: {bad}"
        )

    def test_json_trigger_globs_match_a_file(self):
        """Every trigger glob matches at least one tracked file.

        The base-path check above stops at the first wildcard segment, so
        `spec/2-*/**` stayed green on the base `spec` after the old tree it
        named was deleted (NERV cutover step 5). The file list is `git ls-files`,
        so a local untracked file (`node_modules`, a generated cache) cannot
        make this green on one machine only. The matching rules are pinned by
        `GlobMatchHelperTest` below."""
        files = _tracked_files()
        bad = {}
        for row in _load_matrix()["rows"]:
            for g in row["trigger"]["globs"]:
                if not _glob_matches_a_file(g, files):
                    bad.setdefault(row["id"], []).append(g)
        self.assertFalse(
            bad, f"doc-sync-matrix.json trigger globs that match no file: {bad}"
        )


class GlobMatchHelperTest(unittest.TestCase):
    """`_glob_matches_a_file` on a synthetic file list: one positive and one
    negative per rule, so a helper that always answers True turns this red."""

    FILES = ["spec/CLE-A/CLE-A-X.md", "codebase/x/a.mdx", "codebase/x/deep/b.mdx", "PROJECT.md"]

    def test_wildcards(self):
        self.assertTrue(_glob_matches_a_file("spec/CLE-*/**", self.FILES))
        self.assertFalse(_glob_matches_a_file("spec/2-*/**", self.FILES))
        # fnmatch's `*` crosses `/` — the matrix's `**.mdx` relies on it.
        self.assertTrue(_glob_matches_a_file("codebase/x/**.mdx", self.FILES))
        self.assertFalse(_glob_matches_a_file("codebase/y/**.mdx", self.FILES))

    def test_trailing_slash_names_a_directory(self):
        self.assertTrue(_glob_matches_a_file("codebase/x/", self.FILES))
        self.assertFalse(_glob_matches_a_file("codebase/y/", self.FILES))

    def test_plain_path(self):
        self.assertTrue(_glob_matches_a_file("PROJECT.md", self.FILES))
        self.assertFalse(_glob_matches_a_file("CLAUDE.md", self.FILES))

    def test_every_brace_alternative_must_match(self):
        self.assertTrue(_glob_matches_a_file("codebase/x/{a,deep/b}.mdx", self.FILES))
        self.assertFalse(_glob_matches_a_file("codebase/x/{a,c}.mdx", self.FILES))


if __name__ == "__main__":
    unittest.main()
