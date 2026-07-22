"""Tests for the shared mermaid-lint readiness SoT (_lib/mermaid_lint_ready.py).

Two things are guarded:
  - is_ready()'s rule — node_modules present AND the completion marker inside it,
    so a half-written tree (dir but no marker) reads as NOT ready; and
  - the cross-language binding. bootstrap-session.sh (bash) writes the marker
    with a hardcoded name and .githooks/pre-commit (bash) reads it via this
    module's CLI, while lint_mermaid_posttooluse.py (python) imports is_ready.
    A bash file and a python file cannot share a runtime constant, so — the
    repo's convention (cf. test_doc_sync_matrix, test_summary_agent_contract) —
    a test asserts the hardcoded strings match MARKER_NAME here. Drift that
    would silently re-split the three consumers fails loudly instead.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

import _harness  # noqa: F401  — side effect: harness path setup; REPO_ROOT used below

ready = _harness.load_module_by_path(
    "mermaid_lint_ready",
    _harness.HOOKS_DIR / "_lib" / "mermaid_lint_ready.py",
)

BOOTSTRAP_SRC = _harness.REPO_ROOT / ".claude" / "tools" / "bootstrap-session.sh"
PRECOMMIT_SRC = _harness.REPO_ROOT / ".githooks" / "pre-commit"
POSTTOOLUSE_SRC = _harness.HOOKS_DIR / "lint_mermaid_posttooluse.py"

# Stubbed `node` for the execution-based tests below (W8): records one line per
# call (so a test can assert whether the linter ran at all) and exits with an
# env-controlled code (so a test can assert the wrapper forwards a failure).
# Never touches the network or a real mermaid install.
_NODE_STUB = """#!/usr/bin/env bash
echo call >> "$NODE_CALL_LOG"
exit "${NODE_EXIT_CODE:-0}"
"""


class IsReadyTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.tool_dir = os.path.join(self.tmp, "mermaid-lint")

    def _node_modules(self):
        nm = os.path.join(self.tool_dir, "node_modules")
        os.makedirs(nm, exist_ok=True)
        return nm

    def test_no_tool_dir_is_not_ready(self):
        self.assertFalse(ready.is_ready(None))
        self.assertFalse(ready.is_ready(self.tool_dir))  # nothing created yet

    def test_node_modules_without_marker_is_not_ready(self):
        """The partial-install case — the whole reason a bare dir test is wrong."""
        self._node_modules()
        self.assertFalse(ready.is_ready(self.tool_dir))

    def test_node_modules_with_marker_is_ready(self):
        nm = self._node_modules()
        open(os.path.join(nm, ready.MARKER_NAME), "w").close()
        self.assertTrue(ready.is_ready(self.tool_dir))

    def test_marker_without_node_modules_dir_is_not_ready(self):
        """`is_ready` ANDs two conditions — node_modules isdir AND the marker
        isfile — and this pins that the isdir half is actually load-bearing,
        not merely implied by the marker's path.

        W13: the marker path is defined as living *inside* node_modules
        (`marker_path` joins `tool_dir/node_modules/MARKER_NAME`), so
        structurally a real marker file cannot exist without its parent
        directory also existing — this combination is not constructible with
        real filesystem state alone. Reaching this branch at all therefore
        requires mocking `os.path.isdir` to lie, with a genuine marker file on
        disk, rather than calling `is_ready()` on an empty tool_dir (which is
        just test_no_tool_dir_is_not_ready's input again, verified fresh below
        so the two tests cannot silently re-converge without notice).
        """
        nm = self._node_modules()
        marker = os.path.join(nm, ready.MARKER_NAME)
        open(marker, "w").close()
        self.assertTrue(os.path.isfile(marker), "the marker file must genuinely exist")

        with mock.patch("os.path.isdir", return_value=False):
            self.assertFalse(ready.is_ready(self.tool_dir))

    def test_cli_exit_codes_match_is_ready(self):
        # not ready → exit 1
        r = subprocess.run([sys.executable, str(_harness.HOOKS_DIR / "_lib" /
                                                "mermaid_lint_ready.py"), self.tool_dir])
        self.assertEqual(r.returncode, 1)
        # ready → exit 0
        nm = self._node_modules()
        open(os.path.join(nm, ready.MARKER_NAME), "w").close()
        r = subprocess.run([sys.executable, str(_harness.HOOKS_DIR / "_lib" /
                                                "mermaid_lint_ready.py"), self.tool_dir])
        self.assertEqual(r.returncode, 0)


class ConsumerBindingTest(unittest.TestCase):
    """The three consumers must not drift from MARKER_NAME / this module."""

    def test_bootstrap_writes_the_shared_marker_name(self):
        src = BOOTSTRAP_SRC.read_text()
        self.assertIn(ready.MARKER_NAME, src,
                      "bootstrap-session.sh must write the marker name this module owns")

    def test_precommit_reads_via_the_shared_helper(self):
        src = PRECOMMIT_SRC.read_text()
        self.assertIn("mermaid_lint_ready.py", src,
                      "pre-commit must gate on the shared readiness helper, not a bare "
                      "[ -d node_modules ] test")

    def test_posttooluse_imports_is_ready(self):
        src = POSTTOOLUSE_SRC.read_text()
        self.assertIn("from mermaid_lint_ready import is_ready", src)
        self.assertIn("is_ready(tool_dir)", src,
                      "the PostToolUse hook must decide readiness via the shared helper")


class PostToolUseExecutionTest(unittest.TestCase):
    """Execution-based regression for lint_mermaid_posttooluse.py's readiness
    gate (W8).

    ConsumerBindingTest.test_posttooluse_imports_is_ready above only checks
    that the source TEXT contains `is_ready(tool_dir)` — an assertIn that
    still passes even if `if not is_ready(tool_dir):` were mutated to
    `if is_ready(tool_dir):` (confirmed by directly reproducing that mutant
    during review). These tests instead spawn the real script end-to-end
    (payload piped on stdin, a stubbed `node` on PATH via
    MERMAID_LINT_TOOL_DIR) and prove the gate actually controls whether the
    linter subprocess runs, in both directions.
    """

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)

        self.tool_dir = os.path.join(self.tmp, "mermaid-lint")
        os.makedirs(self.tool_dir)
        # Content is irrelevant — the stubbed `node` below never parses it.
        open(os.path.join(self.tool_dir, "lint-mermaid.mjs"), "w").close()

        self.bin = os.path.join(self.tmp, "bin")
        os.makedirs(self.bin)
        node_stub = os.path.join(self.bin, "node")
        with open(node_stub, "w") as f:
            f.write(_NODE_STUB)
        os.chmod(node_stub, 0o755)
        self.node_call_log = os.path.join(self.tmp, "node-calls.log")

        self.md_file = os.path.join(self.tmp, "doc.md")
        with open(self.md_file, "w") as f:
            f.write("# doc\n\n```mermaid\ngraph TD; a-->b;\n```\n")

    def _node_calls(self):
        if not os.path.exists(self.node_call_log):
            return 0
        with open(self.node_call_log) as f:
            return len([ln for ln in f if ln.strip()])

    def _run(self, ready_state, node_exit_code=0):
        if ready_state:
            nm = os.path.join(self.tool_dir, "node_modules")
            os.makedirs(nm, exist_ok=True)
            open(os.path.join(nm, ready.MARKER_NAME), "w").close()
        env = dict(os.environ)
        env["PATH"] = self.bin + os.pathsep + env["PATH"]
        env["MERMAID_LINT_TOOL_DIR"] = self.tool_dir
        env["NODE_CALL_LOG"] = self.node_call_log
        env["NODE_EXIT_CODE"] = str(node_exit_code)
        payload = json.dumps({"tool_input": {"file_path": self.md_file}})
        return subprocess.run(
            [sys.executable, str(POSTTOOLUSE_SRC)],
            input=payload, capture_output=True, text=True, env=env, timeout=10,
        )

    def test_not_ready_skips_without_invoking_the_linter(self):
        r = self._run(ready_state=False)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("skipped (tooling deps not installed)", r.stderr)
        self.assertEqual(self._node_calls(), 0,
                         "must not invoke the linter when deps are not ready")

    def test_ready_invokes_the_linter_and_forwards_its_failure(self):
        r = self._run(ready_state=True, node_exit_code=1)
        self.assertEqual(self._node_calls(), 1,
                         "must invoke the linter once deps are ready")
        self.assertEqual(r.returncode, 2, "a linter failure must surface as exit 2")
        self.assertIn("mermaid syntax error", r.stderr)

    def test_ready_fails_open_when_linter_reports_tooling_broken(self):
        """Exit 3 from the linter = its deps failed to import (a corrupt tree
        that still passed the readiness marker), NOT a malformed diagram. The
        hook must fail open (return 0) rather than nag Claude with a bogus
        parse error. node IS invoked — readiness passed — so the wrapper is
        classifying the exit code, which is the behaviour under test."""
        r = self._run(ready_state=True, node_exit_code=3)
        self.assertEqual(self._node_calls(), 1,
                         "the linter runs — readiness passed; the exit code decides")
        self.assertEqual(r.returncode, 0,
                         "tooling breakage (exit 3) must fail open, not surface as exit 2")
        self.assertIn("corrupt node_modules", r.stderr)
        self.assertNotIn("mermaid syntax error", r.stderr)


class PreCommitExecutionTest(unittest.TestCase):
    """Execution-based regression for .githooks/pre-commit's mermaid gate
    (W8), mirroring PostToolUseExecutionTest for the bash consumer.

    ConsumerBindingTest.test_precommit_reads_via_the_shared_helper only checks
    that the source text mentions `mermaid_lint_ready.py`. This drives a real
    staged commit through a synthetic git repo (same fixture pattern as
    test_bootstrap_mermaid_install.py) so the marker's presence/absence is
    proven to actually decide block-vs-allow, not merely referenced in text.
    """

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.repo = os.path.realpath(os.path.join(self.tmp, "repo"))
        os.makedirs(self.repo)
        self._git("init", "-b", "main")
        self._git("config", "user.email", "t@t")
        self._git("config", "user.name", "t")

        # pre-commit locates the readiness helper via $repo_top (git
        # rev-parse --show-toplevel), NOT MERMAID_LINT_TOOL_DIR — so the
        # shared SoT module has to actually live inside the fixture repo.
        hooks_lib = os.path.join(self.repo, ".claude", "hooks", "_lib")
        os.makedirs(hooks_lib)
        shutil.copy(_harness.HOOKS_DIR / "_lib" / "mermaid_lint_ready.py", hooks_lib)

        githooks = os.path.join(self.repo, ".githooks")
        os.makedirs(githooks)
        self.precommit = os.path.join(githooks, "pre-commit")
        shutil.copy(PRECOMMIT_SRC, self.precommit)
        os.chmod(self.precommit, 0o755)

        # The tool dir itself lives OUTSIDE the repo, reached via
        # MERMAID_LINT_TOOL_DIR (pre-commit does honour that override).
        self.tool_dir = os.path.join(self.tmp, "mermaid-lint")
        os.makedirs(self.tool_dir)
        open(os.path.join(self.tool_dir, "lint-mermaid.mjs"), "w").close()

        self.bin = os.path.join(self.tmp, "bin")
        os.makedirs(self.bin)
        node_stub = os.path.join(self.bin, "node")
        with open(node_stub, "w") as f:
            f.write(_NODE_STUB)
        os.chmod(node_stub, 0o755)
        self.node_call_log = os.path.join(self.tmp, "node-calls.log")

        self._write(os.path.join(self.repo, "doc.md"),
                    "# doc\n\n```mermaid\ngraph TD; a-->b;\n```\n")
        self._git("add", "doc.md")

    def _git(self, *args):
        return subprocess.run(["git", "-C", self.repo, *args],
                              capture_output=True, text=True, check=True)

    def _write(self, path, content):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def _node_calls(self):
        if not os.path.exists(self.node_call_log):
            return 0
        with open(self.node_call_log) as f:
            return len([ln for ln in f if ln.strip()])

    def _run(self, ready_state, node_exit_code=0):
        if ready_state:
            nm = os.path.join(self.tool_dir, "node_modules")
            os.makedirs(nm, exist_ok=True)
            open(os.path.join(nm, ready.MARKER_NAME), "w").close()
        env = dict(os.environ)
        env["PATH"] = self.bin + os.pathsep + env["PATH"]
        env["MERMAID_LINT_TOOL_DIR"] = self.tool_dir
        env["NODE_CALL_LOG"] = self.node_call_log
        env["NODE_EXIT_CODE"] = str(node_exit_code)
        return subprocess.run(["bash", self.precommit], cwd=self.repo, env=env,
                              capture_output=True, text=True, timeout=10)

    def test_not_ready_allows_the_commit_without_invoking_the_linter(self):
        r = self._run(ready_state=False)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self._node_calls(), 0,
                         "must not invoke the linter when deps are not ready")

    def test_ready_blocks_the_commit_on_a_linter_failure(self):
        r = self._run(ready_state=True, node_exit_code=1)
        self.assertEqual(self._node_calls(), 1,
                         "must invoke the linter once deps are ready")
        self.assertNotEqual(r.returncode, 0, "a linter failure must block the commit")
        self.assertIn("Commit aborted", r.stderr)

    def test_ready_allows_commit_when_linter_reports_tooling_broken(self):
        """Mirror of PostToolUseExecutionTest's exit-3 case for the bash
        consumer: exit 3 = deps failed to import (corrupt tree), so the commit
        must proceed (fail open) instead of aborting with a bogus parse error."""
        r = self._run(ready_state=True, node_exit_code=3)
        self.assertEqual(self._node_calls(), 1,
                         "the linter runs — readiness passed; the exit code decides")
        self.assertEqual(r.returncode, 0,
                         "tooling breakage (exit 3) must not abort the commit")
        self.assertNotIn("Commit aborted", r.stderr)
        self.assertIn("skipped", r.stderr)


if __name__ == "__main__":
    unittest.main()
