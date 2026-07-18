#!/usr/bin/env bash
# SessionStart bootstrap — make the repo's git-side guards work without any
# manual per-clone setup. Wired into `.claude/settings.json` SessionStart.
#
# Idempotent and fast on repeat runs (it skips work already done), so it is
# safe to run on every session start. Always exits 0 — bootstrap must never
# block a session.
#
# Four responsibilities:
#   1. Point git at .githooks so the version-controlled pre-commit hooks
#      (branch guard + mermaid lint) actually run. This replaces the
#      easy-to-forget `scripts/setup-githooks.sh` step.
#   2. Install the mermaid-lint tooling deps once, in the MAIN checkout
#      (node_modules is gitignored, so worktrees share this single copy).
#   3. Garbage-collect stale guard state markers (>30 days) so .claude/state/
#      does not grow unbounded.
#   4. Reap worktrees / local branches whose PR has merged (see section 4).

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
#    Two guards. NOT a mutual-exclusion lock — see the design note below.
#
#    - A COMPLETION MARKER, rather than a bare `[ -d node_modules ]` test. An
#      install cut short — a crashed session, or two interleaving into one tree —
#      leaves a PARTIAL node_modules that the directory test then accepts
#      forever, so mermaid lint stays disabled with no signal at all. The marker
#      is the single "install finished" signal, written only after npm exits 0;
#      the pre-commit and PostToolUse lint guards read the SAME marker (via
#      _lib/mermaid_lint_ready.py) so all three agree on "installed". It lives
#      INSIDE node_modules on purpose, so deleting the tree deletes the marker
#      with it — `rm -rf node_modules` is the recovery for a bad tree, and it
#      re-arms the install. (One-off: a good install from before the marker
#      existed reinstalls once.)
#
#    - A FAILURE THROTTLE. Without it a persistently failing install (network
#      down, auth expired) would retry on EVERY SessionStart with no backoff —
#      the same unbounded-retry shape the reaper section already solves with
#      REAP_MIN_INTERVAL. A failure stamps a cooldown file; retries inside
#      MERMAID_INSTALL_RETRY_SEC (default 30 min) are skipped.
#
#    NO LOCK, deliberately. Earlier revisions here hand-rolled a `mkdir` lock
#    with an owner PID + grace age + stale-lock steal. Its reclaim path was a
#    check-then-act TOCTOU: two sessions observing the same dead lock both
#    `rm -rf` + `mkdir`, and the loser deletes the winner's fresh lock, so both
#    install concurrently — the very race the lock was meant to stop
#    (reproduced, review/code/2026/07/18/02_06_42 C1). The correct primitive is
#    OS advisory locking (fcntl.flock, auto-released on death), not a filesystem
#    lock reinvented in bash. We chose to DROP the lock rather than reintroduce
#    that complexity: the marker already delivers the actual goal (a partial or
#    failed install never counts as done, and self-heals next session). Residual,
#    accepted: several sessions hitting the *first* cold install within the same
#    instant can still npm-install concurrently; npm is not concurrency-safe into
#    one dir, so that narrow window can produce a bad tree. Worst case is a
#    corrupt-but-marked node_modules needing a manual `rm -rf node_modules`
#    (which re-arms the install). This is a rare first-install-only window on a
#    dev-tooling linter, judged not worth a hand-rolled lock whose safety keeps
#    being wrong. A real fix, if ever needed, is fcntl.flock — see plan §G.
tool_dir="$main_root/.claude/tools/mermaid-lint"
marker="$tool_dir/node_modules/.bootstrap-install-complete"
fail_marker="$main_root/.claude/state/mermaid_install_last_fail"
retry_after="${MERMAID_INSTALL_RETRY_SEC:-1800}"        # cooldown after a failed install

_file_mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo 0; }

# True while a prior failure is still inside its cooldown window.
_install_throttled() {
    [ -f "$fail_marker" ] || return 1
    [ "$retry_after" -gt 0 ] 2>/dev/null || return 1
    [ $(( $(date +%s) - $(_file_mtime "$fail_marker") )) -lt "$retry_after" ]
}

if [ -f "$tool_dir/package.json" ] && [ ! -f "$marker" ] \
   && ! _install_throttled && command -v npm >/dev/null 2>&1; then
    echo "bootstrap: installing mermaid-lint deps (one-time)…"
    if (cd "$tool_dir" && npm install --no-fund --no-audit --silent); then
        : > "$marker" 2>/dev/null && echo "bootstrap: mermaid-lint ready"
        rm -f "$fail_marker" 2>/dev/null || true
    else
        echo "bootstrap: mermaid-lint install failed (lint fails open; will retry after cooldown)" >&2
        mkdir -p "$(dirname "$fail_marker")" 2>/dev/null && : > "$fail_marker" 2>/dev/null || true
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
