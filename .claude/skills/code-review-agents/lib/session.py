"""Session-level utilities: output directories, metadata, logging, truncation."""

import json
import os
from datetime import datetime


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
    """
    now = datetime.now()
    parts = [output_dir]
    if subdir:
        parts.append(subdir)
    parts.extend([
        f"{now.year:04d}",
        f"{now.month:02d}",
        f"{now.day:02d}",
        f"{now.hour:02d}_{now.minute:02d}_{now.second:02d}",
    ])
    session_dir = os.path.join(*parts)
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
