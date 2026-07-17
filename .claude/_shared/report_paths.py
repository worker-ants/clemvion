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
    return os.path.join(os.path.abspath(session_dir), os.path.basename(str(recorded)))


def report_paths(session_dir: str, state: dict) -> dict[str, str]:
    """`{agent name: report path}` for every agent the manifest declares."""
    invocations = state.get("subagent_invocations")
    if not isinstance(invocations, list):
        return {}
    return {
        inv["name"]: report_path(session_dir, inv["name"], state)
        for inv in invocations
        if isinstance(inv, dict) and inv.get("name")
    }


def has_report(session_dir: str, name: str, state: dict) -> bool:
    """True when `name` left a usable report — present **and** non-empty."""
    try:
        return os.path.getsize(report_path(session_dir, name, state)) > 0
    except OSError:
        return False  # absent, or unreadable — either way we have no report


def missing_reports(session_dir: str, names, state: dict) -> list[str]:
    """Which of `names` left no usable report. Empty ⇒ complete coverage."""
    if not isinstance(names, list):
        return []
    return [n for n in names if not has_report(session_dir, n, state)]
