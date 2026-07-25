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
# gate; §L then made the VALUE a sequence of pieces so a quoted one glued to an
# unquoted one (`A="a b"c git push`) cannot hide it either; §M then added `\n` to
# the separator class so a push on its own line (`cd <wt>\ngit push`) — this
# repo's commonest form — is no longer invisible; §M(d) added the bash BACKGROUND
# operator `&` (`sleep 5 & git push` was undetected, predating §M); §M(e) excluded
# `\n` from the tail scan, which (a) had turned into a fresh O(n²). Same mutually
# exclusive alternatives `guard_default_branch_bash._MUTATING` carries, kept
# identical on purpose.
_BLIND_PATTERN = (
    r"(?:^|&&|[;|&\n])[^\S\n]*(?:"
    r"(?:[A-Za-z_][A-Za-z0-9_]*="
    r"(?:'[^']*'|\"(?:\\.|[^\"\\])*\"|'(?![^']*')|\"(?!(?:\\.|[^\"\\])*\")|[^\s'\"])*"
    r"[^\S\n]+)*"
    r"|(?:[A-Za-z_][A-Za-z0-9_]*=\S+[^\S\n]+)*"
    r")"
    r"git\b(?:[^&;|\n\\]|\\[^\n]|\\\n)*\bpush\b"
)
_BLIND = re.compile(_BLIND_PATTERN)


def legacy_is_push(command: str) -> bool:
    """The guard's behaviour BEFORE the allowlist existed."""
    if not command or "push" not in command:
        return False
    return bool(_LEGACY.search(command))


def blind_is_push(command: str) -> bool:
    """The blind first pass alone, without the allowlist releases.

    §O removed the pre-fold the hook briefly carried, so this mirror is once
    again a plain search — there is no preprocessing left to mirror.
    """
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
    # A LITERAL newline INSIDE a quoted env value. Ordinary shell (`bash -n` says
    # exit 0) and the push really runs. These exist as a corpus entry because the
    # §N split-then-match experiment BROKE them: `str.split("\n")` has no idea
    # the newline is inside quotes, so the value tears in half and the fragment
    # holding `git push` has no separator in front of it — undetected, i.e. a
    # gate bypass. The whole-command pattern handles them for free, because its
    # quoted alternatives absorb any character including a newline.
    # Do not "simplify" detection into a line-oriented scan; this is the case
    # that costs. SoR: plan/complete/harness-push-detection-split-then-match.md.
    ('A="line1\nline2" git push', "literal newline inside a double-quoted value", None),
    # Line continuation: the shell deletes `\`+newline and joins the lines, so
    # this runs a push. §M(e) lost it when the tail stopped crossing newlines —
    # a differential-floor violation (LEGACY catches it) that no test saw because
    # no corpus entry spelled a continuation.
    ("git \\\n  push origin main", "backslash line continuation before push", None),
    ("A='line1\nline2' git push", "literal newline inside a single-quoted value", None),
    ('GIT_SSH_COMMAND="ssh\nkey" git push origin main',
     "literal newline in a real env var's value", None),
    ('cd /x && A="a\nb" git push', "same, after a chain separator", None),
    # §M(a) side effect, ACCEPTED as over-blocking. A heredoc body that is not
    # owned by `git commit|tag -F -` is never released, and now that `\n` is a
    # separator its `git push` line looks like a fresh segment. The shell would
    # write it to a file, not run it — but the safe direction for a blind pass is
    # to block, and pinning it here keeps the behaviour visible instead of
    # surprising (this suite's stated philosophy).
    ("cat <<EOF > notes.md\ngit push\nEOF",
     "FP (accepted): push line inside a NON-commit heredoc body", None),
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

    # Shared with the nudge hook's `OldEnvPrefixSupersetTest` — see the comment
    # on the constant for why it is not duplicated per file.
    _VALUES = _harness.ENV_VALUE_SHAPES
    _TEMPLATES = [
        "A={v} git push",
        "A=1 B={v} git push",
        "A={v} B=z git push",
        "A={v} B={v} git push",
        "cmd && A={v} git push",
        "; A={v} git push",
        "cmd | A={v} git push",
        # §M: newline separator, NON-git preceding line. Omitting `\n` from the
        # separator axis is exactly how `cd\ngit push` slipped past both the
        # curated corpus and this floor. `test_the_newline_separator_axis_is_...`
        # pins it so a future edit cannot drop it silently.
        "cmd\nA={v} git push",
        # §M(d): the bash BACKGROUND operator. Its absence from this axis is why
        # `sleep 5 & git push` — a total gate skip — survived three separator
        # fixes without any generated input ever asking about it.
        "cmd & A={v} git push",
    ]

    def _cases(self):
        return [t.format(v=v) for v in self._VALUES for t in self._TEMPLATES]

    def test_no_duplicate_values(self):
        """A duplicate silently shrinks the space while the count keeps claiming
        the larger number."""
        dupes = sorted({v for v in self._VALUES if self._VALUES.count(v) > 1})
        self.assertEqual(dupes, [], "duplicate values in the generated set")

    def test_both_axes_are_actually_generated(self):
        """The multi-assignment axis is load-bearing, so pin it alongside the
        value shapes: the prefix group only collapses when it has to FAIL a
        repetition, so single-assignment cases test a strictly easier problem."""
        multi = [t for t in self._TEMPLATES if t.count("=") >= 2]
        single = [t for t in self._TEMPLATES if t.count("=") == 1]
        self.assertGreaterEqual(len(multi), 2, "multi-assignment axis was dropped")
        self.assertTrue(single, "single-assignment baseline was dropped")

    def test_the_newline_separator_axis_is_generated(self):
        """§M: the separator axis must include `\\n` with a NON-git preceding
        line. It was omitted originally (only `&&`, `;`, `|`), which is precisely
        how `cd\\ngit push` slipped past both the curated corpus and this floor.
        A `git`-prefixed preceding line would match by the `[^&;|]*` walk — the
        accident that hid the gap — so require the head to be non-git."""
        newline = [t for t in self._TEMPLATES if "\n" in t]
        self.assertTrue(newline, "the newline separator axis (§M) was dropped")
        for t in newline:
            head = t.split("\n", 1)[0].strip()
            self.assertFalse(
                head.startswith("git"),
                f"{t!r}: preceding line starts with git — that matches by "
                "accident, not by the newline separator the fix added",
            )

    def test_the_regression_shapes_are_still_generated(self):
        """Close the escape hatch: a failing superset test can be "fixed" by
        deleting the input that exposes it.

        These specific shapes are load-bearing history, not decoration — each
        one is a value form that actually caused a released regression. Removing
        one costs nothing today and hides the next recurrence, so name them.
        Guards the shared `_harness.ENV_VALUE_SHAPES` on behalf of both suites.
        """
        for shape, why in (
            ("'x", "unclosed single quote — the §J-follow-up regression"),
            ('"x', "unclosed double quote — same class"),
            (r'"a\"b"', "escaped quote inside the value — #1002's own first fix"),
            ('"a b"c', "quoted piece glued to more text — §L canary"),
            ('"x y"', "quoted value with a space — the original §J bypass"),
        ):
            with self.subTest(shape=shape):
                self.assertIn(shape, self._VALUES, why)

    # Separators that must be interchangeable. `&&` is the REFERENCE: it predates
    # every §M change and the legacy floor covers it, so whatever the guard does
    # for `cmd && <x>` is the settled answer for `cmd <sep> <x>`.
    _EQUIVALENT_SEPARATORS = ("\n", " & ", " &\n", "\n\t")

    def test_new_separators_behave_exactly_like_the_reference(self):
        """The floor comparison asks only "did we narrow vs LEGACY?", and legacy
        knows neither `\n` nor `&` — so on those axes it is vacuously satisfied
        no matter what the guard does. Review demonstrated the hole: a mutation
        that broke quoted values after `\n` left all nine related tests green.

        Asserting "every generated case is detected" would be WRONG in the other
        direction — 27 of these are unclosed-quote values that bash itself
        refuses (`bash -n` → syntax error), and the guard has never claimed them.
        The real invariant is that a separator choice must not CHANGE the answer:
        compare each new separator against `&&`, value shape by value shape.
        """
        for sep in self._EQUIVALENT_SEPARATORS:
            for value in self._VALUES:
                reference = f"cmd && A={value} git push"
                variant = f"cmd{sep}A={value} git push"
                with self.subTest(sep=repr(sep), value=value):
                    self.assertEqual(
                        guard._is_git_push(variant),
                        guard._is_git_push(reference),
                        f"separator {sep!r} disagrees with `&&` on value "
                        f"{value!r} — a separator must not change whether a "
                        "push is seen",
                    )

    def test_blind_pass_never_narrows_below_the_floor(self):
        lost = [c for c in self._cases()
                if legacy_is_push(c) and not blind_is_push(c)]
        self.assertEqual(
            lost, [],
            "the blind pass stopped catching commands the pre-allowlist regex "
            "caught — a FALSE NEGATIVE in the half whose whole justification is "
            "that it has none",
        )

    # Non-vacuity floor as a RATIO, not a count. `_MIN_CORPUS_COVERAGE` guards
    # the curated corpus, whose size is roughly fixed; this population grows
    # every time a shape is added, so an absolute floor silently loosens — at 10
    # it was passing on 5% participation while the real figure was 147/203.
    _MIN_PARTICIPATION = 0.5

    def test_the_generated_set_actually_exercises_the_floor(self):
        """Without this, an edit that made `legacy_is_push` stop matching would
        turn the test above into a tautology."""
        cases = self._cases()
        compared = sum(1 for c in cases if legacy_is_push(c))
        self.assertGreaterEqual(
            compared / len(cases), self._MIN_PARTICIPATION,
            f"only {compared}/{len(cases)} generated commands engage the floor — "
            "the comparison above is close to vacuous",
        )

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

    def test_newline_between_env_assignments_stays_linear(self):
        """§M's ReDoS — LIVE, and re-introduced mid-fix (a canary for it).

        Adding `\\n` to the separator class gave `A=v\\n` two parses: an
        assignment whose `\\s+` close ATE the newline, or a separator `\\n`
        starting a fresh segment. With `\\s+` both stay viable at every
        repetition and a failing tail re-partitions the whole run — measured
        `A=v\\n`×20000 + tail ≈ 30s, a frozen PreToolUse gate (this test runs
        `_ENV_PREFIX_REPEATS`, larger still, so it separates by more). MULTILINE `^` does
        NOT fix it: the `\\s+` still eats the newline, so the two parses remain
        (measured, still ≈30s). Closing the repetition on `[^\\S\\n]+` makes a
        newline ONLY ever a separator, so the rival cannot form (≈5ms at 20k,
        ≈10ms at this test's 40k). Fails
        LOUD (subprocess timeout) if either half of §M regresses.
        """
        self._assert_finishes(
            ("A=v\n" * self._ENV_PREFIX_REPEATS) + "q push",
            f"{self._ENV_PREFIX_REPEATS} newline-separated assignments, failing tail",
            "the env-value repetition went back to closing on `\\s+`, which "
            "matches `\\n` and races the new `\\n` separator into a rival parse. "
            "Close it on `[^\\S\\n]+` (whitespace except newline) so a newline is "
            "only ever a separator — MULTILINE `^` does not fix this.",
        )

    # Sized from a measured old-vs-new comparison on the §M draft, like every
    # other constant here: 16k newlines took 6.3s and 50k took 62s (input ×2 →
    # time ×4, i.e. quadratic), against 4ms for the shipped pattern. 50k is the
    # first size that is decisively past the 10s timeout on the broken form.
    _NEWLINE_RUN = 50_000

    def test_newline_run_before_a_failing_tail_stays_linear(self):
        """§M(c) — the CRITICAL /ai-review found in the first §M draft.

        Making `\\n` a separator gives a run of K newlines K distinct match
        STARTS. The `\\s*` that followed the separator then re-consumed and gave
        back the rest of the run at every one of them — O(K²). Narrowing it to
        `[^\\S\\n]*` binds each newline to a single starting position.

        This shape needs no crafting: any large multi-line Bash command that
        contains the word "push" and a run of blank lines hits it, and this hook
        gates every Bash call synchronously. It is also NOT protected by
        `_MAX_REDACTION_INPUT` — that cap sits on the release path, AFTER this
        first `search` (see `test_oversized_command_is_not_truncated_before_
        detection` for why the cap must not be moved earlier).
        """
        self._assert_finishes(
            ("\n" * self._NEWLINE_RUN) + "echo push",
            f"a run of {self._NEWLINE_RUN} newlines before a non-matching tail",
            "the whitespace after the separator went back to `\\s*`, which eats "
            "newlines and re-partitions the run at every one of the K possible "
            "starts. Keep it `[^\\S\\n]*` so a newline belongs to exactly one "
            "starting position.",
        )

    # Sized like the rest: on the (a)-(c) state 6k lines took 3.7s and 12k took
    # 14.7s (×2 → ×4); 20k is decisively past the timeout there and ~5ms here.
    _GIT_LINE_REPEATS = 20_000

    def test_many_git_lines_with_a_failing_tail_stay_linear(self):
        """§M(e) — the second CRITICAL, and §M's own doing.

        The tail `git\b[^&;|]*\bpush\b` did not exclude `\n`. Before §M that
        was harmless: only `^` could start a match, so the tail scanned once.
        Once (a) made `\n` a separator, EVERY `git`-prefixed line became a match
        start, and from each one the tail scanned all remaining lines hunting a
        `push` that never comes — O(n²). Measured pre-fix: 6k lines = 3.7s, 12k =
        14.7s; before §M the same input was 2.8ms.

        The `| grep push` tail matters: it puts `push` in the command (so
        `_is_git_push` does not short-circuit) behind a `|` the tail cannot
        cross (so every start must fail).
        """
        self._assert_finishes(
            ("git log x\n" * self._GIT_LINE_REPEATS) + "| grep push",
            f"{self._GIT_LINE_REPEATS} git-prefixed lines with a failing tail",
            "the tail scan went back to `[^&;|]*`, which crosses newlines. With "
            "`\n` as a separator that makes every git line a match start and "
            "re-scans the remainder from each. Keep it `[^&;|\n]*`.",
        )

    def test_background_operator_run_stays_linear(self):
        """§M(d)'s separator gets the same measured pin as §M(a)'s.

        `&` is structurally safer than `\n` (it cannot be eaten by the
        whitespace tokens around it), but this file has had "safe without
        measuring" refuted three times, so the claim is measured rather than
        asserted.
        """
        self._assert_finishes(
            ("cmd & " * self._ENV_PREFIX_REPEATS) + "x push",
            f"{self._ENV_PREFIX_REPEATS} `&`-separated commands, failing tail",
            "adding `&` to the separator class introduced backtracking — it must "
            "stay a single-character alternative that cannot overlap `&&`.",
        )

    def test_mixed_separator_run_stays_linear(self):
        """The separators INTERLEAVED. Each is linear alone; this pins that the
        combination is too, since a match start of one kind sits next to the
        other's whitespace handling (the repo's "each arm AND their order is a
        separate surface" lesson)."""
        self._assert_finishes(
            ("cmd &\n" * self._ENV_PREFIX_REPEATS) + "x push",
            f"{self._ENV_PREFIX_REPEATS} alternating `&` + newline separators",
            "see test_background_operator_run_stays_linear and "
            "test_newline_run_before_a_failing_tail_stays_linear",
        )

    def test_continuation_aware_tail_stays_linear(self):
        """§O's tail crosses a newline only when a backslash escapes it, so its
        three alternatives must stay disjoint on the first character. Measured
        (×2 input → ×2 time) on backslash runs, `\\<newline>` runs and mixed
        runs; pinned because "safe without measuring" has been refuted three
        times in this file."""
        for label, body in (
            ("backslashes", "\\" * self._ENV_PREFIX_REPEATS),
            ("continuations", "\\\n" * self._ENV_PREFIX_REPEATS),
            ("mixed", "\\x\\\n" * self._ENV_PREFIX_REPEATS),
        ):
            with self.subTest(shape=label):
                self._assert_finishes(
                    "git " + body + " nopush",
                    f"{label} run in the tail with a failing end",
                    "the tail's alternatives started overlapping — keep them "
                    "disjoint on the first character (non-backslash / "
                    "backslash+non-newline / backslash+newline).",
                )

    # The shapes below are EXPONENTIAL, not quadratic, so unlike
    # `_ENV_PREFIX_REPEATS` they separate at tiny inputs — sized from a measured
    # old-vs-new comparison, not guessed:
    #
    #   pre-§L pattern   24 repeats = 6.4s (246 bytes), 28 = over 15s
    #   shipped pattern  40 repeats = 0.017s
    #
    # 28 is the first count that was decisively over the timeout on the broken
    # pattern; going larger only makes a RED run slower to report.
    _RIVAL_PARSE_REPEATS = 28
    _GLUED_PIECE_REPEATS = 24

    def test_rival_env_value_parses_do_not_multiply(self):
        """The ReDoS §L's fix removed — this was LIVE, not hypothetical.

        `'…'|"…"|\\S+` in one alternation are not disjoint: a quoted value that
        spans whitespace also has a parse where `\\S+` stops AT that whitespace.
        `A="x y=z" ` is crafted so the leftover (`y=z"`) still looks like an
        assignment, which keeps BOTH parses viable at every repetition instead
        of dying at the next step — so the engine explores 2^k of them.

        286 bytes was enough to hang this hook for over 15s, and it gates every
        Bash call synchronously: a frozen session, or a harness timeout into
        fail-open. The fix splits the two forms into separate prefix BRANCHES,
        so the choice is made once rather than per repetition.
        """
        self._assert_finishes(
            'A="x y=z" ' * self._RIVAL_PARSE_REPEATS + "q push",
            f"{self._RIVAL_PARSE_REPEATS} env assignments with two viable parses",
            "the piece branch and the `\\S+` branch were merged back into one "
            "alternation. Keep them as separate top-level branches of the "
            "prefix group — that is what stops the two parses from being "
            "traded per repetition.",
        )

    def test_glued_quoted_pieces_in_one_value_stay_linear(self):
        """Many quoted pieces glued together inside ONE value, failing tail.

        This is the §L shape at its worst: the value is a repetition whose
        alternatives must stay mutually exclusive. If a future edit adds an
        alternative that can also match a lone quote, every piece gains a second
        parse and the engine re-partitions the whole run.
        """
        self._assert_finishes(
            "A=" + "'x'" * self._GLUED_PIECE_REPEATS + " x push",
            f"{self._GLUED_PIECE_REPEATS} glued quoted pieces in one env value",
            "the env-value pieces stopped being mutually exclusive. Every "
            "alternative must be decidable from the first character (the "
            "unterminated-quote branches carry a negative lookahead for "
            "exactly that reason).",
        )

    def test_glued_pieces_across_many_assignments_stay_linear(self):
        """The same ambiguity, spread across the OUTER repetition instead.

        `test_env_prefix_with_failing_tail_stays_linear` covers well-formed
        values; this covers glued ones, where the value itself is a repetition
        nested inside the assignment repetition.
        """
        self._assert_finishes(
            'A="a b"c ' * self._ENV_PREFIX_REPEATS + "x push",
            "a long run of glued-value env assignments before a failing tail",
            "see test_glued_quoted_pieces_in_one_value_stay_linear",
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

    def test_oversized_command_is_not_truncated_before_detection(self):
        """The cap may bound the RELEASE path and nothing else.

        The §M review suggested also truncating to `_MAX_REDACTION_INPUT` before
        the first `_GIT_PUSH.search`, as a second line of defence against a slow
        scan. That was REJECTED because it manufactures a bypass, which this
        pins: with padding past the cap and a real push after it, truncation
        leaves text containing no push at all, so `_is_git_push` would return
        False and BOTH gates would skip — the exact silent-skip class §M exists
        to close. Exceeding the cap must keep meaning "block" (safe direction),
        never "stop looking". Linearity is bought in the PATTERN
        (`test_newline_run_before_a_failing_tail_stays_linear`), not by refusing
        to read the input.
        """
        command = "echo " + "x" * guard._MAX_REDACTION_INPUT + "\ngit push -u origin main"
        self.assertGreater(len(command), guard._MAX_REDACTION_INPUT)
        self.assertTrue(
            guard._is_git_push(command),
            "a real push after cap-exceeding padding must still be detected — "
            "if this fails, detection was made to depend on a length cap",
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
    def _env_value_subpatterns(pattern: str) -> list:
        """Every value alternation: the text between an env-name group and the
        `[^\\S\\n]+)*` that closes its repetition.

        A LIST, not a single string, since §L: the prefix now has two branches
        (piece-sequence and `\\S+`) and comparing only the first would let the
        second drift unnoticed — which is precisely the failure this class was
        created to stop, one level down.

        The closing anchor is `[^\\S\\n]+)*`, not `\\s+)*`, since §M: both hooks
        stopped letting the repetition eat a newline (a `\\n` there raced the
        push guard's new `\\n` separator into a ReDoS). If a future edit reverts
        one hook to `\\s+`, this `.index` raises for that hook and the test fails
        loudly — which is the drift-detection this class exists for.
        """
        key = "[A-Za-z0-9_]*="
        out = []
        at = 0
        while True:
            found = pattern.find(key, at)
            if found < 0:
                return out
            start = found + len(key)
            end = pattern.index(r"[^\S\n]+)*", start)
            out.append(pattern[start:end].replace('\\"', '"'))
            at = end

    def test_both_hooks_use_the_same_env_value_alternation(self):
        nudge = _harness.load_module_by_path(
            "guard_default_branch_bash",
            _harness.HOOKS_DIR / "guard_default_branch_bash.py",
        )
        push_subs = self._env_value_subpatterns(guard._GIT_PUSH.pattern)
        nudge_subs = self._env_value_subpatterns(nudge._MUTATING.pattern)
        self.assertEqual(
            len(push_subs), 2,
            "expected the two §L prefix branches — extraction drifted and this "
            "check would be comparing the wrong thing",
        )
        self.assertEqual(
            push_subs, nudge_subs,
            "the two hooks' env-value alternations drifted. A fix applied to one "
            "and not the other is exactly how §J's escaped-quote gap survived "
            "the first round.",
        )

    def test_only_the_newline_was_excluded_from_the_whitespace(self):
        """§M narrowed two whitespace tokens from `\\s` to `[^\\S\\n]`. That must
        exclude the NEWLINE and nothing else — a wrong character class (say
        `[ ]`) would silently stop recognising tab-separated forms, which is a
        false NEGATIVE and therefore a gate bypass, not a cosmetic loss."""
        for command, note in (
            ("A=v\tgit push", "tab between an env assignment and git"),
            ("A=v \t git push", "mixed spaces and tabs"),
            ("cd /a\n\tgit push", "tab indent after a newline separator"),
            ("A=v\x0cgit push", "formfeed — still whitespace, still consumed"),
        ):
            with self.subTest(note=note):
                self.assertTrue(guard._is_git_push(command), note)

    def test_the_alternation_is_escape_aware(self):
        subs = self._env_value_subpatterns(guard._GIT_PUSH.pattern)
        self.assertIn(
            r'"(?:\\.|[^"\\])*"', subs[0],
            "the double-quoted alternative lost its escape-aware body — an "
            r'escaped \" inside the value hides the push again',
        )

    def test_the_token_local_branch_survives(self):
        """§L's second branch is what still catches an unclosed quote.

        Dropping it looks like a simplification — the piece branch already
        handles every well-formed value — but `A='x git push -o 'y'` has its
        closing quote LATER in the command, so the piece branch consumes past
        the `git` and the whole match fails. That is the §J follow-up's
        28-command regression, re-entered from a new direction.
        """
        subs = self._env_value_subpatterns(guard._GIT_PUSH.pattern)
        # Length first: dropping the branch entirely would otherwise raise
        # IndexError, which reads as a broken test rather than a broken guard.
        self.assertEqual(
            len(subs), 2, "the token-local fallback branch was removed")
        self.assertEqual(
            subs[1], r"\S+",
            "the token-local fallback branch was rewritten",
        )
        self.assertTrue(guard._is_git_push("A='x git push -o 'y'"))
        self.assertTrue(guard._is_git_push('A=""" git push origin "main"'))


class GluedQuotedEnvValueTest(unittest.TestCase):
    """§L — an env value whose closing quote is glued to more text.

    `A="a b"c git push` is a legal assignment (the value is `a bc`), but nothing
    used to match it: the quoted branch stopped at the closing quote and then
    demanded whitespace, while `\\S+` could not span the space inside the quotes.
    The prefix group collapsed and the push went undetected — the same silent
    gate bypass §J was, one step further along.

    The previous class shape asserted the BUG and told the fixer to flip it;
    this is that flip (§J's canary was handed over the same way). Kept as a
    class so the bypass cannot silently return.

    `test_the_gap_predates_the_j_fix` stays as-is: the gap was PRE-EXISTING, not
    a §J regression, and the legacy pattern still misses these — which is also
    what makes the fix a strict gain rather than a restoration.
    """

    _CASES = (
        'A="a b"c git push',
        "A='a b'c git push",
        'GIT_SSH_COMMAND="ssh -i ~/.key"/bin/ssh git push',
        # The mirror shape: unquoted piece FIRST, quoted one glued after it.
        'A=x"a b" git push',
        # An empty value is legal shell and was missed for the same reason —
        # `\\S+` demanded at least one character.
        "A= git push",
        # Not at the start of the command: the segment anchor must still hold.
        'echo hi && A="a b"c git push',
    )

    def test_quoted_value_glued_to_more_text_is_detected(self):
        for command in self._CASES:
            with self.subTest(command=command):
                self.assertTrue(
                    guard._is_git_push(command),
                    "§L regressed — a glued quoted env value hides the push "
                    "again and BOTH gates are skipped without a banner",
                )

    def test_the_gap_predates_the_j_fix(self):
        for command in self._CASES:
            with self.subTest(command=command):
                self.assertFalse(legacy_is_push(command))


class NewlineSeparatorTest(unittest.TestCase):
    """A newline between commands hid the push from the blind pass — the same
    UNSAFE-DIRECTION gap as §J/§L, and it predates all of them.

    `_GIT_PUSH`'s separator prefix was `(?:^|&&|;|\\|)` — it never listed `\\n`,
    though the sibling `_SEGMENT_SPLIT` in this same file AND the one in
    `guard_default_branch_bash` both treat `\\n` as a separator. So a push on its
    own line, after any NON-git command, was not detected: `main()` returned 0
    without running either gate or printing the fail-open banner — this repo's
    single most common push form silently skipped the whole review requirement:

        cd <worktree>
        git push -u origin <branch>

    It reproduced from the real command that slipped through (see
    `plan/complete/harness-push-gate-did-not-fire.md`): a `cd`, a heredoc commit, an
    `echo`, then the push on its own line. `default-branch` guard caught its
    commits because it splits on `_SEGMENT_SPLIT` (which HAS `\\n`) first; this
    hook matched the whole command in one go, so the missing `\\n` was fatal.

    Why it hid so long — a two-layer blind spot:
      - CORPUS's ONLY newline case was `git add -A\\ngit push`, whose preceding
        line starts with `git`, so the blind `git\\b[^&;|]*\\bpush\\b` walked
        ACROSS the newline and matched by accident. Replace `git add` with
        anything else and the accident is gone.
      - `test_every_non_release_entry_stays_blocked` only asserts entries
        `legacy_is_push` already matches, and legacy — no `\\n` in ITS separators
        either — misses all of these. So the differential never judged this axis.

    Kept as a class so the bypass cannot silently return.
    """

    # Every case has a NON-git preceding line, so the blind walk cannot bridge
    # the newline by accident — legacy misses all of them (asserted below), which
    # is exactly why the legacy-gated differential could not see this axis.
    _CASES = (
        "cd /tmp\ngit push -u origin main",  # the most common form in this repo
        "echo hi\ngit push",
        'echo "=== push ==="\ngit push -u origin claude/x 2>&1 | tail -20',  # real repro
        "cd /a\nGIT_SSH=k git push",  # newline separator THEN an env prefix
        # §M(c): narrowing the post-separator whitespace to `[^\S\n]*` must not
        # cost these — a LATER newline in the run supplies the separator, and
        # ordinary (non-newline) indentation is still consumed.
        "cd /a\n\n\ngit push",  # blank lines between
        "cd /a\n  git push",  # indented continuation
        "cd /a\n\n   git push",  # blank line AND indent
        "cd /a\n\tgit push",  # tab indent — only NEWLINE was excluded
        "cd /a\n\n\tA=v git push",  # blank line, tab, then an env prefix
    )

    def test_newline_separated_push_is_detected(self):
        for command in self._CASES:
            with self.subTest(command=command):
                self.assertTrue(
                    guard._is_git_push(command),
                    "a push on its own line after a non-git command must be "
                    "detected — this silently bypassed BOTH gates with no banner",
                )

    def test_the_gap_predates_j_and_l(self):
        """The floor missed it too, which is why corpus/differential could not:
        their non-release check only asserts entries `legacy_is_push` matches."""
        for command in self._CASES:
            with self.subTest(command=command):
                self.assertFalse(
                    legacy_is_push(command),
                    "if legacy caught this the differential would have too; the "
                    "point is it did not, so this explicit assertion is required",
                )


class BackgroundOperatorSeparatorTest(unittest.TestCase):
    """§M(d) — `&`, the bash BACKGROUND operator, was never a separator.

    `sleep 5 & git push` runs the push exactly like `;` would, but the class was
    `[;|\n]` and `&` only ever appeared as part of the `&&` alternative. So
    these were not detected at all: `main()` returned 0, both gates skipped, no
    fail-open banner — the same total bypass as §J/§L/§M(a), spelled differently.

    It PREDATES §M (the legacy floor misses it too), and the sibling
    `guard_default_branch_bash._SEGMENT_SPLIT` has listed `&` all along — that
    comparison is what should have caught this three separator fixes ago, which
    is why the generated separator axis now carries `&` as well.
    """

    _CASES = (
        "sleep 5 & git push",
        "npm run build & git push -u origin main",
        "echo x & git push --force",
        "cd /a & A=v git push",
    )

    def test_background_operator_is_a_separator(self):
        for command in self._CASES:
            with self.subTest(command=command):
                self.assertTrue(
                    guard._is_git_push(command),
                    "`&` backgrounds the left side and runs the right — a push "
                    "after it must be detected, not skipped silently",
                )

    def test_the_chain_operator_still_matches_at_its_first_character(self):
        """Adding `&` to the class must not disturb `&&`: the two-character
        alternative has to stay ahead of it, and a chain must still match."""
        for command in ("git add -A && git push", "a && b && git push"):
            with self.subTest(command=command):
                self.assertTrue(guard._is_git_push(command))

    def test_the_gap_predates_m(self):
        for command in self._CASES:
            with self.subTest(command=command):
                self.assertFalse(
                    legacy_is_push(command),
                    "legacy missed these too — so the differential could never "
                    "have flagged them, hence this explicit class",
                )


class LineContinuationTest(unittest.TestCase):
    """`\\` + newline is deleted by the shell, so the push runs.

    §M(e) excluded `\\n` from the tail scan to kill an O(n²) and silently lost
    this shape: `git \\<newline>  push origin main` stopped matching while the
    LEGACY floor still caught it — i.e. a differential-floor violation. Nothing
    failed, because `test_no_new_false_negatives` only compares CORPUS entries
    and nobody had ever written a continuation into it. Found by /ai-review,
    which called it pre-existing; measuring the legacy pattern showed otherwise.

    `_is_git_push` now unfolds continuations before matching — the same thing the
    shell does — so the tail keeps its newline exclusion (and its linearity).
    """

    _CASES = (
        "git \\\n  push origin main",
        "git \\\npush",
        "cd /x && git \\\n  push --force",
        "git push \\\n  --force-with-lease",
    )

    def test_line_continuation_does_not_hide_the_push(self):
        for command in self._CASES:
            with self.subTest(command=command):
                self.assertTrue(
                    guard._is_git_push(command),
                    "the shell joins these lines and pushes; the guard must see "
                    "the same command the shell will run",
                )

    def test_the_legacy_floor_caught_these(self):
        """What makes this a REGRESSION rather than a known gap: the pre-allowlist
        pattern matched them, so the differential owed us this and the corpus was
        simply silent on the shape."""
        for command in self._CASES:
            with self.subTest(command=command):
                self.assertTrue(
                    legacy_is_push(command),
                    "if legacy misses it too this is a gap, not a regression — "
                    "re-file the finding accordingly",
                )

    def test_even_backslash_run_is_not_a_continuation(self):
        """/ai-review CRITICAL #1 on the first fold.

        A backslash escapes the next one, so `echo a\\\\<LF>git push` is a
        LITERAL backslash followed by a REAL newline — the shell runs TWO
        commands (verified by running it). The first fold ignored parity and
        deleted that newline, erasing the separator in front of `git push` and
        hiding a push that genuinely runs. Folding must key on an ODD run.
        """
        for command in (
            "echo a\\\\\ngit push",
            "echo a\\\\\ngit push --force",
            "cd /x\\\\\nA=v git push",
        ):
            with self.subTest(command=command):
                self.assertTrue(
                    guard._is_git_push(command),
                    "an EVEN backslash run leaves a real newline separator, so "
                    "the next line starts a fresh segment the tail must not eat",
                )

    def test_continuation_inside_the_word_is_a_KNOWN_GAP(self):
        """A continuation that splits `push` ITSELF is not detected. Pinned as a
        known gap, not silently absent.

        The shell deletes both characters, so `git pu\\<LF>sh` really is the word
        `push`. Catching it needs the text REWRITTEN before matching, and §O
        removed exactly that pre-fold: the fold merged a heredoc body's last line
        into its terminator, which unmasked every `git push` after the heredoc —
        a far commoner shape (every commit in this repo uses that heredoc form)
        than a continuation inside a keyword. So the trade is deliberate.

        LEGACY misses these too (asserted below), so this is a gap the guard
        never closed rather than a regression §O introduced.
        """
        for command in (
            "git pu\\\nsh origin main",
            "git p\\\nu\\\ns\\\nh",
        ):
            with self.subTest(command=command):
                self.assertFalse(
                    guard._is_git_push(command),
                    "if this starts being detected the trade above changed — "
                    "re-read §O before updating this expectation",
                )
                self.assertFalse(
                    legacy_is_push(command),
                    "legacy catches it => it IS a floor violation after all, "
                    "and the gap must be closed rather than pinned",
                )

    def test_heredoc_body_ending_in_a_backslash_keeps_the_push_visible(self):
        """§O's reason for existing — /ai-review CRITICAL on the pre-fold.

        A heredoc body whose last line ends in an odd backslash sits right above
        its terminator. Folding continuations first glued `message\\` to `EOF`,
        so `_commit_heredoc_spans` never found the terminator, the span ran to
        the end of the command, and the REAL `git push` after the heredoc was
        blanked as "inert body" — a silent gate bypass. Matching without
        rewriting keeps the terminator where it is.
        """
        command = "git commit -F - <<'EOF'\nmessage\\\nEOF\ngit push"
        self.assertTrue(
            guard._is_git_push(command),
            "the push AFTER the heredoc must stay visible; if this fails, some "
            "pre-pass is rewriting the text again",
        )

    def test_unfolding_does_not_invent_a_push(self):
        """The fold may only ever JOIN text; it must not turn a non-push into one."""
        for command in ("echo a \\\n  b", "git \\\n  status", "ls \\\n  -la"):
            with self.subTest(command=command):
                self.assertFalse(guard._is_git_push(command))


class QuotedNewlineValueTest(unittest.TestCase):
    """A newline INSIDE a quoted value is part of the value, not a separator.

    Found by /ai-review on the §N split-then-match experiment, which replaced the
    whole-command scan with `any(_GIT_PUSH.search(line) for line in
    text.split("\\n"))`. That split cannot know a newline sits inside quotes, so
    `A="line1\\nline2" git push` tore into `A="line1` and `line2" git push`; the
    second fragment has no separator before `git`, so nothing matched and BOTH
    gates were skipped. Every case here is valid shell (`bash -n` exits 0) that
    really does push, so the miss was a live bypass — not the safe direction.

    §N was reverted for exactly this, and the class stays as the tripwire: any
    future attempt to make detection line-oriented fails here first. The
    whole-command pattern needs no special handling — its quoted alternatives
    (`'[^']*'`, `"(?:\\.|[^"\\])*"`) absorb any character, newline included.
    """

    _CASES = (
        'A="line1\nline2" git push',
        "A='line1\nline2' git push",
        'GIT_SSH_COMMAND="ssh\nkey" git push origin main',
        'cd /x && A="a\nb" git push',
        'A="a\nb" B="c\nd" git push --force',
    )

    def test_newline_inside_a_quoted_value_does_not_hide_the_push(self):
        for command in self._CASES:
            with self.subTest(command=command):
                self.assertTrue(
                    guard._is_git_push(command),
                    "a newline inside quotes is VALUE, not a separator — "
                    "treating it as one skips both gates on a push that runs",
                )

    def test_these_are_real_shell(self):
        """Guards the premise: if these stopped parsing, the class above would be
        pinning behaviour on inputs no shell would run, which is the mistake made
        earlier in this same effort (27 unclosed-quote 'misses' that bash itself
        rejects)."""
        for command in self._CASES:
            with self.subTest(command=command):
                result = subprocess.run(
                    ["bash", "-n", "-c", command], capture_output=True
                )
                self.assertEqual(
                    result.returncode, 0,
                    "this fixture is not valid shell, so it proves nothing",
                )


if __name__ == "__main__":
    unittest.main()
