"""End-to-end tests for guard_review_before_push.py's main() entry point.

Scope: `main()`'s ORCHESTRATION only — the exit codes (0 allow / 2 block), the
REVIEW-then-PLAN gate order, the BYPASS_* per-gate overrides, the triple
fail-open (a gate module that fails to import, or whose evaluate_*() raises),
and stdin JSON handling. A silent regression there (e.g. the plan gate running
before the review gate, or a bypass leaking across gates, or fail-open turning
into fail-closed) would ship unnoticed.

NOT covered here: `_is_git_push`'s own detection logic. That lives in
`test_push_guard_allowlist.py`, which freezes the blind first pass byte-for-byte
and runs a differential corpus against it (backlog item ②). Before that suite
existed, detection had NO dedicated tests at all — the 44-case
`test_push_detection.py` was withdrawn in `3c6547b4d` ("push 가드 서브커맨드
재작성 철회"). The tests below deliberately use unambiguous commands
(`git push …` / `git status`) so they exercise main()'s ORCHESTRATION rather
than probing detection edges.

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
        # The fail-open reporter writes its streak under
        # $CLAUDE_PROJECT_DIR/.claude/state/. Point it at the per-test temp dir:
        # otherwise every fail-open case would write into the real repo and the
        # streak would leak between tests.
        env["CLAUDE_PROJECT_DIR"] = self.tmp
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

    # --- fail-open OBSERVABILITY (§E policy, 2026-07-23) -------------------
    # The gates still fail open; what changed is that they no longer do it
    # silently. A gate that cannot answer must say so and be counted, because
    # "the push went through" must never be mistaken for "the check passed".
    def _streak_file(self):
        return os.path.join(self.tmp, ".claude", "state", "push_guard_failopen.json")

    def _streak(self):
        with open(self._streak_file(), encoding="utf-8") as fh:
            return json.load(fh)["streak"]

    def test_import_failure_is_announced_and_counted(self):
        r = self._run(_PUSH, review="import_error", plan="clean")
        self.assertEqual(r.returncode, 0, "still fails OPEN — policy unchanged")
        self.assertIn("fail-open", r.stdout)
        self.assertIn("REVIEW gate", r.stdout)
        self.assertEqual(self._streak(), 1)

    def test_evaluate_exception_is_announced_and_counted(self):
        r = self._run(_PUSH, review="raise", plan="clean")
        self.assertEqual(r.returncode, 0)
        self.assertIn("fail-open", r.stdout)
        self.assertEqual(self._streak(), 1)

    def test_consecutive_fail_opens_accumulate_and_escalate(self):
        """Escalation must fire AT the threshold and not before — asserting only
        its presence at 3 would let `>= 1` pass and make every blip shout."""
        for expected in (1, 2, 3):
            r = self._run(_PUSH, review="import_error", plan="clean")
            self.assertEqual(self._streak(), expected)
            if expected < 3:
                self.assertNotIn(
                    "‼️", r.stdout,
                    f"streak {expected} must not escalate yet — one blip and a "
                    "dead gate have to read differently",
                )
        self.assertIn(
            "‼️", r.stdout,
            "a sustained streak must escalate — one blip and a dead gate must "
            "not read the same",
        )

    def test_both_gates_degraded_counts_once_and_names_both(self):
        r = self._run(_PUSH, review="import_error", plan="import_error")
        self.assertEqual(r.returncode, 0)
        self.assertEqual(
            self._streak(), 1,
            "the streak counts PUSHES with degradation, not degraded gates",
        )
        self.assertIn("REVIEW gate", r.stdout)
        self.assertIn("PLAN gate", r.stdout)
        with open(self._streak_file(), encoding="utf-8") as fh:
            gates = {entry["gate"] for entry in json.load(fh)["gates"]}
        self.assertEqual(gates, {"REVIEW", "PLAN"})

    def test_a_clean_run_resets_the_streak(self):
        self._run(_PUSH, review="import_error", plan="clean")
        self.assertTrue(os.path.exists(self._streak_file()))
        self._run(_PUSH, review="clean", plan="clean")
        self.assertFalse(
            os.path.exists(self._streak_file()),
            "the counter measures CONSECUTIVE degradation; a working run clears it",
        )

    def test_conscious_bypass_is_not_counted_as_degradation(self):
        """BYPASS_* is a deliberate override, not a silent failure. Counting it
        would drown the signal this exists to produce."""
        r = self._run(_PUSH, review="blocked", plan="clean", bypass_review=True)
        self.assertEqual(r.returncode, 0)
        self.assertNotIn("fail-open", r.stdout)
        self.assertFalse(os.path.exists(self._streak_file()))

    def test_bypassing_an_actually_broken_gate_is_still_not_counted(self):
        """The precise boundary: a gate that WOULD have failed open, skipped by
        an explicit override. The other case above uses a healthy-but-blocking
        gate, which never reaches the degradation path at all."""
        r = self._run(_PUSH, review="import_error", plan="clean",
                      bypass_review=True)
        self.assertEqual(r.returncode, 0)
        self.assertNotIn("fail-open", r.stdout)
        self.assertFalse(os.path.exists(self._streak_file()))

    def test_bypass_does_not_clear_an_existing_streak(self):
        """A bypass says nothing about whether the gate works, so it must not
        erase evidence that it has been broken for several pushes. Resetting
        here would let an unrelated override wipe the signal (review W2)."""
        for _ in range(2):
            self._run(_PUSH, review="import_error", plan="clean")
        self.assertEqual(self._streak(), 2)

        self._run(_PUSH, review="import_error", plan="clean", bypass_review=True)
        self.assertEqual(
            self._streak(), 2,
            "a bypassed push is neither degradation nor proof of health — the "
            "streak must survive it untouched",
        )

        self._run(_PUSH, review="clean", plan="clean")
        self.assertFalse(
            os.path.exists(self._streak_file()),
            "only a gate that actually answered clears the streak",
        )

    def test_non_push_does_not_clear_an_existing_streak(self):
        self._run(_PUSH, review="import_error", plan="clean")
        self.assertEqual(self._streak(), 1)
        self._run("git status")
        self.assertEqual(
            self._streak(), 1,
            "an unrelated command is not evidence the gate recovered",
        )

    def test_degradation_is_reported_even_when_the_other_gate_blocks(self):
        """The report runs in a `finally`, so a blocking exit still surfaces the
        gate that failed open — otherwise the loudest case would be the quietest."""
        r = self._run(_PUSH, review="import_error", plan="untouched")
        self.assertEqual(r.returncode, 2, "the plan gate still blocks")
        self.assertIn("(plan gate)", r.stderr)
        self.assertIn("fail-open", r.stderr)
        self.assertEqual(self._streak(), 1)

    def test_detection_failure_is_observed_not_just_swallowed(self):
        """Fail-open #3: an exception BEFORE the gates run (payload read, or push
        detection itself). It used to escape `main()` and the harness's
        "non-0/non-2 means allow" rule let the push through with nothing
        recorded. Detection is the code three review rounds kept finding bugs
        in, so a silent failure there is the worst shape this can take."""
        with open(self.hook, encoding="utf-8") as fh:
            source = fh.read()
        broken = source.replace(
            "def _is_git_push(command: str) -> bool:\n",
            'def _is_git_push(command: str) -> bool:\n'
            '    raise RuntimeError("simulated detection failure")\n',
            1,
        )
        self.assertNotEqual(broken, source, "the injection point moved")
        with open(self.hook, "w", encoding="utf-8") as fh:
            fh.write(broken)

        r = self._run(_PUSH)
        self.assertEqual(r.returncode, 0, "still fails OPEN — policy unchanged")
        self.assertIn("DETECTION", r.stdout)
        self.assertEqual(self._streak(), 1)

    def test_banner_goes_to_the_stream_the_harness_actually_surfaces(self):
        """A banner on the wrong stream is a banner nobody reads.

        The harness injects STDOUT into the model's context on exit 0 (the
        rationale `guard_default_branch_bash.py` documents for its
        never-blocking reminder), while on exit 2 the refusal is read from
        stderr. So the channel has to follow the exit code, and both directions
        are pinned here — an earlier version always used stderr, which would
        have quietly undone the whole point of this policy on the common path.
        """
        allowed = self._run(_PUSH, review="import_error", plan="clean")
        self.assertEqual(allowed.returncode, 0)
        self.assertIn("fail-open", allowed.stdout)
        self.assertNotIn("fail-open", allowed.stderr)

        blocked = self._run(_PUSH, review="import_error", plan="untouched")
        self.assertEqual(blocked.returncode, 2)
        self.assertIn("fail-open", blocked.stderr)
        self.assertNotIn("fail-open", blocked.stdout)

    def test_a_blocking_gate_does_not_reset_the_other_gates_streak(self):
        """CRITICAL (review 17_22_18): a REVIEW block returns before the PLAN
        gate runs, so PLAN never answers. Treating "someone answered" as proof
        of health wiped a live PLAN streak on an ordinary blocked push — and
        REVIEW blocking is this hook's most common event, so the escalation
        would essentially never fire."""
        for _ in range(2):
            self._run(_PUSH, review="clean", plan="import_error")
        self.assertEqual(self._streak(), 2)

        r = self._run(_PUSH, review="blocked", plan="import_error")
        self.assertEqual(r.returncode, 2, "the review gate still blocks")
        self.assertEqual(
            self._streak(), 2,
            "PLAN never ran on this push, so it is neither proven healthy nor "
            "observed broken: the streak must be PRESERVED — not cleared (the "
            "CRITICAL) and not incremented (nothing was observed)",
        )

        # …and once PLAN is actually reached again, counting resumes from 2.
        self._run(_PUSH, review="clean", plan="import_error")
        self.assertEqual(self._streak(), 3)

    def test_a_fully_clean_push_still_resets(self):
        """The other direction: when BOTH gates answer, the streak clears.
        Without this the fix above could degenerate into 'never reset'."""
        self._run(_PUSH, review="clean", plan="import_error")
        self.assertTrue(os.path.exists(self._streak_file()))
        self._run(_PUSH, review="clean", plan="clean")
        self.assertFalse(os.path.exists(self._streak_file()))

    def test_unwritable_state_dir_does_not_break_the_guard(self):
        """Observability must never break the thing it observes — and that
        includes the banner itself. An earlier version persisted BEFORE
        printing, so an unwritable state dir swallowed the warning and the push
        went through in total silence."""
        env_dir = os.path.join(self.tmp, ".claude", "state")
        os.makedirs(os.path.dirname(env_dir), exist_ok=True)
        # A FILE where the state directory should be — makedirs/open will fail.
        with open(env_dir, "w") as fh:
            fh.write("not a directory")
        r = self._run(_PUSH, review="import_error", plan="clean")
        self.assertEqual(
            r.returncode, 0,
            "a failed state write must not change the guard's verdict",
        )
        self.assertIn(
            "fail-open", r.stdout,
            "the banner is the PRIMARY signal and must survive a failed write",
        )


if __name__ == "__main__":
    unittest.main()
