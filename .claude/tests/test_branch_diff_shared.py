"""The branch-diff probe, after it stopped being two copies.

`consistency_orchestrator._branch_changed_rels` and
`code_review_orchestrator.get_git_branch_diff_files` ran the same git command
behind a "Mirrors X — change both" comment on each. That is the arrangement
`_shared/report_paths.py`, `_shared/retry_state.py` and `_shared/git_probe.py`
were each created to replace, after the pair they governed drifted anyway.

This pair had drifted too. Measured 2026-08-07 on one fixture repo, before the
extraction:

    file on disk        code-review copy        consistency copy
    " lead.ts"          "lead.ts"     ← wrong   " lead.ts"      ← right
    "한글.ts"           C-quoted      ← wrong   C-quoted        ← wrong

The first is round 7's leading-space bug (`.strip()` on a whole stdout blob) in a
third place. The second is a flag `_shared/git_probe._run_git` already sets and
neither copy did.

Neither shape exists in this repository today — 0 of 18,748 tracked files carry a
non-ASCII byte, a leading/trailing space, a quote or a backslash — so both were
latent. They are pinned here anyway, because a fixture is the only thing that
tells the two implementations apart, and "the two agree" is the property the
'change both' comment was asking a human to hold.

Fresh-interpreter convention, as in `test_review_changeset_warning`: importing an
orchestrator in-process collides on the name `_lib` (the hook suites put
`.claude/hooks/_lib` on `sys.path` and `from _lib import project_config` then
resolves to the wrong package). Standalone runs would pass while `discover`
fails, so this must not be "fixed" by running the file on its own.
"""

from __future__ import annotations

import os
import shutil
import tempfile
import unittest

import _harness
from _harness import REPO_ROOT

CODE_REVIEW_ORCH = (
    REPO_ROOT / ".claude" / "skills" / "code-review-agents" / "scripts"
    / "code_review_orchestrator.py"
)
CONSISTENCY_ORCH = (
    REPO_ROOT / ".claude" / "skills" / "consistency-checker" / "scripts"
    / "consistency_orchestrator.py"
)

_CODE_REVIEW_PREAMBLE = _harness.orchestrator_preamble(CODE_REVIEW_ORCH, imports="os")
_CONSISTENCY_PREAMBLE = _harness.orchestrator_preamble(CONSISTENCY_ORCH, imports="os")

# Both orchestrators run git in the PROCESS cwd (`repo_root()` is `os.getcwd()` on
# the consistency side, `_git` inherits it on the code-review side), so the
# snippets chdir into the fixture rather than passing a root through.
_CODE_REVIEW_CALL = """
    os.chdir(ARG["repo"])
    emit(orch.get_git_branch_diff_files(ARG["base"]))
    """
_CONSISTENCY_CALL = """
    os.chdir(ARG["repo"])
    emit(sorted(orch._branch_changed_rels(ARG["base"], ARG["repo"])))
    """


def _fixture(files, *, base_branch="main"):
    """A repo with `files` added on a feature branch off `base_branch`."""
    tmp = tempfile.mkdtemp()
    repo = _harness.make_temp_git_repo(os.path.join(tmp, "r"), branch=base_branch)
    _harness.git_in(repo, "checkout", "-qb", "feat")
    for name in files:
        path = os.path.join(repo, name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write("x\n")
    _harness.git_in(repo, "add", "-A")
    _harness.git_in(repo, "commit", "-qm", "feat")
    return tmp, repo


class BothOrchestratorsSeeTheSameFilesTest(unittest.TestCase):
    """One implementation, driven through each orchestrator's own entry point.

    Testing `git_probe.branch_diff_files` alone would not catch a caller that
    kept its own copy, or one that re-mangled the result on the way out — and a
    mangled result is exactly what the drift was.
    """

    def setUp(self):
        self._tmp = None

    def tearDown(self):
        if self._tmp:
            shutil.rmtree(self._tmp, ignore_errors=True)

    def _both(self, files):
        self._tmp, repo = _fixture(files)
        arg = {"repo": str(repo), "base": "main"}
        code_review = _harness.run_in_orchestrator(
            _CODE_REVIEW_PREAMBLE, _CODE_REVIEW_CALL, arg)
        consistency = _harness.run_in_orchestrator(
            _CONSISTENCY_PREAMBLE, _CONSISTENCY_CALL, arg)
        return sorted(code_review), sorted(consistency)

    def test_an_ordinary_changeset_agrees(self):
        code_review, consistency = self._both(["sub/a.ts", "b.md"])
        self.assertEqual(code_review, ["b.md", "sub/a.ts"])
        self.assertEqual(code_review, consistency)

    def test_a_leading_space_survives_on_both_sides(self):
        """The measured drift. The code-review copy returned `"lead.ts"` for a
        file named `" lead.ts"` — a path that then matches nothing on disk, so
        the file is silently dropped from the review corpus."""
        code_review, consistency = self._both([" lead.ts"])
        self.assertEqual(code_review, [" lead.ts"])
        self.assertEqual(code_review, consistency)

    def test_a_trailing_space_survives_in_the_last_position(self):
        """Why the shared probe reads `_run_git_raw` rather than `_run_git`.

        `_run_git` rstrips the whole stdout blob, which is right for every
        scalar probe (`rev-parse`, `merge-base`, `log`) and wrong for a
        newline-separated list: it renames whichever path git prints LAST.

        The path must therefore genuinely end in a space, and must be last. A
        first draft used `"trail .ts"` — the space is in the middle, rstrip does
        not touch it, and the test passed against the broken implementation.
        The mutation run caught it; the assertion below is what makes the
        fixture state its own precondition instead.
        """
        name = "trailing.ts "
        self._tmp, repo = _fixture(["aaa.ts", name])
        raw = _harness.git_in(
            repo, "diff", "--no-renames", "--name-only", "main...HEAD").stdout
        self.assertTrue(raw.endswith(name + "\n"),
                        f"픽스처가 마지막 줄에 후행 공백 경로를 두지 못했다: {raw!r}")

        arg = {"repo": str(repo), "base": "main"}
        code_review = sorted(_harness.run_in_orchestrator(
            _CODE_REVIEW_PREAMBLE, _CODE_REVIEW_CALL, arg))
        consistency = sorted(_harness.run_in_orchestrator(
            _CONSISTENCY_PREAMBLE, _CONSISTENCY_CALL, arg))
        self.assertEqual(code_review, ["aaa.ts", name])
        self.assertEqual(code_review, consistency)

    def test_a_non_ascii_path_comes_back_decoded(self):
        """Neither copy passed `core.quotePath=false`, so both returned
        `"\\355\\225\\234\\352\\270\\200.ts"` — quotes and all. That string is
        handed straight to `git diff -- <path>` downstream, which matches
        nothing, so the file arrives at the reviewer with an empty diff."""
        code_review, consistency = self._both(["한글.ts"])
        self.assertEqual(code_review, ["한글.ts"])
        self.assertEqual(code_review, consistency)

    def test_an_unresolvable_base_is_empty_on_both_sides(self):
        """The failure defaults differ in TYPE (list vs set) and that is
        deliberate — each orchestrator's callers depend on its own. What must
        not differ is that failure is empty rather than an exception."""
        self._tmp, repo = _fixture(["a.ts"])
        arg = {"repo": str(repo), "base": "no-such-ref"}
        self.assertEqual(
            _harness.run_in_orchestrator(_CODE_REVIEW_PREAMBLE, _CODE_REVIEW_CALL, arg), [])
        self.assertEqual(
            _harness.run_in_orchestrator(_CONSISTENCY_PREAMBLE, _CONSISTENCY_CALL, arg), [])


class ThreeDotIsNotNegotiableTest(unittest.TestCase):
    """`A...HEAD`, not `A HEAD`. Both copies documented this independently.

    Two-dot diffs the two tips, so a base that has advanced past this branch's
    fork point turns work that landed on the base into REVERSE DELETIONS here —
    a checker then reads code the branch never touched as "removed".
    """

    def test_a_base_that_advanced_does_not_leak_into_the_changeset(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        repo = _harness.make_temp_git_repo(os.path.join(tmp, "r"), branch="main")

        _harness.git_in(repo, "checkout", "-qb", "feat")
        with open(os.path.join(repo, "mine.ts"), "w", encoding="utf-8") as f:
            f.write("mine\n")
        _harness.git_in(repo, "add", "-A")
        _harness.git_in(repo, "commit", "-qm", "feat")

        # main moves on, independently of this branch.
        _harness.git_in(repo, "checkout", "-q", "main")
        with open(os.path.join(repo, "theirs.ts"), "w", encoding="utf-8") as f:
            f.write("theirs\n")
        _harness.git_in(repo, "add", "-A")
        _harness.git_in(repo, "commit", "-qm", "base moved")
        _harness.git_in(repo, "checkout", "-q", "feat")

        # Vacuity check: two-dot really would drag `theirs.ts` in, so the
        # assertion below is measuring the three-dot behaviour and not an empty
        # repository.
        two_dot = _harness.git_in(
            repo, "diff", "--no-renames", "--name-only", "main", "HEAD").stdout.split()
        self.assertIn("theirs.ts", two_dot)

        arg = {"repo": str(repo), "base": "main"}
        for label, preamble, call in (
            ("code-review", _CODE_REVIEW_PREAMBLE, _CODE_REVIEW_CALL),
            ("consistency", _CONSISTENCY_PREAMBLE, _CONSISTENCY_CALL),
        ):
            with self.subTest(orchestrator=label):
                self.assertEqual(
                    sorted(_harness.run_in_orchestrator(preamble, call, arg)),
                    ["mine.ts"],
                )


class SharedProbeContractTest(unittest.TestCase):
    """Properties of `git_probe` itself that the split into raw/trimmed created."""

    def _probe(self):
        import sys
        if str(_harness.CLAUDE_DIR) not in sys.path:
            sys.path.insert(0, str(_harness.CLAUDE_DIR))
        from _shared import git_probe
        return git_probe

    def test_run_git_still_trims_for_the_scalar_callers(self):
        """The split must not change what the three hooks already depend on:
        `rev-parse`/`merge-base`/`log` want the bare value, and `_porcelain_path`
        needs the LEADING space kept."""
        gp = self._probe()
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        repo = _harness.make_temp_git_repo(os.path.join(tmp, "r"), branch="main")
        rc, out, _ = gp._run_git(["rev-parse", "--abbrev-ref", "HEAD"], str(repo))
        self.assertEqual((rc, out), (0, "main"), "trailing newline should be gone")

        with open(os.path.join(repo, ".gitkeep"), "w", encoding="utf-8") as f:
            f.write("touched\n")
        _, status, _ = gp._run_git(["status", "--porcelain"], str(repo))
        self.assertTrue(status.startswith(" M "),
                        f"leading status column was eaten: {status!r}")

    def test_the_raw_runner_keeps_stdout_verbatim(self):
        gp = self._probe()
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        repo = _harness.make_temp_git_repo(os.path.join(tmp, "r"), branch="main")
        _, raw, _ = gp._run_git_raw(["rev-parse", "--abbrev-ref", "HEAD"], str(repo))
        self.assertEqual(raw, "main\n")

    def test_on_error_reports_the_failure_the_callers_log(self):
        """Failure is silent and empty by design, so the only way an orchestrator
        can say anything is this callback. Without it the extraction would have
        dropped the consistency side's `debug_log` on a failed diff."""
        gp = self._probe()
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        repo = _harness.make_temp_git_repo(os.path.join(tmp, "r"), branch="main")
        seen = []
        self.assertEqual(
            gp.branch_diff_files("no-such-ref", str(repo), on_error=seen.append), [])
        self.assertEqual(len(seen), 1, f"failure was not reported: {seen}")
        self.assertIn("no-such-ref", seen[0])

    def test_on_error_is_silent_on_success(self):
        """A callback that always fires is the same as no callback."""
        gp = self._probe()
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        repo = _harness.make_temp_git_repo(os.path.join(tmp, "r"), branch="main")
        seen = []
        gp.branch_diff_files("main", str(repo), on_error=seen.append)
        self.assertEqual(seen, [])

    def test_on_error_still_says_something_when_git_produced_no_stderr(self):
        """The other half of the reason string, which nothing exercised.

        A timeout or a missing `git` binary comes back from `_run_git_raw` as
        `(1, "", "")`, so `err.strip()` is empty and the generic fallback runs.
        The test above only covers the bad-ref case, where git writes a real
        message and the `or` branch is never evaluated — half the diagnostic the
        two orchestrators log was unverified.
        """
        from unittest import mock
        gp = self._probe()
        with mock.patch.object(gp, "_run_git_raw", return_value=(1, "", "")):
            seen = []
            self.assertEqual(
                gp.branch_diff_files("main", "/nonexistent", on_error=seen.append), [])
        self.assertEqual(len(seen), 1)
        self.assertIn("rc=1", seen[0])
        self.assertIn("main", seen[0])


class UndecodableGitOutputTest(unittest.TestCase):
    """`text=True` decodes as strict UTF-8, and that broke the failure contract.

    Both orchestrator copies wrapped their git call in `except Exception`, and
    all three docstrings say "empty on any failure". The extraction narrowed that
    to `except (TimeoutExpired, FileNotFoundError, OSError)` — and
    `UnicodeDecodeError` is a `ValueError`, not an `OSError`, so it escaped and
    took the orchestrator process with it. The failure mode changed from "empty
    changeset" to "crash".

    `core.quotePath=false` is what makes this reachable rather than theoretical:
    it is exactly the flag that stops git from C-quoting non-ASCII bytes, so an
    undecodable filename (a latin-1 name created on Linux — this repo's CI runs
    there) arrives as raw bytes. Driven through a fake `git` on PATH rather than
    a mocked `subprocess`, so it tests the decoding this code actually asks for.
    """

    def _probe(self):
        import sys
        if str(_harness.CLAUDE_DIR) not in sys.path:
            sys.path.insert(0, str(_harness.CLAUDE_DIR))
        from _shared import git_probe
        return git_probe

    def _fake_git(self, script_body):
        """Put a `git` on PATH that does what we say. Returns its directory."""
        import stat
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        path = os.path.join(tmp, "git")
        with open(path, "w", encoding="utf-8") as f:
            f.write("#!/bin/sh\n" + script_body)
        os.chmod(path, os.stat(path).st_mode | stat.S_IEXEC)
        return tmp

    def test_a_path_git_cannot_round_trip_does_not_crash_the_caller(self):
        from unittest import mock
        gp = self._probe()
        # 0o344 is a lone latin-1 byte — invalid as UTF-8 continuation.
        bindir = self._fake_git('printf "ok.ts\\nbad\\344name.ts\\n"\nexit 0\n')

        with mock.patch.dict(os.environ,
                             {"PATH": bindir + os.pathsep + os.environ["PATH"]}):
            files = gp.branch_diff_files("main", bindir)

        self.assertEqual(len(files), 2, f"경로가 유실됐다: {files!r}")
        self.assertEqual(files[0], "ok.ts")
        # Surrogateescape, not "replace": the byte survives, so the path can
        # still be handed back to the filesystem.
        self.assertEqual(files[1].encode("utf-8", "surrogateescape"),
                         b"bad\xe4name.ts")

    def test_an_unexpected_exception_is_empty_for_the_list_caller_only(self):
        """Where "empty on any failure" applies — and where it deliberately does not.

        `branch_diff_files` must absorb anything, because that is the promise the
        two orchestrator copies made and the extraction broke. `_run_git_raw` and
        `_run_git` must NOT, because the three push-gate guards run on them and a
        swallowed programming error there becomes "git failed" — fail-open in
        `review_guard`, a false BLOCK in `plan_guard`. A guard that crashes is
        loud; a guard that degrades silently is the failure class this repo keeps
        rediscovering.

        Pinned separately from the decode fix: `surrogateescape` removes the one
        known trigger, this pins the boundary itself.
        """
        from unittest import mock
        gp = self._probe()
        with mock.patch.object(gp.subprocess, "run",
                               side_effect=ValueError("something unforeseen")):
            for fn in (gp._run_git_raw, gp._run_git):
                with self.subTest(fn=fn.__name__):
                    with self.assertRaises(ValueError):
                        fn(["diff"], "/tmp")
            seen = []
            self.assertEqual(
                gp.branch_diff_files("main", "/tmp", on_error=seen.append), [])
        self.assertEqual(len(seen), 1, "실패가 조용히 삼켜졌다 — 호출부가 로그할 게 없다")
        self.assertIn("ValueError", seen[0])

    def test_the_narrow_failures_are_still_absorbed_by_the_probe(self):
        """Narrowing the guard-facing catch must not reopen what it did handle:
        a missing `git`, a timeout and an `OSError` still mean `(1, "", "")`."""
        from unittest import mock
        gp = self._probe()
        for exc in (FileNotFoundError("no git"),
                    gp.subprocess.TimeoutExpired("git", 1.0),
                    OSError("io")):
            with self.subTest(exc=type(exc).__name__):
                with mock.patch.object(gp.subprocess, "run", side_effect=exc):
                    self.assertEqual(gp._run_git_raw(["diff"], "/tmp"), (1, "", ""))
                    self.assertEqual(gp._run_git(["diff"], "/tmp"), (1, "", ""))


if __name__ == "__main__":
    unittest.main()
