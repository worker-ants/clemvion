"""The consistency orchestrator must reject a mode argument that is not a path.

Every mode arg (``--spec`` / ``--plan`` / ``--impl-prep`` / ``--impl-done``) is
interpolated verbatim into each checker prompt's ``## Target 문서 / 경로:`` field.
Before this guard, a non-path sailed through: ``collect_markdown_files`` returns []
for a missing directory, the bundle renders ``(없음)``, and the five checkers then
report the corrupted payload itself as a CRITICAL — a ``BLOCK: YES`` with zero real
conflicts, after paying for a full fan-out.

That is not hypothetical: on 2026-07-17 a caller passed
``--impl-prep "spec/2-navigation — <설명문>"`` and burned a 5-checker run before the
mistake surfaced. The failure is silent and expensive at the far end, and free to
catch here, so the CLI fails fast instead.

We drive the real CLI via subprocess (matching test_orchestrator_state).
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from _harness import REPO_ROOT

ORCH = (
    REPO_ROOT / ".claude" / "skills" / "consistency-checker" / "scripts"
    / "consistency_orchestrator.py"
)


def _run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(ORCH), *args],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )


class TargetValidationTest(unittest.TestCase):
    def test_prose_in_scope_slot_is_rejected_with_a_pointed_hint(self):
        # The exact 2026-07-17 mistake.
        r = _run("--impl-prep", "spec/2-navigation — 사용자 가이드 링크 무한 중첩 fix")
        self.assertEqual(r.returncode, 2, r.stdout)
        self.assertIn("--impl-prep", r.stderr)
        # A caller who did this needs to know *where* the context belongs, not just
        # that the path is wrong.
        self.assertIn("설명문", r.stderr)
        self.assertIn("plan/in-progress", r.stderr)

    def test_nonexistent_spec_file_is_rejected(self):
        r = _run("--spec", "plan/in-progress/does-not-exist.md")
        self.assertEqual(r.returncode, 2, r.stdout)
        self.assertIn("--spec", r.stderr)

    def test_nonexistent_impl_prep_dir_is_rejected(self):
        r = _run("--impl-prep", "spec/no-such-area/")
        self.assertEqual(r.returncode, 2, r.stdout)

    def test_directory_passed_to_a_file_mode_is_rejected(self):
        # --spec wants a file; handing it a real directory must not pass.
        r = _run("--spec", "spec/2-navigation/")
        self.assertEqual(r.returncode, 2, r.stdout)
        self.assertIn("파일", r.stderr)

    def test_file_passed_to_a_dir_mode_is_rejected(self):
        # --impl-prep wants a directory; a real file must not pass.
        r = _run("--impl-prep", "spec/2-navigation/_layout.md")
        self.assertEqual(r.returncode, 2, r.stdout)
        self.assertIn("디렉토리", r.stderr)

    def test_valid_target_still_prepares_a_session(self):
        # Guard against the validation rejecting legitimate input (the whole CLI is
        # useless if this regresses).
        with tempfile.TemporaryDirectory() as tmp:
            draft = Path(tmp) / "spec-draft-probe.md"
            draft.write_text("# probe\n", encoding="utf-8")
            r = _run("--spec", str(draft))
        self.assertEqual(r.returncode, 0, r.stderr)
        # stdout's last line is the session dir.
        session = r.stdout.strip().splitlines()[-1]
        self.assertTrue(Path(session).is_dir(), f"session dir not created: {session}")
        # Clean up the session this test created.
        import shutil

        shutil.rmtree(session, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
