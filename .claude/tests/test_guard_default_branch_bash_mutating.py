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
     and sharing that machinery would buy nothing here: the one residual FP
     (`AcknowledgedFalsePositiveTest`) is a quoted **separator**, which
     `_redact_inert_text` does not address either — it only blanks git
     commit/tag message values and heredoc bodies, not arbitrary `echo` args.
  2. `SegmentTest` — the real defect was the opposite sign: a *false negative*.
     The anchor saw only the first token of the whole command, so the common
     `git add -A && git commit -m "x"` shape never fired, i.e. the hook missed
     precisely the moment it exists to catch.

The nudge never blocks and fires at most once per session, so the asymmetry is
deliberate: err toward nudging, never toward blocking.
"""

from __future__ import annotations

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

    Pinned rather than fixed, deliberately. Teaching the splitter about quoting
    is the "precise shell parser" path that item ② already had to abandon: every
    shell feature that moves text (quotes, escapes, heredocs, expansion) becomes
    another hole. Here the payoff for that unbounded surface would be avoiding a
    *soft, once-per-session reminder shown only while you are already sitting on
    the default branch* — where the reminder is apt regardless of the trigger.
    """

    def test_quoted_separator_nudges(self):
        self.assertTrue(guard._is_mutating('echo "a && rm -rf x" > /dev/null'))


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

    def test_env_prefix_does_not_promote_a_read_only_command(self):
        self.assertFalse(guard._is_mutating("GIT_PAGER=cat git status"))


class EmptyInputTest(unittest.TestCase):
    def test_empty_and_blank_are_not_mutating(self):
        for command in ("", "   ", "\n"):
            with self.subTest(command=repr(command)):
                self.assertFalse(guard._is_mutating(command))


if __name__ == "__main__":
    unittest.main()
