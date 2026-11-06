"""Guard: `backend-checks` runs when a file that `production-guards.spec.ts` reads changes.

Why this exists — NERV Task `CLE-T-2V7SBC`. The spec's last `describe` reads the
repo-committed example key files (`.env.example`, the k8s example secret, the local
overlay secret, the e2e compose file, the root README) and asserts every
`ENCRYPTION_KEY` / `INTEGRATION_ENCRYPTION_KEY` value in them is in the production
boot guard's reject list. Only `codebase/backend/.env.example` is inside the
`codebase/backend/**` filter. A PR that edits only one of the other files (for
example replaces `REPLACE_ME` in `k8s/base/secret.example.yaml`) was judged
`relevant=false`, so the `backend unit` job passed as a no-op and the comparison
never ran. The same class as `test_api_catalog_ci_coverage.py`: the stack pathspec
names its own package, not the files next to it that its tests read.

The file list is read from the spec itself (`const EXAMPLE_FILES = [...]`) rather than
copied here, so a file added to the spec is demanded in the pathspecs without touching
this test. A missing array raises `LookupError` naming it, and two floors keep the
parse from passing vacuously.

The spec is also listed in `harness-checks.yml`'s pathspecs, so a PR that edits only
the spec runs this guard. #1637 renamed the array as `FILES` → `EXAMPLE_FILES` in a
codebase-only PR, the suite never ran, and this guard failed on main (`CLE-T-HRZRC8`).

`README.md` is the one deliberate exception: listing it would run the backend jobs
for every README edit in the repo. Its example values are compared only on a PR that
already triggers `backend-checks` for another reason. The exception is pinned both
ways — it must still be read by the spec and must still be absent from the pathspecs,
so the day someone lists it the exception entry has to go with it.
"""
from __future__ import annotations

import re
import unittest

from _harness import REPO_ROOT
from test_harness_checks_paths_coverage import filter_covers_file, parse_pathspecs_block

SPEC = "codebase/backend/src/common/config/production-guards.spec.ts"
# The array in SPEC that lists the files its comparison reads.
SPEC_ARRAY = "EXAMPLE_FILES"
WORKFLOW = ".github/workflows/backend-checks.yml"
HARNESS_WORKFLOW = ".github/workflows/harness-checks.yml"

# Files the spec reads that the pathspecs leave out on purpose, with the reason.
UNLISTED_ON_PURPOSE: dict[str, str] = {
    "README.md": "every README edit would run the backend jobs",
}

# Files that must stay in the spec's list. Dropping one silently shrinks the guard.
REQUIRED_IN_SPEC = (
    "codebase/backend/.env.example",
    "k8s/base/secret.example.yaml",
    "k8s/overlays/local/secret.yaml",
    "docker-compose.e2e.yml",
)

_FILES_ARRAY = re.compile(rf"\bconst\s+{SPEC_ARRAY}\s*=\s*\[(.*?)\]", re.S)
_QUOTED = re.compile(r"""['"]([^'"\n]+)['"]""")


def files_read_by_spec(source: str) -> list[str]:
    """Repo-relative paths in the spec's `const EXAMPLE_FILES = [...]` literal.

    Raises `LookupError` naming the array when the source has none. Returning `[]`
    instead is what let #1637's rename fail with a message about a missing file.
    """
    match = _FILES_ARRAY.search(source)
    if match is None:
        raise LookupError(
            f"`const {SPEC_ARRAY} = [...]` not found in {SPEC} — if the array was renamed, "
            f"update SPEC_ARRAY in .claude/tests/test_backend_example_key_ci_coverage.py"
        )
    return _QUOTED.findall(match.group(1))


class FilesReadBySpecTest(unittest.TestCase):
    def test_reads_quoted_entries(self) -> None:
        src = f"const {SPEC_ARRAY} = [\n  'a/b.yaml',\n  \"c.yml\",\n];\n"
        self.assertEqual(files_read_by_spec(src), ["a/b.yaml", "c.yml"])

    def test_missing_array_fails_naming_it(self) -> None:
        with self.assertRaisesRegex(LookupError, rf"const {SPEC_ARRAY} = \["):
            files_read_by_spec("const OTHER = ['x'];")

    def test_the_old_name_is_not_read(self) -> None:
        # #1637 renamed `FILES` to `EXAMPLE_FILES`; the old regex then read `[]` and two
        # tests failed with a message about `.env.example` instead of the rename.
        with self.assertRaisesRegex(LookupError, SPEC_ARRAY):
            files_read_by_spec("const FILES = ['codebase/backend/.env.example'];")

    def test_an_empty_array_is_read_as_empty(self) -> None:
        # Present-but-empty is left to the REQUIRED_IN_SPEC floor, which names each file.
        self.assertEqual(files_read_by_spec(f"const {SPEC_ARRAY} = [];"), [])


class BackendExampleKeyCiCoverageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.files = files_read_by_spec((REPO_ROOT / SPEC).read_text(encoding="utf-8"))
        cls.pathspecs = parse_pathspecs_block(
            (REPO_ROOT / WORKFLOW).read_text(encoding="utf-8")
        )

    def test_parse_is_not_vacuous(self) -> None:
        self.assertTrue(self.pathspecs, f"{WORKFLOW}: no pathspecs block parsed")
        for required in REQUIRED_IN_SPEC:
            self.assertIn(
                required,
                self.files,
                f"{SPEC} no longer reads {required!r} — update REQUIRED_IN_SPEC if intended",
            )

    def test_every_file_outside_backend_triggers_the_workflow(self) -> None:
        for rel in self.files:
            if rel in UNLISTED_ON_PURPOSE:
                continue
            self.assertTrue(
                any(filter_covers_file(spec, rel) for spec in self.pathspecs),
                f"{rel} is read by {SPEC} but no pathspec in {WORKFLOW} matches it — "
                f"a PR that edits only that file would skip the backend unit job",
            )

    def test_exceptions_are_still_accurate(self) -> None:
        for rel, reason in UNLISTED_ON_PURPOSE.items():
            self.assertIn(rel, self.files, f"{rel} ({reason}) is no longer read by {SPEC}")
            self.assertFalse(
                any(filter_covers_file(spec, rel) for spec in self.pathspecs),
                f"{rel} is now covered by {WORKFLOW}; drop it from UNLISTED_ON_PURPOSE",
            )


class SpecTriggersHarnessChecksTest(unittest.TestCase):
    """Editing the spec alone must run this suite.

    `test_harness_checks_paths_coverage.py` drops `codebase/` paths as product paths, so
    the entry is pinned here. #1637 renamed the array in a codebase-only PR, harness-checks
    judged it `relevant=false`, and this guard broke on main unseen (`CLE-T-HRZRC8`).
    """

    def test_spec_is_in_harness_checks_pathspecs(self) -> None:
        pathspecs = parse_pathspecs_block((REPO_ROOT / HARNESS_WORKFLOW).read_text(encoding="utf-8"))
        self.assertTrue(pathspecs, f"{HARNESS_WORKFLOW}: no pathspecs block parsed")
        self.assertTrue(
            any(filter_covers_file(spec, SPEC) for spec in pathspecs),
            f"{SPEC} is not in {HARNESS_WORKFLOW}'s pathspecs — a PR that edits only the "
            f"spec (renames `{SPEC_ARRAY}`, say) would not run this guard",
        )


if __name__ == "__main__":
    unittest.main()
