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


if __name__ == "__main__":
    unittest.main()
