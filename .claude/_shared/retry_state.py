"""`_retry_state.json` bookkeeping, shared by all three orchestrators.

`code_review_orchestrator` and `consistency_orchestrator` each carried their own
copy of these five functions, kept in step by a "Mirrors X. Change both." comment
on each pair. That is the same arrangement `_shared/report_paths.py` was created
to replace, after two copies of *that* rule drifted apart in practice.

`merge_coordinator_orchestrator` was the third copy and joined in two steps: it
delegated `load_state`/`save_state`/`apply_status_update` first, and became a
full consumer only once it also picked up `reconcile_state_with_disk` — until
then it was the one orchestrator with no self-healing at all.

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
the fake success this contract exists to remove. That arbitration covers both
terminal buckets — a success is backed by its report file, a fatal by a
`_fatal/<name>` sentinel — so an update lost to a concurrent writer is
recoverable for either. **Recoverable in the direction that ADDS the status**;
see `_record_fatal` for the asymmetry, which is real and unclosed. Rate-limit
bookkeeping (`rate_limit_episodes`, `last_reset_hint_sec`) is left alone — an
agent that hit a limit has no file and stays pending, which is what `/loop`
needs.
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

    **Lost updates between concurrent writers remain**, and this note is precise
    about which fields survive one. `apply_status_update` is a read-modify-write,
    so two `--update` calls that overlap keep only the later writer's copy — and
    CLAUDE.md tells callers to batch independent tool calls in parallel, so that
    is a real path rather than a thought experiment. Measured with this code
    (2026-08-07): two overlapping updates, and the first writer's transition was
    gone from the file.

    What a later `reconcile_state_with_disk` can put back is exactly what disk
    records independently:

      · `agents_success` — rebuilt from the report files every read. Converges.
      · `agents_fatal` — a fatal transition drops a `_fatal/<name>` sentinel, so
        BECOMING fatal converges. It did NOT until 2026-08-07: the bucket was
        only *filtered* from whatever the loaded state held, nothing on disk said
        "this was fatal", and a lost update therefore silently demoted a fatal
        back to pending with no way back — `/loop` then re-ran a checker already
        judged permanently failed. See `_record_fatal`, including the direction
        that still does not converge.
      · `agents_pending` — the remainder of the two, so it follows.
      · `agent_history`, `rate_limit_episodes`, `last_reset_hint_sec` — no
        convergence. A lost `last_reset_hint_sec` makes `/loop` retry before a
        rate limit clears; a lost history entry quietly shrinks the audit trail.
        Still accepted: these are bookkeeping, not the buckets the gate and
        `/loop` branch on.

    Locking is still not the answer here, for the same reason it was rejected the
    first time: `fcntl.flock` would put a blocking primitive in the path of every
    hook. Widening what disk records is the cheaper half of the same guarantee.
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


FATAL_SENTINEL_DIR = "_fatal"


def fatal_sentinel_path(session_dir, name):
    """Where `name`'s fatal sentinel lives, or None when `name` cannot name one.

    Keyed on the **manifest name**, not on the report's basename: the name is the
    key every bucket already uses, while `output_file` is caller-supplied and
    `report_paths` has had to defend against its shapes twice. A name that is not
    a plain path component (contains a separator, or is `.`/`..`) gets no
    sentinel at all rather than one written somewhere other than where it is
    looked for — a silent mismatch would be worse than the gap it closes.
    """
    if not name or name in (".", "..") or name != os.path.basename(name):
        return None
    return os.path.join(os.path.abspath(session_dir), FATAL_SENTINEL_DIR, name)


def fatal_on_disk(session_dir, names):
    """Which of `names` carry a fatal sentinel. Empty on any filesystem trouble."""
    out = []
    for name in names:
        path = fatal_sentinel_path(session_dir, name)
        if not path:
            continue
        try:
            if os.path.isfile(path):
                out.append(name)
        except OSError:
            continue
    return out


def _record_fatal(session_dir, name, is_fatal):
    """Create or clear `name`'s fatal sentinel — the disk half of `agents_fatal`.

    One file per agent, on purpose: a single shared `_fatal.json` list would be
    another read-modify-write and would inherit the very lost update this exists
    to survive. Per-agent files are lock-free by construction.

    Written **before** `save_state`, in both directions, so the durable record is
    the one the caller most recently asked for. If the JSON write is then lost to
    a concurrent writer, the sentinel still says fatal and the next reconcile
    restores it.

    Advisory: any `OSError` is swallowed. The JSON transition is still the
    primary record, so a read-only or full filesystem degrades to exactly the
    pre-2026-08-07 behaviour instead of failing the update.

    **The two directions are NOT symmetric, and the clear direction is still
    unprotected.** Becoming fatal leaves positive evidence, so a lost JSON write
    is recovered. Ceasing to be fatal leaves only the ABSENCE of the sentinel,
    and absence is not evidence — `reconcile_state_with_disk` unions JSON with
    the sentinels precisely so that sessions committed before this existed keep
    their fatals. So if a retry demotes an agent to `pending` and *that* write is
    the one lost, the stale JSON still lists it and the union revives it: the
    agent stays fatal until a real report happens to appear for it.

    That is not a regression — the JSON-only version behaved identically, since
    it read `agents_fatal` from the same stale state. It is the half this change
    did not close, pinned by
    `test_clearing_fatal_is_still_unprotected_against_a_lost_update` so the gap
    is a recorded fact rather than a surprise. Closing it needs positive evidence
    of clearing (a `_cleared/` marker, or comparing sentinel mtime against the
    state file), which is a design rather than a patch — registered in the plan.

    **Caller contract: updates for the SAME agent must not overlap.** This
    function clears from its own `status` alone; it cannot see a writer that just
    ran. So if one update establishes fatal for agent `x` while another update
    for `x` is between its `load_state` and here, the second clears the sentinel
    and then saves a snapshot that predates the fatal — erasing it from both
    records, unrecoverably. Also not a regression (JSON-only lost it the same
    way), and the documented flow does not produce it: one agent invocation
    yields one `--update`. Duplicated retries or a manual re-run racing `/loop`
    would. Pinned by `test_two_overlapping_updates_for_the_SAME_agent_lose_the_
    fatal`, and it belongs to the same design axis as the clear direction above:
    an mtime comparison would close both.
    """
    path = fatal_sentinel_path(session_dir, name)
    if not path:
        return
    try:
        if is_fatal:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(datetime.utcnow().isoformat() + "Z\n")
        elif os.path.exists(path):
            os.unlink(path)
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
    # Union of the two records, never just one: the loaded state can have lost a
    # fatal transition to a concurrent writer, and the sentinel can be absent for
    # a session that predates them or ran on a read-only filesystem. Taking
    # either as authoritative alone would drop fatals one of them still holds.
    fatal_recorded = set(state.get("agents_fatal", [])) | set(fatal_on_disk(sd, known))
    fatal = [n for n in missing if n in fatal_recorded]

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
    """Move an agent between pending/success/fatal buckets and record history.

    Read-modify-write, and deliberately still unlocked — see `save_state`. What
    makes that survivable for the buckets is that both `success` and `fatal` are
    also recorded on disk independently (a report file, a `_fatal/<name>`
    sentinel), so a reconcile can rebuild them after a lost update.
    """
    sd = os.path.abspath(session_dir)
    state_file, state = load_state(sd)
    # Before the save, so the sentinel is what survives if the JSON write is lost.
    _record_fatal(sd, agent, status == "fatal")
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
