#!/usr/bin/env python3
"""PreToolUse(Agent) hook — stamp a "resolution in flight" marker the instant the
main agent dispatches the `resolution-applier` sub-agent.

Why this exists
---------------
After `/ai-review` writes SUMMARY.md, the `resolution-applier` sub-agent edits
`codebase/**` files to fix the findings. Those edits postdate the review session,
so `review_guard.evaluate_review()` (consumed by the Stop hook) correctly sees
"code changed AFTER the most recent resolved review" and fires its nudge — even
though the fix is *legitimately in flight*. The model, obeying the nudge, then
launches a premature, redundant `/ai-review` over work the background sub-agent
is already doing → wasted tokens + a race. This marker lets
`guard_review_before_stop.py` suppress that one nudge while resolution is
genuinely in progress (Stop only — the push guard still hard-gates).

Lifecycle
---------
- Written HERE at dispatch. PreToolUse fires *before* the sub-agent executes
  (confirmed empirically), so the marker precedes any of the applier's edits —
  closing the immediate-after-dispatch race that a filesystem-state signal alone
  would miss.
- Cleared by `clear_resolution_in_flight.py` on `SubagentStop` (same
  `tool_use_id`). A TTL in `review_guard._resolution_in_flight` is the backstop
  when SubagentStop never fires (crash / unusual async path), so an abandoned
  resolution re-arms the gate.

Marker file: `<state>/resolution_in_flight/<tool_use_id>`, content = epoch
seconds. `<state>` = `$CLAUDE_PROJECT_DIR/.claude/state` (the stable main-project
dir both marker hooks and the Stop guard resolve), gitignored.

Contract: this hook is advisory plumbing, never a gate. Any error → no marker
(degrades to the prior behaviour). It always allows the tool call (exit 0).
"""

from __future__ import annotations

import json
import os
import re
import sys
import time

# Everything outside this set collapses to `_` so a tool_use_id can never escape
# the state dir into another path (defence-in-depth; ids are harness-issued).
_MARKER_SAFE = re.compile(r"[^A-Za-z0-9._-]")

_RESOLUTION_SUBAGENT = "resolution-applier"


def _state_dir() -> str:
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    return os.path.join(project_dir, ".claude", "state", "resolution_in_flight")


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        return 0  # unparseable payload → allow, no marker

    try:
        if payload.get("tool_name") != "Agent":
            return 0
        tool_input = payload.get("tool_input") or {}
        if (tool_input.get("subagent_type") or "") != _RESOLUTION_SUBAGENT:
            return 0
        tool_use_id = str(payload.get("tool_use_id") or "nouseid")
        marker = os.path.join(_state_dir(), _MARKER_SAFE.sub("_", tool_use_id))
        os.makedirs(os.path.dirname(marker), exist_ok=True)
        with open(marker, "w", encoding="utf-8") as f:
            f.write(str(time.time()))
    except Exception:
        pass  # fail-open: a marker write must never block a dispatch
    return 0


if __name__ == "__main__":
    sys.exit(main())
