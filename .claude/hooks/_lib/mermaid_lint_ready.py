#!/usr/bin/env python3
"""Single source of truth for "is the mermaid-lint tooling installed?".

Three places must agree on this, or they drift into the exact bug this guards:
  - bootstrap-session.sh WRITES the completion marker after a successful install;
  - .githooks/pre-commit (bash) and lint_mermaid_posttooluse.py (python) READ it
    to decide whether to run the linter.

A bare `[ -d node_modules ]` test is not enough — an install cut short leaves a
PARTIAL node_modules that the directory test accepts forever, so the reader runs
the linter against half-installed deps and reports mermaid syntax errors that do
not exist (blocking the commit / nagging the editor). Readiness therefore means
BOTH: node_modules exists AND the marker inside it exists.

The readers import/invoke this module so they share one rule. bootstrap is bash
and writes the marker with a hardcoded name; test_mermaid_lint_ready.py asserts
that hardcoded string matches MARKER_NAME here, so the writer cannot drift from
the readers silently (the repo's cross-language binding convention — guard the
agreement with a test, since a bash file and a python file cannot share a
runtime constant).

CLI (for the bash reader):
    python3 mermaid_lint_ready.py <tool_dir>
    exit 0 → ready (run the linter);  exit 1 → not ready (skip, fail open).
"""

from __future__ import annotations

import os
import sys

# Lives INSIDE node_modules on purpose: deleting the tree deletes the marker
# with it, so a wiped/partial install is never mistaken for a complete one.
MARKER_NAME = ".bootstrap-install-complete"


def marker_path(tool_dir: str) -> str:
    return os.path.join(tool_dir, "node_modules", MARKER_NAME)


def is_ready(tool_dir: str | None) -> bool:
    """True only when a *completed* install is present in tool_dir."""
    if not tool_dir:
        return False
    node_modules = os.path.join(tool_dir, "node_modules")
    return os.path.isdir(node_modules) and os.path.isfile(marker_path(tool_dir))


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("usage: mermaid_lint_ready.py <tool_dir>", file=sys.stderr)
        return 2
    return 0 if is_ready(argv[0]) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
