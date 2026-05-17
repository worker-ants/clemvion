"""Project-level config loader for the Claude harness.

Reads ``<repo-root>/.claude.project.json`` if present, falling back to
sensible defaults that match this harness's conventions. All harness
scripts that need project-relative paths (corpora, code areas) should
go through ``load(repo_root)`` rather than hard-coding paths.

Schema (every key optional; missing keys fall back to DEFAULTS below):

    {
      "corpora": {
        "spec":              "spec",
        "conventions":       "spec/conventions",
        "plan_in_progress":  "plan/in-progress",
        "plan_complete":     "plan/complete"
      },
      "outputs": {
        "review_code":         "review/code",
        "review_consistency":  "review/consistency",
        "review_merge":        "review/merge"
      },
      "code_areas": ["codebase"]
    }

Unknown keys are silently preserved (forward-compatible with future
schema additions). The result of ``load()`` always carries every
top-level key from DEFAULTS, with caller-provided values overriding
(one level deep for the ``corpora`` and ``outputs`` dicts).

The corpora/outputs/code_areas keys reflect the harness's required
folder conventions. The values can be relocated, but the *concepts*
(spec corpus, plan tracking, review outputs, code areas) are part of
the harness contract — see CLAUDE.md "폴더 구조".
"""

from __future__ import annotations

import json
import os
from typing import Any


CONFIG_FILENAME = ".claude.project.json"

DEFAULTS: dict[str, Any] = {
    "corpora": {
        "spec":             "spec",
        "conventions":      "spec/conventions",
        "plan_in_progress": "plan/in-progress",
        "plan_complete":    "plan/complete",
    },
    "outputs": {
        "review_code":         "review/code",
        "review_consistency":  "review/consistency",
        "review_merge":        "review/merge",
    },
    "code_areas": ["codebase"],
}


def _clone_defaults() -> dict[str, Any]:
    """Return a deep-enough copy of DEFAULTS so callers can mutate safely."""
    out: dict[str, Any] = {}
    for k, v in DEFAULTS.items():
        if isinstance(v, dict):
            out[k] = dict(v)
        elif isinstance(v, list):
            out[k] = list(v)
        else:
            out[k] = v
    return out


def _merge_overrides(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    """Merge user overrides onto a defaults-clone (one level deep for dicts)."""
    if not isinstance(override, dict):
        return base
    for k, v in override.items():
        if isinstance(base.get(k), dict) and isinstance(v, dict):
            base[k] = {**base[k], **v}
        else:
            base[k] = v
    return base


def load(repo_root: str) -> dict[str, Any]:
    """Load ``<repo_root>/.claude.project.json``, returning the merged config.

    Missing file / unreadable file / invalid JSON → DEFAULTS only (no
    raise). The harness must keep working in repos that have not yet
    written a project config file.
    """
    base = _clone_defaults()
    if not repo_root:
        return base
    path = os.path.join(repo_root, CONFIG_FILENAME)
    if not os.path.isfile(path):
        return base
    try:
        with open(path, "r", encoding="utf-8") as f:
            user_cfg = json.load(f)
    except (OSError, json.JSONDecodeError):
        return base
    return _merge_overrides(base, user_cfg)


def find_repo_root(start: str | None = None) -> str | None:
    """Walk up from ``start`` (default: cwd) looking for the project config or .git.

    Returns the first directory that contains either ``.claude.project.json``
    or a ``.git`` entry (file or directory). Returns ``None`` if neither is
    found before the filesystem root.
    """
    cur = os.path.abspath(start or os.getcwd())
    while True:
        if os.path.isfile(os.path.join(cur, CONFIG_FILENAME)):
            return cur
        if os.path.exists(os.path.join(cur, ".git")):
            return cur
        parent = os.path.dirname(cur)
        if parent == cur:
            return None
        cur = parent
