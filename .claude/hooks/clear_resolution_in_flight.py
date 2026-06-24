#!/usr/bin/env python3
"""SubagentStop hook — clear the "resolution in flight" marker when a
`resolution-applier` sub-agent finishes.

Pairs with `mark_resolution_in_flight.py` (PreToolUse(Agent)). A `SubagentStop`
payload carries the same `tool_use_id` as the originating `Agent` dispatch
(confirmed empirically — the dispatch's tool_use_id matches the completion
event's), so we remove exactly that marker. If the stopping sub-agent was not a
resolution-applier its marker simply does not exist → harmless no-op (we do not
need, and the payload does not reliably carry, the subagent_type here).

The TTL in `review_guard._resolution_in_flight` is the backstop for the case
where SubagentStop never fires (crash / unusual async path): a stale marker then
expires and the gate re-arms. Fail-open, always exit 0 (a Stop-family hook must
never wedge the session).
"""

from __future__ import annotations

import json
import os
import re
import sys

_MARKER_SAFE = re.compile(r"[^A-Za-z0-9._-]")


def _state_dir() -> str:
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    return os.path.join(project_dir, ".claude", "state", "resolution_in_flight")


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        return 0

    try:
        tool_use_id = payload.get("tool_use_id")
        if not tool_use_id:
            return 0  # cannot correlate → leave it for the TTL backstop
        marker = os.path.join(_state_dir(), _MARKER_SAFE.sub("_", str(tool_use_id)))
        if os.path.isfile(marker):
            os.remove(marker)
    except Exception:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
