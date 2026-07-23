"""Pin `guard_default_branch_bash._is_mutating` — the "you're on the default
branch" nudge classifier.

Why this file exists at all: the classifier had **zero** tests, and the plan's
item C proposed replacing it with the push guard's shell-aware detection code.
Measuring first showed that would be a bad trade, so C was closed as won't-do
(`plan/in-progress/harness-guard-followups.md` §C). Two claims carry that
decision, and both are pinned below so a future reader does not have to re-derive
them:

  1. `NoFalsePositiveClassTest` — anchoring to a *segment's* first token means
     message text, grep patterns and quoted words do not trigger the nudge. That
     is the false-positive class the push guard needs `_redact_*` machinery for,
     and sharing that machinery would buy nothing here: the residual FPs
     (`AcknowledgedFalsePositiveTest` — a quoted **separator**, and a **heredoc
     body line**) are not what `_redact_inert_text` addresses either, since it
     blanks git commit/tag message values and heredocs *owned by* such a
     command, not arbitrary `echo` args or a `cat <<EOF` body.
  2. `SegmentTest` — the real defect was the opposite sign: a *false negative*.
     The anchor saw only the first token of the whole command, so the common
     `git add -A && git commit -m "x"` shape never fired, i.e. the hook missed
     precisely the moment it exists to catch.

The nudge never blocks and fires at most once per session, so the asymmetry is
deliberate: err toward nudging, never toward blocking.
"""

from __future__ import annotations

import re
import unittest

import _harness

guard = _harness.load_module_by_path(
    "guard_default_branch_bash",
    _harness.HOOKS_DIR / "guard_default_branch_bash.py",
)


class NoFalsePositiveClassTest(unittest.TestCase):
    """Words inside message text / patterns are not mistaken for commands.

    This is the evidence behind closing item C: the push guard needs
    `_redact_inert_text()` because its pattern searches anywhere in the command;
    this hook's pattern is anchored per segment, so quoted words stay inert.
    If any of these ever fail, that premise broke and C is worth reopening.
    """

    def test_mutating_words_inside_inert_text_do_not_match(self):
        for command in (
            'echo "rm -rf /tmp/x"',
            'grep -n "mkdir" file.txt',
            'git log --grep="commit"',
            'echo "git commit"',
            'rg "pnpm install" docs/',
            "cat notes.md  # remember to run make build",
            'git show HEAD:script.sh | grep "touch"',
        ):
            with self.subTest(command=command):
                self.assertFalse(guard._is_mutating(command))

    def test_read_only_commands_stay_silent(self):
        for command in (
            "ls -la",
            "git status",
            "git diff --stat",
            "git log --oneline -20",
            "pwd && git status && ls",
        ):
            with self.subTest(command=command):
                self.assertFalse(guard._is_mutating(command))


class SegmentTest(unittest.TestCase):
    """Every command in a chain is classified, not just the first one."""

    def test_mutating_command_after_separator_is_caught(self):
        for command in (
            'git add -A && git commit -m "x"',
            "cd /tmp && rm -rf build",
            'git status; git commit -m "x"',
            "ls -la || mkdir -p out",
            "sleep 5 & rm -rf x",
            "git fetch origin\ngit rebase origin/main",
        ):
            with self.subTest(command=command):
                self.assertTrue(guard._is_mutating(command))

    def test_leading_position_still_matches(self):
        for command in (
            'git commit -m "x"',
            "rm -rf build",
            "pnpm install",
            "make e2e-test",
        ):
            with self.subTest(command=command):
                self.assertTrue(guard._is_mutating(command))


class AcknowledgedFalsePositiveTest(unittest.TestCase):
    """The segment split is naive about quoting. These nudge, and that is fine.

    Two distinct classes, not one — the split ignores quoting both *within* a
    line (a quoted separator) and *across* lines (a heredoc body, where every
    newline is a separator regardless of the `<<'EOF'` around it).

    Pinned rather than fixed, deliberately. Teaching the splitter about quoting
    is the "precise shell parser" path that item ② already had to abandon: every
    shell feature that moves text (quotes, escapes, heredocs, expansion) becomes
    another hole. Here the payoff for that unbounded surface would be avoiding a
    *soft, once-per-session reminder shown only while you are already sitting on
    the default branch* — where the reminder is apt regardless of the trigger.
    Newlines cannot stop being separators: multi-line chained commands are how
    real git work is written here, and `SegmentTest` depends on that.
    """

    def test_quoted_separator_nudges(self):
        self.assertTrue(guard._is_mutating('echo "a && rm -rf x" > /dev/null'))

    def test_heredoc_body_line_starting_with_a_verb_nudges(self):
        self.assertTrue(
            guard._is_mutating(
                "cat <<'EOF' > notes.txt\nmkdir the new feature folder\nEOF"
            )
        )


class OutOfScopeTest(unittest.TestCase):
    """Indirect execution is not classified — unchanged, and not a regression.

    The classifier reads a segment's first token only, so a mutating command
    reached through another program stays invisible. Real enforcement is
    `guard_default_branch_edit.py` and `.githooks/pre-commit`; this hook is only
    an early nudge, so it does not chase these.
    """

    def test_indirectly_executed_commands_stay_silent(self):
        for command in (
            "cat list.txt | xargs rm",
            "bash -c 'rm -rf build'",
            "find . -name '*.tmp' -delete",
        ):
            with self.subTest(command=command):
                self.assertFalse(guard._is_mutating(command))


class EnvPrefixTest(unittest.TestCase):
    """`VAR=value` prefixes shift the real command past the anchor."""

    def test_env_assignment_prefix_is_skipped(self):
        for command in (
            'GIT_EDITOR=vim git commit -m "x"',
            "CI=1 NODE_ENV=test pnpm install",
            'git add -A && GIT_EDITOR=true git commit -m "x"',
        ):
            with self.subTest(command=command):
                self.assertTrue(guard._is_mutating(command))

    def test_quoted_env_value_containing_spaces_is_skipped(self):
        """A bare `\\S+` stops at the space *inside* the quotes.

        The command then appears to start with the value's tail (`key"`), so the
        nudge is lost — the same false negative this file's `SegmentTest` exists
        to prevent, just reached by a different route. These are ordinary shapes,
        not contrivances.
        """
        for command in (
            'GIT_SSH_COMMAND="ssh -i ~/.key" git commit -m "x"',
            "GIT_SSH_COMMAND='ssh -i ~/.key' git commit -m x",
            'GIT_AUTHOR_DATE="2024-01-01 00:00:00" git commit --amend',
            'git add -A && GIT_AUTHOR_NAME="John Doe" git commit -m "x"',
        ):
            with self.subTest(command=command):
                self.assertTrue(guard._is_mutating(command))

    def test_empty_env_value_stays_unmatched(self):
        """`VAR= git commit` — every alternative needs at least one character.
        Not a shape worth widening for, so the gap is pinned rather than closed.
        """
        self.assertFalse(guard._is_mutating("VAR= git commit -m x"))

    def test_unterminated_quote_still_matches(self):
        """Regression, plus a lesson in how it got pinned as "intended".

        Adding quoted-value support REPLACED the `\\S+` catch-all instead of
        falling back to it, so a value that opens a quote and never closes it
        stopped matching and these nudges went silent. An earlier revision of
        this very test asserted that as correct — written by judging the new
        pattern on its own instead of against what the old one classified.
        `OldEnvPrefixSupersetTest` now makes that comparison mechanical, over
        generated inputs rather than remembered ones.
        """
        for command in (
            "A='x mkdir foo",
            'A="unclosed git commit -m x',
            "A=' git commit -m x",
        ):
            with self.subTest(command=command):
                self.assertTrue(guard._is_mutating(command))

    def test_env_prefix_does_not_promote_a_read_only_command(self):
        for command in (
            "GIT_PAGER=cat git status",
            'GIT_SSH_COMMAND="ssh -i ~/.key" git status',
        ):
            with self.subTest(command=command):
                self.assertFalse(guard._is_mutating(command))


class OldEnvPrefixSupersetTest(unittest.TestCase):
    """Classification may only ever GROW — the push guard's floor, applied here.

    This is the forgiving hook: it never blocks, which is precisely why a silent
    narrowing is easy to ship and hard to notice. One was — adding quoted-value
    support replaced the `\\S+` catch-all rather than falling back to it, and a
    test in the same change pinned the loss as intended behaviour. Frozen below
    is the prefix as it stood before quoted values existed; whatever it
    classified must still be classified.

    Generated rather than listed, for the same reason the push guard's
    `GeneratedFloorTest` is: a curated set only ever contains shapes somebody
    already thought of, and the regressing shape was in nobody's head.
    """

    # Do not update when `_MUTATING` changes — it is the fixed point the
    # comparison needs. Only the PREFIX is frozen; the command body comes from
    # the live pattern so this never has to mirror the verb list.
    _PRE_QUOTED_PREFIX = r"^\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*"
    _SPLIT_MARKER = r"\s+)*(?:"

    _VALUES = [
        "x", "'x'", '"x"', "'x", '"x', "x'", 'x"', "'x y'", '"x y"', "''", '""',
        "'", '"', "a'b", 'a"b', "x=y", "-i", "~/.key", "'x y", '"x y', r'"a\"b"',
    ]
    _COMMANDS = ["mkdir foo", "rm -rf build", 'git commit -m "x"', "pnpm install"]

    def _pre_quoted_is_mutating(self, command: str) -> bool:
        body = guard._MUTATING.pattern.split(self._SPLIT_MARKER, 1)[1]
        pattern = re.compile(self._PRE_QUOTED_PREFIX + "(?:" + body, re.VERBOSE)
        return any(
            pattern.search(segment)
            for segment in guard._SEGMENT_SPLIT.split(command)
        )

    def _cases(self):
        return [f"A={v} {c}" for v in self._VALUES for c in self._COMMANDS]

    def test_the_frozen_prefix_still_composes(self):
        """Guards this test's own splice: if `_MUTATING` is reshaped so the
        marker disappears, the comparison would silently compare nothing."""
        self.assertIn(self._SPLIT_MARKER, guard._MUTATING.pattern)
        self.assertTrue(self._pre_quoted_is_mutating("A=x mkdir foo"))

    def test_no_classification_is_lost(self):
        lost = [c for c in self._cases()
                if self._pre_quoted_is_mutating(c) and not guard._is_mutating(c)]
        self.assertEqual(
            lost, [],
            "the classifier stopped recognising commands it used to recognise",
        )

    def test_quoted_support_actually_added_something(self):
        gained = [c for c in self._cases()
                  if guard._is_mutating(c) and not self._pre_quoted_is_mutating(c)]
        self.assertTrue(gained, "quoted values are not being recognised at all")


class BacktrackingTest(unittest.TestCase):
    """The classifier must stay linear on adversarial input.

    This hook runs synchronously in front of EVERY Bash call, so a pathological
    regex does not merely slow a report — it freezes the session. The push guard
    shipped that class twice (review 2026/07/23 14_23_23 C1/C2).

    **What this does NOT pin**: it is not a proxy for the env-value alternation
    being disjoint. That was measured — the ambiguous variant is linear here too,
    because `^` and a mandatory `IDENT=` per repetition leave no partition to
    explore — and a mutant restoring the ambiguity passes this test. Recorded
    because the tempting comment ("disjoint alternatives prevent the ReDoS here")
    would be an unmeasured claim, and stating it would let a later reader treat
    this test as evidence for something it never checked.

    What it DOES pin: a future edit that reintroduces unanchored nested
    quantifiers gets caught before it reaches a hook on the Bash hot path.

    Run in a SUBPROCESS with a hard timeout: catastrophic backtracking happens
    inside C-level `re`, where a signal cannot interrupt it, so an in-process
    timing assertion would hang instead of failing.
    """

    _PROBE = r"""
import importlib.util, sys
spec = importlib.util.spec_from_file_location("g", sys.argv[1])
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)
for payload in (
    'A=' + '"' * 20000 + ' git commit',
    'A="' + 'x' * 20000 + ' git commit',
    'A=' + "'" * 20000 + ' git commit',
    ('A=b ' * 20000) + 'git commit',
    'A="' + 'x y ' * 5000 + '" git commit',
):
    g._is_mutating(payload)
print("done")
"""

    def test_adversarial_input_does_not_hang(self):
        import subprocess
        import sys

        result = subprocess.run(
            [sys.executable, "-c", self._PROBE,
             str(_harness.HOOKS_DIR / "guard_default_branch_bash.py")],
            capture_output=True, text=True, timeout=20,
        )
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        self.assertIn("done", result.stdout)


class EmptyInputTest(unittest.TestCase):
    def test_empty_and_blank_are_not_mutating(self):
        for command in ("", "   ", "\n"):
            with self.subTest(command=repr(command)):
                self.assertFalse(guard._is_mutating(command))


if __name__ == "__main__":
    unittest.main()
