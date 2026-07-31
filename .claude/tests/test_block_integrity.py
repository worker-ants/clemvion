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


class CheckerListIsCanonicalTest(unittest.TestCase):
    """One list, derived — not two that happen to agree today.

    `block_integrity` must know every checker: a name added to the orchestrator
    and forgotten here would make this backstop silently blind to that checker's
    downgrades, which is the failure it exists to catch, reproduced one level up.
    The orchestrator therefore derives its `ALL_CHECKERS` from this module.
    """

    def test_orchestrator_derives_its_list_from_here(self):
        """Fresh interpreter: importing the orchestrator in-process collides on
        the name `_lib` (hooks vs skills), the same dodge the consistency suites
        document."""
        import json as _json
        import subprocess
        import sys as _sys
        path = (_harness.CLAUDE_DIR / "skills" / "consistency-checker" / "scripts"
                / "consistency_orchestrator.py")
        snippet = (
            "import importlib.util, json, sys\n"
            f"spec = importlib.util.spec_from_file_location('o', {str(path)!r})\n"
            "m = importlib.util.module_from_spec(spec); sys.modules['o'] = m\n"
            "spec.loader.exec_module(m)\n"
            "sys.stdout.write(json.dumps(list(m.ALL_CHECKERS)))\n"
        )
        out = subprocess.run([_sys.executable, "-c", snippet],
                             capture_output=True, text=True,
                             cwd=str(_harness.REPO_ROOT), timeout=60)
        self.assertEqual(out.returncode, 0, out.stderr[-2000:])
        self.assertEqual(_json.loads(out.stdout), list(BI.ALL_CHECKERS))

    def test_report_filenames_follow_the_names(self):
        self.assertEqual(BI.CHECKER_REPORTS,
                         tuple(f"{n}.md" for n in BI.ALL_CHECKERS))


class VerdictIsAnchoredTest(unittest.TestCase):
    """A summary narrating an earlier verdict must not be read as its own.

    Summaries routinely retrospect ("직전 19_19_53 BLOCK: YES 정정 후"), so a
    plain first-match search believes the narration. Measured over the 732
    committed summaries, four disagreed with their own template line; all four
    shapes are reproduced below verbatim enough to fail under the old rule.

    Line-start alone was not enough — it fixed three and made the fourth worse,
    because a human override banner puts the verdict at the END of its line.
    Accepting line-start OR line-end classifies all four correctly.
    """

    def test_template_line_start(self):
        self.assertEqual(BI.summary_block_verdict("**BLOCK: NO** — Critical 없음"), "NO")
        self.assertEqual(BI.summary_block_verdict("## BLOCK: YES"), "YES")

    def test_prose_mentioning_a_previous_session_is_not_the_verdict(self):
        """`review/consistency/2026/07/05/19_27_28` — first match was YES."""
        text = ("모드: `--spec draft.md` 재검증(직전 19_19_53 BLOCK: YES 정정 후).\n"
                "\n## BLOCK: NO\n")
        self.assertEqual(BI.summary_block_verdict(text), "NO")

    def test_a_bullet_citing_a_prior_session_is_not_the_verdict(self):
        """`review/consistency/2026/07/17/20_00_05`."""
        text = ("- **선행 세션**: `19_44_52` (BLOCK: YES — 중복 작업 Critical)\n"
                "\n## BLOCK: NO\n")
        self.assertEqual(BI.summary_block_verdict(text), "NO")

    def test_mid_line_original_verdict_loses_to_the_template_line(self):
        """`review/consistency/2026/06/03/21_38_47`."""
        text = ("**checker 원판정: BLOCK: YES** → **main 반증 후 실질 판정: 해소**\n"
                "\n**BLOCK: NO** (Critical 은 FP)\n")
        self.assertEqual(BI.summary_block_verdict(text), "NO")

    def test_an_override_banner_at_line_end_wins(self):
        """`review/consistency/2026/07/17/00_17_40` — the case line-start alone
        got wrong. The final verdict sits at the end of a decorated line, above
        a superseded template line that still says YES."""
        text = ("> ## ✅ 최종 판정 (main Claude 가 전수 확보 후 확정): **BLOCK: NO**\n"
                "\n**BLOCK: YES** (최초 판정 — 위 최종 판정으로 대체됨)\n")
        self.assertEqual(BI.summary_block_verdict(text), "NO")

    def test_absent_verdict_is_none(self):
        self.assertIsNone(BI.summary_block_verdict("판정 줄이 없는 문서"))


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

    def _notes(self, root):
        RG = _harness.load_module_by_path(
            "review_guard_probe", _harness.HOOKS_DIR / "_lib" / "review_guard.py"
        )
        notes = []
        RG._newest_resolved_impl_done_mtime(root, dirty=set(), notes=notes)
        return notes

    def test_the_adopted_session_is_reported(self):
        root = self._repo_with_session("NO", "- **[CRITICAL]** 모순\n")
        self.assertTrue(any("[CRITICAL]" in n for n in self._notes(root)))

    def test_quiet_when_the_session_agrees(self):
        """A gate that always warns is the same as one that never does."""
        root = self._repo_with_session("NO", "CRITICAL 없음\n")
        self.assertEqual(self._notes(root), [])

    def test_only_the_session_the_gate_adopts_is_checked(self):
        """Scanning all history re-warned about ~8 old sessions on every hook.

        The gate trusts exactly one session — the newest resolved one. A verdict
        nobody is relying on is not worth a warning, and a warning that fires on
        every push is one that stops being read.
        """
        root = self._repo_with_session("NO", "CRITICAL 없음\n")
        older = os.path.join(root, "review", "consistency",
                             "2026", "07", "30", "09_00_00")
        os.makedirs(older)
        with open(os.path.join(older, "meta.json"), "w", encoding="utf-8") as f:
            f.write('{"mode": "구현 완료 후 검토 (--impl-done, scope=spec/x)"}')
        with open(os.path.join(older, "SUMMARY.md"), "w", encoding="utf-8") as f:
            f.write("**BLOCK: NO** — 요약\n")
        with open(os.path.join(older, "cross_spec.md"), "w", encoding="utf-8") as f:
            f.write("- **[CRITICAL]** 옛 세션의 하향\n")
        self.assertEqual(self._notes(root), [])


class AdvisoryReachesTheModelTest(unittest.TestCase):
    """On ALLOW the harness injects stdout, not stderr — and this fires on ALLOW.

    The push hook documents the rule for its own fail-open banner: "a banner on
    the wrong stream is a banner nobody reads". The first version of this
    backstop hardcoded `sys.stderr` inside the gate, which put every advisory on
    the stream the model ignores in exactly the case the advisory exists for.
    """

    def test_push_hook_prints_notes_on_stdout_when_allowing(self):
        import io
        import contextlib
        PG = _harness.load_module_by_path(
            "push_guard_probe", _harness.HOOKS_DIR / "guard_review_before_push.py"
        )
        outcome = PG._Outcome()
        outcome.notes = []
        outcome.notes.append("⚠️  세션X: 하향 감지")
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            PG._report_notes(outcome, 0)
        self.assertIn("하향 감지", out.getvalue())
        self.assertEqual(err.getvalue(), "")

    def test_push_hook_prints_notes_on_stderr_when_blocking(self):
        import io
        import contextlib
        PG = _harness.load_module_by_path(
            "push_guard_probe", _harness.HOOKS_DIR / "guard_review_before_push.py"
        )
        outcome = PG._Outcome()
        outcome.notes = []
        outcome.notes.append("⚠️  세션X: 하향 감지")
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            PG._report_notes(outcome, 2)
        self.assertIn("하향 감지", err.getvalue())
        self.assertEqual(out.getvalue(), "")


class NotesReachBothHooksTest(unittest.TestCase):
    """The wiring, not just the reporter.

    Deleting the collection block in `_evaluate_over_targets` left all 735 tests
    GREEN — the advisory vanished and nothing noticed, which is this branch's own
    defect class one level up. These drive the real hooks end to end.
    """

    _STUB = (
        "from dataclasses import dataclass, field\n"
        "@dataclass\n"
        "class _D:\n"
        "    blocked: bool = False\n"
        "    reason: str = 'clean'\n"
        "    notes: tuple = ('⚠️  세션X: 하향 감지',)\n"
        "    @property\n"
        "    def push_blocks(self):\n"
        "        return self.blocked\n"
        "def evaluate_review(cwd=None, *, in_flight_ok=False):\n"
        "    return _D()\n"
    )
    _CLEAN_PLAN = (
        "class _P:\n    untouched = False\n    complete_but_in_progress = False\n"
        "    reason = ''\n    plan_path = ''\ndef evaluate_plan():\n    return _P()\n"
    )

    def _hook_env(self):
        import shutil as _sh
        tmp = tempfile.mkdtemp()
        self.addCleanup(_sh.rmtree, tmp, ignore_errors=True)
        hooks = os.path.join(tmp, "hooks")
        _sh.copytree(str(_harness.HOOKS_DIR), hooks)
        with open(os.path.join(hooks, "_lib", "review_guard.py"), "w",
                  encoding="utf-8") as f:
            f.write(self._STUB)
        with open(os.path.join(hooks, "_lib", "plan_guard.py"), "w",
                  encoding="utf-8") as f:
            f.write(self._CLEAN_PLAN)
        return tmp, hooks

    def test_push_hook_surfaces_notes_on_stdout(self):
        import json as _json
        import subprocess
        import sys as _sys
        tmp, hooks = self._hook_env()
        r = subprocess.run(
            [_sys.executable, os.path.join(hooks, "guard_review_before_push.py")],
            input=_json.dumps({"tool_input": {"command": "git push"}}),
            capture_output=True, text=True, timeout=30,
            env={**os.environ, "CLAUDE_PROJECT_DIR": tmp}, cwd=tmp,
        )
        self.assertEqual(r.returncode, 0)
        self.assertIn("하향 감지", r.stdout)

    def test_stop_hook_surfaces_notes_on_stderr(self):
        """Stop's stdout is a JSON protocol, so its advisories go to stderr."""
        import json as _json
        import subprocess
        import sys as _sys
        tmp, hooks = self._hook_env()
        r = subprocess.run(
            [_sys.executable, os.path.join(hooks, "guard_review_before_stop.py")],
            input=_json.dumps({"session_id": "s1"}),
            capture_output=True, text=True, timeout=30,
            env={**os.environ, "CLAUDE_PROJECT_DIR": tmp}, cwd=tmp,
        )
        self.assertEqual(r.returncode, 0)
        self.assertIn("하향 감지", r.stderr)
        self.assertNotIn("하향 감지", r.stdout)


if __name__ == "__main__":
    unittest.main()
