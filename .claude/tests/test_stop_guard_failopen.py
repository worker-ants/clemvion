"""The Stop guard's fail-open paths, and the reporting it now shares with push.

`guard_review_before_push.py` got this treatment in #999 (harness-guard-followups
§E). The Stop hook has the same three fail-open paths — gate import,
`evaluate_*()` raising, `main()` itself — and was still silent about all of
them, so a session could end with the review nudge quietly disabled and nothing
to show for it.

Rather than copy ~120 lines of carefully-reasoned reporting into a second file
(the duplication class this repo keeps getting bitten by), the push hook's logic
moved to `_lib/failopen_state.py` and both hooks call it. The push hook's 35
subprocess tests in `test_guard_review_before_push_main.py` are what made that
extraction checkable; this file covers what is genuinely Stop-specific.

The load-bearing difference, and the reason the stream is a parameter rather
than being derived inside the shared module:

    **A Stop hook's STDOUT is its protocol.** It carries
    `{"decision": "block", "reason": ...}`. The push hook picks stdout or stderr
    by exit code; doing that here would splice a banner into the JSON the
    harness parses. Stop always reports on stderr.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import _harness  # noqa: F401  — side effect: harness path setup

REPO_ROOT = _harness.REPO_ROOT
HOOKS_DIR = _harness.HOOKS_DIR
STOP_HOOK = HOOKS_DIR / "guard_review_before_stop.py"
PUSH_HOOK = HOOKS_DIR / "guard_review_before_push.py"

_CLEAN_REVIEW = "class _D:\n    blocked = False\n    reason = ''\ndef evaluate_review():\n    return _D()\n"
_CLEAN_PLAN = (
    "class _P:\n    untouched = False\n    complete_but_in_progress = False\n"
    "    reason = ''\n    plan_path = ''\ndef evaluate_plan():\n    return _P()\n"
)


class StopGuardFailOpenTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.hooks = Path(self.tmp) / "hooks"
        shutil.copytree(HOOKS_DIR, self.hooks)
        self._write("review_guard.py", _CLEAN_REVIEW)
        self._write("plan_guard.py", _CLEAN_PLAN)

    def _write(self, name: str, body: str):
        (self.hooks / "_lib" / name).write_text(body, encoding="utf-8")

    def _run(self, payload=None, *, env=None, hook=None):
        return subprocess.run(
            [sys.executable, str(self.hooks / (hook or STOP_HOOK.name))],
            input=json.dumps(payload if payload is not None else {"session_id": "s1"}),
            capture_output=True, text=True,
            env={**os.environ, "CLAUDE_PROJECT_DIR": self.tmp, **(env or {})},
            cwd=self.tmp, timeout=30.0,
        )

    def _state(self, name="stop_guard_failopen.json"):
        path = Path(self.tmp) / ".claude" / "state" / name
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None

    # ---- the protocol constraint ------------------------------------------

    def test_banner_never_lands_on_stdout(self):
        """Stop's stdout is the decision protocol; a banner there corrupts it."""
        self._write("plan_guard.py", "raise RuntimeError('broken')\n")
        r = self._run()
        self.assertEqual(r.returncode, 0)
        out = r.stdout.strip()
        if out:
            json.loads(out)  # must still parse — raises the test failure if not
        self.assertNotIn("fail-open", r.stdout)
        self.assertIn("fail-open", r.stderr)

    # ---- the three paths ---------------------------------------------------

    def test_import_failure_is_reported(self):
        self._write("plan_guard.py", "raise RuntimeError('broken')\n")
        r = self._run()
        self.assertEqual(r.returncode, 0, "a Stop hook must never wedge a session")
        self.assertIn("PLAN gate", r.stderr)
        self.assertEqual(self._state()["streak"], 1)

    def test_review_gate_degradation_is_reported_too(self):
        """Every other test here breaks the PLAN gate, which left the REVIEW
        branch entirely unexercised — deleting its `degraded.append` passed the
        whole file. The two branches are hand-written twins; both need a case."""
        self._write("review_guard.py", "raise RuntimeError('review is broken')\n")
        r = self._run()
        self.assertEqual(r.returncode, 0)
        self.assertIn("REVIEW gate", r.stderr)
        self.assertIn("review is broken", r.stderr)
        self.assertEqual(self._state()["streak"], 1)

    def test_review_gate_present_but_none_is_accurate_too(self):
        self._write("review_guard.py", "evaluate_review = None\n")
        r = self._run()
        self.assertIn("imported but evaluate_review is None", r.stderr)

    def test_evaluate_exception_is_reported(self):
        self._write("plan_guard.py",
                    "def evaluate_plan():\n    raise KeyError('boom')\n")
        r = self._run()
        self.assertEqual(r.returncode, 0)
        self.assertIn("KeyError", r.stderr)
        self.assertEqual(self._state()["streak"], 1)

    def test_main_raising_is_reported_and_still_allows(self):
        r = subprocess.run(
            [sys.executable, str(self.hooks / STOP_HOOK.name)],
            input="[1,2,3]", capture_output=True, text=True,
            env={**os.environ, "CLAUDE_PROJECT_DIR": self.tmp},
            cwd=self.tmp, timeout=30.0,
        )
        self.assertEqual(r.returncode, 0, "a Stop hook must never wedge a session")
        self.assertIn("MAIN gate", r.stderr)
        self.assertIsNotNone(self._state(), "the main() path must be counted too")

    # ---- accuracy of the reason -------------------------------------------

    def test_present_but_none_is_not_called_an_import_failure(self):
        """A module can import cleanly and bind the symbol to None — which is
        exactly how tests disable a gate. Calling that "failed to import" put a
        reason in the state file that never happened."""
        self._write("plan_guard.py", "evaluate_plan = None\n")
        r = self._run()
        self.assertIn("imported but evaluate_plan is None", r.stderr)
        self.assertNotIn("plan_guard.py failed to import", r.stderr)

    def test_a_real_import_failure_carries_the_exception_text(self):
        self._write("plan_guard.py", "raise RuntimeError('very specific')\n")
        r = self._run()
        self.assertIn("failed to import", r.stderr)
        self.assertIn("very specific", r.stderr)

    # ---- counting ----------------------------------------------------------

    def test_streak_accumulates_and_escalates(self):
        self._write("plan_guard.py", "raise RuntimeError('broken')\n")
        for _ in range(3):
            r = self._run()
        self.assertEqual(self._state()["streak"], 3)
        self.assertIn("사실상 꺼져", r.stderr)

    def test_a_fully_clean_run_resets_the_streak(self):
        self._write("plan_guard.py", "raise RuntimeError('broken')\n")
        self._run()
        self.assertIsNotNone(self._state())
        self._write("plan_guard.py", _CLEAN_PLAN)
        self._run()
        self.assertIsNone(self._state(), "a run where every gate answered must reset")

    def test_bypass_is_not_counted_as_degradation(self):
        """A conscious override is not a silent failure; mixing them buries the
        signal (the reset predicate has been wrong twice for related reasons —
        see _lib/failopen_state.py)."""
        self._write("plan_guard.py", "raise RuntimeError('broken')\n")
        r = self._run(env={"BYPASS_PLAN_GUARD": "1"})
        self.assertIsNone(self._state())
        self.assertNotIn("fail-open", r.stderr)

    def test_bypass_does_not_clear_an_existing_streak(self):
        self._write("plan_guard.py", "raise RuntimeError('broken')\n")
        self._run()
        self._write("plan_guard.py", _CLEAN_PLAN)
        self._run(env={"BYPASS_REVIEW_GUARD": "1"})
        self.assertIsNotNone(self._state(), "a bypassed run is not proof of health")

    # ---- isolation between the two hooks ----------------------------------

    def test_push_and_stop_keep_separate_streaks(self):
        """One hook's degradation must not escalate — or reset — the other's."""
        self._write("plan_guard.py", "raise RuntimeError('broken')\n")
        self._run()
        self._run(payload={"tool_input": {"command": "git push"}},
                  hook=PUSH_HOOK.name)
        self.assertIsNotNone(self._state("stop_guard_failopen.json"))
        self.assertIsNotNone(self._state("push_guard_failopen.json"))

    # ---- degrading the reporter itself ------------------------------------

    def test_missing_shared_module_costs_the_counter_not_the_signal(self):
        """Extraction into _lib/ added a dependency that can go missing. Silence
        is the one outcome that must not happen — it is the failure this whole
        mechanism exists to prevent."""
        (self.hooks / "_lib" / "failopen_state.py").unlink()
        self._write("plan_guard.py", "raise RuntimeError('broken')\n")
        r = self._run()
        self.assertEqual(r.returncode, 0)
        self.assertIn("fail-open", r.stderr)
        self.assertIsNone(self._state(), "no module → no counter, by design")

    def test_broken_shared_module_does_not_break_the_hook(self):
        (self.hooks / "_lib" / "failopen_state.py").write_text(
            "raise RuntimeError('module is broken')\n", encoding="utf-8"
        )
        r = self._run()
        self.assertEqual(r.returncode, 0, r.stderr[-600:])


class SuiteLeavesNoRealStateTest(unittest.TestCase):
    """The harness suite must not write fail-open state into the real repo.

    Measured twice on 2026-07-23: a hermetic test that patches a gate to `None`
    makes the hook (correctly) record a degradation, and without
    `CLAUDE_PROJECT_DIR` isolation that lands in the working tree — a few suite
    runs and a perfectly healthy gate escalates to "사실상 꺼져 있습니다".
    Pinned here so the next hook test that forgets to isolate fails loudly
    instead of quietly poisoning a counter nobody thinks to look at.
    """

    def test_no_failopen_state_after_the_suite_runs(self):
        state_dir = REPO_ROOT / ".claude" / "state"
        if not state_dir.exists():
            return
        leftovers = sorted(
            p.name for p in state_dir.iterdir() if p.name.endswith("_failopen.json")
        )
        self.assertEqual(
            leftovers, [],
            f"harness tests wrote real fail-open state: {leftovers}. A test ran a "
            f"guard hook without pointing CLAUDE_PROJECT_DIR at a temp dir.",
        )


if __name__ == "__main__":
    unittest.main()
