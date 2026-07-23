"""Differential tests for the push guard's blind-scan + allowlist design.

The guard detects `git push` in two halves (SoR:
plan/in-progress/harness-push-guard-subcommand-detection.md):

  1. a BLIND regex over raw text — ignorant on purpose, so it has no false
     negatives that a shell-aware parser would introduce;
  2. an ENUMERATED allowlist that releases only shapes provably inert TEXT
     (a commit message, a grep pattern).

A 2026-07-17 rewrite that replaced (1) with shlex-based subcommand detection was
REVERTED: /ai-review found a new false-NEGATIVE class every round (`git $'push'`,
`git $"push"`, backticks, `bash -c "… && git push"`). The shell's
text-transforming features are unbounded; the blind regex's false POSITIVES are
finite. This suite keeps that trade from being made again:

  * `test_blind_pattern_is_frozen` pins half (1) byte-for-byte;
  * `test_no_new_false_negatives` re-runs the ORIGINAL regex (frozen below as
    `_LEGACY_PATTERN`) over the whole corpus and fails if the guard releases
    anything without an enumerated, justified reason.

CORPUS is the single source of truth: a third field holds the release reason
(None = must stay blocked), so a command literal is never typed twice.

Every command the 3 review rounds surfaced is here as a regression floor, plus
the three CRITICALs found in review/code/2026/07/23/14_23_23 — all of which were
defects in the allowlist half, reproduced before being fixed:
  C1 single-quote escape confusion redacted a REAL `&& git push` (gate bypass);
  C2 an ambiguous alternation backtracked exponentially (hook hang);
  C3 blanking a message unmasked a live `$(git push …)` the blind pass never
     matched, flipping a block into a silent pass.
"""

from __future__ import annotations

import re
import subprocess
import sys
import time
import unittest

import _harness  # noqa: F401  — side effect: harness path setup; HOOKS_DIR used below

_HOOK_PATH = _harness.HOOKS_DIR / "guard_review_before_push.py"
guard = _harness.load_module_by_path("guard_review_before_push", _HOOK_PATH)

# The pre-allowlist regex, frozen. This is the differential BASELINE: the new
# guard must block everything this blocks, minus the enumerated releases.
_LEGACY_PATTERN = (
    r"(?:^|&&|;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\b[^&;|]*\bpush\b"
)
_LEGACY = re.compile(_LEGACY_PATTERN)


def legacy_is_push(command: str) -> bool:
    """The guard's behaviour BEFORE the allowlist existed."""
    if not command or "push" not in command:
        return False
    return bool(_LEGACY.search(command))


# --- corpus -----------------------------------------------------------------
# (command, note, release_reason). release_reason=None means "must stay blocked";
# a string is the argument for why the released text can never execute.
CORPUS: list[tuple[str, str, str | None]] = [
    # ---- round 1: spellings a subcommand parser missed -------------------
    ("git add -A\ngit push", "newline as the only separator", None),
    ("git --attr-source main push", "global option before the subcommand", None),
    # ---- round 2: the region really executes -----------------------------
    ('git commit -m "$(git push)"', "command substitution in the message", None),
    ('git commit -m "`git push`"', "backtick in the message", None),
    ('bash -c "cd /tmp && git push"', "&& inside a -c script", None),
    # ---- round 3: shell quoting forms ------------------------------------
    ("git $'push'", "ANSI-C quoting", None),
    ('git $"push"', "locale-translation quoting", None),
    ("git 'pu''sh' --force", "quote splitting (legacy misses it too)", None),
    ("GIT push", "uppercase (legacy misses it too)", None),
    ("git push\x00 extra", "NUL contamination", None),
    ('eval "git push"', "eval (legacy misses it too)", None),
    # ---- plain true positives --------------------------------------------
    ("git push", "bare", None),
    ("git push origin HEAD", "with args", None),
    ("git -C /tmp push", "-C", None),
    ("GIT_SSH=x git push", "env assignment prefix", None),
    ("git add -A && git push", "&& chain", None),
    ("git push --force-with-lease", "force variant", None),
    # ---- message/grep text ADJACENT to a real push -----------------------
    ('git commit -m "msg" && git push', "message then a real push", None),
    ('git commit -m "a" && git push -f', "message then a real force push", None),
    ('git commit -m "push" ; git push', "; then a real push", None),
    ("git commit -F - <<'EOF'\nmsg\nEOF\n&& git push", "heredoc then a real push", None),
    ('grep "x\\|git push" f && git push', "grep pattern then a real push", None),
    (r'echo "a\\" | git push', "escaped backslash then a REAL pipe", None),
    # ---- release-rule abuse attempts -------------------------------------
    ("bash <<'EOF'\nfoo && git push\nEOF", "heredoc body that bash EXECUTES", None),
    (
        'echo "git commit -F -" | bash <<\'EOF\'\nfoo && git push\nEOF',
        "owner spoof: the idiom sits in an echo arg, bash owns the heredoc",
        None,
    ),
    ("git commit -F - <<EOF\nfoo && git push $(id)\nEOF",
     "unquoted delim + expansion", None),
    ('bash -c "git commit -m \\"x\\" && git push"',
     "escaped quotes inside -c", None),
    # ---- the three CRITICALs from review 2026/07/23 14_23_23 -------------
    (
        r"""git commit -m 'a\' && git push -- 'end'""",
        "C1: single-quoted value ending in a backslash. POSIX gives no escapes "
        "inside '…', so the message is just `a\\` and the `&& git push` RUNS. "
        "Treating \\' as an escape pair swallowed it — a full gate bypass.",
        None,
    ),
    (
        'git commit -m "fix: retry push notification bug" '
        '&& echo "log: $(git push origin main)"',
        "C3: legacy blocked this only by accidentally matching `push` in the "
        "message; blanking the message dropped that match while $(git push …) "
        "still executes.",
        None,
    ),
    # ---- tag variant of the heredoc rule (review WARNING #3) -------------
    ("git tag -a v1 -F - <<'EOF'\nrelease notes mention push\nEOF",
     "tag heredoc — the rule accepts commit|tag", "same owner rule as commit"),
    (
        'echo "git tag -F -" | bash <<\'EOF\'\nfoo && git push\nEOF',
        "tag-flavoured owner spoof must be refused just like the commit one",
        None,
    ),
    # ---- known false positive kept ON PURPOSE ----------------------------
    ("git log --grep=push", "flag VALUE, not a message region", None),
    # ---- not a push at all -----------------------------------------------
    ("git status", "unrelated git", None),
    ("ls -la", "unrelated", None),
    # ---- the releases ----------------------------------------------------
    ('git commit -m "add push notification"', "FP: -m message",
     "-m value is message text with no $( ` ${ — the shell expands nothing"),
    ('git commit -m "fix: do not push twice"', "FP: -m message", "inert -m value"),
    ("git commit -m 'add push notification'", "FP: single-quoted -m message",
     "single-quoted body ends at the first quote; nothing inside can execute"),
    ('git commit -m "a" -m "b && git push"', "FP: repeated -m",
     "both values are message text; the && lives inside the quoted value"),
    ('git -c core.hooksPath=/dev/null commit -m "push"', "FP: -c then -m",
     "-c is a git config pair, -m value is inert message text"),
    ("git commit -F - <<'EOF'\nadd push flow\nEOF", "FP: commit heredoc",
     "heredoc owned by `git commit -F -`; quoted delimiter, inert body"),
    ("git commit -F - <<'EOF'\nfoo && git push\nEOF", "FP: && inside message body",
     "same owner; the && is message text git stores, not a shell operator"),
    (
        "git commit -q -F - <<'EOF'\nfeat: push guard\n\nbody mentions push\nEOF",
        "FP: the real-world commit idiom",
        "same owner; the idiom this repo actually uses for commit messages",
    ),
    ("git commit -F - <<'EOF'\nEOF\ngit push", "empty heredoc body, real push after",
     None),
    ("GIT_EDITOR=vim git commit -F - <<'EOF'\nadd push flow\nEOF",
     "env-assignment prefix before the heredoc owner",
     "the owner probe allows leading VAR=value assignments, same as the blind "
     "pass; the body is still an inert commit message"),
    ('grep -n "foo\\|git push\\|bar" f', "FP: escaped pipe in a grep pattern",
     r"the segment start is `\|`, a backslash-escaped literal pipe — never a "
     r"shell pipe operator, in or out of quotes"),
]

RELEASED = {cmd: reason for cmd, _n, reason in CORPUS if reason is not None}


class BlindPassFrozenTest(unittest.TestCase):
    """Half (1) must stay byte-identical — it is the false-negative floor."""

    def test_blind_pattern_is_frozen(self):
        self.assertEqual(
            guard._GIT_PUSH.pattern, _LEGACY_PATTERN,
            "the blind first pass was edited. It is deliberately ignorant and "
            "carries the no-false-negative guarantee; releases belong in "
            "_redact_inert_text(), not here. See the plan before changing it.",
        )


class DifferentialTest(unittest.TestCase):
    """legacy(c) ⇒ new(c), except for enumerated, justified releases."""

    def test_no_new_false_negatives(self):
        for command, note, reason in CORPUS:
            with self.subTest(note=note, command=command):
                if legacy_is_push(command) and not guard._is_git_push(command):
                    self.assertIsNotNone(
                        reason,
                        f"{note}: the guard stopped blocking a command the blind "
                        "scan catches, and it carries no release reason. This is "
                        "a FALSE NEGATIVE — unreviewed code could be pushed.",
                    )

    def test_no_new_blocks(self):
        """The allowlist may only ever RELEASE; it must never add blocking."""
        for command, note, _reason in CORPUS:
            with self.subTest(note=note, command=command):
                if guard._is_git_push(command):
                    self.assertTrue(
                        legacy_is_push(command),
                        f"{note}: blocked by the new guard but not by the blind "
                        "scan — the allowlist layer must only subtract.",
                    )

    def test_every_enumerated_release_actually_releases(self):
        """A stale release reason (fixed upstream, or never reproducing) would
        silently weaken the differential test into a tautology."""
        for command, reason in RELEASED.items():
            with self.subTest(command=command):
                self.assertTrue(
                    legacy_is_push(command),
                    "this entry is not a legacy block, so it proves nothing",
                )
                self.assertFalse(
                    guard._is_git_push(command),
                    f"expected release ({reason}) but the guard still blocks",
                )

    def test_every_non_release_entry_stays_blocked(self):
        """The other direction: an entry with no reason must really be blocked
        whenever the blind scan catches it."""
        for command, note, reason in CORPUS:
            if reason is not None or not legacy_is_push(command):
                continue
            with self.subTest(note=note, command=command):
                self.assertTrue(guard._is_git_push(command), note)


class ReleaseRefusedTest(unittest.TestCase):
    """The release rules must refuse anything the shell could actually run."""

    def _still_blocked(self, command, why):
        self.assertTrue(legacy_is_push(command), "precondition: legacy blocks it")
        self.assertTrue(guard._is_git_push(command), why)

    def test_command_substitution_in_message_is_not_released(self):
        self._still_blocked(
            'git commit -m "$(git push)"',
            "$(...) in a message really runs — round-2 regression",
        )

    def test_backtick_in_message_is_not_released(self):
        self._still_blocked(
            'git commit -m "`git push`"', "backticks in a message really run"
        )

    def test_expansion_in_heredoc_body_is_not_released(self):
        self._still_blocked(
            "git commit -F - <<EOF\nfoo && git push $(id)\nEOF",
            "unquoted delimiter means the shell expands the body",
        )

    def test_script_heredoc_body_is_not_released(self):
        self._still_blocked(
            "bash <<'EOF'\nfoo && git push\nEOF",
            "bash EXECUTES this body — it is not message text",
        )

    def test_heredoc_owner_spoof_is_not_released(self):
        self._still_blocked(
            'echo "git commit -F -" | bash <<\'EOF\'\nfoo && git push\nEOF',
            "the heredoc's owning segment is `bash`, not `git commit -F -`",
        )

    def test_escaped_quotes_inside_dash_c_are_not_released(self):
        self._still_blocked(
            'bash -c "git commit -m \\"x\\" && git push"',
            "the -m value is escape-quoted, so the message rule must bail out "
            "rather than blank across the real `&& git push`",
        )

    def test_real_pipe_after_escaped_backslash_still_separates(self):
        self._still_blocked(
            r'echo "a\\" | git push',
            r"`\\` is an escaped backslash, so the following | IS a pipe operator",
        )

    def test_single_quoted_trailing_backslash_does_not_swallow_a_real_push(self):
        """CRITICAL #1 (review 2026/07/23 14_23_23), reproduced then fixed.

        POSIX shell does no escape processing inside '…' — `-m 'a\\'` is the
        message `a\\` and the following `&& git push` executes. Applying
        double-quote escape rules made the body run on to the NEXT quote,
        blanking the real push out of the command entirely.
        """
        self._still_blocked(
            r"""git commit -m 'a\' && git push -- 'end'""",
            "the single-quoted body ends at its own closing quote; the "
            "`&& git push` after it must survive redaction",
        )

    def test_message_blanking_does_not_unmask_a_live_expansion(self):
        """CRITICAL #3: blanking an inert message must not turn a block into a
        pass when a live `$(git push …)` sits elsewhere in the command."""
        self._still_blocked(
            'git commit -m "fix: retry push notification bug" '
            '&& echo "log: $(git push origin main)"',
            "any shell expansion anywhere withholds the release",
        )


class BacktrackingTest(unittest.TestCase):
    """CRITICAL #2: the message regex must stay linear.

    This hook is a PreToolUse gate on EVERY Bash call, so a pathological input
    does not merely slow a test down — it freezes the session (or trips the
    harness timeout into a fail-open). The pre-fix pattern's two alternatives
    both matched a backslash; with no closing quote the engine explored them
    exponentially (measured: 40 backslashes ≈ 8s, 50 ≈ minutes).

    Run in a SUBPROCESS with a hard timeout rather than timing an in-process
    call: catastrophic backtracking happens inside a C-level `re` call, which
    neither returns nor honours a signal, so an in-process timing assertion
    cannot fail — it hangs the whole suite. (Confirmed by running the pre-fix
    regex as a mutant: the run had to be killed at 2 minutes.)
    """

    _TIMEOUT = 10.0

    def _run_guard_out_of_process(self, command: str):
        script = (
            "import importlib.util,sys\n"
            f"spec=importlib.util.spec_from_file_location('g',{str(_HOOK_PATH)!r})\n"
            "m=importlib.util.module_from_spec(spec);sys.modules['g']=m\n"
            "spec.loader.exec_module(m)\n"
            "import sys;m._is_git_push(sys.stdin.read())\n"
        )
        return subprocess.run(
            [sys.executable, "-c", script], input=command,
            capture_output=True, text=True, timeout=self._TIMEOUT,
        )

    def _assert_finishes(self, command, label, remedy):
        start = time.monotonic()
        try:
            self._run_guard_out_of_process(command)
        except subprocess.TimeoutExpired:
            self.fail(f"{label} did not finish in {self._TIMEOUT:g}s — {remedy}")
        elapsed = time.monotonic() - start
        self.assertLess(elapsed, self._TIMEOUT, f"{label} took {elapsed:.2f}s")

    def test_unterminated_quote_with_long_backslash_run_is_fast(self):
        for count in (60, 200, 800):
            with self.subTest(backslashes=count):
                self._assert_finishes(
                    'git commit -m "' + "\\" * count + " push",
                    f"{count} backslashes in an unterminated -m value",
                    "the message regex is backtracking again. Keep its "
                    "alternatives disjoint (one branch consumes `\\\\.`, the "
                    "other must EXCLUDE backslash).",
                )

    # Sized from a measured old-vs-new comparison: with the pre-fix overlapping
    # greedy pattern this input takes ~38s, with the split probes ~0.014s. Smaller
    # inputs are NOT decisive — 16k repeats sat at 10.3s, right on the timeout, and
    # an earlier 8k version of this test passed against the broken code (i.e. it
    # was vacuous; the mutation run is what exposed that).
    _QUADRATIC_REPEATS = 30_000

    def test_repeated_subcommand_word_without_stdin_flag_is_fast(self):
        """The heredoc-OWNER probe must stay linear too.

        One regex with two greedy `[^\\n]*` runs around `commit|tag` went
        quadratic when the word repeated and `-F -` never appeared (input ×2 →
        time ×4). `BacktrackingTest` originally guarded only `_MESSAGE_ARG`, so
        review found this path, not the tests.
        """
        count = self._QUADRATIC_REPEATS
        self._assert_finishes(
            "git " + "commit " * count + "push <<'EOF'\nx\nEOF",
            f"{count} repeats of `commit` with no -F -",
            "the heredoc-owner probe is backtracking. Keep its checks as "
            "separate single-pass scans, never one pattern with two greedy "
            "runs around the subcommand word.",
        )


class BlankSpansTest(unittest.TestCase):
    """`_blank_spans` rebuilds the command once instead of copying per span.

    No timing gate here, deliberately: that quadratic is O(n·k) *memcpy*, and at
    any realistic command size (≤100KB, ≤1k spans) it costs tens of milliseconds
    — a threshold test would either be vacuous or need an absurd input. What is
    worth pinning is the contract the single-pass rebuild has to keep, because
    redaction offsets are computed against the pre-blank string.
    """

    def test_length_is_preserved(self):
        text = "abcdefghij"
        self.assertEqual(len(guard._blank_spans(text, [(2, 5), (7, 9)])), len(text))

    def test_every_span_is_blanked_and_the_rest_survives(self):
        self.assertEqual(
            guard._blank_spans("abcdefghij", [(2, 5), (7, 9)]),
            "ab   fg  j",
        )

    def test_unsorted_spans_are_handled(self):
        self.assertEqual(
            guard._blank_spans("abcdefghij", [(7, 9), (2, 5)]),
            "ab   fg  j",
        )

    def test_overlapping_spans_do_not_corrupt_the_rebuild(self):
        out = guard._blank_spans("abcdefghij", [(2, 6), (4, 8)])
        self.assertEqual(len(out), 10)
        self.assertEqual(out[:2], "ab")
        self.assertEqual(out[2:6], "    ")

    def test_no_spans_returns_the_input(self):
        self.assertEqual(guard._blank_spans("abc", []), "abc")


class ReleaseTest(unittest.TestCase):
    """The false positives this change exists to remove."""

    def _released(self, command):
        self.assertTrue(legacy_is_push(command), "precondition: legacy blocks it")
        self.assertFalse(guard._is_git_push(command))

    def test_commit_message_word_push_is_released(self):
        self._released('git commit -m "add push notification"')

    def test_single_quoted_commit_message_is_released(self):
        self._released("git commit -m 'add push notification'")

    def test_commit_heredoc_body_is_released(self):
        self._released("git commit -F - <<'EOF'\nadd push flow\nEOF")

    def test_tag_heredoc_body_is_released(self):
        self._released("git tag -a v1 -F - <<'EOF'\nrelease notes mention push\nEOF")

    def test_repo_commit_idiom_is_released(self):
        self._released(
            "git commit -q -F - <<'EOF'\nfeat: push guard\n\nbody mentions push\nEOF"
        )

    def test_empty_heredoc_body_terminates_and_keeps_the_real_push(self):
        """A zero-length heredoc body must not make the scanner re-examine the
        same opener forever (the `pos = max(body_end, m.end())` guard), and the
        real push after it must still be caught."""
        command = "git commit -F - <<'EOF'\nEOF\ngit push"
        start = time.monotonic()
        blocked = guard._is_git_push(command)
        self.assertLess(time.monotonic() - start, 1.0,
                        "empty heredoc body sent the scanner into a loop")
        self.assertTrue(blocked, "the trailing real push must still block")

    def test_grep_pattern_with_escaped_pipe_is_released(self):
        self._released('grep -n "foo\\|git push\\|bar" f')

    def test_message_followed_by_a_real_push_still_blocks(self):
        """The release must be surgical: blanking the message must not swallow a
        real push sitting next to it."""
        self.assertTrue(guard._is_git_push('git commit -m "add push" && git push'))


class KnownRemainingFalsePositiveTest(unittest.TestCase):
    """Pinned so the gap is visible instead of being rediscovered as a surprise."""

    def test_flag_value_false_positive_is_still_blocked(self):
        """`git log --grep=push` is still (wrongly) treated as a push.

        Releasing it needs the git SUBCOMMAND — exactly the parser the plan
        rejected — so it is out of scope here. If a future change releases it,
        this test should be updated deliberately, with its own safety argument.
        """
        self.assertTrue(guard._is_git_push("git log --grep=push"))

    def test_message_beside_any_expansion_is_conservatively_blocked(self):
        """Cost of the CRITICAL #3 fix, pinned honestly: a perfectly innocent
        commit message is NOT released when the command also contains any
        expansion. False positive, i.e. the safe direction."""
        self.assertTrue(
            guard._is_git_push('git commit -m "add push" && echo "$(date)"')
        )

    def test_unrecognised_message_flag_spellings_stay_blocked(self):
        """The message rule only knows `-m` / `--message=` / `-F`. Other
        spellings are not released — conservative, so a false POSITIVE, but
        pinned here so the gap is discoverable rather than surprising."""
        for command in (
            'git commit -am "add push notification"',   # -m fused onto -a
            'git commit --message "add push notification"',  # space, not =
        ):
            with self.subTest(command=command):
                self.assertTrue(legacy_is_push(command), "precondition")
                self.assertTrue(guard._is_git_push(command))


if __name__ == "__main__":
    unittest.main()
