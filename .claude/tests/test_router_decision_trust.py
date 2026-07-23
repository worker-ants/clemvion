"""Routing-decision trust: a router that breaks the forced-whitelist contract
has its whole decision discarded, and every reviewer runs.

Why (measured 2026-07-23, session `review/code/2026/07/23/14_47_40`): the router
returned `selected=false` for **all 14** reviewers — the 7 forced ones included
— with the rationale "소스 코드 변경 없음(문서만 변경)", on a 19-file changeset
containing a brand-new Python module plus two more `.py` files. All three were
in the router's own prompt with 21K/12K/33K characters of content; it read the
15:4 doc-to-code majority and stopped there. `_apply_routing` then silently
re-added the forced reviewers and trusted everything else, so the session
presented as a healthy 7-reviewer review while every judgement behind it was
wrong.

The forced list is stated to the router as `selected=true` 고정, which makes
returning one as false (or omitting it) a contract breach rather than a
judgement call. That is the signal used here: it is unambiguous, and unlike any
count-based threshold it cannot fire on a legitimately narrow decision — a
doc-only typo routing to `documentation` alone is correct and must stay cheap.

**Not** a revival of the old "selected 수가 0 또는 1 이면 전체 fallback" rule.
That was deliberately retired in 6cd7376fc (#244) in favour of "0 명이면 fatal +
minimal SUMMARY, 1명 이상이면 그대로 진행" (`review-router.md` step 4, README
router-safety table: "전체 fallback 안 함"). The orchestrator's prompt was still
advertising the retired rule; that stale prose is corrected, the zero-reviewer
path is left alone, and `test_workflow_has_no_zero_reviewer_fallback` guards
against re-adding it by good intentions.

Two properties are pinned:

1. The contract check looks at forced reviewers only — never a count of picks.
2. Both routing paths agree. `--apply-routing` (CLI) and
   `.claude/workflows/ai-review.js` (Workflow — the path that actually ran)
   implement this independently and the sandbox forbids imports, so the two are
   run side by side over a decision matrix and must never disagree.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from _harness import REPO_ROOT

ORCH = (
    REPO_ROOT / ".claude" / "skills" / "code-review-agents" / "scripts"
    / "code_review_orchestrator.py"
)
WORKFLOW = REPO_ROOT / ".claude" / "workflows" / "ai-review.js"
ROUTER_SAFETY = (
    REPO_ROOT / ".claude" / "skills" / "code-review-agents" / "lib" / "router_safety.py"
)


class ApplyRoutingGuardTest(unittest.TestCase):
    """`--apply-routing` must discard a decision it cannot trust."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.sd = Path(self._tmp.name)
        self.state_file = self.sd / "_retry_state.json"

    def tearDown(self):
        self._tmp.cleanup()

    ALL = ["security", "performance", "testing", "documentation", "scope"]

    def _write(self, forced=()):
        self.state_file.write_text(json.dumps({
            "agents_pending": list(self.ALL),
            "agents_success": [],
            "agents_fatal": [],
            "agents_forced": list(forced),
        }), encoding="utf-8")

    def _decide(self, picked):
        (self.sd / "_routing_decision.json").write_text(json.dumps({
            "decisions": [
                {"name": n, "selected": n in picked} for n in self.ALL
            ]
        }), encoding="utf-8")

    def _run(self):
        r = subprocess.run(
            [sys.executable, str(ORCH), "--apply-routing", str(self.sd)],
            capture_output=True, text=True, cwd=str(REPO_ROOT),
        )
        self.assertEqual(r.returncode, 0, r.stderr)
        return r.stdout, json.loads(self.state_file.read_text(encoding="utf-8"))

    def test_dropping_a_forced_reviewer_runs_every_reviewer(self):
        """The incident exactly: every reviewer false, forced ones included."""
        self._write(forced=["security", "testing", "documentation"])
        self._decide([])
        out, state = self._run()
        self.assertEqual(set(state["agents_pending"]), set(self.ALL))
        self.assertEqual(state["routing_status"], "skipped")
        self.assertIn("fallback=distrusted-decision", out)
        self.assertFalse(state.get("agents_skipped"))
        self.assertIn("selected=false", state["routing_skip_reason"])

    def test_a_single_dropped_forced_reviewer_is_enough(self):
        """Partial compliance is still a contract violation — the decision that
        got one forced reviewer wrong has no claim on the others."""
        self._write(forced=["security", "testing"])
        self._decide(["security", "performance", "scope"])   # `testing` dropped
        out, state = self._run()
        self.assertEqual(set(state["agents_pending"]), set(self.ALL))
        self.assertIn("fallback=distrusted-decision", out)
        self.assertIn("testing", state["routing_skip_reason"])

    def test_omitting_a_forced_reviewer_runs_every_reviewer(self):
        """Silently absent used to be worse than explicitly false: the apply
        loop only walks `decisions`, so an omitted agent fell out of pending
        without ever being recorded as skipped."""
        self._write(forced=["security", "testing"])
        (self.sd / "_routing_decision.json").write_text(json.dumps({
            "decisions": [
                {"name": "security", "selected": True},
                {"name": "performance", "selected": True},
                # `testing` is forced but absent entirely
            ]
        }), encoding="utf-8")
        out, state = self._run()
        self.assertEqual(set(state["agents_pending"]), set(self.ALL))
        self.assertIn("fallback=distrusted-decision", out)
        self.assertIn("omitted", state["routing_skip_reason"])
        self.assertIn("testing", state["routing_skip_reason"])

    def test_a_narrow_but_compliant_decision_is_honoured(self):
        """One reviewer, forced respected → stands. The guard must not become a
        way to quietly always run all 14; a doc-only typo legitimately routes to
        `documentation` alone."""
        self._write(forced=["documentation"])
        self._decide(["documentation"])
        out, state = self._run()
        self.assertEqual(set(state["agents_pending"]), {"documentation"})
        self.assertEqual(state["routing_status"], "done")
        self.assertNotIn("fallback", out)
        self.assertTrue(state["agents_skipped"])

    def test_normal_decision_is_honoured(self):
        self._write(forced=["security"])
        self._decide(["security", "performance", "scope"])
        out, state = self._run()
        self.assertEqual(
            set(state["agents_pending"]), {"security", "performance", "scope"}
        )
        self.assertEqual(state["routing_status"], "done")
        self.assertNotIn("fallback", out)

    def test_router_marking_only_forced_true_is_allowed(self):
        """Not a violation: for some changesets the forced set genuinely is the
        right answer. Distrust is reserved for contract breaches and empty runs,
        so this must not fall back."""
        self._write(forced=["security", "testing"])
        self._decide(["security", "testing"])
        out, state = self._run()
        self.assertEqual(set(state["agents_pending"]), {"security", "testing"})
        self.assertEqual(state["routing_status"], "done")
        self.assertNotIn("fallback", out)


class WorkflowMirrorsPythonRuleTest(unittest.TestCase):
    """The workflow can't import the Python rule — pin the two together.

    These are genuinely two implementations: the Workflow path (which is what
    runs today) and the CLI `--apply-routing`. A divergence would mean the same
    router decision is trusted by one and rejected by the other.
    """

    def test_workflow_has_no_zero_reviewer_fallback(self):
        """An empty `forced ∪ selected` is a documented fatal (review-router.md
        step 4; the run-all fallback was retired in #244). A well-meaning
        re-addition here would silently reverse that decision."""
        js = WORKFLOW.read_text(encoding="utf-8")
        start = js.index("function routingDistrustReason")
        body = js[start:js.index("\n}", start)]
        self.assertNotIn(
            "MIN_EFFECTIVE_REVIEWERS", body,
            "the distrust rule must not reintroduce a zero-reviewer fallback",
        )

    def test_workflow_checks_forced_reviewers_were_not_dropped(self):
        js = WORKFLOW.read_text(encoding="utf-8")
        self.assertRegex(
            js, r"forcedSet\.has\(d\.name\)\s*&&\s*!d\.selected",
            "the workflow must detect forced reviewers returned as selected=false",
        )

    def test_workflow_falls_back_to_every_invocation(self):
        js = WORKFLOW.read_text(encoding="utf-8")
        guard = js[js.index("if (distrust) {"):]
        block = guard[:guard.index("} else {")]
        self.assertIn(
            "invocations.map(i => i.name)", block,
            "the distrust branch must select every reviewer, not a subset",
        )

    def test_workflow_actually_calls_the_rule_at_the_route_site(self):
        """The differential test above exercises `routingDistrustReason` in
        isolation, so a correct rule that the Route phase never consults would
        pass it. Pin the call site too — the rule is only worth having if the
        routing decision is what flows into it."""
        js = WORKFLOW.read_text(encoding="utf-8")
        self.assertRegex(
            js,
            r"const distrust\s*=\s*routingDistrustReason\(\s*decision\.decisions\s*,"
            r"\s*agentsForced\s*\)",
            "the Route phase must compute `distrust` from the router's own "
            "decisions and the forced list",
        )
        self.assertRegex(
            js, r"if\s*\(distrust\)\s*\{",
            "the Route phase must branch on `distrust`",
        )

    def test_both_paths_agree_on_a_matrix_of_decisions(self):
        """Differential: same inputs through the real Python rule and a Node
        evaluation of the real workflow function must agree."""
        cases = [
            # (all_agents, forced, picked)
            (["a", "b", "c"], ["a"], []),            # forced dropped
            (["a", "b", "c"], ["a", "b"], ["a"]),    # one forced dropped
            (["a", "b", "c"], ["a"], ["a"]),         # narrow but compliant
            (["a", "b", "c"], ["a"], ["a", "b"]),    # normal
            (["a", "b", "c"], [], ["c"]),            # no forced at all, one pick
            (["a", "b"], ["z"], ["a"]),              # forced omitted from decisions
        ]
        for all_agents, forced, picked in cases:
            decisions = [{"name": n, "selected": n in picked} for n in all_agents]
            py = subprocess.run(
                [sys.executable, "-c",
                 f"import runpy,sys,json; sys.argv=['x'];"
                 f"m=runpy.run_path({str(ORCH)!r});"
                 f"print(json.dumps(bool(m['_routing_distrust_reason']"
                 f"({decisions!r}, set({forced!r})))))"],
                capture_output=True, text=True, cwd=str(REPO_ROOT),
            )
            self.assertEqual(py.returncode, 0, py.stderr[-1500:])
            py_distrusts = json.loads(py.stdout.strip())

            js_src = WORKFLOW.read_text(encoding="utf-8")
            start = js_src.index("function routingDistrustReason")
            end = js_src.index("\n}", start) + 2
            node = subprocess.run(
                ["node", "-e",
                 f"{js_src[start:end]}\n"
                 f"console.log(JSON.stringify(Boolean(routingDistrustReason("
                 f"{json.dumps(decisions)}, {json.dumps(forced)}))))"],
                capture_output=True, text=True,
            )
            self.assertEqual(node.returncode, 0, node.stderr[-1500:])
            js_distrusts = json.loads(node.stdout.strip())

            self.assertEqual(
                py_distrusts, js_distrusts,
                f"paths disagree for forced={forced} picked={picked}: "
                f"python={py_distrusts} workflow={js_distrusts}",
            )


class RouterPromptStatesCompositionTest(unittest.TestCase):
    """The router is told, as a fact, which changed files are source code.

    The incident's rationale was a claim about composition ("문서만 변경") that
    the prompt itself could have refuted. Stating it removes the inference step
    rather than hoping the router counts correctly.
    """

    def _prepare_over(self, *paths):
        import os
        import shutil

        tmp = tempfile.mkdtemp()
        try:
            r = subprocess.run(
                [sys.executable, str(ORCH), "--prepare", *paths],
                capture_output=True, text=True, cwd=str(REPO_ROOT),
                env=dict(os.environ, REVIEW_OUTPUT_DIR=tmp),
            )
            self.assertEqual(r.returncode, 0, r.stderr[-2000:])
            session = Path(r.stdout.strip().split("\n")[-1])
            return (session / "_prompts" / "_router.md").read_text(encoding="utf-8")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_mixed_changeset_is_declared_not_doc_only(self):
        """15 docs + 1 module is the shape that misled the router."""
        docs = sorted(
            str(p.relative_to(REPO_ROOT))
            for p in (REPO_ROOT / ".claude" / "agents").glob("*-reviewer.md")
        )[:15]
        body = self._prepare_over(
            *docs, str(ROUTER_SAFETY.relative_to(REPO_ROOT)),
        )
        self.assertIn("소스 코드 파일 1개", body)
        self.assertIn("문서 전용이 아닙니다", body)
        self.assertIn("router_safety.py", body)

    def test_doc_only_changeset_is_declared_as_such(self):
        docs = sorted(
            str(p.relative_to(REPO_ROOT))
            for p in (REPO_ROOT / ".claude" / "agents").glob("*-reviewer.md")
        )[:3]
        body = self._prepare_over(*docs)
        self.assertIn("소스 코드 파일 **0개**", body)
        self.assertNotIn("문서 전용이 아닙니다", body)

    def test_prompt_states_the_enforced_fallback_rule(self):
        body = self._prepare_over(str(ROUTER_SAFETY.relative_to(REPO_ROOT)))
        self.assertIn("호출자가 코드로 검증합니다", body)
        self.assertIn("강제 포함", body)
        self.assertIn("통째로 폐기", body)

    def test_prompt_tells_the_router_breaking_the_contract_backfires(self):
        """The behavioural lever, not decoration: the router needs to know that
        dropping a forced reviewer costs *more* review, not less. Pinned as a
        concept so rewording stays allowed and deleting the incentive does
        not."""
        body = self._prepare_over(str(ROUTER_SAFETY.relative_to(REPO_ROOT)))
        self.assertIn("전량 실행을 유발", body)


class SourceFileClassifierTest(unittest.TestCase):
    """`source_files()` is shared with the forced-reviewer rules on purpose, so
    the prompt's claim and the forced list can never disagree.

    Driven by subprocess, not import: `router_safety` pulls in
    `skills/_lib.project_config` while `_harness` binds `_lib` to the *hooks*
    package, and the two cannot both own that name in one interpreter (see
    `.claude/tests/README.md`). Importing it here passed when this file ran
    alone and broke the moment the full suite ran — the collision is
    order-dependent.
    """

    SKILL_LIB = ROUTER_SAFETY.parent          # .../code-review-agents/lib
    SKILL_DIR = SKILL_LIB.parent              # .../code-review-agents
    SKILLS_DIR = SKILL_DIR.parent             # .../skills

    def _eval(self, body: str):
        """Run `body` with router_safety importable; it must print JSON."""
        script = (
            f"import sys, json\n"
            f"sys.path.insert(0, {str(self.SKILL_DIR)!r})\n"
            f"sys.path.insert(0, {str(self.SKILLS_DIR)!r})\n"
            f"from lib import router_safety as rs\n"
            f"{body}\n"
        )
        r = subprocess.run(
            [sys.executable, "-c", script],
            capture_output=True, text=True, cwd=str(REPO_ROOT),
        )
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        return json.loads(r.stdout.strip().splitlines()[-1])

    def test_picks_code_and_rejects_docs(self):
        got = self._eval(
            "print(json.dumps(rs.source_files(["
            "'a/b/mod.py','docs/readme.md','src/App.tsx',"
            "'notes.txt','x.go','data.json','Makefile'])))"
        )
        self.assertEqual(got, ["a/b/mod.py", "src/App.tsx", "x.go"])

    def test_empty_input(self):
        self.assertEqual(self._eval("print(json.dumps(rs.source_files([])))"), [])

    def test_agrees_with_the_forced_rules(self):
        """Same classifier both sides: a source file must force the source
        reviewers, and `source_files` must report it."""
        got = self._eval(
            "paths=['pkg/thing.py']\n"
            "forced,_r = rs.compute_forced_agents(paths, "
            "['security','requirement','scope','side_effect',"
            "'maintainability','testing','documentation'])\n"
            "print(json.dumps({'src': rs.source_files(paths), 'forced': forced}))"
        )
        self.assertEqual(got["src"], ["pkg/thing.py"])
        self.assertIn("security", got["forced"])


if __name__ == "__main__":
    unittest.main()
