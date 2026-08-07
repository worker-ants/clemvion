"""The default `--prepare` changeset silently omits committed work.

`collect_change_infos`'s default path is staged + unstaged + untracked — only
what is NOT yet committed. The review workflow commits first (the push gate
wants the commit to predate the review), so by the time `/ai-review` runs, that
set is empty or nearly so while the branch carries the real diff. Reviewers get
a near-empty corpus, the summary says "Critical 0", and the push gate reads that
as a genuine review.

`plan/in-progress/harness-review-gate-ci-backstop.md` recorded this as
"`--branch`/`--range` are not used in changeset computation". That premise is
**false** — measured: `--branch origin/main` yields exactly
`git diff --name-only origin/main...`, all of it. The real defect is that the
DEFAULT path says nothing when it is about to review a fraction of the branch.
Measured on this repo right after a commit: default 0 files, `--branch` 6.

So this is a warning, not a behaviour change: the changeset itself is untouched
(silently widening it would review files the caller did not ask for, and the
explicit modes are already correct).

Fresh-interpreter convention as in `test_consistency_context_budget`: importing
the orchestrator in-process collides on the name `_lib` — the hook suites put
`.claude/hooks/_lib` on `sys.path`, and `router_safety`'s
`from _lib import project_config` then resolves to that package instead of the
skills one. Standalone runs pass and `discover` fails, so this must not be
"fixed" by running the file on its own.
"""

from __future__ import annotations

import json
import subprocess
import sys
import textwrap
import unittest
import os
import shutil
import tempfile

import _harness
from _harness import REPO_ROOT

ORCH = (
    REPO_ROOT / ".claude" / "skills" / "code-review-agents" / "scripts"
    / "code_review_orchestrator.py"
)

_PREAMBLE = _harness.orchestrator_preamble(
    ORCH,
    imports="contextlib, io",
)


def run_in_orchestrator(snippet: str, arg=None):
    return _harness.run_in_orchestrator(_PREAMBLE, snippet, arg)


def warn(collected, branch_files, base="origin/main"):
    """Return the advisory's stderr for a given (collected, branch) pair."""
    return run_in_orchestrator(
        """
        orch._default_branch_ref = lambda: ARG["base"]
        orch.get_git_branch_diff_files = lambda b: ARG["branch_files"]
        buf = io.StringIO()
        with contextlib.redirect_stderr(buf):
            orch.warn_if_committed_work_is_missing(ARG["collected"])
        emit(buf.getvalue())
        """,
        {"collected": collected, "branch_files": branch_files, "base": base},
    )


class WarnIfCommittedWorkIsMissingTest(unittest.TestCase):
    def test_warns_when_the_branch_diff_is_not_covered(self):
        """The observed shape: everything committed, nothing left uncommitted."""
        out = warn([], ["codebase/a.ts", "codebase/b.ts"])
        self.assertIn("2개가 리뷰에서 빠집니다", out)
        self.assertIn("codebase/a.ts", out)
        self.assertIn("codebase/b.ts", out)

    def test_warns_on_a_partial_changeset_too(self):
        """The more dangerous half — a session IS created, covering one file,
        and the gate then sees a fresh review over a fraction of the branch."""
        out = warn(["codebase/b.ts"], ["codebase/a.ts", "codebase/b.ts"])
        self.assertIn("1개가 리뷰에서 빠집니다", out)
        self.assertIn("codebase/a.ts", out)
        self.assertNotIn("- codebase/b.ts", out)

    def test_names_the_remedy(self):
        """A warning that does not say what to run instead gets ignored."""
        self.assertIn("--branch origin/main", warn([], ["codebase/a.ts"]))

    def test_silent_when_the_changeset_already_covers_the_branch(self):
        self.assertEqual(warn(["codebase/a.ts"], ["codebase/a.ts"]), "")

    def test_silent_when_the_changeset_is_a_superset(self):
        """Uncommitted-only files are normal and are not a gap."""
        self.assertEqual(warn(["codebase/a.ts", "new.ts"], ["codebase/a.ts"]), "")

    def test_silent_when_the_base_cannot_be_resolved(self):
        """No origin/HEAD, no main, no master — a review must not nag (or fail)
        because the advisory could not be computed."""
        self.assertEqual(warn([], ["codebase/a.ts"], base=None), "")

    def test_git_exceptions_are_absorbed_not_propagated(self):
        """`_git` is a thin `subprocess.run` wrapper that does not swallow.

        Stubbing `_default_branch_ref` (as every test above does) skips the real
        resolution entirely, so it cannot see a missing git binary or a timeout.
        Unhandled, either would propagate through `collect_change_infos` to
        `main` and crash the default `--prepare` — for an advisory that its own
        docstring promises is silent on git failure.
        """
        for exc in ("FileNotFoundError('git')",
                    "__import__('subprocess').TimeoutExpired('git', 5)"):
            with self.subTest(exc=exc):
                out = run_in_orchestrator(
                    """
                    def boom(*a, **k):
                        raise """ + exc + """
                    orch._git = boom
                    buf = io.StringIO()
                    with contextlib.redirect_stderr(buf):
                        resolved = orch._default_branch_ref()
                        orch.warn_if_committed_work_is_missing([])
                    emit({"resolved": resolved, "stderr": buf.getvalue()})
                    """
                )
                self.assertIsNone(out["resolved"])
                self.assertEqual(out["stderr"], "")

    def test_long_lists_are_capped_but_counted(self):
        out = warn([], [f"codebase/f{i}.ts" for i in range(25)])
        self.assertIn("25개 파일이 변경됐지만", out)
        self.assertIn("외 15개", out)
        self.assertEqual(out.count("     - codebase/"), 10)


class DefaultPathIsWiredTest(unittest.TestCase):
    """The warning must fire from the default path, and ONLY from it.

    Testing the helper alone would stay GREEN with the call site deleted; and
    firing it under `--branch`/`--range` would nag on runs that are already
    correct (those modes ARE the remedy it recommends).
    """

    @staticmethod
    def _calls(mode, staged=False):
        return run_in_orchestrator(
            """
            import argparse
            calls = []
            orch.warn_if_committed_work_is_missing = lambda f: calls.append(list(f))
            orch.get_git_diff_files = lambda staged_only=False: []
            orch.get_git_branch_diff_files = lambda b: []
            orch.get_git_range_files = lambda r: []

            kw = dict(commit=None, range=None, branch=None, files=None,
                      staged=ARG["staged"])
            if ARG["mode"]:
                kw[ARG["mode"]] = "origin/main"
            buf = io.StringIO()
            with contextlib.redirect_stderr(buf):
                orch.collect_change_infos(argparse.Namespace(**kw),
                                          {"skip_extensions": set()})
            emit(len(calls))
            """,
            {"mode": mode, "staged": staged},
        )

    def test_default_path_calls_the_warning(self):
        self.assertEqual(self._calls(None), 1)

    def test_explicit_branch_does_not_warn(self):
        self.assertEqual(self._calls("branch"), 0)

    def test_explicit_range_does_not_warn(self):
        self.assertEqual(self._calls("range"), 0)

    def test_staged_is_an_explicit_scope_and_does_not_warn(self):
        """`--staged` sits in the same `else` branch as the bare default, so it
        inherited the advisory even though SKILL.md documents it alongside
        --commit/--range/--branch as an explicit scope. The caller already said
        which changes to review; telling them they might be missing committed
        work is noise, and noise is how a real warning gets ignored."""
        self.assertEqual(self._calls(None, staged=True), 0)


class ScopeFlagDiscardingFilesIsAnnouncedTest(unittest.TestCase):
    """`--branch … --files <paths>` throws the paths away. Say so.

    The scope flags are an if/elif chain, so a scope flag makes `--files`
    unreachable. It used to be silent, and it cost round 6 of this very branch:
    after committing, `--branch` is needed for the diff base, so
    `--branch origin/main --files <sources>` is the natural command — the file
    list was dropped, the branch diff turned out to be the *previous* round's
    committed review artifacts, and fourteen reviewers read `.md` reports
    instead of the code and found nothing. A reviewer noticed the changeset;
    the tool never said a word.
    """

    def _stderr(self, **flags):
        return run_in_orchestrator(
            """
            import argparse
            a = argparse.Namespace(commit=None, range=None, branch=None,
                                   files=[], staged=False)
            for k, v in ARG.items():
                setattr(a, k, v)
            orch.get_git_branch_diff_files = lambda b: []
            orch.get_git_commit_files = lambda c: []
            orch.get_git_range_files = lambda r: []
            orch.get_git_commit_diff = lambda c, f: ""
            orch.get_file_at_commit = lambda c, f: ""
            buf = io.StringIO()
            with contextlib.redirect_stderr(buf):
                orch.collect_change_infos(a, {"skip_extensions": []})
            emit(buf.getvalue())
            """,
            flags,
        )

    def test_branch_plus_files_says_which_paths_were_dropped(self):
        err = self._stderr(branch="origin/main", files=["a.py", "b.py"])
        self.assertIn("--files IGNORED", err)
        self.assertIn("2 path(s)", err)
        self.assertIn("a.py", err)
        self.assertIn("--branch", err, "must name the flag that won")

    def test_commit_and_range_win_the_same_way(self):
        for flag, value in (("commit", "abc123"), ("range", "a..b")):
            with self.subTest(flag=flag):
                err = self._stderr(files=["a.py"], **{flag: value})
                self.assertIn("--files IGNORED", err)
                self.assertIn(f"--{flag}", err)

    def test_silent_when_files_is_the_mode_actually_used(self):
        """No scope flag — the paths are honoured, so there is nothing to warn
        about. A warning that fires when nothing was lost is how a real one
        gets ignored."""
        self.assertNotIn("IGNORED", self._stderr(files=["a.py"]))

    def test_silent_when_a_scope_flag_comes_without_files(self):
        self.assertNotIn("IGNORED", self._stderr(branch="origin/main"))


if __name__ == "__main__":
    unittest.main()


class DefaultBranchRefSuccessPathsTest(unittest.TestCase):
    """`_default_branch_ref()` 의 **성공** 4갈래를 실 저장소로 구동한다 (백로그 §8).

    이 파일의 다른 테스트는 전부 `orch._default_branch_ref` 를 stub 하거나
    실패-흡수 경로(`FileNotFoundError`/`TimeoutExpired`)만 본다. 즉 "무엇을 돌려주는가"
    는 한 번도 실물로 확인된 적이 없었다. 자매 함수 `_branch_changed_rels` 는 임시 git
    repo 로 성공 경로까지 고정돼 있어 비대칭이었다.

    `_git` 은 cwd 를 받지 않고 **프로세스 cwd** 에서 돈다. 그래서 스니펫이 픽스처로
    `os.chdir` 한 뒤 호출한다 — 그 사실 자체가 이 함수의 계약이다.
    """

    _SNIPPET = """
        import os
        os.chdir(ARG["repo"])
        emit(orch._default_branch_ref())
        """

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)

    def _clone_of(self, branch):
        origin = _harness.make_temp_git_repo(
            os.path.join(self.tmp, f"o-{branch}"), branch=branch)
        clone = os.path.join(self.tmp, f"c-{branch}")
        _harness.git_in(self.tmp, "clone", "-q", str(origin), clone)
        return clone

    def test_symbolic_ref_hit_is_what_answers(self):
        """Method 1 을 **분리**해서 잰다.

        평범한 clone 에는 `origin/HEAD` 와 `origin/main` 이 둘 다 있어, 결과가
        `origin/main` 이어도 symbolic-ref 가 답했는지 아래 폴백 루프가 답했는지
        구분되지 않는다 — 그 상태면 symbolic-ref 분기를 지운 뮤턴트가 통과한다.
        기본 브랜치를 `trunk` 로 두면 폴백(main/master 만 조회)이 답할 수 없어 갈린다.
        """
        clone = self._clone_of("trunk")
        for name in ("main", "master"):
            rc = _harness.git_in(clone, "rev-parse", "--verify", "--quiet",
                                 f"origin/{name}", check=False).returncode
            self.assertNotEqual(rc, 0, f"픽스처에 origin/{name} 이 있으면 분리가 깨진다")
        self.assertEqual(run_in_orchestrator(self._SNIPPET, {"repo": clone}),
                         "origin/trunk")

    def test_falls_back_to_origin_main(self):
        clone = self._clone_of("main")
        _harness.git_in(clone, "symbolic-ref", "--delete", "refs/remotes/origin/HEAD")
        self.assertEqual(run_in_orchestrator(self._SNIPPET, {"repo": clone}),
                         "origin/main")

    def test_falls_back_to_origin_master(self):
        clone = self._clone_of("master")
        _harness.git_in(clone, "symbolic-ref", "--delete", "refs/remotes/origin/HEAD")
        self.assertEqual(run_in_orchestrator(self._SNIPPET, {"repo": clone}),
                         "origin/master")

    def test_main_outranks_master_when_both_exist(self):
        # 순서가 계약이다 — 둘 다 있으면 origin/main 이 먼저다.
        clone = self._clone_of("master")
        _harness.git_in(clone, "symbolic-ref", "--delete", "refs/remotes/origin/HEAD")
        _harness.git_in(clone, "update-ref", "refs/remotes/origin/main",
                        "refs/remotes/origin/master")
        self.assertEqual(run_in_orchestrator(self._SNIPPET, {"repo": clone}),
                         "origin/main")

    def test_no_origin_yields_none(self):
        repo = _harness.make_temp_git_repo(os.path.join(self.tmp, "solo"))
        self.assertIsNone(run_in_orchestrator(self._SNIPPET, {"repo": str(repo)}))
