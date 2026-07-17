"""`.claude/_shared/report_paths.py` — the one rule two enforcement points must share.

The push/stop gate (`hooks/_lib/review_guard`) and the orchestrator CLIs
(`--verify-coverage`, `--sync-from-disk`) both answer "did this agent leave a report?".
When each owned a copy behind a "change both" comment, they diverged inside a single PR:
the gate gained a non-empty requirement while `--verify-coverage` still checked mere
existence, so `touch security.md` passed the CLI and failed the gate at the same moment
(measured 2026-07-17). The unit tests below pin the rule; `AgreementTest` pins the thing
that actually matters — that both consumers still answer identically.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import _harness  # noqa: F401  — side effect: puts .claude/hooks on sys.path
from _harness import REPO_ROOT, load_module_by_path
from _lib import review_guard as rg

rp = load_module_by_path(
    "_shared_report_paths", REPO_ROOT / ".claude" / "_shared" / "report_paths.py"
)

ORCH = (
    REPO_ROOT / ".claude" / "skills" / "code-review-agents" / "scripts"
    / "code_review_orchestrator.py"
)

# The shape every finished task leaves behind: `output_file` names a worktree that has
# since been deleted, while `review/**` lives on in git and is read from elsewhere.
DEAD_WORKTREE = "/Volumes/gone/.claude/worktrees/dead-1234/review/code/2026/01/01/00_00_00"

CLEAN_SUMMARY = "# x\n\n## 전체 위험도\n**NONE**\n"


def _state(names, *, output_dir, forced=None):
    s = {
        "subagent_invocations": [
            {"name": n, "output_file": os.path.join(output_dir, f"{n}.md")} for n in names
        ]
    }
    if forced is not None:
        s["agents_forced"] = list(forced)
    return s


class ReportPathsTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.sd = self._tmp.name

    def tearDown(self):
        self._tmp.cleanup()

    def test_path_is_anchored_to_the_session_dir_not_the_recorded_worktree(self):
        st = _state(["security"], output_dir=DEAD_WORKTREE)
        self.assertEqual(
            rp.report_path(self.sd, "security", st),
            os.path.join(self.sd, "security.md"),
        )

    def test_basename_comes_from_the_manifest(self):
        # So a future naming change follows automatically; only the dir is re-anchored.
        st = {"subagent_invocations": [{"name": "security", "output_file": f"{DEAD_WORKTREE}/sec-v2.md"}]}
        self.assertEqual(rp.report_path(self.sd, "security", st), os.path.join(self.sd, "sec-v2.md"))

    def test_a_name_absent_from_the_manifest_falls_back_to_name_md(self):
        self.assertEqual(
            rp.report_path(self.sd, "security", {"subagent_invocations": []}),
            os.path.join(self.sd, "security.md"),
        )

    def test_an_empty_report_is_not_a_report(self):
        # `touch security.md` must not satisfy a whitelist — "looks done, isn't".
        st = _state(["security"], output_dir=self.sd)
        Path(self.sd, "security.md").write_text("", encoding="utf-8")
        self.assertFalse(rp.has_report(self.sd, "security", st))

    def test_a_non_empty_report_counts(self):
        st = _state(["security"], output_dir=self.sd)
        Path(self.sd, "security.md").write_text("# report\n", encoding="utf-8")
        self.assertTrue(rp.has_report(self.sd, "security", st))

    def test_missing_reports_lists_only_the_ones_without_a_body(self):
        st = _state(["security", "scope", "testing"], output_dir=DEAD_WORKTREE)
        Path(self.sd, "security.md").write_text("# r\n", encoding="utf-8")
        Path(self.sd, "scope.md").write_text("", encoding="utf-8")  # empty
        self.assertEqual(
            rp.missing_reports(self.sd, ["security", "scope", "testing"], st),
            ["scope", "testing"],
        )

    def test_malformed_manifest_shapes_do_not_crash(self):
        # valid JSON, wrong types — a str would otherwise be iterated per-character
        self.assertEqual(rp.report_paths(self.sd, {"subagent_invocations": {"x": 1}}), {})
        self.assertEqual(rp.missing_reports(self.sd, "security", {}), [])


class AgreementTest(unittest.TestCase):
    """The gate and the CLI must reach the same verdict — the point of the module.

    Driven end-to-end (real `review_guard` call + real CLI subprocess) rather than by
    asserting they both call the shared helper: the divergence this replaces was invisible
    at that level too.
    """

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.sd = Path(self._tmp.name)
        (self.sd / "SUMMARY.md").write_text(CLEAN_SUMMARY, encoding="utf-8")
        (self.sd / "_retry_state.json").write_text(
            json.dumps(_state(["security"], output_dir=DEAD_WORKTREE, forced=["security"])),
            encoding="utf-8",
        )

    def tearDown(self):
        self._tmp.cleanup()

    def _cli_blocks(self) -> bool:
        r = subprocess.run(
            [sys.executable, str(ORCH), "--verify-coverage", str(self.sd)],
            cwd=str(REPO_ROOT), capture_output=True, text=True,
        )
        return r.returncode != 0

    def _gate_blocks(self) -> bool:
        return bool(rg._forced_coverage_missing(str(self.sd)))

    def test_agree_on_an_empty_report(self):
        # The exact 2026-07-17 divergence: CLI said OK, gate said missing.
        (self.sd / "security.md").write_text("", encoding="utf-8")
        self.assertEqual(self._cli_blocks(), self._gate_blocks(), "CLI and gate disagree on an empty report")
        self.assertTrue(self._gate_blocks(), "an empty report must not satisfy the whitelist")

    def test_agree_on_a_real_report_whose_worktree_is_gone(self):
        (self.sd / "security.md").write_text("# report\n", encoding="utf-8")
        self.assertEqual(self._cli_blocks(), self._gate_blocks(), "CLI and gate disagree")
        self.assertFalse(self._gate_blocks(), "a real report must count even from a dead worktree path")

    def test_agree_on_a_missing_report(self):
        self.assertEqual(self._cli_blocks(), self._gate_blocks(), "CLI and gate disagree")
        self.assertTrue(self._gate_blocks())


if __name__ == "__main__":
    unittest.main()
