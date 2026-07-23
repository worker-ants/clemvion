"""Differential tests for the push guard's blind-scan + allowlist design.

The guard detects `git push` in two halves (SoR:
plan/in-progress/harness-push-guard-subcommand-detection.md):

  1. a BLIND regex over raw text — ignorant on purpose, so it has no false
     negatives that a shell-aware parser would introduce;
  2. an ENUMERATED allowlist that releases only shapes provably proven to be
     inert TEXT (a commit message, a grep pattern).

A 2026-07-17 rewrite that replaced (1) with shlex-based subcommand detection was
REVERTED: /ai-review found a new false-NEGATIVE class every round (`git $'push'`,
`git $"push"`, backticks, `bash -c "… && git push"`). The shell's
text-transforming features are unbounded; the blind regex's false POSITIVES are
finite. This suite exists to keep that trade from being made again:

  * `test_blind_pattern_is_frozen` pins half (1) byte-for-byte;
  * `test_no_new_false_negatives` re-runs the ORIGINAL regex (frozen below as
    `_LEGACY_PATTERN`) over the whole corpus and fails if the guard releases
    anything that is not an explicitly enumerated, justified exception.

Every command the 3 review rounds surfaced is in CORPUS as a regression floor.
"""

from __future__ import annotations

import re
import unittest

import _harness  # noqa: F401  — side effect: harness path setup; HOOKS_DIR used below

guard = _harness.load_module_by_path(
    "guard_review_before_push",
    _harness.HOOKS_DIR / "guard_review_before_push.py",
)

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


# --- corpus ----------------------------------------------------------------
# (command, note). Everything the review rounds found is here as a floor.
CORPUS: list[tuple[str, str]] = [
    # round 1 — spellings a subcommand parser missed
    ("git add -A\ngit push", "newline as the only separator"),
    ("git --attr-source main push", "global option before the subcommand"),
    # round 2 — the region really executes
    ('git commit -m "$(git push)"', "command substitution inside the message"),
    ('git commit -m "`git push`"', "backtick inside the message"),
    ('bash -c "cd /tmp && git push"', "&& inside a -c script"),
    # round 3 — shell quoting forms
    ("git $'push'", "ANSI-C quoting"),
    ('git $"push"', "locale-translation quoting"),
    ("git 'pu''sh' --force", "quote splitting (legacy misses it too)"),
    ("GIT push", "uppercase (legacy misses it too)"),
    ("git push\x00 extra", "NUL contamination"),
    ('eval "git push"', "eval (legacy misses it too)"),
    # plain true positives
    ("git push", "bare"),
    ("git push origin HEAD", "with args"),
    ("git -C /tmp push", "-C"),
    ("GIT_SSH=x git push", "env assignment prefix"),
    ("git add -A && git push", "&& chain"),
    ("git push --force-with-lease", "force variant"),
    # message/grep text ADJACENT to a real push — the push must survive
    ('git commit -m "msg" && git push', "message then a real push"),
    ('git commit -m "a" && git push -f', "message then a real force push"),
    ('git commit -m "push" ; git push', "; then a real push"),
    ("git commit -F - <<'EOF'\nmsg\nEOF\n&& git push", "heredoc then a real push"),
    ('grep "x\\|git push" f && git push', "grep pattern then a real push"),
    (r'echo "a\\" | git push', "escaped backslash then a REAL pipe"),
    # release-rule abuse attempts
    ("bash <<'EOF'\nfoo && git push\nEOF", "heredoc body that bash EXECUTES"),
    (
        'echo "git commit -F -" | bash <<\'EOF\'\nfoo && git push\nEOF',
        "context spoof: the idiom sits in an echo arg, bash owns the heredoc",
    ),
    ("git commit -F - <<EOF\nfoo && git push $(id)\nEOF", "unquoted delim + expansion"),
    ('bash -c "git commit -m \\"x\\" && git push"', "escaped quotes inside -c"),
    # known false positive kept ON PURPOSE (see the test below)
    ("git log --grep=push", "flag VALUE, not a message region"),
    # not a push at all
    ("git status", "unrelated git"),
    ("ls -la", "unrelated"),
    # the releases themselves
    ('git commit -m "add push notification"', "FP: -m message"),
    ('git commit -m "fix: do not push twice"', "FP: -m message"),
    ('git commit -m "a" -m "b && git push"', "FP: repeated -m"),
    ('git -c core.hooksPath=/dev/null commit -m "push"', "FP: -c then -m"),
    ("git commit -F - <<'EOF'\nadd push flow\nEOF", "FP: commit heredoc"),
    ("git commit -F - <<'EOF'\nfoo && git push\nEOF", "FP: && inside message body"),
    (
        "git commit -q -F - <<'EOF'\nfeat: push guard\n\nbody mentions push\nEOF",
        "FP: the real-world commit idiom",
    ),
    ('grep -n "foo\\|git push\\|bar" f', "FP: escaped pipe in a grep pattern"),
]

# The ONLY commands allowed to go from legacy-BLOCK to allowed. Each carries the
# argument for why the released text can never execute.
RELEASED: dict[str, str] = {
    'git commit -m "add push notification"':
        "-m value is message text; contains no $( ` ${ so the shell expands nothing",
    'git commit -m "fix: do not push twice"':
        "same: inert -m value",
    'git commit -m "a" -m "b && git push"':
        "both -m values are message text; the && lives inside the quoted value",
    'git -c core.hooksPath=/dev/null commit -m "push"':
        "-c is a git config pair, -m value is inert message text",
    "git commit -F - <<'EOF'\nadd push flow\nEOF":
        "heredoc owned by `git commit -F -`; quoted delimiter, body is inert",
    "git commit -F - <<'EOF'\nfoo && git push\nEOF":
        "same owner; the && is message text git stores, not a shell operator",
    "git commit -q -F - <<'EOF'\nfeat: push guard\n\nbody mentions push\nEOF":
        "same owner; the idiom this repo actually uses for commit messages",
    'grep -n "foo\\|git push\\|bar" f':
        r"the segment start is `\|`, a backslash-escaped literal pipe — never a "
        r"shell pipe operator, in or out of quotes",
}


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
        for command, note in CORPUS:
            with self.subTest(note=note, command=command):
                if legacy_is_push(command) and not guard._is_git_push(command):
                    self.assertIn(
                        command, RELEASED,
                        f"{note}: the guard stopped blocking a command the blind "
                        "scan catches, and it is not an enumerated release. This "
                        "is a FALSE NEGATIVE — unreviewed code could be pushed.",
                    )

    def test_no_new_blocks(self):
        """The allowlist may only ever RELEASE; it must never add blocking."""
        for command, note in CORPUS:
            with self.subTest(note=note, command=command):
                if guard._is_git_push(command):
                    self.assertTrue(
                        legacy_is_push(command),
                        f"{note}: blocked by the new guard but not by the blind "
                        "scan — the allowlist layer must only subtract.",
                    )

    def test_every_enumerated_release_actually_releases(self):
        """A stale RELEASED entry (fixed upstream, or never reproducing) would
        silently weaken the differential test into a tautology."""
        for command, why in RELEASED.items():
            with self.subTest(command=command):
                self.assertTrue(
                    legacy_is_push(command),
                    "this entry is not a legacy block, so it proves nothing",
                )
                self.assertFalse(
                    guard._is_git_push(command),
                    f"expected release ({why}) but the guard still blocks",
                )


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
        """An earlier draft tested whether the opening LINE mentioned the commit
        idiom; this command defeats that by putting the idiom in an echo arg
        while `bash` owns the heredoc."""
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


class ReleaseTest(unittest.TestCase):
    """The false positives this change exists to remove."""

    def _released(self, command):
        self.assertTrue(legacy_is_push(command), "precondition: legacy blocks it")
        self.assertFalse(guard._is_git_push(command))

    def test_commit_message_word_push_is_released(self):
        self._released('git commit -m "add push notification"')

    def test_commit_heredoc_body_is_released(self):
        self._released("git commit -F - <<'EOF'\nadd push flow\nEOF")

    def test_repo_commit_idiom_is_released(self):
        self._released(
            "git commit -q -F - <<'EOF'\nfeat: push guard\n\nbody mentions push\nEOF"
        )

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


if __name__ == "__main__":
    unittest.main()
