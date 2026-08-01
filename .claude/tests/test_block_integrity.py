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

    def test_role_instructions_registers_the_same_checkers(self):
        """The third place the list exists — `CHECKER_INSTRUCTIONS`.

        That mapping is what actually gets a checker invoked; this module is what
        cross-checks its report. A sixth checker registered there and forgotten
        here would run, find a Critical, and have its downgrade go unnoticed —
        the failure this file exists to catch, opened on a different axis.
        Asserted as an equivalence rather than by importing one into the other:
        the dependency direction (`_shared` must not import a skill) has to stay.
        """
        import importlib.util
        import sys as _sys
        skill = _harness.CLAUDE_DIR / "skills" / "code-review-agents"
        if str(skill) not in _sys.path:
            _sys.path.insert(0, str(skill))
        spec = importlib.util.spec_from_file_location(
            "role_instructions_probe", skill / "lib" / "role_instructions.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        self.assertEqual(sorted(mod.CHECKER_INSTRUCTIONS), sorted(BI.ALL_CHECKERS))

    def test_report_filenames_follow_the_names(self):
        for name in BI.ALL_CHECKERS:
            self.assertIn(f"{name}.md", BI.CHECKER_REPORTS)

    def test_hyphenated_report_names_are_read_too(self):
        """32 committed reports are named `cross-spec.md`, not `cross_spec.md`.

        The backstop simply never opened them, so a checker's Criticals were
        invisible to it because of a separator. Reading both changes 0 of 732
        sessions' verdicts — a blind spot closed, not a miss fixed.
        """
        for name in BI.ALL_CHECKERS:
            self.assertIn(f"{name.replace('_', '-')}.md", BI.CHECKER_REPORTS)

    def test_a_hyphenated_report_can_trigger_the_backstop(self):
        """The property, not just the constant — the constant is what the last
        version of this test checked, and a constant nothing reads is easy to
        get right and useless."""
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        with open(os.path.join(d, "SUMMARY.md"), "w", encoding="utf-8") as f:
            f.write("**BLOCK: NO**\n")
        with open(os.path.join(d, "cross-spec.md"), "w", encoding="utf-8") as f:
            f.write("- **[CRITICAL]** 하이픈 파일명\n")
        self.assertEqual(BI.downgraded_criticals(d), {"cross-spec.md": 1})


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

    def test_two_equally_anchored_verdicts_the_later_one_wins(self):
        """When the anchor cannot discriminate, position decides.

        Note this is the opposite layout from the case above: there the final
        verdict is at the top and wins on its anchor. Here both lines are bare
        and equally anchored, so the anchor is silent and the tiebreak shows.
        """
        text = "**BLOCK: YES**\n\n(위 판정은 초안 — 재검토 후 최종은 아래)\n\n**BLOCK: NO**\n"
        self.assertEqual(BI.summary_block_verdict(text), "NO")

    def test_the_tiebreak_does_not_override_the_anchor(self):
        """A later *unanchored* mention must not beat an earlier anchored one."""
        text = ("## 최종 판정: **BLOCK: NO**\n"
                "\n참고: 직전 세션은 BLOCK: YES 였다 (이번 판정과 무관)\n")
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
        note = BI.contradiction_note(d)
        self.assertIn("§planner 인계", note)
        # The `§planner 인계` string is template-constant, so asserting only that
        # leaves the whole `parts` construction — `.md` stripping, sorting, the
        # `name=count` join — unpinned. These name what the reader must see.
        self.assertIn("convention_compliance=2", note)
        self.assertIn("plan_coherence=1", note)
        # The checker names lose their `.md`; a bare `.md` check would be wrong
        # here because the note cites `consistency-summary.md` on purpose.
        self.assertNotIn("convention_compliance.md", note)
        self.assertLess(note.index("convention_compliance"),
                        note.index("plan_coherence"), "sorted() order")

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
    # `push_blocks` mirrors the real `PlanDecision` property. Omitting it did not
    # make this test fail — it made it pass for the wrong reason: the push hook
    # reads `result.push_blocks` for BOTH gates, the AttributeError escaped the
    # try/except (which wraps only `evaluate()`), and the top-level handler
    # fail-opened with exit 0 while still printing the notes. So the test proved
    # "notes survive a PLAN-gate crash", not "notes appear on a clean allow".
    _CLEAN_PLAN = (
        "class _P:\n    untouched = False\n    complete_but_in_progress = False\n"
        "    reason = ''\n    plan_path = ''\n"
        "    @property\n    def push_blocks(self):\n        return self.untouched\n"
        "def evaluate_plan():\n    return _P()\n"
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
        # Pins the reason it passed. Without this the ALLOW path and the
        # crash-then-fail-open path are indistinguishable from stdout alone.
        self.assertNotIn("Traceback", r.stderr)

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


class NotesFromLaterTargetsSurviveAnEarlierBlockTest(unittest.TestCase):
    """Target order must not decide whether an advisory is heard.

    `_evaluate_over_targets` used to `return` the moment a target blocked, so
    every target after it was never evaluated and its notes were lost. The
    comment defending the feature only covered the other arrangement (the
    blocking target's *own* notes), which is why it read as complete.

    Worst case is the one that matters: the push is being refused, which is
    exactly when the reader most needs every advisory in front of them.
    """

    def _run(self, decisions):
        """Drive the real `_evaluate_over_targets` over stub targets."""
        PG = _harness.load_module_by_path(
            "push_guard_order_probe",
            _harness.HOOKS_DIR / "guard_review_before_push.py",
        )

        class _D:
            def __init__(self, blocks, notes):
                self.push_blocks = blocks
                self.notes = tuple(notes)
                self.reason = "stub"

        class _O:
            def __init__(self):
                self.answered, self.bypassed, self.degraded = [], [], []
                self.notes = []

        outcome = _O()
        targets = [f"/w/{i}" for i in range(len(decisions))]
        by_target = dict(zip(targets, decisions))
        msg = PG._evaluate_over_targets(
            lambda t: _D(*by_target[t]),
            targets, gate="REVIEW", outcome=outcome,
            render=lambda r, t: f"blocked at {t}",
        )
        return msg, outcome.notes

    def test_a_later_targets_note_is_kept_when_an_earlier_one_blocks(self):
        msg, notes = self._run([
            (True, ["⚠️  워크트리 A: 차단"]),
            (False, ["⚠️  워크트리 B: 하향 감지"]),
        ])
        self.assertEqual(msg, "blocked at /w/0", "first blocker still decides")
        self.assertIn("⚠️  워크트리 B: 하향 감지", notes)
        self.assertIn("⚠️  워크트리 A: 차단", notes)

    def test_the_first_blocker_supplies_the_message_not_the_last(self):
        msg, _ = self._run([(False, []), (True, []), (True, [])])
        self.assertEqual(msg, "blocked at /w/1")


class VerdictParserStaysLinearTest(unittest.TestCase):
    """The verdict scan must not go quadratic on adversarial input.

    `_BLOCK_AT_LINE_START` used `[\\s…]` for its leading class. `\\s` matches
    newlines, so under `re.MULTILINE` the class could run past its own line and
    the engine repeated that walk from every later line start. Measured: ×4 per
    input doubling, 5.4s at 16k lines — on a path that runs at every push and
    every turn-end, over every session on disk, against LLM-written markdown
    with no enforced size. A hook slow enough to hit its timeout fails open,
    which would bypass the very gate this branch is reinforcing.

    Run in a subprocess with a hard timeout, not by asserting on elapsed time
    after the call returns: the backtracking happens inside CPython's C-level
    `re`, where signals do not land, so an in-process test would hang the whole
    suite instead of failing it.
    """

    # Two sizes, each measured against the pattern it is meant to catch. Reusing
    # one number is what made the second case vacuous on first writing: 20k is
    # ample for the leading-class defect but leaves the inner-gap defect at 2.9s,
    # comfortably inside the timeout, so reverting the fix stayed GREEN.
    #
    #   _LINES=20_000 lines  → leading class:  ~8.4s broken / ~1ms fixed
    #   _RUN=45_000 chars    → inner gap:     ~14.5s broken / ~1ms fixed
    _LINES = 20_000
    _RUN = 45_000
    _TIMEOUT = 5

    def _run(self, text_expr, label, expect=None):
        import subprocess
        import sys as _sys
        path = _harness.CLAUDE_DIR / "_shared" / "block_integrity.py"
        prog = (
            "import importlib.util,sys\n"
            f"spec=importlib.util.spec_from_file_location('bi', r'{path}')\n"
            "m=importlib.util.module_from_spec(spec)\n"
            "sys.modules['bi']=m\n"
            "spec.loader.exec_module(m)\n"
            f"text={text_expr}\n"
            f"got=m.summary_block_verdict(text)\n"
            f"assert got == {expect!r}, got\n"
            "print('ok')\n"
        )
        try:
            r = subprocess.run([_sys.executable, "-c", prog],
                               capture_output=True, text=True,
                               timeout=self._TIMEOUT)
        except subprocess.TimeoutExpired:
            self.fail(
                f"summary_block_verdict did not finish in {self._TIMEOUT}s on "
                f"{label} — the verdict pattern went quadratic again"
            )
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        self.assertIn("ok", r.stdout)

    def test_no_verdict_in_a_large_document_returns_fast(self):
        """No `BLOCK:` anywhere — every start position fails on the LEADING class."""
        self._run(f"('> '*3+chr(10))*{self._LINES}", f"{self._LINES} lines")

    def test_a_bare_block_followed_by_a_long_run_returns_fast(self):
        """`BLOCK:` present, verdict never — exercises the gap AFTER the literal.

        The test above cannot reach that part of the pattern: with no `BLOCK:`
        in the input the scan fails before it. So a second quadratic lived in
        `\\s*\\**\\s*` right there, through the round that "fixed the quadratic"
        and through the regression test written to prevent exactly this. One
        arrangement pinned is not the property pinned.

        Deliberately one line, no newlines: the first defect was about `\\s`
        crossing lines, and reading that as *the* mechanism is what hid this one.
        """
        self._run(f"'BLOCK:' + ' '*{self._RUN}", f"BLOCK: + {self._RUN} spaces")

    # There is deliberately NO third case for the END pattern's trailing gap.
    # One was written and removed: its input `"BLOCK: YES" + " "*n + "x"` never
    # reaches that gap at all — the trailing `x` stops `$` from matching, so
    # `_BLOCK_AT_LINE_END` produces no match and the answer comes from
    # `_BLOCK_AT_LINE_START`, which finishes at the verdict and never looks at
    # the run. Measured afterwards: the tail is linear in both the old and new
    # forms (×2 per doubling, 0.0001s at 64k), so there is no quadratic there to
    # pin. A test that cannot fail reads as coverage and is worse than none —
    # this branch has now produced that shape three times, and the note is here
    # so the fourth is not written by someone filling an obvious gap.


class SpecGlobCompilationIsBoundedTest(unittest.TestCase):
    """A spec `code:` glob must not be able to wedge the gate.

    Each `*` becomes its own unbounded quantifier, so `a*a*a*…` against a failing
    candidate is exponential (×16 per two extra stars; 10s at sixteen). The input
    comes from a spec file's frontmatter, so anyone who can edit `spec/**` could
    stall every push and turn-end for everyone who checks that file out.
    """

    def setUp(self):
        self.RG = _harness.load_module_by_path(
            "review_guard_glob_probe",
            _harness.HOOKS_DIR / "_lib" / "review_guard.py",
        )

    def test_a_pathological_glob_compiles_to_something_that_matches_fast(self):
        import subprocess
        import sys as _sys
        path = _harness.HOOKS_DIR / "_lib" / "review_guard.py"
        prog = (
            "import importlib.util,sys\n"
            f"spec=importlib.util.spec_from_file_location('rg', r'{path}')\n"
            "m=importlib.util.module_from_spec(spec)\n"
            "sys.modules['rg']=m\n"
            "spec.loader.exec_module(m)\n"
            "p=m._glob_to_regex('a*'*24+'!')\n"
            "p.match('a'*48)\n"
            "print('ok')\n"
        )
        try:
            r = subprocess.run([_sys.executable, "-c", prog],
                               capture_output=True, text=True, timeout=5)
        except subprocess.TimeoutExpired:
            self.fail("_glob_to_regex went exponential on a many-wildcard glob")
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])

    def test_over_the_cap_matches_everything_not_nothing(self):
        """Direction matters more than the cap.

        This predicate decides whether Gate 2 applies. "No match" would switch
        the gate OFF, which is a length limit silently disabling detection — the
        failure `_MAX_REDACTION_INPUT` exists to warn about. Matching everything
        asks for a report that may be unnecessary: loud, and safe.
        """
        p = self.RG._glob_to_regex("a*" * 24 + "!")
        self.assertTrue(p.match("codebase/backend/src/anything.ts"))

    def test_real_spec_globs_are_all_under_the_cap(self):
        """The cap must never fire on legitimate input.

        Measured when it was chosen: 633 real globs, 528 with no `*` at all, and
        the busiest single path segment holding exactly one.
        """
        import glob as _glob
        globs = []
        for path in _glob.glob(str(_harness.REPO_ROOT / "spec" / "**" / "*.md"),
                               recursive=True):
            globs.extend(self.RG._parse_frontmatter_code(path))
        self.assertGreater(len(globs), 100, "spec globs not found — probe is stale")
        over = [g for g in globs if g.count("*") > self.RG._MAX_GLOB_WILDCARDS]
        self.assertEqual(over, [], "a real spec glob exceeds the wildcard cap")


class PlanStubsMirrorTheRealInterfaceTest(unittest.TestCase):
    """Every hand-written `evaluate_plan` stub must expose `push_blocks`.

    Found twice, in two files, the same way: the push hook reads
    `result.push_blocks` for BOTH gates, so a stub missing it raises
    AttributeError, the top-level handler fail-opens with exit 0, and the test
    still sees what it asserted on. It passes — for the wrong reason, hiding
    whichever ALLOW path it claimed to cover.

    An audit fixes the instances; this fixes the class. A fifth stub added later
    fails here instead of quietly testing the crash path.
    """

    def test_every_plan_stub_defines_push_blocks(self):
        """Reads the stub *literal*, not the file.

        The first version of this searched the whole file for `push_blocks`,
        which the explanatory comment right above each stub already contains —
        so deleting the actual property left it GREEN. A guard that its own
        rationale satisfies is worse than none.
        """
        import ast
        import glob
        checked = []
        tests_dir = _harness.CLAUDE_DIR / "tests"
        # Both gates, not just PLAN. `_evaluate_over_targets` reads `push_blocks`
        # off whatever each gate returns, so a `evaluate_review` stub missing it
        # fails open exactly the same way — the first version of this guard
        # watched only one of the two symmetric halves.
        marker = ("def evaluate_plan", "def evaluate_review")
        for path in sorted(glob.glob(str(tests_dir / "test_*.py"))):
            with open(path, encoding="utf-8") as f:
                src = f.read()
            if not any(m in src for m in marker):
                continue
            # `"\n" in v` 로 마커 상수 자체를 걸러낸다 — 이 가드가 쓰는 `marker` 튜플도
            # `"def evaluate_plan"` 을 담은 문자열이라, 그것 없이는 자기 자신을 스텁으로
            # 세고 실패한다. 진짜 스텁은 소스 텍스트라 반드시 줄바꿈을 갖는다.
            stubs = [n.value for n in ast.walk(ast.parse(src))
                     if isinstance(n, ast.Constant) and isinstance(n.value, str)
                     and "\n" in n.value
                     and any(m in n.value for m in marker)]
            # The stub is usually built by concatenating adjacent literals, which
            # `ast` folds into one Constant; if a file ever splits it across
            # separate expressions, join what we found for that file.
            name = os.path.basename(path)
            self.assertTrue(stubs, f"{name}: could not locate the stub literal")
            checked.append(name)
            # Per stub, not per file. Joining them first meant a file with two
            # stubs passed while one of them had lost `push_blocks`, because the
            # other still carried the word — measured on a real second stub.
            for idx, stub in enumerate(stubs):
                if "raise " in stub:
                    # 예외를 던지는 스텁은 결정 객체를 아예 돌려주지 않는다 — 실을 곳이
                    # 없으므로 이 성질의 대상이 아니다. (fail-open 경로를 구동하는 스텁들이
                    # 이 모양이고, 요구하면 의미 없는 필드를 넣게 만든다.)
                    continue
                self.assertIn(
                    "push_blocks", stub,
                    f"{name} stub #{idx} declares evaluate_plan/evaluate_review "
                    "without push_blocks — the push hook reads it for both gates, "
                    "so that test would pass via fail-open",
                )
        self.assertGreaterEqual(len(checked), 4, f"stub files found: {checked}")


class StopThrottleKeysOnTextTest(unittest.TestCase):
    """Repeat the same advisory → silence. A different one → still heard.

    The throttle keyed on `enumerate`'s index, which is always 0 because the
    gate reports at most one adopted session. So the first downgrade warning on
    a branch suppressed every later one — different session, different checker,
    any text — which is precisely the "a downgrade passes silently" failure this
    branch exists to close, rebuilt inside the mechanism meant to close it.

    Nothing caught it: no test in the suite ran either hook twice.
    """

    _STUB = (
        "from dataclasses import dataclass\n"
        "import os\n"
        "@dataclass\n"
        "class _D:\n"
        "    blocked: bool = False\n"
        "    reason: str = 'clean'\n"
        "    @property\n"
        "    def notes(self):\n"
        "        return (os.environ['FAKE_NOTE'],)\n"
        "    @property\n"
        "    def push_blocks(self):\n"
        "        return self.blocked\n"
        "def evaluate_review(cwd=None, *, in_flight_ok=False):\n"
        "    return _D()\n"
    )

    def setUp(self):
        import shutil as _sh
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(_sh.rmtree, self.tmp, ignore_errors=True)
        self.hooks = os.path.join(self.tmp, "hooks")
        _sh.copytree(str(_harness.HOOKS_DIR), self.hooks)
        with open(os.path.join(self.hooks, "_lib", "review_guard.py"), "w",
                  encoding="utf-8") as f:
            f.write(self._STUB)
        with open(os.path.join(self.hooks, "_lib", "plan_guard.py"), "w",
                  encoding="utf-8") as f:
            f.write(NotesReachBothHooksTest._CLEAN_PLAN)

    def _run(self, note):
        import json as _json
        import subprocess
        import sys as _sys
        r = subprocess.run(
            [_sys.executable, os.path.join(self.hooks, "guard_review_before_stop.py")],
            input=_json.dumps({"session_id": "same-session"}),
            capture_output=True, text=True, timeout=30,
            env={**os.environ, "CLAUDE_PROJECT_DIR": self.tmp, "FAKE_NOTE": note},
            cwd=self.tmp,
        )
        self.assertEqual(r.returncode, 0)
        return r.stderr

    def test_identical_note_is_throttled(self):
        note = "⚠️  세션A: convention_compliance 하향 감지"
        self.assertIn("세션A", self._run(note))
        self.assertNotIn("세션A", self._run(note))

    def test_a_different_note_still_gets_through(self):
        self.assertIn("세션A", self._run("⚠️  세션A: convention_compliance 하향 감지"))
        # Same position in `notes`, same session, same branch — only the text
        # differs. Index keying swallowed this one.
        self.assertIn("세션B", self._run("⚠️  세션B: plan_coherence 하향 감지"))


class NotesSurviveBlockingTest(unittest.TestCase):
    """Blocking does not make the advisory moot — it may be the same session.

    Gate 2 rejects a stale `--impl-done` session; that session can be exactly the
    one that downgraded a Critical. Dropping the note on the blocking path loses
    the only place the downgrade surfaces. Mutation showed the wiring was
    unprotected: removing `tuple(notes)` from the returns left all 738 GREEN.
    """

    def _decision(self, *, stale):
        """Drive `evaluate_review` over a repo with one contradicting session."""
        import importlib.util
        RG = _harness.load_module_by_path(
            "review_guard_notes_probe",
            _harness.HOOKS_DIR / "_lib" / "review_guard.py",
        )
        root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, root, ignore_errors=True)
        d = os.path.join(root, "review", "consistency", "2026", "07", "31", "12_00_00")
        os.makedirs(d)
        with open(os.path.join(d, "meta.json"), "w", encoding="utf-8") as f:
            f.write('{"mode": "구현 완료 후 검토 (--impl-done, scope=spec/x)"}')
        with open(os.path.join(d, "SUMMARY.md"), "w", encoding="utf-8") as f:
            f.write("**BLOCK: NO** — 요약\n")
        with open(os.path.join(d, "cross_spec.md"), "w", encoding="utf-8") as f:
            f.write("- **[CRITICAL]** 모순\n")
        notes = []
        RG._newest_resolved_impl_done_mtime(root, dirty=set(), notes=notes)
        return RG, notes

    def test_the_contradiction_is_collected_for_the_adopted_session(self):
        _RG, notes = self._decision(stale=False)
        self.assertTrue(notes, "the adopted session's contradiction was not collected")

    def test_blocking_returns_carry_notes(self):
        """Every Gate 2 `ReviewDecision` must pass the advisory.

        Parsed with `ast`, not a regex: the first version used
        `return ReviewDecision\\((.*?)\\n        \\)` and matched **1 of the 3**
        returns — the nested ones close at a deeper indent — so it passed while
        two of them silently dropped the notes. Structure is what this asserts,
        so structure is what it should read.
        """
        import ast
        src = (_harness.HOOKS_DIR / "_lib" / "review_guard.py").read_text(encoding="utf-8")
        tree = ast.parse(src)
        fn = next(n for n in ast.walk(tree)
                  if isinstance(n, ast.FunctionDef) and n.name == "evaluate_review")
        gate2_line = next(
            n.lineno for n in ast.walk(fn)
            if isinstance(n, ast.Assign)
            and any(getattr(t, "id", "") == "spec_linked" for t in n.targets)
        )
        checked = 0
        for node in ast.walk(fn):
            if not (isinstance(node, ast.Return) and isinstance(node.value, ast.Call)):
                continue
            if getattr(node.value.func, "id", "") != "ReviewDecision":
                continue
            if node.lineno < gate2_line:
                continue  # early returns predate the advisory and cannot carry one
            checked += 1
            self.assertGreaterEqual(
                len(node.value.args), 3,
                f"ReviewDecision at line {node.lineno} drops the advisory",
            )
        self.assertGreaterEqual(checked, 3, "expected Gate 2's three returns")


if __name__ == "__main__":
    unittest.main()
