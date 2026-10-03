"""Guard: `spec-link-checks.yml` runs the WHOLE docs-guard directory, and runs it
when `spec/**` or a path the guards resolve changes.

Why this exists — 2026-09-24. The guards under
`codebase/frontend/src/lib/docs/__tests__/` scan `spec/**` (`spec-impl-locations`,
`spec-link-integrity`, ...; `spec-frontmatter` and `spec-code-paths` until NERV
cutover step 5) and, until cutover step 3 (Task CLE-T-FN2JWK, 2026-10-01),
`plan/**` too. `frontend-checks` never triggers
on those paths, so this workflow is the only CI entry point for them on a
spec-only PR. Until 2026-09-24 it had two holes:

  1. its pathspecs had `spec/**` but NOT `plan/**`, so a plan-only PR skipped the
     job entirely (measured with the real `scripts/ci-paths-changed.sh` on a
     historical plan-only commit: old pathspecs `relevant=false`, new `true`);
  2. it ran ONE guard file (`spec-link-integrity.test.ts`), so even when it did
     trigger, the other docs guards never ran.

A plan-frontmatter violation slipped past CI exactly this way (`#1387` round 1).
Step 3 removed `plan/` with the plan guards, and `plan/**` left the pathspecs;
`spec/**` is the trigger this file still pins.

Cutover step 5 (Task CLE-T-7M4C4X) added the third shape. `spec-impl-locations`
checks that the repository paths in a mirror doc's `## 구현 위치` exist, under
four roots (`IMPL_LOCATION_ROOTS`). A PR that moves only a cited
`scripts/*` or `.github/workflows/*` file did not trigger the job, so the broken
citation surfaced on the next unrelated PR. Every tracked file under those roots
must now fall under a pathspec.

Nothing else pins either fact: `test_workflow_yaml_structure.py` fixes the job
name and its `if:`, not what the job runs or when it is relevant. Deleting
a scanned root or narrowing the run back to one file kept the whole harness green
(reported by the 2026-09-24 review). These assertions are deliberately NARROW —
they name the regression shapes, so a future edit that reintroduces one fails
with a message that says which.

The pathspec block is read with the SAME parser that
`test_harness_checks_paths_coverage.py` uses, not a copy — a guard that checks
its own re-implementation stops tracking the real one.
"""
from __future__ import annotations

import subprocess
import unittest

import yaml

from _harness import REPO_ROOT, impl_location_roots
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


def _covered(path: str, pathspecs: list[str]) -> bool:
    """A tracked file falls under a plain `dir/**` pathspec or an exact one.

    `:(glob)` magic entries are skipped; they only add root-level `*.md`, which no
    implementation-location root contains.
    """
    for ps in pathspecs:
        if ps.endswith("/**") and path.startswith(ps[:-2]):
            return True
        if ps == path:
            return True
    return False


class SpecLinkChecksScopeTest(unittest.TestCase):
    def test_pathspecs_cover_every_implementation_location_root(self) -> None:
        pathspecs = parse_pathspecs_block(WORKFLOW.read_text(encoding="utf-8"))
        roots = impl_location_roots()
        self.assertGreaterEqual(len(roots), 4)
        for root in roots:
            files = subprocess.run(["git", "ls-files", "--", root], cwd=REPO_ROOT, check=True,
                                   capture_output=True, text=True).stdout.splitlines()
            self.assertTrue(files, f"no tracked file under {root!r} — check the root list")
            uncovered = [f for f in files if not _covered(f, pathspecs)]
            self.assertEqual(
                uncovered[:5],
                [],
                f"{WORKFLOW.name}: {len(uncovered)} file(s) under {root!r} trigger no "
                f"docs-guard run, yet `spec-impl-locations` resolves paths there. "
                f"Add `{root}**` to the pathspecs",
            )

    def test_pathspecs_trigger_on_spec(self) -> None:
        pathspecs = parse_pathspecs_block(WORKFLOW.read_text(encoding="utf-8"))
        self.assertIn(
            "spec/**",
            pathspecs,
            f"{WORKFLOW.name}: pathspecs lost 'spec/**' — docs guards that "
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
