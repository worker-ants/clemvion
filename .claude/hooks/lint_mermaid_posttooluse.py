#!/usr/bin/env python3
"""PostToolUse hook — static syntax check for ```mermaid blocks Claude writes.

Registered in `.claude/settings.json` for the matchers
`Write|Edit|MultiEdit|NotebookEdit`. The harness pipes a JSON payload on
stdin describing the tool call that just ran and watches the exit code:

  exit 0 → no problem (also: not markdown, or no mermaid block — fast path).
  exit 2 → mermaid parse error; stderr is shown to Claude so it can fix it.
  any other → treated as a runtime error; non-blocking (we fail open).

This wrapper is deliberately thin. The actual parse logic lives in the one
shared script `.claude/tools/mermaid-lint/lint-mermaid.mjs`, which the
`.githooks/pre-commit` hook also calls — single source of truth.

To keep latency near-zero on the common case we gate in stages before ever
spawning node:
  1. file_path must end in a markdown extension, else exit 0.
  2. the file content must contain a ```mermaid fence, else exit 0.
  3. only then invoke the node validator (which itself only imports the
     heavy mermaid library when a block is present).

node_modules for the tooling lives only in the MAIN checkout (it is
gitignored, so worktrees and fresh clones don't have their own copy). We
resolve the main checkout via `git --git-common-dir` and run that copy of
the script, passing the edited file by absolute path. If deps aren't
installed yet we fail open — the SessionStart bootstrap installs them.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys

MARKDOWN_EXTS = (".md", ".markdown", ".mdx")
FENCE_RE = re.compile(r"^[ \t]*(`{3,}|~{3,})[ \t]*mermaid\b", re.IGNORECASE | re.MULTILINE)


def _read_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _target_path(payload: dict) -> str | None:
    ti = payload.get("tool_input") or payload.get("input") or {}
    return ti.get("file_path") or ti.get("path") or ti.get("notebook_path")


def _resolve_tool_dir(near: str) -> str | None:
    """Locate `.claude/tools/mermaid-lint` in the MAIN checkout.

    Worktrees share one git common dir; its parent is the main worktree,
    where node_modules is installed exactly once. `MERMAID_LINT_TOOL_DIR`
    overrides this (testing / unusual layouts).
    """
    override = os.environ.get("MERMAID_LINT_TOOL_DIR")
    if override:
        return override if os.path.isdir(override) else None

    workdir = os.path.dirname(near) or "."
    try:
        common = subprocess.run(
            ["git", "-C", workdir, "rev-parse", "--path-format=absolute", "--git-common-dir"],
            capture_output=True, text=True, check=True, timeout=5.0,
        ).stdout.strip()
    except Exception:
        return None
    if not common:
        return None
    main_root = os.path.dirname(common)  # .../clemvion/.git -> .../clemvion
    tool_dir = os.path.join(main_root, ".claude", "tools", "mermaid-lint")
    return tool_dir if os.path.isdir(tool_dir) else None


def main() -> int:
    payload = _read_payload()
    target = _target_path(payload)
    if not target or not target.lower().endswith(MARKDOWN_EXTS):
        return 0
    if not os.path.isfile(target):
        return 0  # deletion / rename away — nothing to lint

    try:
        with open(target, "r", encoding="utf-8", errors="replace") as fh:
            content = fh.read()
    except OSError:
        return 0
    if not FENCE_RE.search(content):
        return 0  # no mermaid block — fast path, never spawn node

    tool_dir = _resolve_tool_dir(target)
    if tool_dir is None or not os.path.isdir(os.path.join(tool_dir, "node_modules")):
        # Deps not installed yet — fail open. SessionStart bootstrap installs them.
        print(
            "mermaid-lint: skipped (tooling deps not installed). "
            "Run: (cd .claude/tools/mermaid-lint && npm install)",
            file=sys.stderr,
        )
        return 0

    script = os.path.join(tool_dir, "lint-mermaid.mjs")
    try:
        proc = subprocess.run(
            ["node", script, os.path.abspath(target)],
            capture_output=True, text=True, timeout=20.0,
        )
    except FileNotFoundError:
        print("mermaid-lint: skipped (node not found on PATH).", file=sys.stderr)
        return 0
    except subprocess.TimeoutExpired:
        # A hung linter must never wedge the PostToolUse hook (and the session).
        print("mermaid-lint: skipped (linter timed out after 20s).", file=sys.stderr)
        return 0

    if proc.returncode == 0:
        return 0

    # Parse failure → surface to Claude so it fixes the diagram.
    detail = (proc.stderr or proc.stdout or "").rstrip()
    print(
        "mermaid syntax error in the markdown just written "
        f"({os.path.relpath(target)}):\n{detail}\n\n"
        "Fix the ```mermaid block so it parses. The same check runs at "
        "commit time via .githooks/pre-commit.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
