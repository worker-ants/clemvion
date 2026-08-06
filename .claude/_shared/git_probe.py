"""Git probes shared by the three push-gate guards.

`review_guard.py` and `plan_guard.py` each carried byte-identical copies of these
five functions. AST-compared before extracting (docstrings excluded): all five
were identical, and only `push_blocks` genuinely differs between the two modules.

The extraction is not tidiness. The pair drifted, twice, in the way this repo has
now recorded three times over (`report_paths`, `retry_state`, the doc-sync matrix):

  · Round 7 found `_run_git` doing `p.stdout.strip()`, which ate the leading space
    of `git status --porcelain`'s `" M path"` and made the fixed-width parse chop
    the first character off every unstaged-modification path. Fixed — in
    `review_guard.py` only.
  · Round 8 found the identical line still in `plan_guard.py`, reproduced it on
    this repository's own working tree, and noted the direction was worse there:
    the review gate had fail-opened, but the plan gate false-BLOCKS — an updated
    plan reads as untouched and the push is refused, inverting that module's own
    documented "a parse failure always means NOT blocked".

Both suites hid it the same way: they mock the git helpers, so `_run_git`,
`_repo_root`, `_merge_base` and `_default_branch` were never executed by any test
in either copy. One implementation with real-repository tests replaces twelve untested ones.

Round 9 moved five of them here and round 10 found a sixth (`_current_branch`)
still duplicated between `plan_guard` and `branch_guard` — the consolidation had
been driven by a hand-written list, which is the same shape as the problem. The
guard now derives the set from the modules themselves instead. `branch_guard`'s
`_origin_default_branch` moved here too, so `_shared` no longer reaches back into
`hooks/_lib` to borrow it.
"""

from __future__ import annotations

import os
import subprocess


def _current_branch(cwd: str) -> str | None:
    """Return current branch name, or None for detached HEAD / unknown."""
    rc, out, _ = _run_git(["symbolic-ref", "--short", "HEAD"], cwd)
    if rc == 0 and out:
        return out
    return None  # detached HEAD or other non-branch state


def _origin_default_branch(cwd: str) -> str | None:
    """Resolve origin's default branch.

    Priority:
      1. `git symbolic-ref refs/remotes/origin/HEAD` — fully local, fast.
         Returns refs/remotes/origin/<name> on success.
      2. None. The network probe moved to `_origin_default_branch_over_network`,
         which `_default_branch` calls only after every local option is spent.
    """
    # Step 0: does origin remote exist at all?
    rc, out, _ = _run_git(["remote"], cwd)
    if rc != 0:
        return None
    remotes = {line.strip() for line in out.splitlines() if line.strip()}
    if "origin" not in remotes:
        return None

    # Method 1: symbolic-ref of origin/HEAD (local cache; no network).
    rc, out, _ = _run_git(
        ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], cwd,
    )
    if rc == 0 and out:
        # `out` looks like "origin/main" — strip the remote prefix.
        prefix = "origin/"
        if out.startswith(prefix):
            return out[len(prefix):]
        return out  # unexpected format; pass through

    return None


def _origin_default_branch_over_network(cwd: str) -> str | None:
    """Ask the remote. Last resort — every other probe is local and free.

    Ordered last on purpose. It used to run before the local remote-tracking
    guesses, and round 11's note claimed "that path is no longer reached" — which
    was wrong in the one environment that matters. Under `actions/checkout` there
    is no `refs/remotes/origin/HEAD`, so the local method above always misses and
    this call always ran; measured at ~2.6s against its own 2.0s cap, i.e. it
    times out and contributes nothing, on every PR, before the local
    `refs/remotes/origin/<name>` probe that answers correctly for free.

    Correctness is unchanged by the move: `refs/remotes/origin/HEAD` (above) is
    still consulted first and is the authoritative statement of origin's default.
    What now precedes this call are only the local *guesses*, and this call could
    not have improved on them — when it succeeds it agrees with them, and when it
    fails it returns nothing.
    """
    rc, out, _ = _run_git(["remote", "show", "origin"], cwd, timeout=2.0)
    if rc == 0 and out:
        for line in out.splitlines():
            stripped = line.strip()
            if stripped.startswith("HEAD branch:"):
                name = stripped.split(":", 1)[1].strip()
                if name and name != "(unknown)":
                    return name
    return None


# `core.quotePath=false`: git otherwise C-quotes any path with a non-ASCII byte —
# `"\355\225\234\352\270\200.ts"`, complete with the surrounding double quotes.
# Nothing downstream decodes that, so such a path (a) never matches a real one in
# `_dirty_set`, making a freshly edited file read as clean and therefore old, and
# (b) is handed straight to `git log -- <path>` by `_newest_commit_time`, which
# matches nothing and returns 0.0 — at which point Gate 1 accepts ANY resolved
# review in the repository, however old. Both directions are fail-open, and both
# are the same root cause as the leading-space bug round 7 fixed one layer up.
#
# Applied at this chokepoint rather than at each call site: there are three
# consumers of path output and the next one would have to remember.
#
# Measured before adding it: `codebase/**` currently holds 2,464 tracked files
# and **zero** with a non-ASCII byte or a quote, so this is unreachable today.
# It is a one-flag fix at a single gate, not a redesign, so it goes in on
# correctness rather than waiting for the first Korean filename to prove it.
# (Residual: git still quotes paths containing `"`, `\`, or control characters
# even with this off. Registered in the plan rather than hand-rolling a decoder.)
def _run_git(args: list[str], cwd: str, timeout: float = 5.0) -> tuple[int, str, str]:
    try:
        p = subprocess.run(
            ["git", "-c", "core.quotePath=false"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        # `rstrip()`, NOT `strip()`. `git status --porcelain` emits a two-column
        # status code, and the most common shape — a tracked file modified but
        # not staged — is `" M path"` with a LEADING SPACE. Stripping it shifted
        # every line left by one, and `_porcelain_path`'s fixed-width parse then
        # returned `"odebase/backend/src/a.ts"` for `codebase/backend/src/a.ts`.
        # That path matches nothing, so the file lost its "just edited" signal
        # and the gate fail-opened — on the most ordinary flow there is (edit one
        # file, push). Found in review round 7 and reproduced directly.
        #
        # Trailing whitespace still goes: every other caller (`rev-parse`,
        # `merge-base`, `log`) wants the bare value without its newline, and
        # none of them can produce meaningful leading whitespace.
        return p.returncode, p.stdout.rstrip(), p.stderr.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return 1, "", ""


def _repo_root(cwd: str) -> str | None:
    rc, out, _ = _run_git(["rev-parse", "--show-toplevel"], cwd)
    if rc != 0 or not out:
        return None
    return out


def _default_branch(cwd: str) -> str | None:
    try:
        d = _origin_default_branch(cwd)
        if d:
            return d
    except Exception:  # noqa: BLE001
        pass
    # Local fallbacks, in order of how much they prove.
    #
    # The remote-tracking probe is the one that matters in CI. `actions/checkout`
    # builds the worktree with `init` + `remote add` + `fetch`, and never runs
    # `git remote set-head`, so `refs/remotes/origin/HEAD` does not exist; it also
    # fetches only the PR ref, so there is no local `refs/heads/main` either. That
    # left `_origin_default_branch`'s NETWORK call as the only path, and when it
    # fails the whole gate reads as "no codebase changes — allowed": base is None,
    # so the committed-changes list is empty, so nothing looks changed. Reproduced
    # in an isolated repo built the way `actions/checkout` builds one, with an
    # unreachable origin — a modified `codebase/` file and no review at all came
    # back as `통과`, exit 0. The backstop was inert in exactly the environment it
    # was written for.
    #
    # `refs/remotes/origin/<name>` is present in that topology and costs no
    # network. Checked before `refs/heads/<name>` because a local branch of the
    # same name is the weaker claim about what the DEFAULT branch is.
    for ref in ("refs/remotes/origin/{}", "refs/heads/{}"):
        for name in ("main", "master"):
            rc, _, _ = _run_git(["rev-parse", "--verify", ref.format(name)], cwd)
            if rc == 0:
                return name
    # Only now the network. See `_origin_default_branch_over_network`.
    try:
        return _origin_default_branch_over_network(cwd)
    except Exception:  # noqa: BLE001
        return None


def _merge_base(cwd: str, default_branch: str) -> str | None:
    # Prefer the remote ref (origin/<default>) so we diff against where the
    # branch forked, falling back to the local branch ref.
    for ref in (f"origin/{default_branch}", default_branch):
        rc, out, _ = _run_git(["merge-base", "HEAD", ref], cwd)
        if rc == 0 and out:
            return out
    return None


def _porcelain_path(ln: str) -> str:
    """Extract the (destination) path from one `git status --porcelain v1` line.

    Format: "XY <path>" where the status code is the first two columns and the
    path starts at column 3. For a rename the payload is "<old> -> <new>" — we
    want <new>. The split is anchored on git's literal `" -> "` separator (with
    surrounding spaces) and only applied when the status code's first column is
    `R`/`C`; a bare `"->"` substring inside an ordinary filename must not split.
    """
    if len(ln) < 4:
        return ""
    code = ln[:2]
    path = ln[3:].strip()
    if code and code[0] in ("R", "C") and " -> " in path:
        path = path.split(" -> ", 1)[1].strip()
    return path
