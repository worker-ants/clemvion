"""Shared path resolution and module loaders for the `.claude/` harness tests.

These tests exercise the harness's own Python (hooks, skill libs, config) — not
the product code under `codebase/`. They use only the standard library
(`unittest`) so they run with a bare `python3 -m unittest` and need no install,
matching the harness convention that its Python carries zero third-party deps.

Loading harness modules is fiddly because two different `_lib` packages exist
(`.claude/hooks/_lib` and `.claude/skills/_lib`). Importing both via `sys.path`
would collide. So:
  - `.claude/hooks/` is placed on `sys.path` once, making `import _lib.branch_guard`
    / `import _lib.branch_naming` resolve to the *hooks* package (which is what
    `branch_naming` itself expects via `from _lib.branch_guard import ...`).
  - Everything else (`project_config`, `role_instructions`) is loaded by explicit
    file path under a unique module name, sidestepping the `_lib` ambiguity.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

# _harness.py lives in .claude/tests/ → parents[2] == repo root.
REPO_ROOT = Path(__file__).resolve().parents[2]
CLAUDE_DIR = REPO_ROOT / ".claude"
HOOKS_DIR = CLAUDE_DIR / "hooks"

# Make `import _lib.branch_guard` / `import _lib.branch_naming` resolve to the
# hooks package. Done once, at import time, before any test imports them.
if str(HOOKS_DIR) not in sys.path:
    sys.path.insert(0, str(HOOKS_DIR))


def load_module_by_path(name: str, path: Path) -> ModuleType:
    """Load a standalone module from an explicit file path.

    Use this for harness modules that would otherwise collide on a shared
    package name (e.g. the two `_lib` packages). The module is registered in
    ``sys.modules`` under ``name`` so dataclasses compare by identity within a
    run.
    """
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {name} from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


# Shapes a `VAR=value` assignment's VALUE can take. Both guards skip such a
# prefix before looking at the real command, both had the same regex, and both
# regressed the same way — twice — by narrowing that value's alternatives. Their
# superset tests generate inputs from this list, and it lives here so the two
# cannot drift: a shape added because one guard broke on it is immediately
# exercised against the other.
#
# Order and duplicates matter (the tests assert there are none), so add rather
# than rewrite. Each entry is the VALUE alone; templates supply the assignment.
ENV_VALUE_SHAPES = (
    "x", "'x'", '"x"', "'x", '"x', "x'", 'x"', "'x y'", '"x y"', "''", '""',
    "'", '"', "a'b", 'a"b', "x=y", "-i", "~/.key", "'x y", '"x y',
    r'"a\"b"', r'"a\"b', r'"a\\"', "a b", "''''", '"""',
    # Quoted piece glued to an unquoted one — harness-guard-followups §L, still
    # undetected by every generation. Here so a future §L fix is measured on the
    # same axes rather than on a fresh, incomparable set.
    '"a b"c', "'a b'c", 'x"a b"',
)
