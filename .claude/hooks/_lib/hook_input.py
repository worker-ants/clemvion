"""Hook input — the JSON a hook receives on stdin, and the directory it names.

Consumed by the three default-branch hooks:
  - .claude/hooks/guard_default_branch_edit.py    (PreToolUse, Write/Edit)
  - .claude/hooks/guard_default_branch_bash.py    (PreToolUse, Bash)
  - .claude/hooks/guard_default_branch_prompt.py  (UserPromptSubmit)

These two rules lived as a ten-line `_read_payload` copied byte for byte into each of the
three hooks and a `hook_cwd` in `branch_guard`. A rule about what the harness sends is not
a rule about the default branch, so it sits here and `branch_guard` keeps only the policy.
Four other hooks (`guard_nerv_owned_paths`, `normalize_worktree_branch`,
`guard_review_before_push`, `lint_mermaid_posttooluse`) still carry their own
`_read_payload` with a different body; moving them is a separate change (NERV Task
`CLE-T-QY5AZ3` follow-up).
"""

from __future__ import annotations

import json
import os
import sys


def read_payload(stream=None) -> dict:
    """The hook input as a dict. Anything unreadable reads as `{}`, the same as no input.

    Unreadable is: empty or blank input, text that is not JSON, bytes that are not UTF-8
    (`stream.read()` raises `UnicodeDecodeError`, a `ValueError`), a stream that fails
    (`OSError`), and JSON that is not an object (`[]`, `"x"`, `3`). `stream` defaults to
    `sys.stdin`, read when the function is called so a test can swap it.
    """
    stream = sys.stdin if stream is None else stream
    try:
        raw = stream.read()
        if not raw.strip():
            return {}
        payload = json.loads(raw)
    except (ValueError, OSError):  # JSONDecodeError and UnicodeDecodeError are ValueErrors
        return {}
    return payload if isinstance(payload, dict) else {}


def payload_cwd(payload) -> str | None:
    """The directory a hook should judge: the input's `cwd` when it is a non-empty string, else None.

    None makes `branch_guard.evaluate()` fall back to `os.getcwd()`, the behaviour before hooks
    read their input. Kept in one place so the three default-branch hooks cannot drift on what
    counts as a usable `cwd`.
    """
    if not isinstance(payload, dict):
        return None
    cwd = payload.get("cwd")
    return cwd if isinstance(cwd, str) and cwd else None
