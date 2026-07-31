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

from _harness import REPO_ROOT

ORCH = (
    REPO_ROOT / ".claude" / "skills" / "code-review-agents" / "scripts"
    / "code_review_orchestrator.py"
)

_PREAMBLE = textwrap.dedent(
    f"""
    import contextlib, importlib.util, io, json, sys
    spec = importlib.util.spec_from_file_location("orch", {str(ORCH)!r})
    orch = importlib.util.module_from_spec(spec)
    sys.modules["orch"] = orch
    spec.loader.exec_module(orch)

    def emit(value):
        sys.stdout.write("<<<" + json.dumps(value) + ">>>")

    ARG = json.loads(sys.stdin.read() or "null")
    """
)


def run_in_orchestrator(snippet: str, arg=None):
    proc = subprocess.run(
        [sys.executable, "-c", _PREAMBLE + textwrap.dedent(snippet)],
        input=json.dumps(arg), cwd=str(REPO_ROOT),
        capture_output=True, text=True,
        # Sibling suites set one too — without it a hang in the target code
        # blocks the run forever instead of failing.
        timeout=30.0,
    )
    if proc.returncode != 0:
        raise AssertionError(proc.stderr[-3000:])
    out = proc.stdout
    return json.loads(out[out.index("<<<") + 3:out.rindex(">>>")])


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
