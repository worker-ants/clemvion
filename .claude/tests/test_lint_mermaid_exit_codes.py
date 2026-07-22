"""Exit-code contract for lint-mermaid.mjs, run against REAL node.

The other mermaid tests (test_mermaid_lint_ready.py) deliberately stub `node`
so they never need a mermaid install. This file is the complement: it runs the
actual script so the ONE behaviour a stub cannot prove is pinned — that a
dependency-import failure exits 3 (tooling broken), distinct from 1 (a real
mermaid.parse() failure) and 2 (usage error).

Why it matters (review/code/2026/07/17 §A W1(10_55_35), deferred there): a
corrupt / partially-installed node_modules that still carried bootstrap's
completion marker passes is_ready(), so a consumer runs the linter — and its
top-level `await import("jsdom")` / `import("mermaid")` throw
ERR_MODULE_NOT_FOUND. Before the fix node crashed with its default exit 1,
indistinguishable from a malformed diagram, so .githooks/pre-commit (exit 1)
and lint_mermaid_posttooluse.py (exit 2) blocked EVERY markdown commit/edit
with a bogus "parse error". The try/catch now exits 3 and the consumers fail
open on it (those halves are pinned in test_mermaid_lint_ready.py).

The missing-deps case is reproduced by copying just lint-mermaid.mjs into an
isolated temp dir with no reachable `jsdom`/`mermaid` on the module-resolution
path — exactly what a corrupt tree looks like to node. Tests skip (do not pass
vacuously) when `node` is not on PATH.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import unittest

import _harness  # noqa: F401  — side effect: harness path setup; REPO_ROOT used below

LINT_SRC = _harness.REPO_ROOT / ".claude" / "tools" / "mermaid-lint" / "lint-mermaid.mjs"
NODE = shutil.which("node")

# A block that parses cleanly with real mermaid — so if deps WERE present this
# file would exit 0, making it unambiguous that a non-zero result comes from the
# import failure and not from malformed content.
_MD_WITH_MERMAID = "# doc\n\n```mermaid\ngraph TD; a-->b;\n```\n"
_MD_NO_MERMAID = "# doc\n\nplain text, no diagram\n"


class LintMermaidExitCodeTest(unittest.TestCase):
    def setUp(self):
        if not NODE:
            self.skipTest("node not on PATH — cannot exercise the real linter")
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        # Copy the script into an isolated dir with a marked-but-empty
        # node_modules: is_ready() would accept it, yet `jsdom`/`mermaid` are not
        # installed — the corrupt-but-marked tree the fix targets. Under
        # /var/folders there is no ancestor node_modules to accidentally satisfy
        # the import, so resolution genuinely fails.
        self.tool_dir = os.path.join(self.tmp, "mermaid-lint")
        os.makedirs(os.path.join(self.tool_dir, "node_modules"))
        open(os.path.join(self.tool_dir, "node_modules",
                          ".bootstrap-install-complete"), "w").close()
        self.script = os.path.join(self.tool_dir, "lint-mermaid.mjs")
        shutil.copy(LINT_SRC, self.script)

    def _write_md(self, content):
        path = os.path.join(self.tmp, "doc.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return path

    def _run(self, *args):
        return subprocess.run([NODE, self.script, *args],
                              capture_output=True, text=True, timeout=30)

    def test_import_failure_exits_3_not_1(self):
        """The fix: a missing dependency is tooling breakage (exit 3), NOT a
        parse error (exit 1). Reverting the try/catch makes node crash with its
        default exit 1 and fails this test."""
        r = self._run(self._write_md(_MD_WITH_MERMAID))
        self.assertEqual(r.returncode, 3,
                         f"import failure must exit 3, got {r.returncode}\n{r.stderr}")
        self.assertIn("tooling unavailable", r.stderr)

    def test_no_mermaid_block_exits_0_without_touching_deps(self):
        """The fast path returns before importing, so a corrupt tree is
        irrelevant when there is nothing to lint. Proves exit 3 is not returned
        spuriously — it fires only when a dependency is actually needed."""
        r = self._run(self._write_md(_MD_NO_MERMAID))
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_usage_error_still_exits_2(self):
        """No file args → usage error (2), a code distinct from the new 3, so a
        consumer can never confuse the two."""
        r = self._run()  # no file arguments
        self.assertEqual(r.returncode, 2, r.stderr)


if __name__ == "__main__":
    unittest.main()
