"""End-to-end tests for guard_review_before_push.py's main() entry point.

Scope: `main()`'s ORCHESTRATION only — the exit codes (0 allow / 2 block), the
BYPASS_REVIEW_GUARD override, the triple fail-open (the gate module fails to
import, its evaluate_review() raises, or push detection / target selection
blows up), and stdin JSON handling. A silent regression there (e.g. fail-open
turning into fail-closed, or a degraded check going unreported) would ship
unnoticed.

The hook used to run a second, PLAN gate (`_lib/plan_guard.py`). It left with
`plan/` in NERV cutover stage 3 (NERV Task `CLE-T-FN2JWK`); the tests that only
made sense with two gates (gate order, a bypass leaking into the other gate, one
gate's streak surviving the other's block) went with it. Where a second
degraded check is still needed, a target-selection failure plays that role.

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
code and stderr. The gate module is replaced with a stub (a temp `_lib/` next
to a copy of the hook) whose behaviour is env-driven:

  STUB_REVIEW = clean | blocked | raise | import_error   (default clean)

`import_error` makes the stub raise at import time, reproducing the hook's
`except Exception: evaluate_review = None` disable path. This lets one fixture
exercise every branch of main() without needing real review state.
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

# Stub gate module. It mimics the real return contract:
#   review_guard.evaluate_review() -> obj with .blocked / .reason
# Behaviour is chosen at runtime from an env var so ONE copy covers every case.
#
# Deliberately NARROWER than the real dataclass: it models only the fields main()
# actually reads. If main() starts reading another one, the stub raises
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

    @property
    def push_blocks(self):  # the push runner reads this, not `.blocked`
        return self.blocked


# Mirrors the real signature (`cwd=None, *, branch, head, base_ref, client`). A
# no-arg stub would accept whatever the push guard passes and hide the thing that
# matters here: the push guard must let the gate read the branch and HEAD from the
# worktree it publishes. Passing any of them would judge something other than what
# is being pushed (the CI backstop is the caller that passes them, for the PR head).
def evaluate_review(cwd=None, *, branch=None, head=None, base_ref=None, client=None):
    seam = os.environ.get("SEAM_OUT")
    if seam:
        with open(seam, "a") as f:
            f.write(repr((branch, head, base_ref, client)) + "\\n")
    mode = os.environ.get("STUB_REVIEW", "clean")
    if mode == "raise":
        raise RuntimeError("boom in evaluate_review")
    if mode == "blocked":
        return _Decision(blocked=True, reason="unreviewed codebase/ changes")
    return _Decision(blocked=False, reason="clean")
'''

_PUSH = "git push origin HEAD"

# §M: a push on its own line, after a non-git command — this repo's commonest
# form. Until §M `_is_git_push` returned False for this and main() skipped the
# gates (the reproduced bypass). `test_multiline_push_still_gates` pins that the
# ORCHESTRATION now reaches the gates for it, end to end.
_MULTILINE_PUSH = 'cd /some/worktree\necho "pushing"\ngit push -u origin HEAD'


class GuardReviewBeforePushMainTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        # A copy of the real hook with a stub _lib beside it. THIS_DIR/_lib is
        # what the hook puts on sys.path, so the stub wins over the real gate.
        self.hooks_dir = os.path.join(self.tmp, "hooks")
        os.makedirs(os.path.join(self.hooks_dir, "_lib"))
        self.hook = os.path.join(self.hooks_dir, "guard_review_before_push.py")
        shutil.copy(HOOK_SRC, self.hook)
        # The real hook has _lib/failopen_state.py beside it; copy it in so the
        # fixture matches production. Without it the hook takes its degraded
        # reporting path and the streak assertions below silently pass on
        # nothing.
        shutil.copy(_harness.HOOKS_DIR / "_lib" / "failopen_state.py",
                    os.path.join(self.hooks_dir, "_lib", "failopen_state.py"))
        # Same for the JSON envelope. Without it the hook takes its fallback
        # envelope, which `test_pretooluse_hook_output.py` covers on its own.
        shutil.copy(_harness.HOOKS_DIR / "_lib" / "hook_output.py",
                    os.path.join(self.hooks_dir, "_lib", "hook_output.py"))
        self._write(os.path.join(self.hooks_dir, "_lib", "review_guard.py"), _REVIEW_STUB)

    def _write(self, path, content):
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    @staticmethod
    def _ctx(r):
        """What the model receives on an allow (exit 0). A raw `r.stdout` substring
        check also passes for plain text, which Claude Code drops."""
        return _harness.pretooluse_context(r.stdout)

    def _run(self, command="", *, payload=None, raw_stdin=None, seam_out=None,
             review="clean", bypass_review=False):
        """Run the hook. `command` builds a standard payload; `payload` / `raw_stdin`
        override for the stdin-shape tests."""
        env = dict(os.environ)
        env["STUB_REVIEW"] = review
        # The fail-open reporter writes its streak under
        # $CLAUDE_PROJECT_DIR/.claude/state/. Point it at the per-test temp dir:
        # otherwise every fail-open case would write into the real repo and the
        # streak would leak between tests.
        env["CLAUDE_PROJECT_DIR"] = self.tmp
        # Start from a clean slate so the parent shell's env can't leak a bypass.
        env.pop("BYPASS_REVIEW_GUARD", None)
        if bypass_review:
            env["BYPASS_REVIEW_GUARD"] = "1"
        if seam_out:
            env["SEAM_OUT"] = seam_out
        else:
            env.pop("SEAM_OUT", None)

        if raw_stdin is not None:
            stdin = raw_stdin
        elif payload is not None:
            stdin = json.dumps(payload)
        else:
            stdin = json.dumps({"tool_input": {"command": command}})

        return subprocess.run(
            [sys.executable, self.hook],
            input=stdin, capture_output=True, text=True, env=env, timeout=10,
            # Pin the cwd to the per-test temp dir. Inheriting the caller's
            # checkout made the hook see whatever worktrees happen to exist on
            # the machine — a review flagged one
            # non-reproducing failure out of 14 runs from exactly that coupling.
            # These tests are about the hook's decision table, not the repo.
            cwd=self.tmp,
        )

    # --- push detection gate (main's consumption of _is_git_push) ----------
    def test_non_push_command_allows(self):
        r = self._run("git status", review="blocked")
        self.assertEqual(r.returncode, 0,
                         "a non-push must pass even when the gate would block")
        self.assertEqual(r.stderr, "", "no gate output on a non-push")
        # main() now routes EVERY command through the fail-open reporter (in a
        # `finally`), so pin that a non-push stays a complete no-op: no banner
        # and no state written. Without this, a future loosening of the reset
        # rule could quietly give ordinary commands a side effect on disk.
        self.assertEqual(r.stdout, "", "no banner on a non-push")
        self.assertFalse(
            os.path.exists(os.path.join(
                self.tmp, ".claude", "state", "push_guard_failopen.json")),
            "a non-push must not touch the streak file",
        )

    def test_push_via_input_alias_key_is_detected(self):
        # main() reads tool_input OR input — a push under `input` must still gate.
        r = self._run(payload={"input": {"command": _PUSH}}, review="blocked")
        self.assertEqual(r.returncode, 2)
        self.assertIn("(review gate)", r.stderr)

    # --- clean / block outcomes --------------------------------------------
    def test_push_allowed_when_the_gate_is_clean(self):
        r = self._run(_PUSH, review="clean")
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_push_lets_the_gate_read_branch_and_head_from_the_worktree(self):
        """The hook passes only the worktree. Overriding the branch, HEAD, base or
        client would judge a NERV round for something other than what is being
        pushed — and the decision object would look identical either way."""
        seam = os.path.join(self.tmp, "push_seam.txt")
        r = self._run("git push", seam_out=seam)
        self.assertEqual(r.returncode, 0)
        with open(seam) as f:
            observed = [ln.strip() for ln in f if ln.strip()]
        self.assertTrue(observed, "evaluate_review was never called")
        self.assertEqual(set(observed), {"(None, None, None, None)"})

    def test_push_blocked_by_review_gate(self):
        r = self._run(_PUSH, review="blocked")
        self.assertEqual(r.returncode, 2)
        self.assertIn("(review gate)", r.stderr)
        self.assertIn("unreviewed codebase/ changes", r.stderr)

    def test_multiline_push_still_gates(self):
        """§M end-to-end: a push on its OWN LINE after a non-git command reaches
        the gates. This is the exact shape that slipped through in the field —
        `main()` used to return 0 here because `_is_git_push` missed the newline
        separator, skipping the gates with no banner. It must now block."""
        r = self._run(_MULTILINE_PUSH, review="blocked")
        self.assertEqual(
            r.returncode, 2,
            "a multi-line push must reach the review gate, not skip it as a "
            "non-push (the reproduced field bypass)",
        )
        self.assertIn("(review gate)", r.stderr)

    def test_multiline_push_clean_is_a_normal_allow(self):
        """The mirror: detection widening must not turn the multi-line form into
        a false BLOCK — with the gate clean it passes, same as the one-liner."""
        r = self._run(_MULTILINE_PUSH, review="clean")
        self.assertEqual(r.returncode, 0, r.stderr)

    # --- BYPASS_REVIEW_GUARD ---------------------------------------------
    def test_bypass_review_skips_the_gate(self):
        r = self._run(_PUSH, review="blocked", bypass_review=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    # --- fail-open: evaluate_review() raises -------------------------------
    def test_review_evaluate_exception_fails_open(self):
        r = self._run(_PUSH, review="raise")
        self.assertEqual(r.returncode, 0, "a raising review gate must fail open")
        self.assertIn("Traceback", r.stderr, "the swallowed exception is logged")

    # --- fail-open: the gate module fails to import -------------------------
    def test_review_import_failure_allows_the_push(self):
        r = self._run(_PUSH, review="import_error")
        self.assertEqual(r.returncode, 0, "gate disabled → fail open, push allowed")

    # --- stdin shapes ------------------------------------------------------
    def test_malformed_stdin_json_allows(self):
        r = self._run(raw_stdin="not json {{{", review="blocked")
        self.assertEqual(r.returncode, 0,
                         "unparseable stdin → empty payload → no command → allow")

    def test_empty_stdin_allows(self):
        r = self._run(raw_stdin="", review="blocked")
        self.assertEqual(r.returncode, 0)

    def test_payload_without_command_allows(self):
        r = self._run(payload={"tool_input": {}}, review="blocked")
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
        r = self._run(_PUSH, review="import_error")
        self.assertEqual(r.returncode, 0, "still fails OPEN — policy unchanged")
        self.assertIn("fail-open", self._ctx(r))
        self.assertIn("REVIEW gate", self._ctx(r))
        self.assertEqual(self._streak(), 1)

    def test_evaluate_exception_is_announced_and_counted(self):
        r = self._run(_PUSH, review="raise")
        self.assertEqual(r.returncode, 0)
        self.assertIn("fail-open", self._ctx(r))
        self.assertEqual(self._streak(), 1)

    def test_consecutive_fail_opens_accumulate_and_escalate(self):
        """Escalation must fire AT the threshold and not before — asserting only
        its presence at 3 would let `>= 1` pass and make every blip shout."""
        for expected in (1, 2, 3):
            r = self._run(_PUSH, review="import_error")
            self.assertEqual(self._streak(), expected)
            if expected < 3:
                self.assertNotIn(
                    "‼️", self._ctx(r),
                    f"streak {expected} must not escalate yet — one blip and a "
                    "dead gate have to read differently",
                )
        self.assertIn(
            "‼️", self._ctx(r),
            "a sustained streak must escalate — one blip and a dead gate must "
            "not read the same",
        )

    def _break_target_selection(self):
        """Make `_push_targets` raise, so TARGET_SELECTION degrades while the gate
        still runs on the cwd — the second independent degraded check now that
        the PLAN gate is gone."""
        with open(self.hook, encoding="utf-8") as fh:
            source = fh.read()
        with open(self.hook, "w", encoding="utf-8") as fh:
            fh.write(_harness.break_push_targets(source))

    def test_two_degraded_checks_count_once_and_name_both(self):
        self._break_target_selection()
        r = self._run(_PUSH, review="import_error")
        self.assertEqual(r.returncode, 0)
        self.assertEqual(
            self._streak(), 1,
            "the streak counts PUSHES with degradation, not degraded checks",
        )
        self.assertIn("REVIEW gate", self._ctx(r))
        self.assertIn("TARGET_SELECTION", self._ctx(r))
        with open(self._streak_file(), encoding="utf-8") as fh:
            gates = {entry["gate"] for entry in json.load(fh)["gates"]}
        self.assertEqual(gates, {"REVIEW", "TARGET_SELECTION"})

    def test_a_clean_run_resets_the_streak(self):
        self._run(_PUSH, review="import_error")
        self.assertTrue(os.path.exists(self._streak_file()))
        self._run(_PUSH, review="clean")
        self.assertFalse(
            os.path.exists(self._streak_file()),
            "the counter measures CONSECUTIVE degradation; a working run clears it",
        )

    def test_conscious_bypass_is_not_counted_as_degradation(self):
        """BYPASS_* is a deliberate override, not a silent failure. Counting it
        would drown the signal this exists to produce."""
        r = self._run(_PUSH, review="blocked", bypass_review=True)
        self.assertEqual(r.returncode, 0)
        self.assertNotIn("fail-open", self._ctx(r))
        self.assertFalse(os.path.exists(self._streak_file()))

    def test_bypassing_an_actually_broken_gate_is_still_not_counted(self):
        """The precise boundary: a gate that WOULD have failed open, skipped by
        an explicit override. The other case above uses a healthy-but-blocking
        gate, which never reaches the degradation path at all."""
        r = self._run(_PUSH, review="import_error",
                      bypass_review=True)
        self.assertEqual(r.returncode, 0)
        self.assertNotIn("fail-open", self._ctx(r))
        self.assertFalse(os.path.exists(self._streak_file()))

    def test_bypass_does_not_clear_an_existing_streak(self):
        """A bypass says nothing about whether the gate works, so it must not
        erase evidence that it has been broken for several pushes. Resetting
        here would let an unrelated override wipe the signal (review W2)."""
        for _ in range(2):
            self._run(_PUSH, review="import_error")
        self.assertEqual(self._streak(), 2)

        self._run(_PUSH, review="import_error", bypass_review=True)
        self.assertEqual(
            self._streak(), 2,
            "a bypassed push is neither degradation nor proof of health — the "
            "streak must survive it untouched",
        )

        self._run(_PUSH, review="clean")
        self.assertFalse(
            os.path.exists(self._streak_file()),
            "only a gate that actually answered clears the streak",
        )

    def test_non_push_does_not_clear_an_existing_streak(self):
        self._run(_PUSH, review="import_error")
        self.assertEqual(self._streak(), 1)
        self._run("git status")
        self.assertEqual(
            self._streak(), 1,
            "an unrelated command is not evidence the gate recovered",
        )

    def test_degradation_is_reported_even_when_the_gate_blocks(self):
        """The report runs in a `finally`, so a blocking exit still surfaces the
        check that failed open — otherwise the loudest case would be the
        quietest. Target selection degrades; the gate still runs on the cwd and
        blocks."""
        self._break_target_selection()
        r = self._run(_PUSH, review="blocked")
        self.assertEqual(r.returncode, 2, "the review gate still blocks")
        self.assertIn("(review gate)", r.stderr)
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
        self.assertIn("DETECTION", self._ctx(r))
        self.assertEqual(self._streak(), 1)

    def test_banner_goes_to_the_stream_the_harness_actually_surfaces(self):
        """A banner on the wrong stream is a banner nobody reads.

        On exit 0 only the PreToolUse JSON envelope reaches the model (plain
        stdout lands in Claude Code's debug log — `_lib/hook_output.py`), while
        on exit 2 the refusal is read from stderr. So the channel has to follow
        the exit code, and both directions are pinned here — an earlier version
        always used stderr, and until 2026-10-10 the allow path printed plain
        stdout; either quietly undoes the whole point of this policy on the
        common path.
        """
        allowed = self._run(_PUSH, review="import_error")
        self.assertEqual(allowed.returncode, 0)
        self.assertIn("fail-open", self._ctx(allowed))
        self.assertNotIn("fail-open", allowed.stderr)

        self._break_target_selection()
        blocked = self._run(_PUSH, review="blocked")
        self.assertEqual(blocked.returncode, 2)
        self.assertIn("fail-open", blocked.stderr)
        self.assertEqual(blocked.stdout, "", "exit 2: nothing on stdout, the refusal is stderr")

    def test_a_blocking_answer_still_proves_the_gate_works(self):
        """With one gate, a push it BLOCKS is still a push it ANSWERED: the gate
        imported, ran, and decided. That is the evidence the streak waits for,
        so it clears — the same rule `failopen_state.report` applies to any set
        of gates (degraded → count, all answered → reset, otherwise untouched)."""
        for _ in range(2):
            self._run(_PUSH, review="import_error")
        self.assertEqual(self._streak(), 2)

        r = self._run(_PUSH, review="blocked")
        self.assertEqual(r.returncode, 2, "the review gate still blocks")
        self.assertFalse(
            os.path.exists(self._streak_file()),
            "the gate answered (by blocking), so the degradation streak is over",
        )

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
        r = self._run(_PUSH, review="import_error")
        self.assertEqual(
            r.returncode, 0,
            "a failed state write must not change the guard's verdict",
        )
        self.assertIn(
            "fail-open", self._ctx(r),
            "the banner is the PRIMARY signal and must survive a failed write",
        )

    # ---- degrading the reporter itself ------------------------------------
    # Moved from `test_stop_guard_failopen.py` when the Stop hook retired (NERV
    # cutover stage 3): the push hook is now the only consumer of
    # `failopen_state`, so the reporter's own failure modes are pinned here.

    def test_missing_shared_module_costs_the_counter_not_the_signal(self):
        """Extraction into `_lib/` added a dependency that can go missing.
        Silence is the one outcome that must not happen — it is the failure this
        whole mechanism exists to prevent."""
        os.unlink(os.path.join(self.hooks_dir, "_lib", "failopen_state.py"))
        r = self._run(_PUSH, review="import_error")
        self.assertEqual(r.returncode, 0)
        self.assertIn("fail-open", self._ctx(r))
        self.assertFalse(os.path.exists(self._streak_file()),
                         "no module → no counter, by design")

    def test_broken_shared_module_does_not_break_the_hook(self):
        self._write(os.path.join(self.hooks_dir, "_lib", "failopen_state.py"),
                    "raise RuntimeError('module is broken')\n")
        r = self._run(_PUSH, review="clean")
        self.assertEqual(r.returncode, 0, r.stderr[-600:])
        r = self._run(_PUSH, review="blocked")
        self.assertEqual(r.returncode, 2, "a broken reporter must not cost the verdict")

    # ---- accuracy of the reason --------------------------------------------
    # Also moved from the Stop tests (stage 3). They were the only callers that
    # told `failopen_state.import_failure_reason`'s two branches apart; without
    # them a mutant answering "failed to import" for both survived 65 push tests.

    def _degraded_reasons(self):
        with open(self._streak_file(), encoding="utf-8") as fh:
            return [g["reason"] for g in json.load(fh)["gates"]]

    def test_present_but_none_is_not_called_an_import_failure(self):
        """A module can import cleanly and bind the symbol to None — which is
        exactly how tests disable a gate. Calling that "failed to import" put a
        reason in the state file that never happened."""
        self._write(os.path.join(self.hooks_dir, "_lib", "review_guard.py"),
                    "evaluate_review = None\n")
        r = self._run(_PUSH)
        self.assertEqual(r.returncode, 0)
        self.assertIn("imported but evaluate_review is None", self._ctx(r))
        self.assertNotIn("failed to import", self._ctx(r))
        self.assertEqual(self._degraded_reasons(),
                         ["_lib/review_guard.py imported but evaluate_review is None"])

    def test_a_real_import_failure_carries_the_exception_text(self):
        self._write(os.path.join(self.hooks_dir, "_lib", "review_guard.py"),
                    "raise RuntimeError('very specific')\n")
        r = self._run(_PUSH)
        self.assertEqual(r.returncode, 0)
        self.assertIn("failed to import", self._ctx(r))
        self.assertIn("very specific", self._ctx(r))
        [reason] = self._degraded_reasons()
        self.assertIn("RuntimeError: very specific", reason)


class DetectionSurvivesABroken_libTest(unittest.TestCase):
    """탐지 정규식이 `_lib` 과 **함께 죽지 않는다** — 복제를 남긴 이유가 이것이다.

    `_GIT_PUSH` 는 `guard_default_branch_bash._MUTATING` 과 env-value 서브패턴을
    글자 그대로 공유하고, 그 동기화는 지금 사람 손과 `EnvValueSubpatternSharedTest`
    의 사후 비교에 기대고 있다. "DRY 하게 `_lib` 로 빼자" 는 제안이 반복해서 나오는데,
    그렇게 하면 **이 훅이 자기 탐지 능력을 `_lib` 의 건강에 걸게 된다**.

    왜 그게 치명적인가 — 이 훅의 import 는 게이트별 best-effort 다. 실패하면 심볼을
    `None` 으로 두고 **계속 실행**한다(다른 게이트를 침묵시키지 않으려고 일부러 그렇게
    했다). 정규식이 같은 경로로 들어오면 `None.search(...)` 가 되어 `AttributeError` 로
    훅이 죽고, 하네스의 "non-0/non-2 = allow" 규칙에 따라 **모든 push 가 무검증 통과**한다.
    게이트가 조용히 사라지는 것 — 이 저장소가 §J·§L·§M·#1002·#1005 로 반복해 닫아온
    바로 그 클래스다.

    그래서 이 테스트는 `_lib` 을 통째로 부순 상태에서 훅이 **여전히 push 를 push 로 알아보고
    차단 판정까지 도달하는지**를 본다. 주석만으로는 다음 사람이 "정리" 라는 이름으로
    이 성질을 되돌릴 수 있다 — 실제로 "keep identical" 주석은 §J 에서 세 곳 중 한 곳이
    누락되는 것을 막지 못했다.
    """

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.hooks_dir = os.path.join(self.tmp, "hooks")
        os.makedirs(os.path.join(self.hooks_dir, "_lib"))
        self.hook = os.path.join(self.hooks_dir, "guard_review_before_push.py")
        shutil.copy(HOOK_SRC, self.hook)

    def _write(self, rel, content):
        path = os.path.join(self.hooks_dir, "_lib", rel)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def _run(self, command):
        env = dict(os.environ)
        env["CLAUDE_PROJECT_DIR"] = self.tmp
        env.pop("BYPASS_REVIEW_GUARD", None)
        return subprocess.run(
            [sys.executable, self.hook],
            input=json.dumps({"tool_input": {"command": command}}),
            capture_output=True, text=True, env=env, timeout=10, cwd=self.tmp,
        )

    @staticmethod
    def _model_text(r):
        """모델이 읽는 쪽: 막았으면 stderr, 통과시켰으면 PreToolUse envelope.

        `r.stdout + r.stderr` 부분 문자열 단언은 평문 stdout 으로 퇴행해도 통과한다.
        """
        if r.returncode == 2:
            return r.stderr
        return _harness.pretooluse_context(r.stdout)

    def _break_every_lib_module(self):
        """`_lib` 의 세 모듈을 전부 import 불가로 만든다 — 최악의 경우."""
        for name in ("review_guard.py", "failopen_state.py", "hook_output.py"):
            self._write(name, "raise RuntimeError('_lib is broken')\n")

    def test_a_push_is_still_recognised_when_every_gate_import_fails(self):
        self._break_every_lib_module()
        r = self._run(_PUSH)
        # 훅이 살아 있어야 한다 — 크래시(비-0/비-2)는 하네스가 allow 로 읽는다.
        self.assertIn(
            r.returncode, (0, 2),
            f"훅이 죽었다 (rc={r.returncode}) — 하네스는 이걸 allow 로 읽는다.\n"
            f"stderr:\n{r.stderr}",
        )
        # 그리고 이 명령을 **push 로 알아봤어야** 한다. 게이트가 죽었으니 차단은
        # 못 하지만, fail-open 을 소리 내어 보고하는 것이 그 증거다.
        self.assertIn(
            "fail-open", self._model_text(r),
            "push 로 인식하지 못해 게이트 경로에 아예 들어가지 않았다 — 탐지가 "
            "`_lib` 과 함께 죽었다는 뜻이다",
        )

    def test_a_non_push_stays_silent_under_the_same_breakage(self):
        """반대 방향. 위 단언이 '무조건 시끄럽다' 로 통과하면 안 된다 — 탐지가
        **구분**을 유지하는지가 요점이다."""
        self._break_every_lib_module()
        r = self._run("git status")
        self.assertIn(r.returncode, (0, 2))
        self.assertNotIn(
            "fail-open", r.stdout,
            "push 가 아닌 명령까지 게이트 경로로 들어갔다 — 탐지가 무너진 것이다",
        )

    def test_the_multiline_form_survives_too(self):
        """§M 이 닫은 형태(줄바꿈 뒤의 push)가 `_lib` 붕괴 하에서도 유지되는지.
        이 형태가 이 저장소에서 가장 흔하고, 종전에 통째로 안 보이던 것이다."""
        self._break_every_lib_module()
        r = self._run(_MULTILINE_PUSH)
        self.assertIn(r.returncode, (0, 2))
        self.assertIn("fail-open", self._model_text(r))


class SuiteLeavesNoRealStateTest(unittest.TestCase):
    """The harness suite must not write fail-open state into the real repo.

    Measured twice on 2026-07-23: a hermetic test that patches a gate to `None`
    makes the hook (correctly) record a degradation, and without
    `CLAUDE_PROJECT_DIR` isolation that lands in the working tree — a few suite
    runs and a perfectly healthy gate escalates to "사실상 꺼져 있습니다".
    Pinned so the next hook test that forgets to isolate fails loudly instead of
    quietly poisoning a counter nobody thinks to look at. (Moved here from
    `test_stop_guard_failopen.py` when the Stop hook retired in NERV cutover
    stage 3.)
    """

    def test_no_failopen_state_after_the_suite_runs(self):
        state_dir = _harness.REPO_ROOT / ".claude" / "state"
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


class StubMirrorsTheGateSignatureTest(unittest.TestCase):
    """훅 테스트는 게이트를 손으로 쓴 스텁으로 바꿔 돈다. 실물 시그니처가 바뀌면 스텁도 따라가야 한다.

    스텁이 실물보다 너그러우면(이름이 바뀐 인자를 받아 줌) 훅이 실물을 부르는 이음매가 깨져도 이 파일은
    초록이다(2026-10-01 리뷰). 인자 이름과 종류(위치 · 키워드 전용)를 실물과 대조한다."""

    def test_the_stub_mirrors_the_real_signature(self):
        import ast
        import inspect
        import re

        from _lib import review_guard as rg

        m = re.search(r"def evaluate_review\((.*?)\):", _REVIEW_STUB)
        self.assertIsNotNone(m)
        args = ast.parse(f"def f({m.group(1)}): pass").body[0].args
        stub = [a.arg for a in args.args] + ["*"] + [a.arg for a in args.kwonlyargs]
        params = list(inspect.signature(rg.evaluate_review).parameters.values())
        real = ([p.name for p in params if p.kind is p.POSITIONAL_OR_KEYWORD] + ["*"]
                + [p.name for p in params if p.kind is p.KEYWORD_ONLY])
        self.assertEqual(stub, real)


if __name__ == "__main__":
    unittest.main()
