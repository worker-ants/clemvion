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


def git_in(repo: Path | str, *args: str, check: bool = True,
           capture: bool = True) -> "subprocess.CompletedProcess[str]":
    """Run `git` **inside** ``repo``, and make it impossible to escape.

    2026-08-06 a fixture of this shape ran `git remote add origin …` while its
    cwd was still the worktree, so it rewrote the **shared** `.git/config`.
    Five worktrees read that file: other sessions' `git fetch` broke, and
    nothing signalled it until a later fetch failed. The fixture looked correct
    — it passed `cwd=` — but `cwd` alone does not stop git from walking *up* to
    find a repository when the target is not one yet.

    Three things close that, and they only work together:

    - ``git -C <repo>`` pins the directory in git's own argv, so a caller that
      forgets `cwd` cannot silently target the process's cwd.
    - ``GIT_CEILING_DIRECTORIES`` stops the upward search at ``repo``. Without
      it, `git init`-before-the-fact or a typo'd path finds the enclosing
      worktree instead of failing.
    - the realpath assertion rejects a ``repo`` outside a temp directory
      **before** git runs. `GIT_CEILING_DIRECTORIES` protects the tree above
      ``repo``; it does nothing if ``repo`` *is* the worktree.

    Real-repository readers (tests that intentionally query this checkout's own
    history) must NOT use this helper — pinning a ceiling at the repo root is
    meaningless there, and the assertion would reject it. Those call `git`
    directly with `cwd=REPO_ROOT`.
    """
    import os
    import subprocess
    import tempfile

    resolved = os.path.realpath(str(repo))
    tmp_roots = {os.path.realpath(tempfile.gettempdir()), "/tmp", "/private/tmp"}
    assert any(resolved == r or resolved.startswith(r + os.sep) for r in tmp_roots), (
        f"git_in() 은 임시 디렉터리 안에서만 쓴다 — 받은 경로: {resolved}. "
        "실 저장소를 읽는 테스트라면 이 헬퍼가 아니라 cwd=REPO_ROOT 로 직접 호출할 것 "
        "(공유 .git/config 오염 사고 2026-08-06 의 방어)."
    )
    env = dict(os.environ)
    env["GIT_CEILING_DIRECTORIES"] = resolved
    env.setdefault("GIT_CONFIG_GLOBAL", os.devnull)
    env.setdefault("GIT_CONFIG_SYSTEM", os.devnull)
    return subprocess.run(["git", "-C", resolved, *args], env=env, check=check,
                          capture_output=capture, text=True)


def make_temp_git_repo(path: Path | str, *, branch: str = "main",
                       initial_commit: bool = True) -> Path:
    """Initialise an isolated git repo at ``path`` and return it.

    Identity is set locally (never `--global`) so the helper works on a machine
    with no git identity configured — CI runners included.
    """
    repo = Path(path)
    repo.mkdir(parents=True, exist_ok=True)
    git_in(repo, "init", "-q", "-b", branch)
    git_in(repo, "config", "user.email", "harness@example.invalid")
    git_in(repo, "config", "user.name", "harness")
    if initial_commit:
        (repo / ".gitkeep").write_text("", encoding="utf-8")
        git_in(repo, "add", ".gitkeep")
        git_in(repo, "commit", "-qm", "init")
    return repo


TESTS_DIR = Path(__file__).resolve().parent

# Four suites drive an orchestrator in a FRESH interpreter. The reason is the
# `_lib` collision documented at the top of this file: importing an orchestrator
# in-process pollutes `sys.modules` for the whole run. A subprocess sidesteps it.
#
# They were near-copies, not copies — measured before extracting: the runner
# bodies were byte-identical in 3 of 4 (the fourth differed only in a docstring),
# but the preambles ranged 44–70% similar because each adds its own fixtures on
# top of a shared core. So only the CORE moves here; per-file fixtures stay in
# the file that needs them, passed as `extra`. Extracting those too would have
# invented a shared thing that never existed.
_PREAMBLE_CORE = """\
import importlib.util, json, sys
sys.path.insert(0, {tests_dir!r})
import _harness            # git_in / make_temp_git_repo inside the snippet
spec = importlib.util.spec_from_file_location("orch", {orch!r})
orch = importlib.util.module_from_spec(spec)
sys.modules["orch"] = orch
spec.loader.exec_module(orch)
REPO_ROOT = {root!r}
ROOT = REPO_ROOT   # 두 이름이 모두 쓰인다

def emit(value):
    sys.stdout.write("<<<" + json.dumps(value) + ">>>")

ARG = json.loads(sys.stdin.read() or "null")
"""


def orchestrator_preamble(orch_path: Path | str, *, imports: str = "",
                          extra: str = "") -> str:
    """Build the fresh-interpreter preamble for an orchestrator suite.

    `imports` is a comma-separated list of EXTRA modules the snippet needs
    (`"contextlib, io"`); the core always imports what it uses itself.
    `extra` is appended verbatim — per-file fixtures, already dedented.

    `_harness` is on the subprocess's path, so a snippet that needs a temp git
    repo calls `_harness.git_in(...)` instead of a raw `subprocess.run(["git",
    …])`. That matters beyond tidiness: the AST guard in
    `test_review_guard_hardening.py` cannot see calls that live inside a string,
    so a raw call there is invisible to it.
    """
    head = _PREAMBLE_CORE.format(tests_dir=str(TESTS_DIR), orch=str(orch_path),
                                 root=str(REPO_ROOT))
    if imports:
        head = head.replace("import importlib.util, json, sys\n",
                            f"import importlib.util, json, sys\nimport {imports}\n", 1)
    return head + (extra if extra.endswith("\n") or not extra else extra + "\n")


def run_in_orchestrator(preamble: str, snippet: str, arg=None,
                        *, timeout: float = 30.0):
    """Run `snippet` with `orch`, `emit`, `ARG`, `ROOT` and `_harness` in scope.

    `timeout` is not optional in spirit: without it a hang in the target code
    blocks the whole run instead of failing. One suite lacked it while a comment
    in another claimed every sibling had one.
    """
    import json as _json
    import subprocess
    import textwrap

    proc = subprocess.run(
        [sys.executable, "-c", preamble + textwrap.dedent(snippet)],
        input=_json.dumps(arg), cwd=str(REPO_ROOT),
        capture_output=True, text=True, timeout=timeout,
    )
    if proc.returncode != 0:
        raise AssertionError(proc.stderr[-3000:])
    out = proc.stdout
    return _json.loads(out[out.index("<<<") + 3:out.rindex(">>>")])
