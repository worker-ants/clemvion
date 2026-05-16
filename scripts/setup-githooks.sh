#!/usr/bin/env bash
# Point git at the checked-in hooks under .githooks/.
#
# Run once per clone. Re-running is safe (idempotent).
#
# Why this exists:
#   Git does not sync hooks across clones — `.git/hooks/` is per-checkout.
#   `core.hooksPath` lets us version the hooks alongside the code, so
#   every contributor gets the same pre-commit guard without manual
#   copying.

set -euo pipefail

repo_top=$(git rev-parse --show-toplevel)
target=".githooks"

if [ ! -d "$repo_top/$target" ]; then
    echo "Error: $repo_top/$target does not exist." >&2
    exit 1
fi

current=$(git -C "$repo_top" config --get core.hooksPath || true)
if [ "$current" = "$target" ]; then
    echo "core.hooksPath already set to '$target' — nothing to do."
    exit 0
fi

git -C "$repo_top" config core.hooksPath "$target"
echo "core.hooksPath set to '$target'."
echo "Verify: $(git -C "$repo_top" config --get core.hooksPath)"
