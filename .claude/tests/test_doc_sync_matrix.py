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

TRANSITIONAL (NERV cutover step 5, Task CLE-T-7M4C4X): until the frozen old
tree is deleted, `SPEC_PATH_RE` still matches old-tree paths so a cited one is
caught. `OLD_TREE_ALLOWED` pinned the old-tree files PROJECT.md named where it
described what an old-tree guard read; the last one (`spec/0-overview.md`, read
by `spec-status-lifecycle`) left with that guard in step 3 (CLE-T-FN2JWK), so the
set is empty. Step 5 drops `_LEGACY`.

Scope note: this is a harness self-test that deliberately reaches into product
paths (`codebase/`, `spec/`) because the matrix is precisely a harness↔product
binding. harness-checks runs it on PROJECT.md · `.claude/**` edits, not on
`spec/**`-only changes (rule 3 of test_harness_checks_paths_coverage.py).
"""

from __future__ import annotations

import json
import re
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
# Frozen old tree. TRANSITIONAL — remove with the old tree (CLE-T-7M4C4X).
_LEGACY = r"conventions/[A-Za-z0-9_./-]+|[0-9][A-Za-z0-9_./-]+"
MIRROR_PATH_RE = re.compile(rf"spec/{_MIRROR}\.md")
SPEC_PATH_RE = re.compile(rf"spec/(?:{_LEGACY}|{_MIRROR})\.md")
# Old-tree files PROJECT.md may still name, each where it describes what a
# guard reads. Empty since step 3 (CLE-T-FN2JWK) removed `spec-status-lifecycle`,
# the last guard that read one (`spec/0-overview.md`). Anything cited must point
# at the mirror.
OLD_TREE_ALLOWED: frozenset[str] = frozenset()


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
          - the mirror branch of SPEC_PATH_RE is live (without a mirror match the
            existence check would pass vacuously on old-tree paths alone);
          - old-tree paths do not creep back: every non-mirror match must be in
            OLD_TREE_ALLOWED."""
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
            f"SPEC_PATH_RE misses mirror paths (regex branches diverged): "
            f"{sorted(mirror - cited)}",
        )
        old_tree = cited - mirror
        self.assertLessEqual(
            old_tree, OLD_TREE_ALLOWED,
            f"PROJECT.md cites frozen old-tree spec paths: "
            f"{sorted(old_tree - OLD_TREE_ALLOWED)}. Point at the NERV mirror "
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

        The old `spec/<n>-<area>/` · `spec/conventions/` tree is frozen (cutover
        step 1) and only removed in step 5, so a ref into it would still pass
        the existence check above while pointing at a document nobody updates."""
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
        two are bound only by row count — so a target naming a moved or frozen
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
        meta = set("*?{}<>")
        bad = {}
        for row in _load_matrix()["rows"]:
            for g in row["trigger"]["globs"]:
                concrete = []
                for seg in g.split("/"):
                    if seg and meta.isdisjoint(seg):
                        concrete.append(seg)
                    else:
                        break  # first segment with a wildcard/placeholder
                if not concrete:
                    continue
                if not REPO_ROOT.joinpath(*concrete).exists():
                    bad.setdefault(row["id"], []).append(g)
        self.assertFalse(
            bad, f"doc-sync-matrix.json trigger globs with non-existent base path: {bad}"
        )


if __name__ == "__main__":
    unittest.main()
