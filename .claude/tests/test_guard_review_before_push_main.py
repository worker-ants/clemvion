"""End-to-end tests for guard_review_before_push.py's main() entry point.

Scope: `main()`'s ORCHESTRATION only — the exit codes (0 allow / 2 block), the
REVIEW-then-PLAN gate order, the BYPASS_* per-gate overrides, the triple
fail-open (a gate module that fails to import, or whose evaluate_*() raises),
and stdin JSON handling. A silent regression there (e.g. the plan gate running
before the review gate, or a bypass leaking across gates, or fail-open turning
into fail-closed) would ship unnoticed.

NOT covered here: `_is_git_push`'s own detection logic. It has no dedicated
unit tests at all — the 44-case `test_push_detection.py` suite and the
subcommand-aware rewrite it guarded were both withdrawn in `3c6547b4d`
("push 가드 서브커맨드 재작성 철회"), leaving today's plain regex. That gap is
real and tracked as backlog item ② (harness-push-guard-subcommand-detection);
these tests deliberately use unambiguous commands (`git push …` / `git status`)
so they exercise main() rather than probing detection edges, and must not be
read as evidence that detection is covered.

These run the REAL hook as a subprocess with a JSON payload on stdin, exactly
as the harness invokes it, so the assertions are on the actual process exit
code and stderr. The two gate modules are replaced with stubs (a temp `_lib/`
next to a copy of the hook) whose behaviour is env-driven:

  STUB_REVIEW = clean | blocked | raise | import_error   (default clean)
  STUB_PLAN   = clean | untouched | raise | import_error  (default clean)

`import_error` makes that stub raise at import time, reproducing the hook's
`except Exception: <gate> = None` disable path. This lets one fixture exercise
every branch of main() without needing real review/plan state on disk.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

import _harness  # noqa: F401  — side effect: harness path setup; HOOKS_DIR used below

HOOK_SRC = _harness.HOOKS_DIR / "guard_review_before_push.py"

# Stub gate modules. They mimic the real return contract:
#   review_guard.evaluate_review() -> obj with .blocked / .reason
#   plan_guard.evaluate_plan()     -> obj with .untouched / .reason / .plan_path
# Behaviour is chosen at runtime from an env var so ONE copy covers every case.
#
# These are deliberately NARROWER than the real dataclasses (PlanDecision also
# carries e.g. `complete_but_in_progress`): they model only the fields main()
# actually reads. If main() starts reading another one, these stubs raise
# AttributeError rather than silently returning a wrong default — fail-loud.
_REVIEW_STUB = '''\
import os
if os.environ.get("STUB_REVIEW") == "import_error":
    raise ImportError("simulated review_guard import failure")
from dataclasses import dataclass


@dataclass
class _Decision:
    blocked: bool
    reason: str


def evaluate_review():
    mode = os.environ.get("STUB_REVIEW", "clean")
    if mode == "raise":
        raise RuntimeError("boom in evaluate_review")
    if mode == "blocked":
        return _Decision(blocked=True, reason="unreviewed codebase/ changes")
    return _Decision(blocked=False, reason="clean")
'''

_PLAN_STUB = '''\
import os
if os.environ.get("STUB_PLAN") == "import_error":
    raise ImportError("simulated plan_guard import failure")
from dataclasses import dataclass


@dataclass
class _Plan:
    untouched: bool
    reason: str
    plan_path: str


def evaluate_plan():
    mode = os.environ.get("STUB_PLAN", "clean")
    if mode == "raise":
        raise RuntimeError("boom in evaluate_plan")
    if mode == "untouched":
        return _Plan(untouched=True, reason="plan not updated",
                     plan_path="plan/in-progress/x.md")
    return _Plan(untouched=False, reason="plan touched", plan_path="plan/in-progress/x.md")
'''

_PUSH = "git push origin HEAD"


class GuardReviewBeforePushMainTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        # A copy of the real hook with a stub _lib beside it. THIS_DIR/_lib is
        # what the hook puts on sys.path, so these stubs win over the real gates.
        self.hooks_dir = os.path.join(self.tmp, "hooks")
        os.makedirs(os.path.join(self.hooks_dir, "_lib"))
        self.hook = os.path.join(self.hooks_dir, "guard_review_before_push.py")
        shutil.copy(HOOK_SRC, self.hook)
        self._write(os.path.join(self.hooks_dir, "_lib", "review_guard.py"), _REVIEW_STUB)
        self._write(os.path.join(self.hooks_dir, "_lib", "plan_guard.py"), _PLAN_STUB)

    def _write(self, path, content):
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def _run(self, command="", *, payload=None, raw_stdin=None,
             review="clean", plan="clean", bypass_review=False, bypass_plan=False):
        """Run the hook. `command` builds a standard payload; `payload` / `raw_stdin`
        override for the stdin-shape tests."""
        env = dict(os.environ)
        env["STUB_REVIEW"] = review
        env["STUB_PLAN"] = plan
        # Start from a clean slate so the parent shell's env can't leak a bypass.
        env.pop("BYPASS_REVIEW_GUARD", None)
        env.pop("BYPASS_PLAN_GUARD", None)
        if bypass_review:
            env["BYPASS_REVIEW_GUARD"] = "1"
        if bypass_plan:
            env["BYPASS_PLAN_GUARD"] = "1"

        if raw_stdin is not None:
            stdin = raw_stdin
        elif payload is not None:
            stdin = json.dumps(payload)
        else:
            stdin = json.dumps({"tool_input": {"command": command}})

        return subprocess.run(
            [sys.executable, self.hook],
            input=stdin, capture_output=True, text=True, env=env, timeout=10,
        )

    # --- push detection gate (main's consumption of _is_git_push) ----------
    def test_non_push_command_allows(self):
        r = self._run("git status", review="blocked", plan="untouched")
        self.assertEqual(r.returncode, 0,
                         "a non-push must pass even when both gates would block")
        self.assertEqual(r.stderr, "", "no gate output on a non-push")

    def test_push_via_input_alias_key_is_detected(self):
        # main() reads tool_input OR input — a push under `input` must still gate.
        r = self._run(payload={"input": {"command": _PUSH}}, review="blocked")
        self.assertEqual(r.returncode, 2)
        self.assertIn("(review gate)", r.stderr)

    # --- clean / block outcomes --------------------------------------------
    def test_push_allowed_when_both_gates_clean(self):
        r = self._run(_PUSH, review="clean", plan="clean")
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_push_blocked_by_review_gate(self):
        r = self._run(_PUSH, review="blocked", plan="clean")
        self.assertEqual(r.returncode, 2)
        self.assertIn("(review gate)", r.stderr)
        self.assertIn("unreviewed codebase/ changes", r.stderr)

    def test_push_blocked_by_plan_gate_when_review_clean(self):
        r = self._run(_PUSH, review="clean", plan="untouched")
        self.assertEqual(r.returncode, 2)
        self.assertIn("(plan gate)", r.stderr)

    # --- gate ORDER: review runs and returns before plan -------------------
    def test_review_gate_precedes_plan_gate(self):
        # Both would block. main() must surface the REVIEW refusal and return
        # before ever consulting the plan gate.
        r = self._run(_PUSH, review="blocked", plan="untouched")
        self.assertEqual(r.returncode, 2)
        self.assertIn("(review gate)", r.stderr)
        self.assertNotIn("(plan gate)", r.stderr,
                         "review must short-circuit before the plan gate runs")

    # --- BYPASS_* are per-gate --------------------------------------------
    def test_bypass_review_skips_only_the_review_gate(self):
        # Review would block but is bypassed; plan is clean → allow.
        r = self._run(_PUSH, review="blocked", plan="clean", bypass_review=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_bypass_review_still_enforces_plan_gate(self):
        # The bypass must NOT leak into the plan gate.
        r = self._run(_PUSH, review="blocked", plan="untouched", bypass_review=True)
        self.assertEqual(r.returncode, 2)
        self.assertIn("(plan gate)", r.stderr)

    def test_bypass_plan_skips_only_the_plan_gate(self):
        r = self._run(_PUSH, review="clean", plan="untouched", bypass_plan=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_bypass_plan_still_enforces_review_gate(self):
        r = self._run(_PUSH, review="blocked", plan="untouched", bypass_plan=True)
        self.assertEqual(r.returncode, 2)
        self.assertIn("(review gate)", r.stderr)

    # --- fail-open: evaluate_*() raises -----------------------------------
    def test_review_evaluate_exception_fails_open_and_runs_plan(self):
        # review raises → treated as no-decision (fail open), plan still runs.
        r = self._run(_PUSH, review="raise", plan="untouched")
        self.assertEqual(r.returncode, 2,
                         "a raising review gate must not silence the plan gate")
        self.assertIn("(plan gate)", r.stderr)
        self.assertIn("Traceback", r.stderr, "the swallowed exception is logged")

    def test_review_exception_alone_allows_when_plan_clean(self):
        r = self._run(_PUSH, review="raise", plan="clean")
        self.assertEqual(r.returncode, 0,
                         "review exception fails open; clean plan → push allowed")

    def test_plan_evaluate_exception_fails_open(self):
        r = self._run(_PUSH, review="clean", plan="raise")
        self.assertEqual(r.returncode, 0, "a raising plan gate must fail open")
        self.assertIn("Traceback", r.stderr)

    # --- fail-open: a gate module fails to import -------------------------
    def test_review_import_failure_disables_only_that_gate(self):
        # review_guard import blows up → review gate disabled (None); plan runs.
        r = self._run(_PUSH, review="import_error", plan="untouched")
        self.assertEqual(r.returncode, 2)
        self.assertIn("(plan gate)", r.stderr)

    def test_review_import_failure_still_allows_when_plan_clean(self):
        r = self._run(_PUSH, review="import_error", plan="clean")
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_plan_import_failure_disables_only_that_gate(self):
        # plan_guard import blows up → plan gate disabled; review still blocks.
        r = self._run(_PUSH, review="blocked", plan="import_error")
        self.assertEqual(r.returncode, 2)
        self.assertIn("(review gate)", r.stderr)

    def test_both_gate_imports_fail_allows_the_push(self):
        r = self._run(_PUSH, review="import_error", plan="import_error")
        self.assertEqual(r.returncode, 0,
                         "both gates disabled → fail open, push allowed")

    # --- stdin shapes ------------------------------------------------------
    def test_malformed_stdin_json_allows(self):
        r = self._run(raw_stdin="not json {{{", review="blocked", plan="untouched")
        self.assertEqual(r.returncode, 0,
                         "unparseable stdin → empty payload → no command → allow")

    def test_empty_stdin_allows(self):
        r = self._run(raw_stdin="", review="blocked", plan="untouched")
        self.assertEqual(r.returncode, 0)

    def test_payload_without_command_allows(self):
        r = self._run(payload={"tool_input": {}}, review="blocked", plan="untouched")
        self.assertEqual(r.returncode, 0)


if __name__ == "__main__":
    unittest.main()
