"""A `BLOCK: NO` that contradicts its own checkers must not pass unremarked.

`consistency-summary.md` §요약 지침 3 forbids downgrading a checker's
`[CRITICAL]` during integration. Until this backstop existed the rule lived only
in the agent's prompt: `review_guard` parsed one `BLOCK:` line and never looked
at the reports sitting beside it, so a downgrade cleared the gate in silence.

Measured across the 732 consistency sessions on `origin/main` before writing it:

    일치                        698
    BLOCK: NO 인데 [CRITICAL] 有   24   (3.3%)
    BLOCK: YES 인데 [CRITICAL] 無   10

The 24 are genuine — their own summaries say so ("checker 자동판정 YES 의
Critical 2건은…"). This suite pins the predicate that finds them and, just as
importantly, the shape of what it must NOT count: bare "CRITICAL" appears 242
times across 400 reports, nearly all of it prose like "CRITICAL 없음" and the
NONE/LOW/…/CRITICAL risk scale. Counting that would fire on every clean session,
and a warning that fires always is one nobody reads.
"""

from __future__ import annotations

import os
import shutil
import tempfile
import unittest

import _harness  # noqa: F401  — side effect: harness path setup

BI = _harness.load_module_by_path(
    "block_integrity", _harness.CLAUDE_DIR / "_shared" / "block_integrity.py"
)


class CountCriticalTagsTest(unittest.TestCase):
    def test_counts_both_documented_tag_shapes(self):
        """`- **[CRITICAL]** 제목` and `### [CRITICAL] 제목` both occur in reports."""
        self.assertEqual(BI.count_critical_tags(
            "- **[CRITICAL]** 하나\n### [CRITICAL] 둘\n"), 2)

    def test_ignores_prose_and_the_risk_scale(self):
        """The reason bare "CRITICAL" is not counted, stated as a test.

        Every one of these lines appears in real clean reports. If any were
        counted, the backstop would fire on sessions that did nothing wrong.
        """
        clean = (
            "## CRITICAL 발견사항\n"
            "CRITICAL 없음\n"
            "Critical 발견 없음\n"
            "위험도: NONE / LOW / MEDIUM / HIGH / CRITICAL\n"
        )
        self.assertEqual(BI.count_critical_tags(clean), 0)


class DowngradedCriticalsTest(unittest.TestCase):
    def _session(self, block, reports):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        if block is not None:
            with open(os.path.join(d, "SUMMARY.md"), "w", encoding="utf-8") as f:
                f.write(f"# 통합 보고서\n\n**BLOCK: {block}** — 요약\n")
        for name, body in reports.items():
            with open(os.path.join(d, name), "w", encoding="utf-8") as f:
                f.write(body)
        return d

    def test_flags_the_real_downgrade_shape(self):
        """Modelled on `review/consistency/2026/06/04/00_00_14`, which downgraded
        two convention_compliance criticals and one plan_coherence critical."""
        d = self._session("NO", {
            "convention_compliance.md": "- **[CRITICAL]** 필드 불일치\n"
                                        "- **[CRITICAL]** turnCount 기술 상충\n",
            "plan_coherence.md": "### [CRITICAL] worktree 동시 편집\n",
            "cross_spec.md": "발견 없음\n",
        })
        self.assertEqual(BI.downgraded_criticals(d),
                         {"convention_compliance.md": 2, "plan_coherence.md": 1})
        self.assertIn("§planner 인계", BI.contradiction_note(d))

    def test_silent_when_the_summary_blocks(self):
        """BLOCK: YES with criticals is the rule working, not a violation."""
        d = self._session("YES", {"cross_spec.md": "- **[CRITICAL]** 모순\n"})
        self.assertEqual(BI.downgraded_criticals(d), {})
        self.assertEqual(BI.contradiction_note(d), "")

    def test_silent_when_everyone_agrees(self):
        d = self._session("NO", {"cross_spec.md": "CRITICAL 없음\n"})
        self.assertEqual(BI.contradiction_note(d), "")

    def test_silent_when_there_is_no_summary(self):
        """An in-flight session is not a violation — and the caller should not
        need to tell "nothing wrong" from "nothing yet" to decide to stay quiet."""
        d = self._session(None, {"cross_spec.md": "- **[CRITICAL]** 모순\n"})
        self.assertEqual(BI.contradiction_note(d), "")

    def test_unreadable_reports_do_not_crash_the_gate(self):
        d = self._session("NO", {})
        os.mkdir(os.path.join(d, "cross_spec.md"))  # a directory, not a file
        self.assertEqual(BI.contradiction_note(d), "")


class GateSurfacesTheContradictionTest(unittest.TestCase):
    """`review_guard` must actually CALL the check — not merely be able to.

    Every test above exercises the predicate directly, so deleting the call site
    in `_newest_resolved_impl_done_mtime` would leave them all GREEN while the
    warning disappears. That is the exact failure this backstop exists to
    prevent, one level up: a rule that nothing reads.
    """

    def _repo_with_session(self, block, report_body):
        root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, root, ignore_errors=True)
        d = os.path.join(root, "review", "consistency", "2026", "07", "31", "12_00_00")
        os.makedirs(d)
        with open(os.path.join(d, "meta.json"), "w", encoding="utf-8") as f:
            f.write('{"mode": "구현 완료 후 검토 (--impl-done, scope=spec/x)"}')
        with open(os.path.join(d, "SUMMARY.md"), "w", encoding="utf-8") as f:
            f.write(f"**BLOCK: {block}** — 요약\n")
        with open(os.path.join(d, "cross_spec.md"), "w", encoding="utf-8") as f:
            f.write(report_body)
        return root

    def _run_gate(self, root):
        import contextlib
        import io
        RG = _harness.load_module_by_path(
            "review_guard_probe", _harness.HOOKS_DIR / "_lib" / "review_guard.py"
        )
        buf = io.StringIO()
        with contextlib.redirect_stderr(buf):
            RG._newest_resolved_impl_done_mtime(root, dirty=set())
        return buf.getvalue()

    def test_warning_reaches_stderr(self):
        root = self._repo_with_session("NO", "- **[CRITICAL]** 모순\n")
        self.assertIn("[CRITICAL]", self._run_gate(root))

    def test_quiet_when_the_session_agrees(self):
        """The other direction: a gate that always warns is the same as silence."""
        root = self._repo_with_session("NO", "CRITICAL 없음\n")
        self.assertEqual(self._run_gate(root), "")


if __name__ == "__main__":
    unittest.main()
