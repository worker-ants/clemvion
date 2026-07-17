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

import re
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
    # --- regression cases found by /ai-review of this file's own rewrite ------
    # (review/code/2026/07/17/18_04_20, Critical #1). Indirect execution: a
    # real shell evaluates `$(...)`/backticks and re-executes `-c`/`eval`
    # strings *before* the surrounding command runs, so a `push` hidden
    # inside one of these really does execute even though it is never a bare
    # `push` token in the outer segment.
    ("command substitution inside a quoted -m argument hides a real push",
     'git commit -m "$(git push)"'),
    ("backtick command substitution inside a quoted -m argument",
     'git commit -m "`git push`"'),
    ("command substitution alongside other text in the same argument",
     'git commit -am "deploy: $(git push origin main)"'),
    ("nested command substitution — a non-nesting-aware extractor "
     "(e.g. a regex like `\\$\\(([^()]*)\\)`) stops at the first inner ')' "
     "and would miss the outer span that actually contains the literal "
     "git/push tokens",
     'git commit -m "$(echo $(git push))"'),
    ("bash -c whose script string has its own && — measured: the legacy "
     "regex already blocked this via its raw && substring anchor, so this "
     "is a regression like the $(...) cases above, not the shared old/new "
     "blind spot originally reported for it",
     'bash -c "cd /tmp && git push"'),
    ("bash -c with no separator in the script string — pre-existing gap "
     "(the legacy regex missed this too), closed in the same pass because "
     "it is the same -c recursion",
     'bash -c "git push"'),
    ("sh -c via absolute path, case-insensitive interpreter basename match",
     '/bin/SH -c "git push"'),
    ("eval — pre-existing gap (the legacy regex missed this too; the "
     "plan's earlier \"eval is accepted\" note is corrected alongside), "
     "closed in the same pass",
     'eval "git push"'),
    ("eval with unquoted arguments — POSIX eval joins all of its "
     "arguments with a single space before re-executing the result",
     'eval git push'),
    ("NUL byte fuses onto the push token, defeating _git_subcommand's "
     "exact-string comparison — the legacy regex's \\b treated NUL as a "
     "non-word character and blocked this correctly (WARNING #1)",
     "git push\x00 extra"),
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
    # --- review/code/2026/07/17/18_04_20 additions ---------------------------
    ("command substitution whose inner command is not git — recursion must "
     "not over-trigger on an unrelated substitution",
     'git commit -m "$(date)"'),
    ("bash -c running something that is not a push",
     'bash -c "echo hello"'),
    ("eval running something that is not a push",
     'eval "echo hello"'),
    # WARNING #2 (measured false positive, plan's "이론적 사례" claim refuted):
    # a known boolean global option must not fall into the fail-closed branch
    # and scan the rest of the segment for someone else's literal "push".
    ("boolean global option followed by an unrelated subcommand whose own "
     "argument happens to be the literal word push",
     "git --no-pager log --grep push"),
    ("same WARNING #2 shape via a different boolean option/subcommand pair",
     "git --no-pager checkout push"),
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

    def test_quoted_pure_punctuation_is_read_as_a_boundary_and_that_is_safe(self):
        """Pins the *measured* behaviour, against a plausible-sounding claim.

        posix shlex strips quotes, so a quoted string that is nothing but
        punctuation is indistinguishable from the real operator by the time
        `_is_segment_boundary` sees it — quoting does NOT protect it, and the
        module docstring must not claim otherwise. Safe in the fail-safe
        direction: splitting only shortens segments, and a shorter segment
        cannot acquire a `push` subcommand it never had.
        """
        self.assertTrue(guard._is_segment_boundary("&&"))
        self.assertEqual(guard._tokenize('git commit -m "&&"'),
                         ["git", "commit", "-m", "&&"])
        # …and the over-split still resolves to `commit`, so it stays allowed.
        self.assertFalse(guard._is_git_push('git commit -m "&&"'))
        # A mixed-content quoted token stays one word — that is what keeps the
        # quoted-grep case (B) working.
        self.assertFalse(guard._is_segment_boundary("a|b"))

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


# =============================================================================
# review/code/2026/07/17/18_04_20 — Critical #1 (indirect execution) and
# WARNING #1-#3 (NUL bytes, boolean global options, docstring accuracy).
# =============================================================================


class RecursiveIndirectionTest(unittest.TestCase):
    """`_is_git_push`-level behaviour of the new recursion, beyond what the
    MUST_BLOCK/MUST_ALLOW table already exercises: the accepted over-blocking
    trade-off and the recursion depth cap."""

    def test_single_quoted_substitution_is_over_blocked_and_that_is_accepted(self):
        """A real shell does NOT evaluate `$(...)` inside single quotes, so
        this does not actually push. `_find_command_substitutions` scans the
        raw command string, not quote-aware tokens, so it cannot tell single
        quotes from double quotes or bare — accepted, safe-direction
        over-blocking (see that function's docstring and the plan's
        "잔여 한계" section). Do not "fix" this by making the guard more
        permissive."""
        self.assertTrue(guard._is_git_push("git commit -m '$(git push)'"))

    def test_recursion_depth_is_capped(self):
        """A substitution/`-c`/`eval` chain deeper than `_MAX_RECURSION_DEPTH`
        stops being followed. Tested by injecting `_depth` directly rather
        than constructing a real deeply-nested shell string: unquoted nested
        `$(...)` is *also* caught by the plain segment-boundary tokenizer
        (bare parens are segment separators on their own, pre-dating this
        session), which would make a string-only test pass for the wrong
        reason and prove nothing about the depth cap specifically."""
        one_below_cap = guard._MAX_RECURSION_DEPTH - 1
        self.assertTrue(
            guard._is_git_push('echo "$(git push)"', one_below_cap),
            "one level of recursion budget must still find the push",
        )
        self.assertFalse(
            guard._is_git_push('echo "$(git push)"', guard._MAX_RECURSION_DEPTH),
            "starting already at the cap must not open the substitution — "
            "only the outer `echo \"...\"` segment is evaluated directly, "
            "and that segment's subcommand is not git",
        )


class CommandSubstitutionExtractionTest(unittest.TestCase):
    """`_find_command_substitutions` in isolation."""

    def test_dollar_paren_is_extracted(self):
        self.assertEqual(
            guard._find_command_substitutions('echo "$(git push)"'),
            ["git push"],
        )

    def test_backtick_is_extracted(self):
        self.assertEqual(
            guard._find_command_substitutions('echo "`git push`"'),
            ["git push"],
        )

    def test_nested_dollar_paren_uses_a_balanced_scan(self):
        """A non-nesting-aware regex like `\\$\\(([^()]*)\\)` matches only the
        inner `$(date)` here and loses the outer span containing the literal
        `git push` tokens — pinned directly against that failure mode."""
        self.assertEqual(
            guard._find_command_substitutions("$(git push $(date))"),
            ["git push $(date)"],
        )

    def test_no_substitution_returns_empty(self):
        self.assertEqual(guard._find_command_substitutions("git status"), [])

    def test_unterminated_backtick_does_not_raise(self):
        self.assertEqual(guard._find_command_substitutions("echo `unterminated"), [])

    def test_unterminated_dollar_paren_takes_the_rest_of_the_string(self):
        """Over-inclusive rather than raising — the safe direction for
        something this module cannot fully parse."""
        self.assertEqual(
            guard._find_command_substitutions("echo $(unterminated"),
            ["unterminated"],
        )


class ShellDashCAndEvalArgumentTest(unittest.TestCase):
    """`_shell_dash_c_argument` / `_eval_argument` in isolation."""

    def test_bash_dash_c(self):
        self.assertEqual(
            guard._shell_dash_c_argument(["bash", "-c", "git push"]), "git push"
        )

    def test_matched_by_basename_and_case_insensitively(self):
        """Same reasoning as `_git_subcommand`'s `git` check (Critical #3):
        a case-insensitive filesystem resolves `ZSH` to the same binary."""
        self.assertEqual(
            guard._shell_dash_c_argument(["/bin/ZSH", "-c", "git push"]), "git push"
        )

    def test_no_dash_c_token_returns_none(self):
        self.assertIsNone(guard._shell_dash_c_argument(["bash", "script.sh"]))

    def test_non_shell_first_token_returns_none(self):
        self.assertIsNone(
            guard._shell_dash_c_argument(["python3", "-c", "print(1)"])
        )

    def test_trailing_dash_c_with_no_following_value_returns_none(self):
        self.assertIsNone(guard._shell_dash_c_argument(["bash", "-c"]))

    def test_empty_segment_returns_none(self):
        self.assertIsNone(guard._shell_dash_c_argument([]))

    def test_eval_joins_multiple_bare_arguments_with_a_space(self):
        """POSIX eval semantics: all arguments are concatenated with a
        single space before being re-executed."""
        self.assertEqual(guard._eval_argument(["eval", "git", "push"]), "git push")

    def test_eval_single_quoted_argument(self):
        self.assertEqual(guard._eval_argument(["eval", "git push"]), "git push")

    def test_eval_with_no_arguments_returns_none(self):
        self.assertIsNone(guard._eval_argument(["eval"]))

    def test_non_eval_first_token_returns_none(self):
        self.assertIsNone(guard._eval_argument(["echo", "hi"]))


class HostileControlCharacterTest(unittest.TestCase):
    """`_has_hostile_control_characters` — WARNING #1."""

    def test_nul_is_hostile(self):
        self.assertTrue(guard._has_hostile_control_characters("git push\x00 extra"))

    def test_escape_character_is_hostile(self):
        self.assertTrue(guard._has_hostile_control_characters("git push\x1b[0m"))

    def test_newline_is_benign(self):
        """Heredocs and multi-line commands are ordinary, expected content —
        see the function's docstring for why treating `\\n` as hostile would
        reintroduce the false positives the shlex rewrite removed."""
        self.assertFalse(guard._has_hostile_control_characters("git add -A\ngit push"))

    def test_tab_and_carriage_return_are_benign(self):
        self.assertFalse(guard._has_hostile_control_characters("git\tstatus\r"))

    def test_plain_command_has_none(self):
        self.assertFalse(guard._has_hostile_control_characters("git push"))

    def test_nul_command_still_blocks_via_the_fallback(self):
        """End-to-end: entry into `_is_git_push` must fail closed, not just
        the helper predicate in isolation."""
        self.assertTrue(guard._is_git_push("git push\x00 extra"))


class GitOptsNoValueTest(unittest.TestCase):
    """WARNING #2: a known boolean global option must not fall into
    `_git_subcommand`'s fail-closed branch, which scans the rest of the
    segment for a literal "push" token and can catch someone else's
    argument (measured: `git --no-pager log --grep push`)."""

    def test_no_pager_does_not_swallow_the_next_token(self):
        self.assertEqual(
            guard._git_subcommand(["git", "--no-pager", "log", "--grep", "push"]),
            "log",
        )

    def test_bare_switch_still_finds_a_real_push_after_it(self):
        self.assertEqual(
            guard._git_subcommand(["git", "--no-pager", "push"]), "push"
        )

    def test_every_no_value_option_skips_only_itself(self):
        """Table-driven so a future edit to the set is covered automatically
        — same rationale as `test_all_value_taking_global_options_skip_their_value`
        above."""
        for opt in sorted(guard._GIT_OPTS_NO_VALUE):
            with self.subTest(option=opt):
                self.assertEqual(
                    guard._git_subcommand(["git", opt, "status"]),
                    "status",
                    f"{opt!r} must not consume the following token as a value",
                )


class ResidualLimitationsTest(unittest.TestCase):
    """Pins the *documented, unfixed* structural gaps of a static
    token-based guard (this session's "잔여 한계") at their actual measured
    value. Neither of these was ever caught by the legacy regex either —
    extending coverage to them is future work, not a regression to close
    now. A silent behaviour change here (e.g. `_tokenize` accidentally
    starting to catch `find -exec`) should be a deliberate, reviewed
    decision, not a side effect noticed only by prose going stale.
    """

    def test_find_exec_indirection_is_not_detected(self):
        self.assertFalse(guard._is_git_push(r"find . -exec git push \;"))

    def test_process_substitution_is_not_detected(self):
        self.assertFalse(guard._is_git_push("diff <(git push) x"))

    def test_git_alias_is_not_detected(self):
        # After `git config alias.p push` (itself correctly allowed — push is
        # just an argument to `config`), invoking the alias is invisible to a
        # static token-based guard: `_git_subcommand` sees literal subcommand
        # "p", not "push".
        self.assertFalse(guard._is_git_push("git p"))


# A broad sample of commands with nothing to do with this ticket, so the
# differential test's corpus below is not limited to hand-picked push cases.
ORDINARY_SHELL_COMMANDS = [
    "ls -la",
    "npm install",
    "npm run build && npm test",
    "pytest tests/ -v",
    "docker ps -a",
    "curl -s https://example.com/api | jq '.data'",
    "echo 'hello world'",
    "cat file.txt | grep foo | wc -l",
    "python3 script.py --arg value",
    "mkdir -p /tmp/foo && cd /tmp/foo",
    "rm -rf node_modules",
    "find . -name '*.py' -exec cat {} \\;",
    "export FOO=bar && echo $FOO",
    "tar -czf archive.tar.gz ./src",
    "ssh user@host 'ls -la'",
    "kubectl get pods -n default",
    "make test",
    "cd codebase/backend && pnpm test",
    "git log --oneline -10",
    "git diff HEAD~1",
    "git status --porcelain",
    "git add -A",
    "git commit -m 'fix: something'",
    "git checkout -b feature/x",
    "git fetch origin",
    "git pull --rebase",
    "gh pr create --title 'x' --body 'y'",
    "echo $(whoami)",
    "VAR=$(date +%Y-%m-%d)",
]

# The worked table from review/code/2026/07/17/18_04_20's task description,
# folded into the differential corpus so the differential test's finding can
# be checked directly against that table's old/new verdicts.
INDIRECT_EXECUTION_CASES = [
    'git commit -m "$(git push)"',
    'git commit -m "`git push`"',
    'bash -c "cd /tmp && git push"',
    'bash -c "git push"',
    'eval "git push"',
    "diff <(git push) x",
    r"find . -exec git push \;",
]


class LegacyRegressionDifferentialTest(unittest.TestCase):
    """Structural regression gate: **everything the legacy regex used to
    block, the rewrite must still block** (old ⊆ new) — except for a short,
    named list of commands this project *deliberately* flipped from BLOCK to
    ALLOW because the legacy regex blocked them by mistake (false positives).

    `_LEGACY_RE` is a deliberate, frozen duplicate of the regex this module
    used before the shlex rewrite — a regression baseline, not a second
    source of truth. It must never be "fixed" to match new behaviour; if it
    needs to change, the whole point of this test is gone.

    This exists because one-off regression tests for each individually
    discovered case (Critical #1-#4 from the 2026-07-17 17_09_10 review,
    then the command-substitution/`-c`/`eval` regressions from 18_04_20) do
    not, by themselves, prove there is no *next* case nobody thought to
    write down. Running the real legacy regex against a broad corpus does
    not depend on anyone having enumerated the failure mode in advance.
    """

    # Deliberate, frozen copy of the pre-rewrite regex
    # (guard_review_before_push.py, before the shlex rewrite). Do not import
    # it from the module under test and do not "fix" it — see the class
    # docstring.
    _LEGACY_RE = re.compile(
        r"(?:^|&&|;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\b[^&;|]*\bpush\b"
    )

    # Commands where `legacy(c) and not new(c)` is EXPECTED and accepted.
    # Every entry names which shape it is and why the flip is intentional.
    # This list must stay SHORT — if a future corpus addition needs a fifth
    # shape to pass, that is very likely an undiscovered regression, not
    # another exception to wave through.
    _INTENTIONAL_FLIPS = {
        # 1. A commit message (heredoc or `-m`) that merely *mentions* the
        #    word "push" — the legacy regex's unbounded git-to-push distance
        #    read straight through the message body.
        "git commit -F - <<'EOF'\nfix: the CLI passes but push is blocked\n\nbody\nEOF":
            "heredoc commit message merely mentions push",
        'git commit -m "explain why push was blocked"':
            "-m commit message merely mentions push",
        # 2. A quoted grep pattern whose `\|` the legacy regex misread as an
        #    unquoted pipe, treating what followed as a new segment.
        'grep -n "foo\\|git push\\|bar" file.py | head -6':
            "quoted \\| inside a grep pattern misread as a pipe",
        # 3. `push` as a plain argument to an unrelated subcommand
        #    (`config`), not the subcommand itself.
        "git config alias.p push":
            "push is config's argument, not the subcommand",
        # 4. WARNING #2: a known-boolean global option followed by an
        #    unrelated subcommand whose own argument happens to be the
        #    literal word "push".
        "git --no-pager log --grep push":
            "WARNING #2 — --no-pager mis-triaged as an unknown option",
        "git --no-pager checkout push":
            "WARNING #2 — same shape, different subcommand/argument",
    }

    def _corpus(self) -> list[str]:
        # De-duplicated, order-preserving: several MUST_BLOCK entries and
        # INDIRECT_EXECUTION_CASES deliberately overlap (the latter mirrors
        # the task table verbatim for direct cross-checking), and a repeated
        # command would otherwise show up twice in a failure's diff.
        commands = (
            [command for _, command in MUST_BLOCK]
            + [command for _, command in MUST_ALLOW]
            + INDIRECT_EXECUTION_CASES
            + ORDINARY_SHELL_COMMANDS
        )
        return list(dict.fromkeys(commands))

    def test_every_legacy_block_is_still_blocked_or_an_acknowledged_exception(self):
        unjustified = []
        for command in self._corpus():
            legacy_blocks = bool(self._LEGACY_RE.search(command))
            new_blocks = guard._is_git_push(command)
            if legacy_blocks and not new_blocks and command not in self._INTENTIONAL_FLIPS:
                unjustified.append(command)
        self.assertEqual(
            unjustified, [],
            "legacy regex blocked these but the rewrite does not, and they "
            "are not in the acknowledged exception list — old ⊆ new is "
            "violated (this is how the $(...) /-c/eval regressions were "
            "found):\n" + "\n".join(repr(c) for c in unjustified),
        )

    def test_every_intentional_flip_is_actually_exercised(self):
        """Guards against exception-list rot: an entry that no longer
        appears in the corpus (e.g. a MUST_ALLOW case got reworded) would
        silently stop being checked at all, and a stale entry that the
        rewrite now blocks too would hide a tightening nobody meant to
        revert."""
        corpus = set(self._corpus())
        for command, reason in self._INTENTIONAL_FLIPS.items():
            with self.subTest(command=command, reason=reason):
                self.assertIn(command, corpus, "stale — no longer in the corpus")
                self.assertTrue(
                    self._LEGACY_RE.search(command),
                    "listed as an intentional flip, but the legacy regex "
                    "does not even block it — stale entry",
                )
                self.assertFalse(
                    guard._is_git_push(command),
                    "listed as an intentional flip, but the rewrite blocks "
                    "it too now — stale entry (or an unintended tightening)",
                )


if __name__ == "__main__":
    unittest.main()
