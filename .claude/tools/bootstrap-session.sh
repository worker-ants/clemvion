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
#
#    Two guards, because running several worktree sessions at once is this
#    repo's documented workflow (worktree-policy.md) and on a cold checkout they
#    all reach this branch at the same moment:
#
#    - A COMPLETION MARKER, rather than a bare `[ -d node_modules ]` test. An
#      install cut short — a crashed session, or two of them interleaving into
#      one tree — leaves a PARTIAL node_modules that the directory test then
#      accepts forever, so mermaid lint stays disabled with no signal at all.
#      The marker makes that self-healing: an unfinished tree simply reinstalls
#      next session. It lives INSIDE node_modules on purpose, so deleting the
#      tree deletes the marker with it. (One-off: an existing good install from
#      before this marker reinstalls once.)
#
#    - A `mkdir` LOCK — atomic and portable, unlike flock, which macOS lacks —
#      so two sessions never npm-install into the same tree concurrently. The
#      loser SKIPS instead of waiting: bootstrap must never block a session, and
#      the marker means the next session picks the work up anyway. A lock whose
#      holder died is stolen after 10 minutes, so the lock itself can never
#      wedge the install permanently — which is the failure mode a naive lock
#      would trade for the race it fixes.
tool_dir="$main_root/.claude/tools/mermaid-lint"
marker="$tool_dir/node_modules/.bootstrap-install-complete"
lock="$tool_dir/.install.lock"
if [ -f "$tool_dir/package.json" ] && [ ! -f "$marker" ] && command -v npm >/dev/null 2>&1; then
    # Steal a lock left behind by a session that died mid-install.
    if [ -d "$lock" ] && [ -z "$(find "$lock" -maxdepth 0 -mmin -10 2>/dev/null)" ]; then
        rmdir "$lock" 2>/dev/null || true
    fi
    if mkdir "$lock" 2>/dev/null; then
        echo "bootstrap: installing mermaid-lint deps (one-time)…"
        if (cd "$tool_dir" && npm install --no-fund --no-audit --silent); then
            : > "$marker" 2>/dev/null && echo "bootstrap: mermaid-lint ready"
        else
            echo "bootstrap: mermaid-lint install failed (lint will fail open)" >&2
        fi
        rmdir "$lock" 2>/dev/null || true
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
