"""Drift guard for PROJECT.md's "변경 유형 → 갱신 위치 매핑" matrix.

The matrix is a hand-maintained binding between change types and the build-time
guards / conventions that enforce them. Its rows reference, by name, things that
live elsewhere in the repo:

  - `*.test.ts` build-time guards under `codebase/`
  - `spec/conventions/*.md` and `spec/<area>/*.md` documents

When one of those is renamed or removed, the matrix silently goes stale — the
exact failure mode this guard exists for. Rather than re-extract the whole
matrix into JSON (a large, churn-heavy restructure best done as its own
reviewed PR), this test validates that every such reference in PROJECT.md still
resolves. It treats PROJECT.md as the source and fails the build on a dangling
pointer.

Scope note: this is a harness self-test that deliberately reaches into product
paths (`codebase/`, `spec/`) because the matrix is precisely a harness↔product
binding. It is keyed off PROJECT.md edits (see harness-checks.yml `paths`).
"""

from __future__ import annotations

import json
import re
import unittest

from _harness import CLAUDE_DIR, REPO_ROOT

PROJECT_MD = REPO_ROOT / "PROJECT.md"
MATRIX_JSON = CLAUDE_DIR / "config" / "doc-sync-matrix.json"
MATRIX_HEADING = "## 변경 유형 → 갱신 위치 매핑"

# Reference patterns the matrix carries, each anchored to a concrete file.
TEST_FILE_RE = re.compile(r"[A-Za-z0-9_-]+\.test\.ts")
SPEC_PATH_RE = re.compile(r"spec/(?:conventions/[A-Za-z0-9_./-]+|[0-9][A-Za-z0-9_./-]+)\.md")


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
