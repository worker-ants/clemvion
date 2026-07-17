"""Syntax + shared-block drift guards for `.claude/workflows/*.js`.

## Why a bespoke syntax check

A workflow script has `export const meta = …` (ESM-only) *and* a top-level `return`
(CJS-only), so it is valid as neither module kind on its own — only the harness's VM
wrapper makes it parseable. `node --check` on these files therefore **exits 0 even for a
duplicate `const`** (verified 2026-07-17: `node --check` catches that error in a normal
file, but silently passes these). Anyone reaching for `node --check` here gets a false
green — exactly the class of failure the workflows themselves were fixed for.

We reproduce the harness's wrapping (async function body) and let Node parse *that*.

## Why a drift guard

The workflow sandbox cannot import: static `import` → "SyntaxError: import call expects
one or two arguments"; dynamic `import()` → "Error: import() is not available in workflow
scripts" (both measured 2026-07-17). So the report-return contract must be duplicated in
all three fan-out workflows. `_lib/agent-return.mjs` holds the canonical text and gets the
unit tests; this guard fails the build when a copy drifts from it. The bug that made this
contract necessary was itself a duplicated comment that drifted — so the duplication is
kept honest mechanically, not by intention.
"""

from __future__ import annotations

import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from _harness import REPO_ROOT

WORKFLOWS_DIR = REPO_ROOT / ".claude" / "workflows"
LIB = WORKFLOWS_DIR / "_lib" / "agent-return.mjs"
FAN_OUT = ["ai-review.js", "consistency-check.js", "merge-coordinate.js"]

BEGIN = ">>> SHARED-BLOCK: agent-return"
END = "<<< SHARED-BLOCK: agent-return"


def _extract_block(text: str) -> str | None:
    i = text.find(BEGIN)
    j = text.find(END)
    if i < 0 or j < 0:
        return None
    # Include the end marker line so a truncated paste cannot pass.
    return text[i:j + len(END)]


def _check_syntax(path: Path) -> subprocess.CompletedProcess:
    src = path.read_text(encoding="utf-8")
    # Strip the ESM-only `export` and wrap in the async body the harness supplies, so the
    # top-level `return` and `await` are legal. This is the only parse that matches how
    # the script actually runs.
    body = re.sub(r"^export\s+const\s+meta\s*=", "const meta =", src, count=1, flags=re.M)
    wrapped = (
        "void (async function(args, agent, parallel, pipeline, log, phase, workflow, budget){\n"
        + body
        + "\n});\n"
    )
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as t:
        t.write(wrapped)
        tmp = t.name
    try:
        return subprocess.run([_node(), "--check", tmp], capture_output=True, text=True)
    finally:
        Path(tmp).unlink(missing_ok=True)


def _node() -> str:
    return "node"


class WorkflowScriptSyntaxTest(unittest.TestCase):
    def test_every_workflow_parses_as_the_harness_wraps_it(self):
        for name in sorted(p.name for p in WORKFLOWS_DIR.glob("*.js")):
            with self.subTest(workflow=name):
                r = _check_syntax(WORKFLOWS_DIR / name)
                self.assertEqual(r.returncode, 0, f"{name} failed to parse:\n{r.stderr}")

    def test_the_check_actually_catches_a_duplicate_declaration(self):
        # Without this, a silently-broken checker would make every test above vacuous —
        # which is what `node --check` alone does to these files.
        src = (WORKFLOWS_DIR / "consistency-check.js").read_text(encoding="utf-8")
        with tempfile.TemporaryDirectory() as d:
            sabotaged = Path(d) / "consistency-check.js"
            sabotaged.write_text(src + "\nconst usable = 1\n", encoding="utf-8")
            r = _check_syntax(sabotaged)
        self.assertNotEqual(r.returncode, 0, "syntax guard is vacuous — it passed a duplicate const")


class SharedBlockDriftTest(unittest.TestCase):
    def test_lib_defines_the_canonical_block(self):
        block = _extract_block(LIB.read_text(encoding="utf-8"))
        self.assertIsNotNone(block, f"{LIB} lost its SHARED-BLOCK markers")
        self.assertIn("parseAgentReturn", block)

    def test_every_fan_out_workflow_mirrors_the_block_verbatim(self):
        canonical = _extract_block(LIB.read_text(encoding="utf-8"))
        for name in FAN_OUT:
            with self.subTest(workflow=name):
                got = _extract_block((WORKFLOWS_DIR / name).read_text(encoding="utf-8"))
                self.assertIsNotNone(got, f"{name} is missing the SHARED-BLOCK — paste it from {LIB.name}")
                self.assertEqual(
                    got,
                    canonical,
                    f"{name}'s shared block drifted from {LIB.name}. Edit the _lib file, "
                    f"then paste the marked block verbatim into all of: {', '.join(FAN_OUT)}",
                )

    def test_no_fan_out_workflow_still_defaults_a_missing_status_to_success(self):
        # The exact regression: `return m ? m[1] : 'success'` turned a contract-breaking
        # agent into a fake success and dropped its findings from the verdict.
        for name in FAN_OUT:
            with self.subTest(workflow=name):
                src = (WORKFLOWS_DIR / name).read_text(encoding="utf-8")
                self.assertNotIn(
                    "'success'\n}", src.replace(" ", ""),
                    f"{name} appears to default a missing STATUS to success again",
                )
                self.assertIn("no_status", src, f"{name} lost the no_status default")


if __name__ == "__main__":
    unittest.main()
