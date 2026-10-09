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

Classes. The README catalog row is a summary; this list is the catalog, so keep THIS list complete.

  - BothOrchestratorsSeeTheSameFilesTest — both orchestrators' entry points against one fixture agree (ordinary
    changeset, leading-space path, trailing space in the last position, non-ASCII path, unresolvable base).
  - ThreeDotIsNotNegotiableTest — `A...HEAD` against a base that has advanced.
  - SharedProbeContractTest — the raw/trimmed split (`_run_git` still trims for the scalar callers, the raw runner keeps
    stdout verbatim) and the failure reasons `on_error` receives.
  - NamedCommitProbesTest (NERV Task `CLE-T-CD9131`) — the probes `nerv_review_payload.py` and `nerv_review_handoff.py`
    use instead of their own `git` calls: `resolve_commit` returns only the full hash git printed, an option-looking
    revision never reaches git (git is not called at all; `merge_base` also differs in result), `merge_base` is the fork
    point, `is_ancestor`, `is_full_commit_id` (the one definition of a full hash), `local_branch_tip`, `in_work_tree`,
    and `branch_diff_files(…, head=…)` diffing a named commit three-dot.
  - UndecodableGitOutputTest — a path git cannot round-trip does not crash the caller; where "empty on any failure"
    applies (`branch_diff_files`) and where it deliberately does not (`_run_git_raw`/`_run_git`).
  - TheWorktreeProbeSeesWhatIsNotCommittedYetTest / TheWorktreeProbeKeepsNonAsciiPaths — `worktree_changed_files` and
    `_porcelain_path` on real repositories (what `test_plan_guard.py` pinned before NERV cutover stage 3).
  - TheDiffTextProbeCarriesTheHardeningTest — `diff_text` and its orchestrator call site.
  - GitProbesAreNotReDuplicatedTest — compares the guards' ASTs and fails on any function whose body is identical in two
    of them.
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


class NamedCommitProbesTest(unittest.TestCase):
    """The probes the NERV payload tool (`nerv_review_payload.py`) uses for `--base` / `--head` / `--branch`
    (NERV Task `CLE-T-CD9131`). It used to run its own `git`, with none of the hardening above and a two-dot
    diff, and ran it in the PROCESS cwd instead of the session's repository."""

    def _probe(self):
        import sys
        if str(_harness.CLAUDE_DIR) not in sys.path:
            sys.path.insert(0, str(_harness.CLAUDE_DIR))
        from _shared import git_probe
        return git_probe

    def _repo(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        repo = _harness.make_temp_git_repo(os.path.join(tmp, "r"), branch="main")
        fork = _harness.git_in(repo, "rev-parse", "HEAD").stdout.strip()
        _harness.git_in(repo, "checkout", "-qb", "feat")
        with open(os.path.join(repo, "mine.ts"), "w", encoding="utf-8") as f:
            f.write("mine\n")
        _harness.git_in(repo, "add", "mine.ts")
        _harness.git_in(repo, "commit", "-qm", "feat")
        feat = _harness.git_in(repo, "rev-parse", "HEAD").stdout.strip()
        _harness.git_in(repo, "checkout", "-q", "main")
        with open(os.path.join(repo, "theirs.ts"), "w", encoding="utf-8") as f:
            f.write("theirs\n")
        _harness.git_in(repo, "add", "theirs.ts")
        _harness.git_in(repo, "commit", "-qm", "base moved")
        main = _harness.git_in(repo, "rev-parse", "HEAD").stdout.strip()
        return str(repo), fork, feat, main

    def test_resolve_commit_returns_only_what_git_printed_in_full(self):
        gp = self._probe()
        repo, fork, feat, _ = self._repo()
        self.assertEqual(gp.resolve_commit("feat", repo), feat)
        self.assertEqual(gp.resolve_commit(fork[:7], repo), fork)
        for bad in ("no-such-ref", "", "-h", "--all", None):
            with self.subTest(rev=bad):
                self.assertIsNone(gp.resolve_commit(bad, repo))

    def test_merge_base_is_the_fork_point_not_the_moved_base(self):
        gp = self._probe()
        repo, fork, feat, main = self._repo()
        self.assertEqual(gp.merge_base(main, feat, repo), fork)
        self.assertIsNone(gp.merge_base("-h", feat, repo))
        self.assertIsNone(gp.merge_base("no-such-ref", feat, repo))

    def test_is_ancestor(self):
        gp = self._probe()
        repo, fork, feat, main = self._repo()
        self.assertTrue(gp.is_ancestor(fork, feat, repo))
        self.assertTrue(gp.is_ancestor(feat, feat, repo))
        self.assertFalse(gp.is_ancestor(feat, main, repo))
        self.assertFalse(gp.is_ancestor("-h", main, repo))

    def test_an_option_looking_revision_never_reaches_git(self):
        """"옵션처럼 보이는 값은 git 에 넘기지 않는다"는 약속을 세 함수가 각각 지키는지.

        `resolve_commit` 은 값 뒤에 `^{commit}` 을 붙이고 `is_ancestor` 는 git 이 스스로 거절해서, 가드를 지워도 결과가
        같다(`None` · `False`). 결과로는 가드를 가를 수 없으므로 git 호출 자체가 없었는지를 본다. `merge_base` 는 결과로도
        갈린다(아래 테스트: `--octopus` 를 지우면 해시가 나온다).
        """
        from unittest import mock
        gp = self._probe()
        repo, fork, feat, main = self._repo()
        with mock.patch.object(gp, "_run_git", wraps=gp._run_git) as run:
            for bad in ("-h", "--all", "--octopus", "", None):
                with self.subTest(rev=bad):
                    self.assertIsNone(gp.resolve_commit(bad, repo))
                    self.assertIsNone(gp.merge_base(bad, feat, repo))
                    self.assertIsNone(gp.merge_base(feat, bad, repo))
                    self.assertFalse(gp.is_ancestor(bad, feat, repo))
                    self.assertFalse(gp.is_ancestor(feat, bad, repo))
            self.assertEqual(run.call_count, 0)
            # 같은 모양의 정상 입력은 git 까지 간다 — 위 단언이 "아무것도 안 부르는 함수" 를 통과시키지 않는다.
            self.assertEqual(gp.resolve_commit("feat", repo), feat)
            self.assertEqual(gp.merge_base(main, feat, repo), fork)
            self.assertTrue(gp.is_ancestor(fork, feat, repo))
            self.assertEqual(run.call_count, 3)

    def test_merge_base_refuses_the_option_that_changes_its_meaning(self):
        gp = self._probe()
        repo, fork, feat, main = self._repo()
        # 가드가 없었다면 이 호출은 `git merge-base --octopus <main>` 이 되어 main 의 해시를 돌려준다.
        self.assertEqual(_harness.git_in(repo, "merge-base", "--octopus", main).stdout.strip(), main)
        self.assertIsNone(gp.merge_base("--octopus", main, repo))
        self.assertIsNone(gp.merge_base(main, "--octopus", repo))

    def test_full_commit_ids_have_one_definition(self):
        gp = self._probe()
        for good in ("a" * 40, "0123456789abcdef" * 4, "f" * 64):
            with self.subTest(value=good):
                self.assertTrue(gp.is_full_commit_id(good))
        for bad in ("a" * 39, "a" * 41, "A" * 40, "g" * 40, "", None, 40, "a" * 40 + "\n"):
            with self.subTest(value=bad):
                self.assertFalse(gp.is_full_commit_id(bad))
        repo, _, feat, _ = self._repo()
        self.assertTrue(gp.is_full_commit_id(gp.resolve_commit("feat", repo)))

    def test_local_branch_tip_is_the_tip_of_a_branch_that_exists_here(self):
        gp = self._probe()
        repo, _, feat, main = self._repo()
        self.assertEqual(gp.local_branch_tip("feat", repo), feat)
        self.assertEqual(gp.local_branch_tip("main", repo), main)
        for unknown in ("no-such-branch", "", None, 7):
            with self.subTest(branch=unknown):
                self.assertIsNone(gp.local_branch_tip(unknown, repo))
        # 브랜치 이름만 본다. 같은 이름의 태그나 해시 문자열은 로컬 브랜치가 아니다.
        _harness.git_in(repo, "tag", "only-a-tag", feat)
        self.assertIsNone(gp.local_branch_tip("only-a-tag", repo))
        self.assertIsNone(gp.local_branch_tip(feat, repo))

    def test_in_work_tree_tells_a_repository_from_a_plain_directory(self):
        from unittest import mock
        gp = self._probe()
        repo, _, _, _ = self._repo()
        self.assertTrue(gp.in_work_tree(repo))
        plain = os.path.join(os.path.dirname(repo), "plain")
        os.mkdir(plain)
        with mock.patch.dict(os.environ, {"GIT_CEILING_DIRECTORIES": os.path.dirname(repo)}):
            self.assertFalse(gp.in_work_tree(plain))
            self.assertFalse(gp.in_work_tree(os.path.join(plain, "no-such-dir")))

    def test_branch_diff_files_can_name_the_reviewed_commit(self):
        gp = self._probe()
        repo, fork, feat, main = self._repo()
        # HEAD is `main` here. Naming `feat` as the head must diff `feat`, three-dot, against the fork point.
        self.assertEqual(gp.branch_diff_files(fork, repo), ["theirs.ts"])
        self.assertEqual(gp.branch_diff_files(fork, repo, head=feat), ["mine.ts"])
        self.assertEqual(gp.branch_diff_files(main, repo, head=feat), ["mine.ts"])  # 3-dot: no reverse deletions
        seen = []
        self.assertEqual(gp.branch_diff_files("no-such-ref", repo, head=feat, on_error=seen.append), [])
        self.assertIn("no-such-ref...", seen[0])


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


class TheWorktreeProbeSeesWhatIsNotCommittedYetTest(unittest.TestCase):
    """`worktree_changed_files` — the half `branch_diff_files` structurally cannot see.

    This project runs its consistency check BEFORE the write lands (planner runs
    `--spec` 직전, developer runs `--impl-prep` 착수 직전), so the documents under
    review are uncommitted by construction and a committed-only probe is blind at
    exactly the moment that matters.
    """

    def _probe(self):
        import sys
        if str(_harness.CLAUDE_DIR) not in sys.path:
            sys.path.insert(0, str(_harness.CLAUDE_DIR))
        from _shared import git_probe
        return git_probe

    def _repo(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        return _harness.make_temp_git_repo(os.path.join(tmp, "r"), branch="main")

    def _write(self, repo, rel, body="x\n"):
        path = os.path.join(repo, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(body)
        return path

    def test_an_unstaged_edit_to_a_tracked_file_is_reported(self):
        gp = self._probe()
        repo = self._repo()
        self._write(repo, "spec/a.md")
        _harness.git_in(repo, "add", "-A")
        _harness.git_in(repo, "commit", "-qm", "base")
        # 커밋된 상태에서는 아무것도 안 나와야 한다 — 안 그러면 아래 단언이 vacuous.
        self.assertEqual(gp.worktree_changed_files(repo), [])
        self._write(repo, "spec/a.md", "edited\n")
        self.assertEqual(gp.worktree_changed_files(repo), ["spec/a.md"])

    def test_a_staged_edit_is_reported_too(self):
        gp = self._probe()
        repo = self._repo()
        self._write(repo, "spec/a.md")
        _harness.git_in(repo, "add", "-A")
        _harness.git_in(repo, "commit", "-qm", "base")
        self._write(repo, "spec/a.md", "edited\n")
        _harness.git_in(repo, "add", "-A")
        self.assertEqual(gp.worktree_changed_files(repo), ["spec/a.md"])

    def test_an_untracked_file_in_a_new_directory_is_named_individually(self):
        """`-uall`. Without it git collapses a new directory to `dir/`, and a
        directory path matches no file path — so the ranking tier silently
        empties for exactly the case a planner creates: a new spec area."""
        gp = self._probe()
        repo = self._repo()
        self._write(repo, "keep.md")
        _harness.git_in(repo, "add", "-A")
        _harness.git_in(repo, "commit", "-qm", "base")
        self._write(repo, "spec/new-area/draft.md")
        self.assertEqual(gp.worktree_changed_files(repo), ["spec/new-area/draft.md"])

    def test_a_rename_reports_the_destination(self):
        gp = self._probe()
        repo = self._repo()
        self._write(repo, "old.md")
        _harness.git_in(repo, "add", "-A")
        _harness.git_in(repo, "commit", "-qm", "base")
        _harness.git_in(repo, "mv", "old.md", "new.md")
        self.assertEqual(gp.worktree_changed_files(repo), ["new.md"])

    def test_a_git_failure_is_empty_and_reported(self):
        from unittest import mock
        gp = self._probe()
        seen = []
        with mock.patch.object(gp, "_run_git_raw", side_effect=ValueError("boom")):
            self.assertEqual(
                gp.worktree_changed_files("/tmp", on_error=seen.append), [])
        self.assertEqual(len(seen), 1, "실패가 조용히 삼켜졌다")
        self.assertIn("ValueError", seen[0])


class TheDiffTextProbeCarriesTheHardeningTest(unittest.TestCase):
    """`diff_text` — the sibling that had been left on a private `subprocess.run`.

    `consistency_orchestrator._collect_code_diff` decoded with plain
    `text=True` and caught only `(OSError, TimeoutExpired)`. `UnicodeDecodeError`
    is a `ValueError`, so an undecodable byte in the diff BODY escaped that
    `except` and crashed `--impl-done` preparation — breaking the function's own
    documented "empty on failure" contract. Routing it through the shared probe
    is what puts `errors="surrogateescape"` on this path.
    """

    def _probe(self):
        import sys
        if str(_harness.CLAUDE_DIR) not in sys.path:
            sys.path.insert(0, str(_harness.CLAUDE_DIR))
        from _shared import git_probe
        return git_probe

    def test_it_returns_the_diff_body_scoped_to_pathspecs(self):
        gp = self._probe()
        tmp, repo = _fixture(["src/a.ts", "docs/b.md"])
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        scoped = gp.diff_text("main", repo, ["src"])
        self.assertIn("src/a.ts", scoped)
        self.assertNotIn("docs/b.md", scoped, "pathspec 이 적용되지 않았다")
        everything = gp.diff_text("main", repo)
        self.assertIn("docs/b.md", everything)

    def test_an_undecodable_byte_does_not_crash(self):
        """The whole reason this function exists. `text=True` alone raises here."""
        gp = self._probe()
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        repo = _harness.make_temp_git_repo(os.path.join(tmp, "r"), branch="main")
        _harness.git_in(repo, "checkout", "-qb", "feat")
        with open(os.path.join(repo, "bad.txt"), "wb") as f:
            f.write(b"latin\xe4name\n")   # not valid UTF-8
        _harness.git_in(repo, "add", "-A")
        _harness.git_in(repo, "commit", "-qm", "feat")
        out = gp.diff_text("main", repo)
        self.assertIn("bad.txt", out)
        self.assertIn("\udce4", out, "surrogateescape 로 보존되지 않았다")

    def test_a_git_failure_is_empty_and_reported(self):
        gp = self._probe()
        seen = []
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        repo = _harness.make_temp_git_repo(os.path.join(tmp, "r"), branch="main")
        # 존재하지 않는 base ref → git 이 0 이 아닌 코드로 끝난다.
        self.assertEqual(
            gp.diff_text("no-such-ref", repo, on_error=seen.append), "")
        self.assertEqual(len(seen), 1, "실패가 조용히 삼켜졌다")

    def test_the_orchestrator_call_site_gets_the_hardening_too(self):
        """호출부 계약. 프리미티브가 옳아도 `_collect_code_diff` 가 사설
        `subprocess.run` 을 유지하면 크래시는 그대로다 — 그 뮤턴트가 실제로
        살아남았고, 이 저장소가 반복해 겪은 "헬퍼 테스트 ≠ 호출부 테스트" 다.

        스파이가 아니라 **동작**으로 고정한다: 호출 여부만 보면 반환값을 버리는
        pass-through 뮤턴트를 놓친다(같은 함수족에서 이미 관측된 형태).
        """
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        repo = _harness.make_temp_git_repo(os.path.join(tmp, "r"), branch="main")
        _harness.git_in(repo, "checkout", "-qb", "feat")
        # 기본 `code_areas` 는 `["codebase"]` — 그 아래여야 diff 에 잡힌다.
        os.makedirs(os.path.join(repo, "codebase"), exist_ok=True)
        with open(os.path.join(repo, "codebase", "bad.ts"), "wb") as f:
            f.write(b"const s = 'latin\xe4name';\n")   # not valid UTF-8
        _harness.git_in(repo, "add", "-A")
        _harness.git_in(repo, "commit", "-qm", "feat")

        out = _harness.run_in_orchestrator(
            _CONSISTENCY_PREAMBLE,
            """
            os.chdir(ARG["repo"])
            emit(orch._collect_code_diff("main", ARG["repo"]))
            """,
            {"repo": str(repo)},
        )
        self.assertIn("codebase/bad.ts", out)
        self.assertIn("\udce4", out, "호출부가 하드닝을 못 받았다")


class TheWorktreeProbeKeepsNonAsciiPaths(unittest.TestCase):
    """git C-quotes non-ASCII paths by default. A Korean file name must come back
    as itself, not as an octal-escaped string that matches no file. Moved here
    from `test_plan_guard.py` when `plan_guard` left in NERV cutover stage 3; the
    probe it exercised (`_porcelain_path` under `git status --porcelain`) is the
    one `worktree_changed_files` still runs on."""

    def test_a_non_ascii_path_survives_git_quoting(self):
        import sys
        if str(_harness.CLAUDE_DIR) not in sys.path:
            sys.path.insert(0, str(_harness.CLAUDE_DIR))
        from _shared import git_probe as gp

        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        repo = _harness.make_temp_git_repo(os.path.join(tmp, "r"), branch="main")
        rel = "spec/한글문서.md"
        path = os.path.join(repo, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write("x\n")
        self.assertEqual(gp.worktree_changed_files(repo), [rel])


class GitProbesAreNotReDuplicatedTest(unittest.TestCase):
    """The guards do not hand-copy the git probes again — the list is derived.

    `review_guard`, `branch_guard` and the since-removed `plan_guard` each carried
    their own copy of the same git helpers, and the copies drifted three rounds in
    a row (7R fixed `_run_git`'s `.strip()` in one, 8R found the same line in the
    second as a false BLOCK, 9R found a third). Every suite mocked those helpers,
    so none of them ever ran. 9R moved five into `_shared/git_probe.py`, and 10R
    found a sixth (`_current_branch`) — the consolidation and its guard had been
    driven by a hand-written list. So this compares the modules' ASTs instead: a
    function whose body is identical in two guards fails by itself. Moved here
    from `test_plan_guard.py` when `plan_guard` left in NERV cutover stage 3.
    """

    # Derived, like the function set: a new `_lib/*_guard.py` joins the check
    # without anyone remembering to list it (it was hand-listed until stage 3).
    _MODULES = tuple(sorted(
        p.name for p in (_harness.HOOKS_DIR / "_lib").glob("*_guard.py")))

    @staticmethod
    def _bodies(src):
        import ast as _ast
        out = {}
        for n in _ast.walk(_ast.parse(src)):
            if isinstance(n, _ast.FunctionDef):
                body = [x for x in n.body
                        if not (isinstance(x, _ast.Expr)
                                and isinstance(x.value, _ast.Constant))]
                out[n.name] = _ast.dump(_ast.Module(body=body, type_ignores=[]))
        return out

    def test_no_identical_function_survives_in_two_guards(self):
        import itertools
        self.assertGreaterEqual(len(self._MODULES), 2,
                                f"fewer than two guards found — nothing to compare: {self._MODULES}")
        srcs = {m: (_harness.HOOKS_DIR / "_lib" / m).read_text(encoding="utf-8")
                for m in self._MODULES}
        bodies = {m: self._bodies(s) for m, s in srcs.items()}
        dupes = []
        for a, b in itertools.combinations(self._MODULES, 2):
            for name in sorted(set(bodies[a]) & set(bodies[b])):
                if bodies[a][name] == bodies[b][name]:
                    dupes.append(f"{name} ({a} == {b})")
        self.assertEqual(
            dupes, [],
            "a function body is identical in two guards — move it to "
            f"`_shared/git_probe.py` and delegate from both: {dupes}",
        )

    def test_the_shared_probes_are_the_same_objects_everywhere(self):
        """The direction the derivation cannot see: a redefinition after
        `_x = _git_probe._x` makes the bodies differ and the test above pass. Check
        the guards really hold the shared objects."""
        import sys as _sys
        from _lib import review_guard as rg  # noqa: PLC0415
        from _lib import branch_guard as bg  # noqa: PLC0415
        claude_dir = str(_harness.CLAUDE_DIR)
        if claude_dir not in _sys.path:
            _sys.path.insert(0, claude_dir)
        from _shared import git_probe as gp  # noqa: PLC0415

        exported = [n for n in dir(gp) if n.startswith("_") and callable(getattr(gp, n))
                    and not n.startswith("__")]
        self.assertGreaterEqual(len(exported), 6, f"too few shared probes: {exported}")
        for mod, obj in (("review_guard", rg), ("branch_guard", bg)):
            for name in exported:
                if not hasattr(obj, name):
                    continue  # a probe the guard does not use has nothing to delegate
                with self.subTest(module=mod, fn=name):
                    self.assertIs(
                        getattr(obj, name), getattr(gp, name),
                        f"{mod}.{name} is not the shared implementation — a local "
                        "redefinition came back",
                    )


if __name__ == "__main__":
    unittest.main()
