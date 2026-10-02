"""Guard: the CI stacks whose tests read the API catalogs run when a catalog changes.

Why this exists — NERV cutover stage 4a (Task `CLE-T-BD48J3`, decision D4,
2026-10-02). The Cafe24 · MakeShop API catalogs moved from
`spec/conventions/<vendor>-api-catalog/` to `codebase/api-catalogs/<vendor>/`.
Six tests read them: four backend sync / drift tests and two frontend i18n sync
tests. While the catalogs lived under `spec/`, neither `backend-checks` nor
`frontend-checks` listed that path, so a catalog-only PR (a generator re-run, a
hand-added row) never ran the tests that compare the catalog with the code. The
move is the moment to close that gap, and nothing else would notice it reopening:
the stack pathspecs name their own package (`codebase/backend/**`), not the data
directory next to it.

The assertions are narrow on purpose. Each consumer must still name the catalog
directory (if it stops, the consumer list here is stale), and each workflow that
runs a consumer must list the directory. The pathspec block is read with the same
parser `test_harness_checks_paths_coverage.py` uses.
"""
from __future__ import annotations

import unittest

from _harness import REPO_ROOT
from test_harness_checks_paths_coverage import parse_pathspecs_block

CATALOG_ROOT = "codebase/api-catalogs"
CATALOG_PATHSPEC = f"{CATALOG_ROOT}/**"
VENDORS = ("cafe24", "makeshop")

# workflow → the tests in that stack that read a catalog.
CONSUMERS: dict[str, tuple[str, ...]] = {
    "backend-checks.yml": (
        "codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts",
        "codebase/backend/src/nodes/integration/cafe24/metadata/catalog-docs-drift.spec.ts",
        "codebase/backend/src/nodes/integration/cafe24/metadata/catalog-required-fields.spec.ts",
        "codebase/backend/src/nodes/integration/makeshop/metadata/catalog-sync.spec.ts",
    ),
    "frontend-checks.yml": (
        "codebase/frontend/src/lib/i18n/__tests__/cafe24-catalog-sync.spec.ts",
        "codebase/frontend/src/lib/i18n/__tests__/makeshop-catalog-sync.spec.ts",
    ),
}


class ApiCatalogCiCoverageTest(unittest.TestCase):
    def test_catalogs_live_in_codebase(self) -> None:
        for vendor in VENDORS:
            overview = REPO_ROOT / CATALOG_ROOT / vendor / "_overview.md"
            self.assertTrue(overview.is_file(), f"missing {overview.relative_to(REPO_ROOT)}")

    def test_consumers_still_read_the_catalog_directory(self) -> None:
        for workflow, consumers in CONSUMERS.items():
            for rel in consumers:
                text = (REPO_ROOT / rel).read_text(encoding="utf-8")
                # 테스트는 경로를 조각으로 잇는다(`join(REPO_ROOT, 'codebase', 'api-catalogs', …)`).
                self.assertIn(
                    "api-catalogs",
                    text,
                    f"{rel} no longer names the catalog directory — update CONSUMERS "
                    f"in this file (stack: {workflow})",
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
