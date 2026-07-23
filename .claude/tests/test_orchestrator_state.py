"""State-machine tests for the code-review orchestrator's CLI.

The orchestrator is a pure-Python state machine (it never calls a model — main
Claude does, via the Agent tool). Its `--update` / `--apply-routing` /
`--summary-state` / `--resume` subcommands mutate `_retry_state.json` on main's
behalf. This is the most intricate automation in the harness and had no tests.

We drive the **real CLI via subprocess** rather than importing the module:
  - it tests the exact surface SKILL.md invokes, and
  - it sidesteps the two-`_lib`-packages import collision (the orchestrator
    needs skills/_lib.project_config; the branch tests need hooks/_lib — they
    can't both own the `_lib` name in one interpreter). A subprocess gets the
    orchestrator's own clean sys.path.
"""

from __future__ import annotations

import json
import os
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


def _run(*args: str, cwd: Path | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(ORCH), *args],
        cwd=str(cwd or REPO_ROOT),
        capture_output=True,
        text=True,
    )


class OrchestratorStateTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.sd = Path(self._tmp.name)
        self.state_file = self.sd / "_retry_state.json"

    def tearDown(self):
        self._tmp.cleanup()

    def _write_state(self, **overrides):
        state = {
            "agents_pending": ["security", "performance", "testing"],
            "agents_success": [],
            "agents_fatal": [],
        }
        state.update(overrides)
        self.state_file.write_text(json.dumps(state), encoding="utf-8")

    def _state(self) -> dict:
        return json.loads(self.state_file.read_text(encoding="utf-8"))

    # ---- --update transitions ----------------------------------------------

    def test_update_success_moves_to_success_bucket(self):
        self._write_state()
        r = _run("--update", str(self.sd), "--agent", "security", "--status", "success")
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self._state()
        self.assertIn("security", s["agents_success"])
        self.assertNotIn("security", s["agents_pending"])

    def test_update_fatal_moves_to_fatal_bucket(self):
        self._write_state()
        _run("--update", str(self.sd), "--agent", "performance", "--status", "fatal")
        s = self._state()
        self.assertIn("performance", s["agents_fatal"])
        self.assertNotIn("performance", s["agents_pending"])

    def test_update_network_keeps_pending(self):
        self._write_state()
        _run("--update", str(self.sd), "--agent", "testing", "--status", "network")
        s = self._state()
        self.assertIn("testing", s["agents_pending"])

    def test_rate_limit_increments_episodes_and_sets_reset_hint(self):
        self._write_state()
        _run("--update", str(self.sd), "--agent", "security",
             "--status", "rate_limit", "--reset-hint", "120")
        s = self._state()
        self.assertIn("security", s["agents_pending"])
        self.assertEqual(s["rate_limit_episodes"], 1)
        self.assertEqual(s["last_reset_hint_sec"], 120)

    def test_reset_hint_keeps_maximum(self):
        self._write_state(last_reset_hint_sec=300)
        _run("--update", str(self.sd), "--agent", "security",
             "--status", "rate_limit", "--reset-hint", "60")
        # 60 < 300 → keep the larger existing hint.
        self.assertEqual(self._state()["last_reset_hint_sec"], 300)

    def test_resuccess_after_retry_does_not_duplicate(self):
        self._write_state()
        _run("--update", str(self.sd), "--agent", "security", "--status", "network")
        _run("--update", str(self.sd), "--agent", "security", "--status", "success")
        s = self._state()
        self.assertEqual(s["agents_success"].count("security"), 1)
        self.assertNotIn("security", s["agents_pending"])

    def test_history_records_each_transition(self):
        self._write_state()
        _run("--update", str(self.sd), "--agent", "security", "--status", "network")
        _run("--update", str(self.sd), "--agent", "security", "--status", "success")
        hist = self._state()["agent_history"]["security"]
        self.assertEqual([h["status"] for h in hist], ["network", "success"])

    def test_update_requires_agent_and_status(self):
        self._write_state()
        r = _run("--update", str(self.sd))
        self.assertEqual(r.returncode, 2)

    # ---- --apply-routing ----------------------------------------------------

    def test_apply_routing_keeps_selected_and_forced(self):
        # A *compliant* decision: forced reviewers returned as selected=true.
        # A decision that drops or omits a forced reviewer is no longer silently
        # patched up — it is distrusted wholesale and every reviewer runs. That
        # rule and its rationale live in `test_router_decision_trust.py`.
        self._write_state(agents_forced=["security"])
        (self.sd / "_routing_decision.json").write_text(json.dumps({
            "decisions": [
                {"name": "security", "selected": True},     # forced → honoured
                {"name": "performance", "selected": True},
                {"name": "testing", "selected": False},     # dropped → skipped
            ]
        }), encoding="utf-8")
        r = _run("--apply-routing", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self._state()
        self.assertEqual(set(s["agents_pending"]), {"security", "performance"})
        self.assertIn("testing", s["agents_skipped"])
        self.assertEqual(s["routing_status"], "done")

    def test_apply_routing_fallback_keeps_all_pending(self):
        self._write_state()
        r = _run("--apply-routing", str(self.sd), "--fallback")
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self._state()
        self.assertEqual(set(s["agents_pending"]), {"security", "performance", "testing"})
        self.assertEqual(s["routing_status"], "skipped")
        self.assertIn("routing_skip_reason", s)

    # ---- --summary-state / --resume ----------------------------------------

    def test_summary_state_line_format(self):
        self._write_state(agents_success=["security"], agents_pending=["performance"],
                          routing_status="done")
        r = _run("--summary-state", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        out = r.stdout.strip()
        self.assertIn("pending=1", out)
        self.assertIn("success=1", out)
        self.assertIn("routing=done", out)
        self.assertIn("last_reset=null", out)

    def test_resume_echoes_path(self):
        self._write_state()
        r = _run("--resume", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        # orchestrator echoes os.path.abspath (not realpath) — match that, so
        # the macOS /tmp→/private/tmp symlink doesn't cause a false mismatch.
        self.assertEqual(r.stdout.strip(), os.path.abspath(str(self.sd)))

    def test_resume_missing_state_fails(self):
        # no _retry_state.json written
        r = _run("--resume", str(self.sd))
        self.assertEqual(r.returncode, 1)

    # ---- --sync-from-disk ---------------------------------------------------
    #
    # Covers the fallback path where main fans reviewers out with the Agent tool
    # directly: `--update` never runs, so the state stays at its prepare-time
    # snapshot while reports pile up on disk. Disk is the arbiter.

    def _write_invocations(self, names, **overrides):
        state = {
            "agents_pending": list(names),
            "agents_success": [],
            "agents_fatal": [],
            "subagent_invocations": [
                {"name": n, "output_file": str(self.sd / f"{n}.md")} for n in names
            ],
        }
        state.update(overrides)
        self.state_file.write_text(json.dumps(state), encoding="utf-8")

    def test_sync_from_disk_promotes_only_agents_with_a_report(self):
        self._write_invocations(["security", "testing", "scope"])
        (self.sd / "security.md").write_text("x", encoding="utf-8")
        (self.sd / "testing.md").write_text("x", encoding="utf-8")
        r = _run("--sync-from-disk", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self._state()
        self.assertEqual(sorted(s["agents_success"]), ["security", "testing"])
        # A claimed status is worth nothing without a file — scope stays pending.
        self.assertEqual(s["agents_pending"], ["scope"])
        self.assertIn("still missing: scope", r.stdout)

    def test_sync_from_disk_demotes_a_success_that_left_no_file(self):
        # The exact fake-success shape this command exists to correct.
        self._write_invocations(
            ["security", "testing"], agents_success=["security", "testing"], agents_pending=[]
        )
        (self.sd / "security.md").write_text("x", encoding="utf-8")
        r = _run("--sync-from-disk", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self._state()
        self.assertEqual(s["agents_success"], ["security"])
        self.assertEqual(s["agents_pending"], ["testing"])

    def test_sync_from_disk_leaves_skipped_out_of_pending(self):
        self._write_invocations(["security", "performance"], agents_skipped=["performance"])
        (self.sd / "security.md").write_text("x", encoding="utf-8")
        r = _run("--sync-from-disk", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self._state()
        self.assertEqual(s["agents_pending"], [])
        self.assertEqual(s["agents_skipped"], ["performance"])

    def test_sync_from_disk_never_invents_agents(self):
        # A stray file that no invocation claims must not enter the state.
        self._write_invocations(["security"])
        (self.sd / "security.md").write_text("x", encoding="utf-8")
        (self.sd / "bogus.md").write_text("x", encoding="utf-8")
        _run("--sync-from-disk", str(self.sd))
        s = self._state()
        self.assertEqual(s["agents_success"], ["security"])

    # ---- --verify-coverage --------------------------------------------------
    #
    # `agents_forced` is the router_safety whitelist the SKILL says a router cannot
    # override. Nothing enforced it until this command: on 2026-07-17 `security` was
    # skipped by a "this diff is small" judgement call on a diff that edited the
    # open-redirect defence boundary.

    def test_verify_coverage_passes_when_every_forced_agent_wrote(self):
        self._write_invocations(["security", "testing"], agents_forced=["security", "testing"])
        (self.sd / "security.md").write_text("x", encoding="utf-8")
        (self.sd / "testing.md").write_text("x", encoding="utf-8")
        r = _run("--verify-coverage", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("2/2", r.stdout)

    def test_verify_coverage_fails_and_names_the_missing_forced_agent(self):
        self._write_invocations(["security", "testing"], agents_forced=["security", "testing"])
        (self.sd / "testing.md").write_text("x", encoding="utf-8")
        r = _run("--verify-coverage", str(self.sd))
        self.assertEqual(r.returncode, 1)
        self.assertIn("security", r.stderr)

    def test_verify_coverage_ignores_claimed_status_without_a_file(self):
        # Fake success must not satisfy the whitelist.
        self._write_invocations(
            ["security"], agents_forced=["security"], agents_success=["security"], agents_pending=[]
        )
        r = _run("--verify-coverage", str(self.sd))
        self.assertEqual(r.returncode, 1)

    def test_verify_coverage_is_a_noop_without_a_forced_list(self):
        self._write_invocations(["security"])
        r = _run("--verify-coverage", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("(none)", r.stdout)

    # ---- report paths are session-relative, never the recorded worktree path ----
    #
    # `output_file` records the worktree the session was prepared in. Worktrees are
    # deleted when their task ends, but `review/**` is committed — so a session read from
    # any later worktree sits at a different absolute path. Trusting the recorded path
    # reported "no report" for 537 of 575 committed sessions (2026-07-17).

    def _write_state_with_dead_worktree_paths(self, names, **overrides):
        state = {
            "agents_pending": list(names),
            "agents_success": [],
            "agents_fatal": [],
            "subagent_invocations": [
                {
                    "name": n,
                    # A worktree that no longer exists — the shape every finished task leaves.
                    "output_file": f"/Volumes/gone/.claude/worktrees/dead-1234/review/code/2026/01/01/00_00_00/{n}.md",
                }
                for n in names
            ],
        }
        state.update(overrides)
        self.state_file.write_text(json.dumps(state), encoding="utf-8")

    def test_verify_coverage_finds_reports_when_the_recorded_worktree_is_gone(self):
        self._write_state_with_dead_worktree_paths(["security"], agents_forced=["security"])
        (self.sd / "security.md").write_text("x", encoding="utf-8")
        r = _run("--verify-coverage", str(self.sd))
        self.assertEqual(
            r.returncode, 0,
            "coverage must be judged in the session dir, not at the dead worktree path:\n" + r.stderr,
        )

    def test_sync_from_disk_finds_reports_when_the_recorded_worktree_is_gone(self):
        self._write_state_with_dead_worktree_paths(["security", "testing"])
        (self.sd / "security.md").write_text("x", encoding="utf-8")
        r = _run("--sync-from-disk", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self._state()
        self.assertEqual(s["agents_success"], ["security"])
        self.assertEqual(s["agents_pending"], ["testing"])

    # ---- read paths self-heal (no --sync-from-disk obligation) ----------------
    #
    # W2: an obligation that lives only in prose is the first thing to go under pressure —
    # so the SoT reconciles itself on read instead of asking anyone to remember.

    def test_summary_state_reconciles_before_reporting(self):
        self._write_invocations(["security", "testing"])  # both pending, none on disk
        (self.sd / "security.md").write_text("x", encoding="utf-8")
        r = _run("--summary-state", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("pending=1", r.stdout)
        self.assertIn("success=1", r.stdout)
        # and it healed the committed artifact, not just the printed line
        self.assertEqual(self._state()["agents_success"], ["security"])

    def test_resume_reconciles_so_a_loop_does_not_rerun_finished_agents(self):
        self._write_invocations(["security", "testing"])
        (self.sd / "security.md").write_text("x", encoding="utf-8")
        r = _run("--resume", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self._state()
        self.assertEqual(s["agents_success"], ["security"])
        self.assertEqual(s["agents_pending"], ["testing"])

    def test_reconcile_does_not_leave_an_agent_in_both_pending_and_fatal(self):
        # A fatal agent is not merely "not run yet"; double membership makes the
        # pending/fatal counts disagree with each other.
        self._write_invocations(
            ["security", "testing"], agents_fatal=["security"], agents_pending=["testing"]
        )
        r = _run("--sync-from-disk", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self._state()
        self.assertEqual(s["agents_fatal"], ["security"])
        self.assertNotIn("security", s["agents_pending"])

    def test_reconcile_persists_a_fatal_only_change(self):
        # `changed` must consider agents_fatal: a run that only drops a stale fatal used
        # to fix `state` in memory and then skip the save.
        self._write_invocations(["security"], agents_fatal=["security"], agents_pending=[])
        (self.sd / "security.md").write_text("x", encoding="utf-8")
        r = _run("--sync-from-disk", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self._state()
        self.assertEqual(s["agents_fatal"], [], "fatal cleared in memory but not persisted")
        self.assertEqual(s["agents_success"], ["security"])

    def test_reconcile_on_read_preserves_rate_limit_bookkeeping(self):
        # An agent that hit a limit has no file and must stay pending — without losing
        # the reset hint /loop schedules from.
        self._write_invocations(
            ["security"], rate_limit_episodes=2, last_reset_hint_sec=900
        )
        r = _run("--summary-state", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self._state()
        self.assertEqual(s["rate_limit_episodes"], 2)
        self.assertEqual(s["last_reset_hint_sec"], 900)
        self.assertIn("last_reset=900", r.stdout)


if __name__ == "__main__":
    unittest.main()
