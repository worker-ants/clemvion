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

import os
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


def _run(*args: str, env: dict | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(ORCH), *args],
        cwd=str(REPO_ROOT),
        env=env,
        capture_output=True,
        text=True,
    )


class TargetValidationTest(unittest.TestCase):
    def test_prose_in_scope_slot_is_rejected_with_a_pointed_hint(self):
        # The exact 2026-07-17 mistake.
        r = _run("--impl-prep", "spec/CLE-UI — 사용자 가이드 링크 무한 중첩 fix")
        self.assertEqual(r.returncode, 2, r.stdout)
        self.assertIn("--impl-prep", r.stderr)
        # A caller who did this needs to know *where* the context belongs, not just
        # that the path is wrong.
        self.assertIn("설명문", r.stderr)
        # Since NERV cutover stage 3 the work context lives in the NERV Task, not
        # in a `plan/in-progress/<task>.md` file.
        self.assertIn("NERV Task", r.stderr)

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

    def test_the_frozen_old_tree_is_rejected_as_a_scope(self):
        """옛 트리는 동결됐고 대조 코퍼스가 미러라서 대상으로 받지 않는다(전환 4e).

        옛 트리를 대상으로 미러와 대조하면 같은 내용의 다른 판끼리 부딪쳐 충돌을 지어낸다.
        """
        for scope in ("spec/2-navigation/", "spec/2-navigation/_layout.md", "spec/conventions/"):
            with self.subTest(scope=scope):
                r = _run("--impl-prep", scope)
                self.assertEqual(r.returncode, 2, r.stdout)
                self.assertIn("동결", r.stderr)

    def test_an_unknown_key_is_rejected_with_the_pull_hint(self):
        r = _run("--impl-done", "CLE-NO-SUCH-KEY")
        self.assertEqual(r.returncode, 2, r.stdout)
        self.assertIn("미러에 없는 키", r.stderr)
        self.assertIn("pull.py", r.stderr)

    def test_an_unknown_focus_key_is_rejected(self):
        r = _run("--impl-prep", "CLE-ENG-SPECEVIDENCE", "--focus", "CLE-NO-SUCH-KEY")
        self.assertEqual(r.returncode, 2, r.stdout)
        self.assertIn("--focus", r.stderr)

    def test_the_plan_mode_is_gone(self):
        """`plan/` 은 전환 단계 3 에서 없어졌고 `--plan` 모드는 4e 에서 걷었다."""
        r = _run("--plan", "x.md")
        self.assertEqual(r.returncode, 2, r.stdout)
        self.assertIn("--plan", r.stderr)

    def test_a_key_scope_prepares_a_session(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "sessions"
            r = _run("--impl-prep", "CLE-ENG-SPECEVIDENCE,spec/CLE-API/",
                     "--focus", "CLE-ENG-SPECEVIDENCE",
                     env=dict(os.environ, CONSISTENCY_OUTPUT_DIR=str(out)))
            self.assertEqual(r.returncode, 0, r.stderr)
            session = Path(r.stdout.strip().splitlines()[-1])
            prompt = (session / "_prompts" / "cross_spec.md").read_text(encoding="utf-8")
        self.assertIn("spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md", prompt)
        self.assertIn("spec/CLE-API/CLE-API-SWAGGER.md", prompt)

    def test_valid_target_still_prepares_a_session(self):
        # Guard against the validation rejecting legitimate input (the whole CLI is
        # useless if this regresses).
        #
        # The session goes to a temp dir, not the default `./review/consistency` of
        # this checkout: there a failure before cleanup left a committable session
        # behind, and a parallel run's `git status` saw it meanwhile.
        with tempfile.TemporaryDirectory() as tmp:
            draft = Path(tmp) / "spec-draft-probe.md"
            draft.write_text("# probe\n", encoding="utf-8")
            out = Path(tmp) / "sessions"
            r = _run("--spec", str(draft),
                     env=dict(os.environ, CONSISTENCY_OUTPUT_DIR=str(out)))
            self.assertEqual(r.returncode, 0, r.stderr)
            # stdout's last line is the session dir.
            session = Path(r.stdout.strip().splitlines()[-1])
            self.assertTrue(session.is_dir(), f"session dir not created: {session}")
            # If the override stopped being honoured the session would land in this
            # checkout again — and still pass the check above.
            self.assertTrue(session.resolve().is_relative_to(out.resolve()),
                            f"session outside the temp output dir: {session}")


if __name__ == "__main__":
    unittest.main()
