"""Where a review/consistency session's per-agent reports live, and what counts as one.

**Single source for two enforcement points that must agree**: the push/stop gate
(`hooks/_lib/review_guard.py`) and the orchestrator CLIs (`--verify-coverage`,
`--sync-from-disk`, `--summary-state`, `--resume`). When they disagree, a caller sees
`--verify-coverage` report OK and then gets blocked at push — or, in the other direction,
the gate silently accepts what the CLI would have refused.

That is not hypothetical. Both sides carried their own copy behind a "change both"
comment, and the comment failed within one PR: the gate gained a non-empty requirement
(#962 W7) while `--verify-coverage` kept checking mere existence, so `touch security.md`
passed the CLI and failed the gate at the same moment (measured 2026-07-17). Hence a
module, not a convention.

## The two rules

**Location.** Resolve reports against the **session directory**, never against the
manifest's `output_file`. That field records the worktree the session was *prepared* in
(`…/.claude/worktrees/<task>-<slug>/review/code/…`). Worktrees are deleted when their task
ends while `review/**` is committed, so the same session is read later from a different
worktree at a different absolute path. Trusting the recorded path reports "no report" for
every session whose worktree is gone — 537 of 575 committed sessions when measured, which
would fire a coverage gate on nearly everything. Only the directory is re-anchored; the
basename still comes from the manifest so a future naming change follows automatically.

**Existence.** A report must be **non-empty**. Existence alone lets `touch security.md`
satisfy a whitelist — the same "looks done, isn't" shape these gates exist to catch. The
bar is deliberately low rather than structural: all 4749 committed reports are ≥254 bytes,
so nothing real is near it, and pinning section headers would freeze the report format.
"""

from __future__ import annotations

import os


def report_path(session_dir: str, name: str, state: dict) -> str:
    """Absolute path where `name`'s report belongs **in this session dir**."""
    recorded = None
    invocations = state.get("subagent_invocations")
    if isinstance(invocations, list):
        recorded = next(
            (
                inv.get("output_file")
                for inv in invocations
                if isinstance(inv, dict) and inv.get("name") == name
            ),
            None,
        )
    recorded = recorded or f"{name}.md"
    basename = os.path.basename(str(recorded))
    if basename in ("", ".", ".."):
        # A recorded `output_file` that ends in `/` (basename "") or is a bare `.`/`..`
        # component would otherwise resolve to the session dir itself or its parent — a
        # directory, not a report file. `has_report()` would then read the *directory's*
        # size, which is rarely 0, and misjudge "report present". Fall back to the same
        # name-based default used when no invocation is recorded at all.
        basename = f"{name}.md"
    return os.path.join(os.path.abspath(session_dir), basename)


def report_paths(session_dir: str, state: dict) -> dict[str, str]:
    """`{agent name: report path}` for every agent the manifest declares.

    No production caller today — both orchestrators reach for `has_report()` /
    `missing_reports()` instead, and the local wrappers that used to call this were
    removed as dead code. Kept as API surface with the plural case pinned by a test
    rather than deleted, but do not read a call site into it.
    """
    invocations = state.get("subagent_invocations")
    if not isinstance(invocations, list):
        return {}
    return {
        inv["name"]: report_path(session_dir, inv["name"], state)
        for inv in invocations
        if isinstance(inv, dict) and inv.get("name")
    }


def has_report(session_dir: str, name: str, state: dict) -> bool:
    """True when `name` left a usable report — present **and** non-empty.

    `isfile` first, deliberately: a bare `getsize() > 0` also passes for a *directory*
    (most filesystems report a non-zero directory-entry size), and `report_path()`'s
    basename fallback aside, nothing guarantees every future caller pre-sanitizes its
    `output_file`. Checking the file type here is the same belt-and-suspenders the
    pre-refactor orchestrators had independently, before this module existed.
    """
    path = report_path(session_dir, name, state)
    try:
        return os.path.isfile(path) and os.path.getsize(path) > 0
    except OSError:
        return False  # absent, or unreadable — either way we have no report


def missing_reports(session_dir: str, names, state: dict) -> list[str]:
    """Which of `names` left no usable report. Empty ⇒ complete coverage."""
    if not isinstance(names, list):
        return []
    return [n for n in names if not has_report(session_dir, n, state)]
