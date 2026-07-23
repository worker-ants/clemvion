"""Guard: README.md's "What's covered" table lists every test file, and only real ones.

Why this exists: the table is the only place that says WHAT each harness test
guards. A file missing from it is a test nobody knows the purpose of — and the
drift is silent, because nothing checks it. It had reached 9 of 27 files
unlisted (including three added the same week) before this guard.

The reverse direction matters too: a row naming a file that no longer exists
reads as coverage the suite does not actually have.

Stdlib only (per this directory's convention), so the table parser is
hand-rolled — which is exactly the kind of code that fails quietly. It therefore
takes TEXT rather than a path so its edge cases can be pinned with synthetic
input, and a sanity test asserts it finds real rows rather than returning an
empty set and passing vacuously.
"""

from __future__ import annotations

import re
import unittest

import _harness  # noqa: F401  — side effect: harness path setup; CLAUDE_DIR used below

TESTS_DIR = _harness.CLAUDE_DIR / "tests"
README = TESTS_DIR / "README.md"

# Rows look like: | `test_x.py` | what it guards |
_ROW = re.compile(r"^\|\s*`(test_[a-z0-9_]+\.py)`\s*\|", re.M)


def _parse_catalog(text: str) -> set[str]:
    """Test filenames listed in the README's table."""
    return set(_ROW.findall(text))


def _catalog() -> set[str]:
    return _parse_catalog(README.read_text(encoding="utf-8"))


def _actual_test_files() -> set[str]:
    return {p.name for p in TESTS_DIR.glob("test_*.py")}


class ParserSanityTest(unittest.TestCase):
    """A parser that silently returns nothing would make the guard vacuous."""

    def test_catalog_rows_are_found(self):
        self.assertGreater(
            len(_catalog()), 10,
            f"parsed almost no rows from {README} — the table format changed and "
            "this guard is now checking nothing",
        )

    def test_parser_reads_the_backticked_filename_only(self):
        text = (
            "| File | Guards |\n"
            "|---|---|\n"
            "| `test_a.py` | guards A, mentions test_not_a_row.py in prose |\n"
            "| `test_b.py` | guards B |\n"
            "\n"
            "Prose mentioning `test_c.py` outside a row must not count.\n"
        )
        self.assertEqual(_parse_catalog(text), {"test_a.py", "test_b.py"})

    def test_actual_test_files_are_found(self):
        self.assertGreater(len(_actual_test_files()), 10, f"no tests under {TESTS_DIR}")


class CatalogCoverageTest(unittest.TestCase):
    def test_every_test_file_is_documented(self):
        missing = sorted(_actual_test_files() - _catalog())
        self.assertEqual(
            missing, [],
            "these test files are not in README.md's \"What's covered\" table, so "
            "nothing records what they guard: " + ", ".join(missing),
        )

    def test_no_row_names_a_missing_file(self):
        dangling = sorted(_catalog() - _actual_test_files())
        self.assertEqual(
            dangling, [],
            "README.md documents test files that do not exist (renamed or "
            "deleted?), which reads as coverage the suite lacks: "
            + ", ".join(dangling),
        )


if __name__ == "__main__":
    unittest.main()
