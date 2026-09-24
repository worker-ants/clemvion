"""Guard: `spec-link-checks.yml` runs the WHOLE docs-guard directory, and runs it
when `plan/**` changes.

Why this exists — 2026-09-24. The guards under
`codebase/frontend/src/lib/docs/__tests__/` scan `plan/**` and `spec/**`
(`plan-frontmatter`, `spec-frontmatter`, `spec-code-paths`,
`spec-pending-plan-existence`, `spec-status-lifecycle`, ...). `frontend-checks`
never triggers on those paths, so this workflow is the only CI entry point for
them on a plan/spec-only PR. Until 2026-09-24 it had two holes:

  1. its pathspecs had `spec/**` but NOT `plan/**`, so a plan-only PR skipped the
     job entirely (measured with the real `scripts/ci-paths-changed.sh` on a
     historical plan-only commit: old pathspecs `relevant=false`, new `true`);
  2. it ran ONE guard file (`spec-link-integrity.test.ts`), so even when it did
     trigger, the other docs guards never ran.

A plan-frontmatter violation slipped past CI exactly this way (`#1387` round 1).

Nothing else pins either fact: `test_workflow_yaml_structure.py` fixes the job
name and its `if:`, not what the job runs or when it is relevant. Deleting
`plan/**` or narrowing the run back to one file kept the whole harness green
(reported by the 2026-09-24 review). These assertions are deliberately NARROW —
they name the regression shapes, so a future edit that reintroduces one fails
with a message that says which.

The pathspec block is read with the SAME parser that
`test_harness_checks_paths_coverage.py` uses, not a copy — a guard that checks
its own re-implementation stops tracking the real one.
"""
from __future__ import annotations

import unittest

import yaml

from _harness import REPO_ROOT
from test_harness_checks_paths_coverage import parse_pathspecs_block

WORKFLOW = REPO_ROOT / ".github" / "workflows" / "spec-link-checks.yml"
JOB = "spec-link-integrity"  # required-check anchor — see the job's comment
DOCS_GUARD_DIR = "src/lib/docs/__tests__/"


def _docs_guard_run_commands() -> list[str]:
    """`run:` lines of the job's steps that invoke the frontend test runner."""
    doc = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    steps = doc["jobs"][JOB]["steps"]
    return [
        s["run"]
        for s in steps
        if isinstance(s.get("run"), str) and "--filter frontend test" in s["run"]
    ]


class SpecLinkChecksScopeTest(unittest.TestCase):
    def test_pathspecs_trigger_on_plan_and_spec(self) -> None:
        pathspecs = parse_pathspecs_block(WORKFLOW.read_text(encoding="utf-8"))
        for needed in ("plan/**", "spec/**"):
            with self.subTest(pathspec=needed):
                self.assertIn(
                    needed,
                    pathspecs,
                    f"{WORKFLOW.name}: pathspecs lost {needed!r} — docs guards that "
                    f"scan it will not run on a PR that only changes it",
                )

    def test_runs_the_docs_guard_directory_not_one_file(self) -> None:
        runs = _docs_guard_run_commands()
        self.assertEqual(
            len(runs),
            1,
            f"expected exactly one docs-guard test step in job {JOB!r}, got {runs!r}",
        )
        cmd = runs[0]
        self.assertIn(
            DOCS_GUARD_DIR,
            cmd,
            f"docs-guard step no longer targets {DOCS_GUARD_DIR!r}: {cmd!r}",
        )
        self.assertNotIn(
            ".test.ts",
            cmd,
            "docs-guard step runs a single guard file again — enumerating files "
            f"forgets the next docs guard; run the directory instead: {cmd!r}",
        )


if __name__ == "__main__":
    unittest.main()
