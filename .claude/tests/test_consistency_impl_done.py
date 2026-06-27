"""Regression test for the consistency checker's ``--impl-done`` false positive.

Bug (PR #738): when a PR adds a new identifier to *both* code and spec, the
cross_spec / naming_collision checker sub-agents falsely reported "spec declares
X but code lacks X" as CRITICAL and BLOCKed the PR. Root cause: a checker
sub-agent's working directory is the *default-branch* checkout (≈ diff-base),
not the task worktree, so its own relative Read/Grep returns the PRE-change code
even though the orchestrator-bundled diff already shows the addition.

The orchestrator can't change a sub-agent's CWD, but it runs *inside* the
worktree, so it now (a) bundles the implementation diff — which carries the new
identifier — and (b) prepends a HEAD-basis notice pinning current-code to the
worktree absolute path and forbidding "missing-from-code" conclusions drawn
from the sub-agent's CWD.

We can't drive the LLM sub-agents here, so we assert the *prepared prompt* — the
deterministic surface the checkers consume — structurally prevents the false
positive: the new identifier is present (evidence) AND the HEAD-basis guard is
present. We drive the real CLI via subprocess (matching test_orchestrator_state).
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

NEW_ID = "WORKSPACE_INVITATIONS_PRUNER_QUEUE"


def _git(cwd: Path, *args: str) -> None:
    subprocess.run(
        ["git", *args],
        cwd=str(cwd),
        check=True,
        capture_output=True,
        text=True,
    )


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


class ImplDoneHeadBasisTest(unittest.TestCase):
    """A code+spec addition must yield a prompt that won't false-positive."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self._tmp.name)
        env = {
            "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t",
            "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t",
        }
        os.environ.update(env)
        _git(self.repo, "init", "-q")
        _git(self.repo, "config", "user.email", "t@t")
        _git(self.repo, "config", "user.name", "t")

        # --- baseline (diff-base): queue constant WITHOUT the new identifier ---
        _write(
            self.repo / "codebase" / "backend" / "system-status.constants.ts",
            "export const MONITORED_QUEUES = [\n"
            "  'WORKSPACE_PROVISIONING_QUEUE',\n"
            "  'BILLING_SYNC_QUEUE',\n"
            "];\n",
        )
        _write(
            self.repo / "spec" / "5-system" / "status.md",
            "# System Status\n\n## Overview\n\nMonitored queues.\n\n"
            "## 본문\n\n| Queue | 설명 |\n| --- | --- |\n"
            "| WORKSPACE_PROVISIONING_QUEUE | provisioning |\n",
        )
        _git(self.repo, "add", "-A")
        _git(self.repo, "commit", "-q", "-m", "baseline")
        self.base = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=str(self.repo),
            capture_output=True, text=True, check=True,
        ).stdout.strip()

        # --- HEAD: add the new queue identifier to BOTH code and spec ---
        _write(
            self.repo / "codebase" / "backend" / "system-status.constants.ts",
            "export const MONITORED_QUEUES = [\n"
            "  'WORKSPACE_PROVISIONING_QUEUE',\n"
            "  'BILLING_SYNC_QUEUE',\n"
            f"  '{NEW_ID}',\n"
            "];\n",
        )
        _write(
            self.repo / "spec" / "5-system" / "status.md",
            "# System Status\n\n## Overview\n\nMonitored queues.\n\n"
            "## 본문\n\n| Queue | 설명 |\n| --- | --- |\n"
            "| WORKSPACE_PROVISIONING_QUEUE | provisioning |\n"
            f"| {NEW_ID} | invitation pruner |\n",
        )
        _git(self.repo, "add", "-A")
        _git(self.repo, "commit", "-q", "-m", "add pruner queue (code+spec)")

    def tearDown(self):
        self._tmp.cleanup()

    def _prepare(self) -> Path:
        r = subprocess.run(
            [sys.executable, str(ORCH),
             "--impl-done", "spec/5-system", "--diff-base", self.base],
            cwd=str(self.repo), capture_output=True, text=True,
        )
        self.assertEqual(r.returncode, 0, f"stderr:\n{r.stderr}")
        session_dir = Path(r.stdout.strip())
        self.assertTrue(session_dir.is_dir(), f"no session dir: {r.stdout!r}")
        return session_dir

    def test_new_identifier_and_head_basis_present_in_code_checkers(self):
        session_dir = self._prepare()
        for checker in ("cross_spec", "naming_collision"):
            prompt = (session_dir / "_prompts" / f"{checker}.md").read_text(
                encoding="utf-8"
            )
            # (a) Evidence: the new identifier reaches the checker via the diff.
            self.assertIn(
                NEW_ID, prompt,
                f"{checker}: new identifier missing from prompt — checker has no "
                "evidence the code adds it (would re-derive from stale CWD).",
            )
            # (b) Guard: the HEAD-basis notice pins current-code to the worktree
            #     and forbids missing-from-code conclusions from the CWD.
            self.assertIn("현재 구현 코드의 기준", prompt, f"{checker}: no HEAD notice")
            self.assertIn(
                "상대경로 Read/Grep/Bash", prompt,
                f"{checker}: notice lacks the stale-CWD warning",
            )
            self.assertIn(
                "재확인하기 전에는 보고하지 말 것", prompt,
                f"{checker}: notice lacks the missing-from-code guard",
            )
            # The authoritative absolute worktree root must be named verbatim so
            # the checker can Read/`git -C` against HEAD instead of its own CWD.
            self.assertIn(str(self.repo.resolve()), prompt,
                          f"{checker}: worktree root not pinned in prompt")

    def test_head_basis_notice_scoped_to_impl_done(self):
        """No regression: other modes must NOT carry the impl-done code notice."""
        # --impl-prep over the same spec scope: pre-implementation, no code diff.
        r = subprocess.run(
            [sys.executable, str(ORCH), "--impl-prep", "spec/5-system"],
            cwd=str(self.repo), capture_output=True, text=True,
        )
        self.assertEqual(r.returncode, 0, f"stderr:\n{r.stderr}")
        session_dir = Path(r.stdout.strip())
        prompt = (session_dir / "_prompts" / "cross_spec.md").read_text(
            encoding="utf-8"
        )
        self.assertNotIn(
            "현재 구현 코드의 기준", prompt,
            "impl-prep must not carry the impl-done HEAD-basis code notice",
        )


if __name__ == "__main__":
    unittest.main()
