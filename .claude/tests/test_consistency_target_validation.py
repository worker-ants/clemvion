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
import shutil
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


def _run(*args: str, env: dict | None = None, cwd: Path = REPO_ROOT) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(ORCH), *args],
        cwd=str(cwd),
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
        r = _run("--spec", "spec/CLE-ENG/")
        self.assertEqual(r.returncode, 2, r.stdout)
        self.assertIn("파일", r.stderr)

    def test_old_tree_shaped_paths_under_spec_are_rejected_as_a_scope(self):
        """`spec/` 에는 미러만 있다. 옛 트리 모양의 폴더 · 파일과 `spec/` 자체는 대상으로 받지 않는다.

        옛 트리는 전환 단계 5(NERV Task `CLE-T-7M4C4X`)에서 지웠다. 그래서 이 저장소에는 그런 경로가
        없다. 누가 다시 만들어도 막히는지 임시 저장소에 옛 트리 모양을 만들어 본다.
        """
        tmp = Path(tempfile.mkdtemp(prefix="consistency-scope-"))
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        for rel, body in {
            "spec/CLE-ENG/CLE-ENG.md": "---\ntype: area\n---\n# 영역\n",
            "spec/2-navigation/_layout.md": "# 옛 레이아웃\n",
            "spec/conventions/old-conv.md": "# 옛 규약\n",
        }.items():
            (tmp / rel).parent.mkdir(parents=True, exist_ok=True)
            (tmp / rel).write_text(body, encoding="utf-8")
        cases = {
            "spec/2-navigation/": "미러 문서가 없는 폴더다",
            "spec/2-navigation/_layout.md": "미러 문서가 아니다",
            "spec/conventions/": "미러 문서가 없는 폴더다",
            "spec/": "NERV 스펙 미러가 아니다",
        }
        for scope, reason in cases.items():
            with self.subTest(scope=scope):
                r = _run("--impl-prep", scope, cwd=tmp)
                self.assertEqual(r.returncode, 2, r.stdout)
                self.assertIn(reason, r.stderr)

    def test_scope_inputs_that_name_no_mirror_document_are_rejected(self):
        """빈 항목 · 미러 안내 · 저장소의 다른 곳 · 없는 미러 파일은 모두 종료 코드 2 와 이유를 낸다."""
        cases = {
            ",": "비어 있다",
            "spec/README.md": "미러 문서가 아니다",
            "codebase/": "NERV 스펙 미러가 아니다",
            "spec/CLE-ENG/no-such.md": "실존하는 경로도 NERV 키도 아니다",
        }
        for scope, reason in cases.items():
            with self.subTest(scope=scope):
                r = _run("--impl-prep", scope)
                self.assertEqual(r.returncode, 2, r.stdout)
                self.assertIn(reason, r.stderr)

    def test_a_path_outside_spec_is_told_to_use_the_mirror(self):
        r = _run("--impl-prep", "codebase/")
        self.assertEqual(r.returncode, 2, r.stdout)
        self.assertIn("미러 영역 폴더", r.stderr)

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
