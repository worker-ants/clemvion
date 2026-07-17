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

import os
import shutil
import subprocess
import sys
import tempfile
import unittest

import _harness  # noqa: F401

ready = _harness.load_module_by_path(
    "mermaid_lint_ready",
    _harness.HOOKS_DIR / "_lib" / "mermaid_lint_ready.py",
)

BOOTSTRAP_SRC = _harness.REPO_ROOT / ".claude" / "tools" / "bootstrap-session.sh"
PRECOMMIT_SRC = _harness.REPO_ROOT / ".githooks" / "pre-commit"
POSTTOOLUSE_SRC = _harness.HOOKS_DIR / "lint_mermaid_posttooluse.py"


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
        # marker path implies node_modules/, but guard the isdir check anyway.
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


if __name__ == "__main__":
    unittest.main()
