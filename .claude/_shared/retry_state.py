"""`_retry_state.json` bookkeeping, shared by both orchestrators.

`code_review_orchestrator` and `consistency_orchestrator` each carried their own
copy of these five functions, kept in step by a "Mirrors X. Change both." comment
on each pair. That is the same arrangement `_shared/report_paths.py` was created
to replace, after two copies of *that* rule drifted apart in practice.

**Measured before extracting** (AST comparison, docstrings excluded):

    _load_state                 identical
    _save_state                 identical
    _reconcile_state_with_disk  identical
    _apply_status_update        identical
    _emit_summary_state         differs — 4 nodes

Only the last one genuinely differs: the code-review side also prints `skipped=`
and `routing=`, because it has a router and the consistency side does not. Line
counts suggested far more divergence (154 vs 113 lines) but that was comment
volume — the code-review copies carry longer rationale comments. Comparing
rendered text instead of syntax would have argued for leaving all five alone.

So the four identical ones move here verbatim, and `emit_summary_state` takes the
differing fields as a parameter rather than being duplicated for them.

Disk is the arbiter throughout: a self-reported status with no file behind it is
the fake success this contract exists to remove. Rate-limit bookkeeping
(`rate_limit_episodes`, `last_reset_hint_sec`) is left alone — an agent that hit
a limit has no file and stays pending, which is what `/loop` needs.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime

from . import report_paths as _report_paths_lib


def load_state(session_dir):
    state_file = os.path.join(session_dir, "_retry_state.json")
    if not os.path.isfile(state_file):
        print(f"Error: _retry_state.json missing under {session_dir}", file=sys.stderr)
        sys.exit(1)
    with open(state_file, "r", encoding="utf-8") as f:
        return state_file, json.load(f)


def save_state(state_file, state):
    """Write atomically: temp file in the same directory, then `os.replace`.

    A plain `open(..., "w")` truncates first, so a concurrent reader that opens
    during the write sees a half-written file and `load_state`'s `json.load`
    raises straight through — a traceback rather than the graceful "state file
    missing" path right above it. `os.replace` is atomic on the same filesystem,
    which removes that window without needing a lock.

    Lost updates between concurrent writers are a separate matter, left to the
    project's existing convergence approach — but that convergence is narrower
    than "the agent buckets are derived from disk", which is how an earlier
    version of this note put it. Precisely: `agents_success` is rebuilt from the
    report files on every read, so it genuinely self-heals. `agents_fatal` is
    only *filtered* from whatever the loaded state already held; nothing on disk
    records "this was fatal". `agents_pending` is the remainder of the two.

    So a lost update can silently revert a committed `fatal` transition back to
    `pending`, and no later reconcile can recover it — `/loop` then retries a
    checker already judged permanently failed. `agent_history` and the
    rate-limit fields have no convergence either: a lost `last_reset_hint_sec`
    makes `/loop` retry before a rate limit clears, a lost history entry quietly
    shrinks the audit trail. CLAUDE.md tells callers to batch independent tool
    calls in parallel, so concurrent `--update` is a real path, not a thought
    experiment.

    Accepted rather than locked, for the same reason `failopen_state` accepts its
    own residuals: the convergent fields are the ones the gate reads, and adding
    `fcntl.flock` here would put a blocking primitive in the path of every hook.
    Registered as a follow-up rather than left implicit.
    """
    tmp = f"{state_file}.tmp.{os.getpid()}"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
        os.replace(tmp, state_file)
    finally:
        if os.path.exists(tmp):
            try:
                os.unlink(tmp)
            except OSError:
                pass


def reconcile_state_with_disk(session_dir):
    """Bring the state's buckets in line with the reports on disk.

    Returns `(state, changed)`. Quiet — callers decide what to say.
    """
    sd = os.path.abspath(session_dir)
    state_file, state = load_state(sd)
    known = [i["name"] for i in state.get("subagent_invocations", [])]
    if not known:
        return state, False
    skipped = set(state.get("agents_skipped", []))

    # `has_report` (shared with the gate) = present AND non-empty. Plain `isfile`
    # here would count a `touch`ed placeholder that the gate refuses — the two
    # enforcement points must not disagree.
    on_disk = [n for n in known if _report_paths_lib.has_report(sd, n, state)]
    missing = [n for n in known if n not in on_disk and n not in skipped]
    fatal = [n for n in state.get("agents_fatal", []) if n in missing]

    before = (
        state.get("agents_success"),
        state.get("agents_pending"),
        state.get("agents_fatal"),
    )
    state["agents_success"] = on_disk
    # An agent already recorded as fatal stays fatal — it is not merely "not run
    # yet", and listing it in both buckets would make `pending`/`fatal` disagree.
    state["agents_pending"] = [n for n in missing if n not in fatal]
    state["agents_fatal"] = fatal
    # `agents_fatal` belongs in the comparison: without it, a run that only
    # changed the fatal list fixed `state` in memory and then skipped the save.
    changed = before != (
        state["agents_success"],
        state["agents_pending"],
        state["agents_fatal"],
    )
    if changed:
        save_state(state_file, state)
    return state, changed


def emit_summary_state(session_dir, extra_fields=None):
    """One-line state summary, reconciled with disk first.

    `extra_fields` is `state -> mapping`, appended to the line — the code-review
    orchestrator passes `skipped`/`routing`, which the consistency side has no
    equivalent of. It is the only axis on which the two copies actually differed.
    Callable, not a mapping: see the note at the call below.

    Reconciling on read means the numbers are true even when the session was
    fanned out with the Agent tool directly: that path never calls `--update`,
    which used to leave the state frozen at its prepare-time snapshot while the
    sibling SUMMARY.md reported real successes — two committed artifacts
    contradicting each other. Self-healing on read beats adding one more thing a
    caller must remember; the failure this addresses was itself an obligation
    that only lived in prose.

    Caveat: that makes this a conditional writer, so auditing an old committed
    session can dirty the worktree. The write is announced on stderr rather than
    done silently.
    """
    state, changed = reconcile_state_with_disk(session_dir)
    if changed:
        print("(reconciled _retry_state.json with reports on disk)", file=sys.stderr)
    parts = [
        f"pending={len(state.get('agents_pending', []))}",
        f"success={len(state.get('agents_success', []))}",
        f"fatal={len(state.get('agents_fatal', []))}",
    ]
    # Callable only. A pre-built mapping would force the caller to reconcile
    # first to compute it, and this function's own reconcile would then find
    # nothing left to announce — which is precisely how the "(reconciled …)"
    # notice went missing on one side when this was first wired.
    for key, value in ((extra_fields(state) if extra_fields else None) or {}).items():
        parts.append(f"{key}={value}")
    last_reset = state.get("last_reset_hint_sec")
    parts.append(f"last_reset={last_reset if last_reset is not None else 'null'}")
    print(" ".join(parts))


def apply_status_update(session_dir, agent, status, reset_hint):
    """Move an agent between pending/success/fatal buckets and record history."""
    state_file, state = load_state(os.path.abspath(session_dir))
    for bucket in ("agents_pending", "agents_success", "agents_fatal"):
        if agent in state.get(bucket, []):
            state[bucket].remove(agent)

    if status == "success":
        state.setdefault("agents_success", []).append(agent)
    elif status == "fatal":
        state.setdefault("agents_fatal", []).append(agent)
    else:
        state.setdefault("agents_pending", []).append(agent)
        if status == "rate_limit":
            state["rate_limit_episodes"] = state.get("rate_limit_episodes", 0) + 1
        if reset_hint is not None:
            prev = state.get("last_reset_hint_sec") or 0
            state["last_reset_hint_sec"] = max(prev, reset_hint)

    history_entry = {"ts": datetime.utcnow().isoformat() + "Z", "status": status}
    if reset_hint is not None:
        history_entry["reset_hint_sec"] = reset_hint
    state.setdefault("agent_history", {}).setdefault(agent, []).append(history_entry)

    save_state(state_file, state)
    print(
        f"agent={agent} status={status} "
        f"pending={len(state.get('agents_pending', []))} "
        f"success={len(state.get('agents_success', []))} "
        f"fatal={len(state.get('agents_fatal', []))}"
    )
