"""Session-level utilities: output directories, metadata, logging, truncation.

Every orchestrator under `.claude/skills/*/scripts/` imports this as
`from _shared import session`. Standard library only, no relative imports:
tests load this file by path (`spec_from_file_location`), and a relative import
would fail there with an error that does not point here.
"""

import json
import os
import re
from datetime import datetime

# How many `<hh>_<mm>_<ss>[_N]` names to try before giving up and reusing the
# plain one. Bounded so a pathological directory cannot spin: a burst of
# parallel sessions needs a handful of names, so the real ceiling is far below
# this. (Batch splitting used to be the other producer of same-second names; it
# was removed on 2026-08-10 — see `code_review_orchestrator._warn_large_changeset`.
# Collisions between concurrent sessions remain, which is why this still exists.)
_MAX_SESSION_NAME_ATTEMPTS = 50

# The last component `create_session_dir` makes: `<hh>_<mm>_<ss>`, then `_2`, `_3`, … from the
# second session in the same second. `parse_session_dir` reads it; keep the two together.
_SESSION_NAME_RE = re.compile(r"(\d{2})_(\d{2})_(\d{2})(?:_([1-9]\d*))?")
_YEAR_RE = re.compile(r"\d{4}")
_TWO_DIGITS_RE = re.compile(r"\d{2}")


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
    """Create `output_dir/[<subdir>/]<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>[_<n>]/` and return the path.

    The nested layout (year/month/day/HH_MM_SS) keeps any single directory
    bounded in size — flat timestamp directories had become impractical to
    list (`ls`) as review history accumulated. The old committed
    `review/<timestamp>/` tree left the repository in NERV cutover stage 3 (NERV
    Task `CLE-T-FN2JWK`); this function governs local `.review/` sessions.
    Every orchestrator names its session here; one that made its own name would
    lose the `_N` suffix below (`test_review_session_dir_collision.py` checks the
    orchestrator sources). The stamp is local time (`datetime.now()`).

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
    processes cannot both believe they won. The guards walk the tree looking for
    `SUMMARY.md` and do not read the name. The one reader is `parse_session_dir`
    below; `.claude/tools/nerv_review_payload.py` `session_stamp()` turns its
    parts into the idempotency-key prefix and keeps the suffix (`13_40_14_2` →
    `…-134014-2`). Change the name shape in both functions of this module.

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


def parse_session_dir(session_dir):
    """Read the path `create_session_dir` made: `…/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>[_<n>]`.

    Returns `(year, month, day, hh, mm, ss, n)` as the strings in the path (leading zeros kept),
    with `n` None for the plain name. Returns None when the last four components do not have that
    shape. Only those four are read; what sits above them (`.review/<kind>/[<subdir>/]`) is the
    caller's business.
    """
    parts = os.path.normpath(os.path.abspath(session_dir)).split(os.sep)[-4:]
    if len(parts) != 4:
        return None
    year, month, day, name = parts
    if not (_YEAR_RE.fullmatch(year) and _TWO_DIGITS_RE.fullmatch(month) and _TWO_DIGITS_RE.fullmatch(day)):
        return None
    m = _SESSION_NAME_RE.fullmatch(name)
    if m is None:
        return None
    return (year, month, day, *m.groups())


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
