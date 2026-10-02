"""Guard: the CI stacks whose tests read the API catalogs run when a catalog changes.

Why this exists — NERV cutover stage 4a (Task `CLE-T-BD48J3`, decision D4,
2026-10-02). The Cafe24 · MakeShop API catalogs moved from
`spec/conventions/<vendor>-api-catalog/` to `codebase/api-catalogs/<vendor>/`.
Backend sync / drift / index-frontmatter tests, frontend i18n sync tests and the
spec link guard read them. While the catalogs lived under `spec/`, neither
`backend-checks` nor `frontend-checks` listed that path, so a catalog-only PR (a
generator re-run, a hand-added row) never ran the tests that compare the catalog
with the code. The move is the moment to close that gap, and nothing else would
notice it reopening: the stack pathspecs name their own package
(`codebase/backend/**`), not the data directory next to it.

The assertions are narrow on purpose. Each listed consumer must still build the
catalog path in code — a quoted string literal outside comments, because four of
the consumers also name the directory in a header comment, and a substring check
passed on the comment alone after the code stopped reading it (review of
`77ffa497e`). Each workflow that runs a consumer must list the directory. The
pathspec block is read with the same parser `test_harness_checks_paths_coverage.py`
uses.

Stated limit: the list catches a consumer that stops reading the catalog, not a new
consumer that starts. A new test that reads `codebase/api-catalogs/` belongs in
`CONSUMERS` together with its workflow.
"""
from __future__ import annotations

import re
import unittest

from _harness import REPO_ROOT
from test_harness_checks_paths_coverage import parse_pathspecs_block

CATALOG_DIR_NAME = "api-catalogs"
CATALOG_ROOT = f"codebase/{CATALOG_DIR_NAME}"
CATALOG_PATHSPEC = f"{CATALOG_ROOT}/**"
VENDORS = ("cafe24", "makeshop")

# workflow → the files in that stack whose code reads a catalog.
CONSUMERS: dict[str, tuple[str, ...]] = {
    "backend-checks.yml": (
        "codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts",
        "codebase/backend/src/nodes/integration/cafe24/metadata/catalog-docs-drift.spec.ts",
        "codebase/backend/src/nodes/integration/cafe24/metadata/catalog-required-fields.spec.ts",
        "codebase/backend/src/nodes/integration/makeshop/metadata/catalog-sync.spec.ts",
        "codebase/backend/src/nodes/integration/api-catalog-index-frontmatter.spec.ts",
    ),
    "frontend-checks.yml": (
        "codebase/frontend/src/lib/i18n/__tests__/cafe24-catalog-sync.spec.ts",
        "codebase/frontend/src/lib/i18n/__tests__/makeshop-catalog-sync.spec.ts",
    ),
    # 옛 spec 트리에서 옛 카탈로그 경로로 가는 링크를 새 자리에서 검사한다(`RELOCATED_SPEC_TREES`).
    "spec-link-checks.yml": (
        "codebase/frontend/src/lib/docs/__tests__/spec-links.ts",
    ),
}

_BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.S)
_LINE_COMMENT = re.compile(r"(?m)^\s*//.*$")
# 따옴표 리터럴 안에서 경로 조각으로 쓰인 디렉터리 이름(`'api-catalogs'`, `"codebase/api-catalogs/cafe24"`).
_CATALOG_LITERAL = re.compile(
    rf"""['"](?:[^'"\n]*/)?{re.escape(CATALOG_DIR_NAME)}(?:/[^'"\n]*)?['"]"""
)


def code_names_catalog_dir(source: str) -> bool:
    """True when the source, comments removed, has a string literal naming the directory."""
    code = _LINE_COMMENT.sub("", _BLOCK_COMMENT.sub("", source))
    return _CATALOG_LITERAL.search(code) is not None


class CodeNamesCatalogDirTest(unittest.TestCase):
    def test_literal_in_code_counts(self) -> None:
        self.assertTrue(code_names_catalog_dir("join(ROOT, 'codebase', 'api-catalogs', 'x')"))
        self.assertTrue(code_names_catalog_dir('["a", "codebase/api-catalogs/cafe24"],'))

    def test_comment_only_mention_does_not_count(self) -> None:
        src = (
            "/** reads `codebase/api-catalogs/cafe24/<r>.md` */\n"
            "// see 'codebase/api-catalogs/x'\n"
            "const DIR = join(ROOT, 'spec', 'conventions');\n"
        )
        self.assertFalse(code_names_catalog_dir(src))

    def test_look_alike_name_does_not_count(self) -> None:
        self.assertFalse(code_names_catalog_dir("const d = 'my-api-catalogs-old';"))


class ApiCatalogCiCoverageTest(unittest.TestCase):
    def test_catalogs_live_in_codebase(self) -> None:
        for vendor in VENDORS:
            overview = REPO_ROOT / CATALOG_ROOT / vendor / "_overview.md"
            self.assertTrue(overview.is_file(), f"missing {overview.relative_to(REPO_ROOT)}")

    def test_consumers_still_read_the_catalog_directory(self) -> None:
        for workflow, consumers in CONSUMERS.items():
            for rel in consumers:
                text = (REPO_ROOT / rel).read_text(encoding="utf-8")
                self.assertTrue(
                    code_names_catalog_dir(text),
                    f"{rel} no longer builds a {CATALOG_DIR_NAME!r} path in code — update "
                    f"CONSUMERS in this file (stack: {workflow})",
                )

    def test_stack_workflows_trigger_on_catalog_changes(self) -> None:
        for workflow in CONSUMERS:
            path = REPO_ROOT / ".github" / "workflows" / workflow
            pathspecs = parse_pathspecs_block(path.read_text(encoding="utf-8"))
            self.assertTrue(pathspecs, f"{workflow}: no pathspecs block parsed")
            self.assertIn(
                CATALOG_PATHSPEC,
                pathspecs,
                f"{workflow}: pathspecs lack {CATALOG_PATHSPEC!r} — a catalog-only PR "
                f"would skip the tests that compare the catalog with the code",
            )


if __name__ == "__main__":
    unittest.main()
