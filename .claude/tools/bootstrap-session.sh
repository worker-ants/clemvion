#!/usr/bin/env bash
# SessionStart bootstrap — make the repo's git-side guards work without any
# manual per-clone setup. Wired into `.claude/settings.json` SessionStart.
#
# Idempotent and fast on repeat runs (it skips work already done), so it is
# safe to run on every session start. Always exits 0 — bootstrap must never
# block a session.
#
# Three responsibilities:
#   1. Point git at .githooks so the version-controlled pre-commit hooks
#      (branch guard + mermaid lint) actually run. This replaces the
#      easy-to-forget `scripts/setup-githooks.sh` step.
#   2. Install the mermaid-lint tooling deps once, in the MAIN checkout
#      (node_modules is gitignored, so worktrees share this single copy).
#   3. Garbage-collect stale guard state markers (>30 days) so .claude/state/
#      does not grow unbounded.

set -u

# Resolve the MAIN checkout (worktrees share one git common dir).
common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
main_root=$(dirname "$common")

# 1. Activate .githooks (only rewrite if it differs, to stay quiet).
if [ -d "$main_root/.githooks" ]; then
    current=$(git -C "$main_root" config --get core.hooksPath 2>/dev/null || true)
    if [ "$current" != ".githooks" ]; then
        git -C "$main_root" config core.hooksPath .githooks 2>/dev/null \
            && echo "bootstrap: core.hooksPath -> .githooks"
    fi
fi

# 2. Ensure mermaid-lint deps (install once; skip if already present).
tool_dir="$main_root/.claude/tools/mermaid-lint"
if [ -f "$tool_dir/package.json" ] && [ ! -d "$tool_dir/node_modules" ]; then
    if command -v npm >/dev/null 2>&1; then
        echo "bootstrap: installing mermaid-lint deps (one-time)…"
        (cd "$tool_dir" && npm install --no-fund --no-audit --silent) \
            && echo "bootstrap: mermaid-lint ready" \
            || echo "bootstrap: mermaid-lint install failed (lint will fail open)" >&2
    fi
fi

# 3. Garbage-collect stale guard state markers. These accumulate one file per
#    (session, branch) and are never read once their session/branch is gone, so
#    prune anything older than 30 days to keep the dirs from growing unbounded.
for state_dir in \
    "$main_root/.claude/state/review_stop_nudged" \
    "$main_root/.claude/state/main_worktree_bash_warned"; do
    if [ -d "$state_dir" ]; then
        find "$state_dir" -type f -mtime +30 -delete 2>/dev/null || true
    fi
done

# 4. Reap worktrees / local branches whose PR has merged (local-only, fail-safe,
#    self-throttled to once per few hours). Never blocks the session — the
#    reaper always exits 0 and skips the current/dirty worktree.
#
#    Hand it this session's ANCHOR worktree to keep. The reaper's own skip is
#    the shell cwd, which is NOT the same thing: settings.json runs every hook
#    as "$CLAUDE_PROJECT_DIR/.claude/hooks/…", so reaping the anchor leaves the
#    session with no loadable hooks — Bash/Write/Edit all fail and it cannot
#    recreate the directory. cwd == anchor normally, but they diverge after an
#    EnterWorktree, and then the cwd skip protects the wrong worktree.
#
#    The anchor is derived from BASH_SOURCE rather than $CLAUDE_PROJECT_DIR: the
#    harness interpolates that same absolute path to invoke this script, so
#    BASH_SOURCE[0] *is* the anchor and holds without depending on the variable
#    being exported into the hook env. `git rev-parse` can't be used — it is
#    cwd-based and would report the same wrong worktree.
anchor=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd -P) || anchor=""
reaper="$main_root/.claude/tools/reap-merged-worktrees.sh"
if [ -f "$reaper" ]; then
    bash "$reaper" ${anchor:+--keep "$anchor"} || true
fi

exit 0
