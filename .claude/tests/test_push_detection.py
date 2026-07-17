"""Tests for `guard_review_before_push._is_git_push` — WHICH commands the gate
inspects, not what it then decides (that is test_review_guard.py's job).

Both directions matter, asymmetrically:
  - A false NEGATIVE lets an unreviewed branch ship. Unsafe.
  - A false POSITIVE blocks an innocent command. Not unsafe, but it is what
    teaches people to route around the guard — the old regex blocked
    `git commit` whenever the commit message happened to contain the word
    "push", and the workaround learned was to move the message into a file.

The old regex allowed unbounded distance between `git` and `push` and had no
notion of shell quoting, so it matched across a heredoc body and read a `\\|`
inside a quoted grep pattern as a pipe. The rewrite decides on the parsed git
subcommand instead; these cases pin both halves of that.
"""

from __future__ import annotations

import unittest

import _harness

guard = _harness.load_module_by_path(
    "guard_review_before_push",
    _harness.HOOKS_DIR / "guard_review_before_push.py",
)

# Commands that really do run `git push`. A miss here is the unsafe direction.
MUST_BLOCK = [
    ("plain push", "git push -u origin HEAD"),
    ("bare push", "git push"),
    ("force push", "git push --force"),
    ("git -C <dir>", "git -C /tmp/wt push"),
    ("git -c <k=v>", 'git -c user.name="a b" push'),
    ("--git-dir=", "git --git-dir=/tmp/wt/.git push"),
    ("--no-pager", "git --no-pager push"),
    ("env assignment prefix", "FOO=1 git push"),
    ("absolute path to git", "/usr/bin/git push"),
    ("after &&", "git add -A && git push"),
    ("after ; without spaces", "git add -A;git push"),
    ("after |", "true | git push"),
    ("inside a subshell", "(git push)"),
    ("second segment of three", "git add -A && git commit -m x && git push"),
    # --- regression cases found by /ai-review of this file's own rewrite ------
    # (review/code/2026/07/17/17_09_10, Critical #1-#4). Each reproduces a real
    # false negative in the *new* shlex-based `_is_git_push`, not a pre-existing
    # gap — see the "MUST regression" tests below for the pre-fix root cause.
    ("newline-only separator between add and push (no && needed)",
     "git add -A\ngit push"),
    ("heredoc commit immediately followed by push on the next line",
     "git commit -F - <<'EOF'\nfix: the CLI passes but push is blocked\nEOF\ngit push"),
    ("quote-split subcommand token defeats the raw substring pre-filter",
     "git 'pu''sh' --force"),
    ("case-insensitive git launcher (default-case-insensitive filesystem)",
     "GIT push"),
    ("global option missing from the whitelist swallows its own value",
     "git --attr-source main push"),
    ("any *other* unlisted global option must fail closed too, not just "
     "--attr-source (structural fix, not a point patch)",
     "git --some-future-global-option value push"),
]

# Commands that merely mention push. Blocking these is the old bug.
MUST_ALLOW = [
    ("grep for the literal string", 'grep -n "foo\\|git push\\|bar" file.py | head -6'),
    ("commit whose heredoc message says push",
     "git commit -F - <<'EOF'\nfix: the CLI passes but push is blocked\n\nbody\nEOF"),
    ("commit whose -m message says push",
     'git commit -m "explain why push was blocked"'),
    ("ordinary heredoc commit", "git commit -F - <<'EOF'\nordinary message\nEOF"),
    ("unrelated command after a pipe", "echo hi | grep push"),
    ("push as an argument to another subcommand", "git config alias.p push"),
    ("no push anywhere", "git status"),
    ("empty command", ""),
]


class IsGitPushTest(unittest.TestCase):
    def test_blocks_real_pushes(self):
        for label, command in MUST_BLOCK:
            with self.subTest(case=label):
                self.assertTrue(
                    guard._is_git_push(command),
                    f"false negative — an unreviewed branch could ship: {command!r}",
                )

    def test_allows_commands_that_only_mention_push(self):
        for label, command in MUST_ALLOW:
            with self.subTest(case=label):
                self.assertFalse(
                    guard._is_git_push(command),
                    f"false positive — this does not run git push: {command!r}",
                )

    def test_unparseable_command_falls_back_to_blocking(self):
        """A guard must not turn permissive when it cannot parse.

        An unbalanced quote makes shlex raise; the over-eager regex takes over.
        """
        self.assertTrue(guard._is_git_push('git push "unterminated'))

    def test_unparseable_non_push_is_still_bounded_by_the_fallback(self):
        """The fallback is over-eager, not unconditional: no `git` → no block."""
        self.assertFalse(guard._is_git_push('echo "unterminated push'))

    def test_comment_character_does_not_hide_a_later_push(self):
        """shlex.shlex() treats `#` as a comment start; the lexer must not.

        Otherwise everything after an unquoted `#` (a URL fragment, say) is
        swallowed and the push behind it becomes invisible.
        """
        self.assertTrue(guard._is_git_push("curl http://x/#frag && git push"))

    def test_quoted_pipe_is_not_a_segment_separator(self):
        """The B-case root cause, pinned directly."""
        tokens = guard._tokenize('grep "a\\|git push\\|b" f')
        self.assertEqual(tokens, ["grep", "a\\|git push\\|b", "f"])

    def test_subcommand_skips_global_options_and_their_values(self):
        self.assertEqual(
            guard._git_subcommand(["git", "-C", "/tmp/wt", "push"]), "push"
        )
        self.assertEqual(
            guard._git_subcommand(["FOO=1", "git", "commit", "-m", "push"]), "commit"
        )
        self.assertIsNone(guard._git_subcommand(["grep", "git", "push"]))
        self.assertIsNone(guard._git_subcommand([]))

    def test_all_value_taking_global_options_skip_their_value(self):
        """WARNING #3: only `-C` was exercised; the other 7 (now 8 with
        --attr-source) entries of `_GIT_OPTS_WITH_VALUE` could silently rot —
        a typo'd or removed entry falls through to the fail-closed branch and,
        for a segment that does not literally end in a `push` token, produces
        a false negative of exactly the Critical #4 shape. Table-driven so a
        future edit to the whitelist is covered automatically."""
        for opt in sorted(guard._GIT_OPTS_WITH_VALUE):
            with self.subTest(option=opt):
                self.assertEqual(
                    guard._git_subcommand(["git", opt, "some-value", "push"]),
                    "push",
                    f"{opt!r} must be treated as consuming a separate value token",
                )

    def test_newline_is_a_segment_separator_on_its_own(self):
        """Critical #1, pinned at the tokenizer level: a bare newline (no
        `&&`/`;` in sight) must end a segment exactly like `;` does, and a run
        of newline + other punctuation (e.g. `&&` immediately followed by a
        line break) must still count as one boundary, not fall through
        `_SEGMENT_SEPARATORS`-style exact-token matching."""
        self.assertEqual(guard._tokenize("git add -A\ngit push")[3], "\n")
        # `punctuation_chars` groups adjacent punctuation into a single token,
        # so `&&` immediately followed by a newline is one token: "&&\n".
        tokens = guard._tokenize("git add -A &&\ngit push")
        self.assertIn("&&\n", tokens)
        self.assertTrue(guard._is_git_push("git add -A &&\ngit push"))

    def test_unknown_global_option_does_not_misread_its_value_as_subcommand(self):
        """Critical #4's structural half: an option this module has never
        heard of must not be treated as a bare flag (the old bug let the
        *value* of such an option — e.g. `main` in `--attr-source main` — be
        mistaken for the subcommand, hiding the real `push` after it)."""
        self.assertEqual(
            guard._git_subcommand(["git", "--totally-unknown-flag", "value", "push"]),
            "push",
        )
        # And the safe complement: no `push` anywhere after an unknown option
        # must NOT be reported as one (this is not "block every unknown flag").
        self.assertIsNone(
            guard._git_subcommand(["git", "--totally-unknown-flag", "value", "status"])
        )


class GitOptsWithValueRegressionTest(unittest.TestCase):
    """`--attr-source` (Critical #4's concrete trigger) must be in the
    whitelist by name, independent of the structural fail-closed fallback
    tested above — belt and suspenders, since the precise skip is strictly
    more accurate than the conservative fallback when we *do* know an option
    takes a value."""

    def test_attr_source_is_registered(self):
        self.assertIn("--attr-source", guard._GIT_OPTS_WITH_VALUE)


if __name__ == "__main__":
    unittest.main()
