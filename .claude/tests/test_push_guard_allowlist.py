"""Differential tests for the push guard's blind-scan + allowlist design.

The guard detects `git push` in two halves (SoR:
plan/complete/harness-push-guard-subcommand-detection.md):

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
    anything without an enumerated, justified reason;
  * `GeneratedFloorTest` asks the same question of GENERATED inputs. Both
    checks above only ever see commands somebody thought to write down, and two
    consecutive fixes narrowed the blind pass anyway because the regressing
    shape (a value that opens a quote and never closes it) was in nobody's
    head. A curated corpus proves what we remembered; generation proves the
    invariant.

CORPUS is the single source of truth for the curated half: a third field holds
the release reason (None = must stay blocked), so a command literal is never
typed twice.

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

# The pre-allowlist regex, frozen. This is the FALSE-NEGATIVE FLOOR: whatever
# this caught must still be caught, minus the enumerated releases. It is history
# and never changes — widening the blind pass (as §J did) can only add to what
# it catches, so the floor stays valid.
_LEGACY_PATTERN = (
    r"(?:^|&&|;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\b[^&;|]*\bpush\b"
)
_LEGACY = re.compile(_LEGACY_PATTERN)

# Floor for the differential tests' non-vacuity guards. The corpus holds
# dozens of entries; if fewer than this many take part, the corpus or a
# baseline stopped matching and the comparison proves nothing.
_MIN_CORPUS_COVERAGE = 10

# The blind first pass as it stands NOW. Pinned separately from the floor above
# because the two answer different questions, and conflating them is what made
# §J unfixable-in-place: one test demanded the pattern never change, while the
# defect WAS the pattern.
#
#   _LEGACY_PATTERN — "did we stop catching something we used to?" (regression)
#   _BLIND_PATTERN  — "did the allowlist layer start blocking on its own?"
#                     (the allowlist may only ever SUBTRACT from this)
#
# §J widened the env-prefix group so a quoted value with spaces
# (`GIT_SSH_COMMAND="ssh -i ~/.key" git push`) no longer slips past the whole
# gate. Same three disjoint alternatives `guard_default_branch_bash._MUTATING`
# already used, kept identical on purpose.
_BLIND_PATTERN = (
    r"(?:^|&&|;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|\"(?:\\.|[^\"\\])*\"|\S+)\s+)*"
    r"git\b[^&;|]*\bpush\b"
)
_BLIND = re.compile(_BLIND_PATTERN)


def legacy_is_push(command: str) -> bool:
    """The guard's behaviour BEFORE the allowlist existed."""
    if not command or "push" not in command:
        return False
    return bool(_LEGACY.search(command))


def blind_is_push(command: str) -> bool:
    """The blind first pass alone, without the allowlist releases."""
    if not command or "push" not in command:
        return False
    return bool(_BLIND.search(command))


# --- corpus -----------------------------------------------------------------
# (command, note, release_reason). release_reason=None means "must stay blocked";
# a string is the argument for why the released text can never execute.
CORPUS: list[tuple[str, str, str | None]] = [
    # ---- §J: quoted env prefix hid the push from the blind pass ----------
    # Not "spellings a parser missed" — the BLIND pass itself missed these, so
    # the gate never ran at all. `legacy_is_push` returns False for every one,
    # which is why they carry no release reason: they must block now.
    ('GIT_SSH_COMMAND="ssh -i ~/.key" git push origin main',
     "quoted env value with spaces (double)", None),
    ("GIT_SSH_COMMAND='ssh -i ~/.key' git push origin main",
     "quoted env value with spaces (single)", None),
    ('GIT_AUTHOR_NAME="John Doe" git push --force origin main',
     "quoted env value before a force push", None),
    ('GIT_SSH_COMMAND="ssh -i k" GIT_AUTHOR_NAME="A B" git push',
     "two quoted env values in a row", None),
    ('cd /tmp && GIT_SSH_COMMAND="ssh -i k" git push',
     "quoted env prefix after a chain separator", None),
    ('VAR="a && b" git push',
     "separator inside the quoted env value", None),
    # An escaped `"` inside the value: the first fix used `"[^"]*"`, which ends
    # at the escaped quote and loses the push all over again. The escape-aware
    # body was already in this very file (`_MESSAGE_ARG`) and went unreused.
    (r'GIT_AUTHOR_NAME="A \\"B\\" C" git push',
     "escaped double quote inside the env value", None),
    (r'GIT_SSH_COMMAND="ssh -i \\"file with space\\"" git push origin main',
     "escaped quotes around a spaced path", None),
    (r'VAR="a\\\\" git push',
     "value ending in an escaped backslash", None),
    ('VAR="" git push', "empty quoted value", None),
    ("""A='say "hi"' git push""", "double quotes inside a single-quoted value", None),
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
            guard._GIT_PUSH.pattern, _BLIND_PATTERN,
            "the blind first pass was edited. It is deliberately ignorant and "
            "carries the no-false-negative guarantee; releases belong in "
            "_redact_inert_text(), not here. See the plan before changing it.",
        )

    def test_the_pin_targets_the_post_fix_pattern(self):
        """Guards the pin itself: if `_BLIND_PATTERN` were ever re-synced to the
        pre-§J text, the pin above would happily freeze the bypass back in."""
        self.assertNotEqual(
            _BLIND_PATTERN, _LEGACY_PATTERN,
            "the pin was reset to the legacy pattern — that is the §J bypass",
        )
        self.assertIn(
            "'[^']*'", _BLIND_PATTERN,
            "the pinned pattern lost the single-quoted env-value alternative",
        )


class DifferentialTest(unittest.TestCase):
    """legacy(c) ⇒ new(c), except for enumerated, justified releases."""

    def test_no_new_false_negatives(self):
        compared = 0
        for command, note, reason in CORPUS:
            with self.subTest(note=note, command=command):
                if legacy_is_push(command):
                    compared += 1
                if legacy_is_push(command) and not guard._is_git_push(command):
                    self.assertIsNotNone(
                        reason,
                        f"{note}: the guard stopped blocking a command the blind "
                        "scan catches, and it carries no release reason. This is "
                        "a FALSE NEGATIVE — unreviewed code could be pushed.",
                    )
        self.assertGreater(
            compared, _MIN_CORPUS_COVERAGE,
            "the differential compared almost nothing — the corpus or the legacy "
            "baseline stopped matching, which makes this test vacuous",
        )

    def test_no_new_blocks(self):
        """The allowlist may only ever RELEASE; it must never add blocking."""
        blocked = 0
        for command, note, _reason in CORPUS:
            with self.subTest(note=note, command=command):
                if guard._is_git_push(command):
                    blocked += 1
                    self.assertTrue(
                        blind_is_push(command),
                        f"{note}: blocked by the new guard but not by the blind "
                        "scan — the allowlist layer must only subtract.",
                    )
        self.assertGreater(
            blocked, _MIN_CORPUS_COVERAGE,
            "the guard blocked almost nothing in the corpus — this test would "
            "pass no matter what the allowlist did",
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


class GeneratedFloorTest(unittest.TestCase):
    """Drive the false-negative floor with GENERATED inputs, not a curated list.

    `_LEGACY_PATTERN` was already the right floor and `test_no_new_false_negatives`
    already compared against it — yet two consecutive fixes narrowed the blind
    pass anyway, because that comparison only ever sees commands somebody thought
    to add to CORPUS. The regressing shape (a value that opens a quote and never
    closes it) was in nobody's head, so the floor never got to judge it.

    A curated corpus proves what we remembered; this proves the invariant. The
    axes are the two that actually interacted in both regressions: the SHAPE of
    the env value, and how many assignments precede the command.
    """

    _VALUES = [
        "x", "'x'", '"x"', "'x", '"x', "x'", 'x"', "'x y'", '"x y"', "''", '""',
        "'", '"', "a'b", 'a"b', "x=y", "-i", "~/.key", "'x y", '"x y',
        r'"a\"b"', r'"a\"b', r'"a\\"', "a b", "''''", '"""',
        # Quoted piece glued to an unquoted one — §K, still undetected by both
        # patterns. Present so a future §K fix is measured on the same axes.
        '"a b"c', "'a b'c", 'x"a b"',
    ]
    _TEMPLATES = [
        "A={v} git push",
        "A=1 B={v} git push",
        "A={v} B=z git push",
        "A={v} B={v} git push",
        "cmd && A={v} git push",
        "; A={v} git push",
        "cmd | A={v} git push",
    ]

    def _cases(self):
        return [t.format(v=v) for v in self._VALUES for t in self._TEMPLATES]

    def test_no_duplicate_values(self):
        """A duplicate silently shrinks the space while the count keeps claiming
        the larger number."""
        dupes = sorted({v for v in self._VALUES if self._VALUES.count(v) > 1})
        self.assertEqual(dupes, [], "duplicate values in the generated set")

    def test_blind_pass_never_narrows_below_the_floor(self):
        lost = [c for c in self._cases()
                if legacy_is_push(c) and not blind_is_push(c)]
        self.assertEqual(
            lost, [],
            "the blind pass stopped catching commands the pre-allowlist regex "
            "caught — a FALSE NEGATIVE in the half whose whole justification is "
            "that it has none",
        )

    def test_the_generated_set_actually_exercises_the_floor(self):
        """Without this, an edit that made `legacy_is_push` stop matching would
        turn the test above into a tautology."""
        compared = sum(1 for c in self._cases() if legacy_is_push(c))
        self.assertGreater(compared, _MIN_CORPUS_COVERAGE, "floor matched almost nothing")

    def test_quoted_values_are_a_strict_gain(self):
        """The mirror failure: a 'superset' that widened nothing would satisfy
        the floor while leaving quoted values unrecognised."""
        gained = [c for c in self._cases()
                  if blind_is_push(c) and not legacy_is_push(c)]
        self.assertTrue(gained, "quoted env values are not being recognised")


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
    # Sized from a measured old-vs-new comparison: with the pre-fix overlapping
    # greedy pattern this input takes ~38s, with the split probes ~0.014s. Smaller
    # inputs are NOT decisive — 16k repeats sat at 10.3s, right on the timeout, and
    # an earlier 8k version of this test passed against the broken code (i.e. it
    # was vacuous; the mutation run is what exposed that).
    _QUADRATIC_REPEATS = 30_000
    # Ditto for the heredoc-opener scan: 24k openers took ~29s before the window
    # bounds, ~0.02s after.
    _HEREDOC_OPENERS = 24_000

    def _run_guard_out_of_process(self, command: str, func: str = "_is_git_push"):
        script = (
            "import importlib.util,sys\n"
            f"spec=importlib.util.spec_from_file_location('g',{str(_HOOK_PATH)!r})\n"
            "m=importlib.util.module_from_spec(spec);sys.modules['g']=m\n"
            "spec.loader.exec_module(m)\n"
            f"m.{func}(sys.stdin.read())\n"
        )
        return subprocess.run(
            [sys.executable, "-c", script], input=command,
            capture_output=True, text=True, timeout=self._TIMEOUT,
        )

    # §J widened the env-prefix group, which is the same kind of hand-edited
    # alternation that caused CRITICAL #2 above — so it gets the same pin. Every
    # input below contains "push" ON PURPOSE: `_is_git_push` short-circuits when
    # it does not, and a first draft of these numbers measured that early return
    # instead of the regex (0.00ms across the board — vacuous).
    #
    # Measured on the shipped pattern: 400KB of `VAR="a b" ` + a failing tail is
    # ~15ms, and 4x the input costs ~4x the time (linear). The ambiguous variant
    # `"(?:\\.|[^"])*"` — where `[^"]` also matches a backslash, so the two
    # alternatives overlap — is what this pins against.
    _ENV_PREFIX_REPEATS = 40_000
    _ENV_BACKSLASHES = 40_000

    def _assert_finishes(self, command, label, remedy, func="_is_git_push"):
        start = time.monotonic()
        try:
            self._run_guard_out_of_process(command, func)
        except subprocess.TimeoutExpired:
            self.fail(f"{label} did not finish in {self._TIMEOUT:g}s — {remedy}")
        elapsed = time.monotonic() - start
        self.assertLess(elapsed, self._TIMEOUT, f"{label} took {elapsed:.2f}s")

    def test_many_heredoc_openers_on_one_line_are_fast(self):
        """The heredoc SCAN itself must be linear, independent of the size cap.

        With many `<<` markers on one line whose ownership check keeps failing,
        two separate accumulators re-walked the prefix per marker — the slice fed
        to the ownership check, and the backward `rfind` for the line start. That
        was O(h²) (12k markers took 11.6s). Driven through `_commit_heredoc_spans`
        directly because `_is_git_push` now refuses oversized input before it ever
        reaches the scan, so the cap would mask this regression.
        """
        count = self._HEREDOC_OPENERS
        self._assert_finishes(
            "echo " + " ".join(f"<<TOK{i}" for i in range(count)),
            f"{count} heredoc openers on one line",
            "the heredoc scan is re-walking the prefix per marker. Bound BOTH "
            "the ownership window and the backward line-start search by "
            "_OWNER_WINDOW.",
            func="_commit_heredoc_spans",
        )

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


    def test_env_prefix_alternation_stays_linear(self):
        """§J's env-value alternation must not backtrack.

        Its two inner branches are disjoint on the first character (`\\` vs
        not), which is exactly why the shipped form is linear and why the
        overlapping variant is not.
        """
        self._assert_finishes(
            'VAR="a b" ' * self._ENV_PREFIX_REPEATS + "git push",
            "a long run of quoted env assignments before a real push",
            "the env-value alternation started backtracking — keep its two "
            "inner branches disjoint on the first character",
        )

    def test_env_prefix_with_failing_tail_stays_linear(self):
        """The expensive shape: every repetition matches, then the tail fails,
        so a backtracking engine re-partitions the whole run."""
        self._assert_finishes(
            'VAR="a b" ' * self._ENV_PREFIX_REPEATS + "x push",
            "quoted env assignments followed by a non-git tail",
            "see test_env_prefix_alternation_stays_linear",
        )

    def test_unterminated_quoted_env_value_stays_linear(self):
        """No closing quote — the case that made `_MESSAGE_ARG` explode."""
        self._assert_finishes(
            'VAR="' + "\\" * self._ENV_BACKSLASHES + " push",
            "an unterminated quoted env value full of backslashes",
            "see test_env_prefix_alternation_stays_linear",
        )

class InputSizeCapTest(unittest.TestCase):
    """Redaction is skipped entirely above `_MAX_REDACTION_INPUT`.

    Three review rounds each found a different super-linear corner in this
    hand-written scanning code. Rather than betting that the fourth does not
    exist, the cap bounds the whole class: past it the guard blocks without
    scanning, which is the safe direction and exactly the pre-allowlist
    behaviour.
    """

    def test_oversized_command_is_blocked_without_redaction(self):
        padding = "x" * guard._MAX_REDACTION_INPUT
        command = f'git commit -m "add push notification" # {padding}'
        self.assertGreater(len(command), guard._MAX_REDACTION_INPUT)
        self.assertTrue(
            guard._is_git_push(command),
            "an oversized command must block rather than be released",
        )

    def test_same_command_under_the_cap_is_released(self):
        """Pins that the cap — not some other rule — is what blocks above."""
        command = 'git commit -m "add push notification"'
        self.assertLess(len(command), guard._MAX_REDACTION_INPUT)
        self.assertFalse(guard._is_git_push(command))

    def test_cap_leaves_room_for_realistic_commands(self):
        """A guard that fired on ordinary work would be a silent regression back
        to the false positives this change removes."""
        self.assertGreaterEqual(guard._MAX_REDACTION_INPUT, 8192)


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


class QuotedEnvPrefixTest(unittest.TestCase):
    """§J, fixed — was an UNSAFE-DIRECTION gap, now a regression floor.

    Until 2026-07-24 these commands were not detected as pushes at all, so
    `main()` returned 0 without running either gate and without even the
    fail-open banner: the review-before-push requirement silently did not apply.
    `GIT_SSH_COMMAND="ssh -i ~/.key" git push` is an ordinary way to push with a
    specific key, not a contrived string.

    Cause: `_GIT_PUSH`'s env-prefix group used `\\S+`, which ends at the space
    INSIDE a quoted value, so neither the group nor the following `git\\b`
    anchor matched. The fix is the same three disjoint alternatives
    `guard_default_branch_bash._MUTATING` already carried
    (`(?:'[^']*'|"[^"]*"|[^\\s'"]\\S*)`) — kept byte-identical between the two
    hooks on purpose.

    The previous class shape asserted the BUG and told the fixer to flip it;
    this is that flip. Kept as a class so the bypass cannot silently return.
    """

    def test_quoted_env_prefix_is_detected(self):
        for command in (
            'GIT_SSH_COMMAND="ssh -i ~/.key" git push origin main',
            "GIT_SSH_COMMAND='ssh -i ~/.key' git push origin main",
            'GIT_AUTHOR_NAME="John Doe" git push --force origin main',
            'GIT_SSH_COMMAND="ssh -i k" GIT_AUTHOR_NAME="A B" git push',
            'cd /tmp && GIT_SSH_COMMAND="ssh -i k" git push',
            'VAR="a && b" git push',
        ):
            with self.subTest(command=command):
                self.assertTrue(
                    guard._is_git_push(command),
                    "a quoted env prefix must not hide a push — this bypassed "
                    "the entire review gate before §J",
                )

    def test_unquoted_env_prefix_is_unaffected(self):
        """The boundary: only values containing a space are lost, so the fix has
        to widen the value, not the whole prefix rule."""
        for command in (
            "GIT_SSH_COMMAND=ssh git push origin main",
            "GIT_AUTHOR_NAME=John git push origin main",
            "git push origin main",
        ):
            with self.subTest(command=command):
                self.assertTrue(guard._is_git_push(command))


class ReleasePathNarrownessTest(unittest.TestCase):
    """`_SEGMENT_IS_GIT` still carries the old `=\\S+`, and that is left alone.

    §J widened the BLOCKING pattern. This one guards the opposite direction: it
    decides whether a heredoc body may be RELEASED as inert. A quoted env prefix
    makes it fail to match, so the heredoc is not released and the command stays
    blocked — the safe direction. Widening a release path is how a real push
    gets let through, so it needs its own justification, not this PR's.

    Measured rather than asserted, because "it fails safe" is exactly the kind of
    claim that turns out to be backwards.
    """

    def test_quoted_env_owner_is_not_released(self):
        command = (
            'GIT_AUTHOR_NAME="A B" git commit -F - <<\'EOF\'\n'
            "git push origin main\n"
            "EOF"
        )
        self.assertFalse(
            guard._SEGMENT_IS_GIT.match('GIT_AUTHOR_NAME="A B" git commit -F -'),
            "if this starts matching, the release path widened — re-justify it",
        )
        self.assertTrue(
            guard._is_git_push(command),
            "an unreleased heredoc must stay blocked (safe direction)",
        )

    def test_unquoted_env_owner_still_releases(self):
        """The boundary: the narrowness only costs the quoted form."""
        command = (
            "GIT_AUTHOR_NAME=A git commit -F - <<'EOF'\n"
            "git push origin main\n"
            "EOF"
        )
        self.assertFalse(
            guard._is_git_push(command),
            "an inert heredoc message owned by `git commit -F -` is released",
        )


class EnvValueSubpatternSharedTest(unittest.TestCase):
    """The env-value alternation is copied into three places; pin the promise.

    `guard_review_before_push._GIT_PUSH`,
    `guard_default_branch_bash._MUTATING` and `_BLIND_PATTERN` above all carry
    the same sub-pattern, and until now only a comment said "keep these
    identical". The §J review found the first fix (`"[^"]*"`) had to be applied
    to all three; a fourth round would have found whichever one was missed.
    """

    @staticmethod
    def _env_value_subpattern(pattern: str) -> str:
        """Text between the env-name group and the `\\s+)*` that closes it."""
        key = "[A-Za-z0-9_]*="
        start = pattern.index(key) + len(key)
        end = pattern.index(r"\s+)*", start)
        return pattern[start:end].replace('\\"', '"')

    def test_both_hooks_use_the_same_env_value_alternation(self):
        nudge = _harness.load_module_by_path(
            "guard_default_branch_bash",
            _harness.HOOKS_DIR / "guard_default_branch_bash.py",
        )
        push_sub = self._env_value_subpattern(guard._GIT_PUSH.pattern)
        nudge_sub = self._env_value_subpattern(nudge._MUTATING.pattern)
        self.assertTrue(push_sub, "extraction failed — this check would be vacuous")
        self.assertEqual(
            push_sub, nudge_sub,
            "the two hooks' env-value alternations drifted. A fix applied to one "
            "and not the other is exactly how §J's escaped-quote gap survived "
            "the first round.",
        )

    def test_the_alternation_is_escape_aware(self):
        sub = self._env_value_subpattern(guard._GIT_PUSH.pattern)
        self.assertIn(
            r'"(?:\\.|[^"\\])*"', sub,
            "the double-quoted alternative lost its escape-aware body — an "
            r'escaped \" inside the value hides the push again',
        )


class KnownFalseNegativeTest(unittest.TestCase):
    """§L — an env value whose closing quote is glued to more text.

    `A="a b"c git push` is a legal assignment (the value is `a bc`), but nothing
    matches it: the quoted branch stops at the closing quote and then demands
    whitespace, while `\\S+` cannot span the space inside the quotes. The prefix
    group collapses and the push goes undetected — the same silent gate bypass
    §J was, one step further along.

    PRE-EXISTING, not a §J regression, which the second test pins so nobody has
    to re-derive it.

    These assertions describe the BUG. Fixing §L means flipping them, exactly as
    §J's canary was flipped. Note why §L is harder: the natural fix lets a value
    be a SEQUENCE of quoted and unquoted pieces, and a repeated group whose
    alternatives can each match a single character is the catastrophic shape
    `BacktrackingTest` exists to catch. Measure before shipping it.
    """

    _CASES = (
        'A="a b"c git push',
        "A='a b'c git push",
        'GIT_SSH_COMMAND="ssh -i ~/.key"/bin/ssh git push',
    )

    def test_quoted_value_glued_to_more_text_hides_a_push(self):
        for command in self._CASES:
            with self.subTest(command=command):
                self.assertFalse(
                    guard._is_git_push(command),
                    "§L appears fixed — flip this class to assertTrue",
                )

    def test_the_gap_predates_the_j_fix(self):
        for command in self._CASES:
            with self.subTest(command=command):
                self.assertFalse(legacy_is_push(command))


if __name__ == "__main__":
    unittest.main()
