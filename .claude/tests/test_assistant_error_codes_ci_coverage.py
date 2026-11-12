"""Guard: `backend-checks` runs when the frontend file the assistant error-code spec reads changes.

Why this exists — NERV Task `CLE-T-GXCJAB`. The backend unit test
`workflow-assistant-stream-errors.spec.ts` reads the frontend file `assistant-message.tsx`
and checks that the codes in its `ERROR_MESSAGE_KEYS` Map literal are the codes the backend
message table covers. The frontend file is outside `codebase/backend/**`, so a PR that edited
only that file (added a code to the Map, say) was judged `relevant=false`, the `backend unit`
job passed as a no-op, and the mismatch would surface on a later, unrelated backend PR
(CLE-T-MX8PSE code round 3). Same class as `test_backend_example_key_ci_coverage.py`.

The frontend path is read from the spec itself (the one quoted relative literal that names a
`frontend/` file, joined onto `__dirname`) rather than copied here, so moving the file in the
spec demands the new path in the pathspecs without touching this test. No literal, or more
than one, raises `LookupError`; a resolved path that does not exist or that falls outside
`codebase/frontend/` fails, so the parse cannot pass vacuously.

The spec is also listed in `harness-checks.yml`'s pathspecs (pinned by
`SpecTriggersHarnessChecksTest`), so a PR that edits only the spec runs this guard. The example
key guard broke on main without that entry (`CLE-T-HRZRC8`).
"""
from __future__ import annotations

import posixpath
import re
import unittest

from _harness import REPO_ROOT
from test_harness_checks_paths_coverage import filter_covers_file, parse_pathspecs_block

SPEC = "codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream-errors.spec.ts"
WORKFLOW = ".github/workflows/backend-checks.yml"
HARNESS_WORKFLOW = ".github/workflows/harness-checks.yml"
FRONTEND_ROOT = "codebase/frontend/"

# A quoted relative path (`'../…'`) that names a file under some `frontend/` directory.
_FRONTEND_LITERAL = re.compile(r"""['"](\.\./[^'"\n]*/frontend/[^'"\n]+)['"]""")


def frontend_file_read_by_spec(source: str, spec_path: str = SPEC) -> str:
    """Repo-relative path of the frontend file the spec joins onto its own directory.

    Raises `LookupError` when the source has no such literal or more than one, so a
    refactor that drops or splits the path fails here instead of passing on nothing.
    """
    literals = _FRONTEND_LITERAL.findall(source)
    if len(literals) != 1:
        raise LookupError(
            f"expected exactly one quoted '../…/frontend/…' path in {spec_path}, found "
            f"{len(literals)} — update .claude/tests/test_assistant_error_codes_ci_coverage.py "
            f"if the spec now reads the frontend file another way"
        )
    return posixpath.normpath(posixpath.join(posixpath.dirname(spec_path), literals[0]))


class FrontendFileReadBySpecTest(unittest.TestCase):
    def test_resolves_the_literal_against_the_spec_directory(self) -> None:
        src = "const F = join(__dirname, '../../../../frontend/src/a/b.tsx');"
        self.assertEqual(
            frontend_file_read_by_spec(src, "codebase/backend/src/modules/x/x.spec.ts"),
            "codebase/frontend/src/a/b.tsx",
        )

    def test_missing_literal_fails(self) -> None:
        with self.assertRaisesRegex(LookupError, "found 0"):
            frontend_file_read_by_spec("const F = join(__dirname, 'local.ts');")

    def test_two_literals_fail(self) -> None:
        src = "'../../frontend/a.tsx'; '../../frontend/b.tsx';"
        with self.assertRaisesRegex(LookupError, "found 2"):
            frontend_file_read_by_spec(src)


class AssistantErrorCodesCiCoverageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.frontend_file = frontend_file_read_by_spec(
            (REPO_ROOT / SPEC).read_text(encoding="utf-8")
        )
        cls.pathspecs = parse_pathspecs_block(
            (REPO_ROOT / WORKFLOW).read_text(encoding="utf-8")
        )

    def test_parse_is_not_vacuous(self) -> None:
        self.assertTrue(self.pathspecs, f"{WORKFLOW}: no pathspecs block parsed")
        # A path under `codebase/backend/` would be covered by `codebase/backend/**` and
        # pass the next test for the wrong reason.
        self.assertTrue(
            self.frontend_file.startswith(FRONTEND_ROOT),
            f"{SPEC} now reads {self.frontend_file!r}, which is not under {FRONTEND_ROOT}",
        )
        self.assertTrue(
            (REPO_ROOT / self.frontend_file).is_file(),
            f"{SPEC} reads {self.frontend_file!r}, which does not exist",
        )

    def test_the_frontend_file_triggers_the_workflow(self) -> None:
        self.assertTrue(
            any(filter_covers_file(spec, self.frontend_file) for spec in self.pathspecs),
            f"{self.frontend_file} is read by {SPEC} but no pathspec in {WORKFLOW} matches "
            f"it — a PR that edits only that file would skip the backend unit job",
        )


class SpecTriggersHarnessChecksTest(unittest.TestCase):
    """Editing the spec alone must run this suite.

    `test_harness_checks_paths_coverage.py` drops `codebase/` paths as product paths, so
    the entry is pinned here, as `test_backend_example_key_ci_coverage.py` does for its spec.
    """

    def test_spec_is_in_harness_checks_pathspecs(self) -> None:
        pathspecs = parse_pathspecs_block((REPO_ROOT / HARNESS_WORKFLOW).read_text(encoding="utf-8"))
        self.assertTrue(pathspecs, f"{HARNESS_WORKFLOW}: no pathspecs block parsed")
        self.assertTrue(
            any(filter_covers_file(spec, SPEC) for spec in pathspecs),
            f"{SPEC} is not in {HARNESS_WORKFLOW}'s pathspecs — a PR that edits only the "
            f"spec (moves the frontend path, say) would not run this guard",
        )


if __name__ == "__main__":
    unittest.main()
