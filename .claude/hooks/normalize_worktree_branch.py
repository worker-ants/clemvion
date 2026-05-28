#!/usr/bin/env python3
"""Normalize harness-created `worktree-<name>` branches to `claude/<name>`.

The built-in `EnterWorktree` tool always names its branch `worktree-<name>`,
diverging from this project's `claude/<task>-<slug>` convention (see
`.claude/tools/ensure-worktree.sh`). No harness setting controls that prefix
and the `WorktreeCreate` hook does not fire inside a git repo, so we cannot
intercept creation. Instead we normalize after the fact via two reliably
firing events:

  - UserPromptSubmit — catches the common cross-turn case (worktree created
    in a prior turn / at job spawn). Prints a short notice when it renames.
  - PreToolUse(Bash) — closes the same-turn gap: a background job may create
    the worktree and `git push` within one turn, so we rename *before* the
    push runs (silent; never blocks the tool).

All judgment lives in `_lib/branch_naming.normalize`, which is idempotent
and only ever touches un-pushed `worktree-*` branches in linked worktrees.

Registered for both events in `.claude/settings.json`.
"""

from __future__ import annotations

import json
import os
import sys
import traceback

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, THIS_DIR)

try:
    from _lib.branch_naming import normalize  # noqa: E402
except Exception:
    traceback.print_exc(file=sys.stderr)
    sys.exit(0)


def _read_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def main() -> int:
    payload = _read_payload()
    cwd = payload.get("cwd") or os.getcwd()
    event = payload.get("hook_event_name") or ""

    try:
        result = normalize(cwd)
    except Exception:
        traceback.print_exc(file=sys.stderr)
        return 0

    # Only surface a notice on prompt submit. On PreToolUse stay silent so we
    # never risk interfering with the Bash command that's about to run.
    if result.renamed and event == "UserPromptSubmit":
        print(
            "<system-reminder>\n"
            f"브랜치명 정규화: '{result.old}' → '{result.new}'\n"
            "(EnterWorktree 의 worktree- 접두를 프로젝트 컨벤션 claude/ 로 자동 교정).\n"
            "</system-reminder>"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
