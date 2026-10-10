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

The file list is read from the spec itself (`const FILES = [...]`) rather than copied
here, so a file added to the spec is demanded in the pathspecs without touching this
test. Two floors keep the parse from passing vacuously.

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
WORKFLOW = ".github/workflows/backend-checks.yml"

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

_FILES_ARRAY = re.compile(r"\bconst\s+FILES\s*=\s*\[(.*?)\]", re.S)
_QUOTED = re.compile(r"""['"]([^'"\n]+)['"]""")


def files_read_by_spec(source: str) -> list[str]:
    """Repo-relative paths in the spec's `const FILES = [...]` literal."""
    match = _FILES_ARRAY.search(source)
    if match is None:
        return []
    return _QUOTED.findall(match.group(1))


class FilesReadBySpecTest(unittest.TestCase):
    def test_reads_quoted_entries(self) -> None:
        src = "const FILES = [\n  'a/b.yaml',\n  \"c.yml\",\n];\n"
        self.assertEqual(files_read_by_spec(src), ["a/b.yaml", "c.yml"])

    def test_no_array_yields_empty(self) -> None:
        self.assertEqual(files_read_by_spec("const OTHER = ['x'];"), [])


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


if __name__ == "__main__":
    unittest.main()
