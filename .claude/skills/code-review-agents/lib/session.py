"""Session-level utilities: output directories, metadata, logging, truncation."""

import json
import os
from datetime import datetime

# How many `<hh>_<mm>_<ss>[_N]` names to try before giving up and reusing the
# plain one. Bounded so a pathological directory cannot spin: a burst of
# parallel sessions needs a handful of names, so the real ceiling is far below
# this. (Batch splitting used to be the other producer of same-second names; it
# was removed on 2026-08-10 — see `code_review_orchestrator._warn_large_changeset`.
# Collisions between concurrent sessions remain, which is why this still exists.)
_MAX_SESSION_NAME_ATTEMPTS = 50


def make_debug_logger(log_file_path):
    """Return a function that appends timestamped messages to log_file_path.

    Failures during logging are silently ignored — logging must never crash the orchestrator.
    """
    def _log(message):
        try:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
            with open(log_file_path, "a") as f:
                f.write(f"[{timestamp}] {message}\n")
        except Exception:
            pass
    return _log


def create_session_dir(output_dir, subdir=None):
    """Create `output_dir/[<subdir>/]<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` and return the path.

    The nested layout (year/month/day/HH_MM_SS) keeps any single directory
    bounded in size — flat timestamp directories had become impractical to
    list (`ls`) as review history accumulated. Existing review/<timestamp>/
    directories are migrated separately by the operator; this function only
    governs newly created sessions.

    **The name is second-resolution, so two sessions in the same second collide.**
    That is not hypothetical. The shape it was first measured on no longer
    occurs — `--prepare` on a 74-file changeset used to split it into two
    batches and prepare both back to back, and batch splitting was removed on
    2026-08-10 — but the collision it exposed is a property of the *name*, not
    of batching, and two parallel Claude sessions still hit it. The historical
    measurement is kept because it is what made the failure legible:
    with `exist_ok=True` the second batch silently overwrote the first's
    `meta.json` and prompts.
    Measured 2026-08-09: stdout printed the same path twice, exactly ONE new
    directory existed, and its `meta.json` listed 24 files — batch 2's size.
    Batch 1's 50 files left no trace on disk, which is why the symptom read as
    "sibling files from one commit are only partly reviewed". Two parallel Claude
    sessions collide the same way.

    So the create is ATOMIC (`exist_ok=False`) and a taken name falls through to
    `<hh>_<mm>_<ss>_2`, `_3`, …. Atomic matters for the parallel case: two
    processes cannot both believe they won. Nothing parses this directory name —
    the guards walk the tree looking for `SUMMARY.md` — so the suffix is free.

    On exhaustion it returns the plain path with `exist_ok=True`, i.e. the old
    behaviour. Losing a session directory is bad; refusing to run a review at all
    is worse.
    """
    now = datetime.now()
    parts = [output_dir]
    if subdir:
        parts.append(subdir)
    parts.extend([
        f"{now.year:04d}",
        f"{now.month:02d}",
        f"{now.day:02d}",
    ])
    day_dir = os.path.join(*parts)
    stamp = f"{now.hour:02d}_{now.minute:02d}_{now.second:02d}"

    for attempt in range(1, _MAX_SESSION_NAME_ATTEMPTS + 1):
        name = stamp if attempt == 1 else f"{stamp}_{attempt}"
        session_dir = os.path.join(day_dir, name)
        try:
            os.makedirs(session_dir, exist_ok=False)
            return session_dir
        except FileExistsError:
            continue
        except OSError:
            break

    session_dir = os.path.join(day_dir, stamp)
    os.makedirs(session_dir, exist_ok=True)
    return session_dir


def save_metadata(session_dir, meta):
    """Write a JSON metadata dict to `<session_dir>/meta.json` (UTF-8, pretty-printed)."""
    meta_file = os.path.join(session_dir, "meta.json")
    try:
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
    except Exception:
        # Metadata is informational; failure to write must not abort the session.
        pass


def truncate_to_budget(text, budget, suffix="\n\n... (truncated due to size limit) ..."):
    """Truncate `text` so the result fits within `budget` characters.

    A budget of 0 or negative means unlimited.
    """
    if budget <= 0 or len(text) <= budget:
        return text
    keep = max(budget - len(suffix), 0)
    return text[:keep] + suffix
