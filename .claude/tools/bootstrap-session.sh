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
#    Several worktree sessions at once is this repo's documented workflow
#    (worktree-policy.md), and on a cold checkout they all reach this branch at
#    the same moment. Four guards, each closing a distinct failure mode:
#
#    - A COMPLETION MARKER, rather than a bare `[ -d node_modules ]` test. An
#      install cut short — a crashed session, or two interleaving into one tree —
#      leaves a PARTIAL node_modules that the directory test then accepts
#      forever, so mermaid lint stays disabled with no signal at all. The marker
#      is the single "install finished" signal; the pre-commit and PostToolUse
#      lint guards read the SAME marker (via _lib/mermaid_lint_ready.py) so all
#      three agree. It lives INSIDE node_modules on purpose, so deleting the tree
#      deletes the marker with it. (One-off: a good install from before the
#      marker existed reinstalls once.)
#
#    - An OWNER-AWARE `mkdir` LOCK — atomic and portable, unlike flock, which
#      macOS lacks — so two sessions never npm-install into the same tree
#      concurrently. The loser SKIPS instead of waiting: bootstrap must never
#      block a session, and the marker means the next session picks the work up.
#
#    - LIVENESS, not elapsed time, decides a steal. The lock records its holder's
#      PID; a lock is stolen only when `kill -0` proves that PID is gone (plus a
#      grace age, so a PID freshly reused by an unrelated process is not trusted
#      on its own). An earlier version stole purely on a 10-minute age — which
#      re-created the very bug this fixes: a live-but-slow install (a throttled
#      sandbox network) that crosses 10 min had its lock stolen and a SECOND
#      npm install ran into the same tree. Release is owner-checked too: a
#      session only rmdir's a lock it still owns, so it can't delete a lock a
#      stealer already re-acquired.
#
#    - A FAILURE THROTTLE. Without the marker a persistently failing install
#      (network down, auth expired) would retry on EVERY SessionStart with no
#      backoff — the same unbounded-retry shape the reaper section already
#      solves with REAP_MIN_INTERVAL. A failure stamps a cooldown file; retries
#      inside MERMAID_INSTALL_RETRY_SEC (default 30 min) are skipped.
tool_dir="$main_root/.claude/tools/mermaid-lint"
marker="$tool_dir/node_modules/.bootstrap-install-complete"
lock="$tool_dir/.install.lock"
fail_marker="$main_root/.claude/state/mermaid_install_last_fail"
lock_grace="${MERMAID_INSTALL_LOCK_GRACE_SEC:-600}"     # min age before a dead-PID lock is stolen
retry_after="${MERMAID_INSTALL_RETRY_SEC:-1800}"        # cooldown after a failed install

_file_mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo 0; }

# True while a prior failure is still inside its cooldown window.
_install_throttled() {
    [ -f "$fail_marker" ] || return 1
    [ "$retry_after" -gt 0 ] 2>/dev/null || return 1
    [ $(( $(date +%s) - $(_file_mtime "$fail_marker") )) -lt "$retry_after" ]
}

# True when the existing lock may be stolen: it has aged past the grace window
# AND its recorded owner PID is no longer alive. The age gate comes first and
# matters on its own — a lock is only ever young for two reasons, and both must
# NOT be stolen: (a) a live holder just created it (owner PID alive anyway), or
# (b) a stealer just re-acquired it (its fresh mkdir reset the mtime). So a
# just-reacquired lock is always young and thus safe from a second stealer,
# which is what stops steals from cascading. Only past the grace age do we
# consult liveness: a labelled lock is stolen only if `kill -0` proves its PID
# gone; an unreadable/garbage owner falls back to age alone (better to reclaim
# an unlabelled stale lock eventually than wedge forever).
_lock_is_dead() {
    [ -d "$lock" ] || return 1
    [ -z "$(find "$lock" -maxdepth 0 -mmin "-$(( lock_grace / 60 ))" 2>/dev/null)" ] || return 1
    local owner; owner=$(cat "$lock/owner" 2>/dev/null || echo "")
    case "$owner" in
        ''|*[!0-9]*) return 0 ;;                        # unlabelled/garbage → age alone decides
        *) ! kill -0 "$owner" 2>/dev/null ;;            # labelled → steal only if PID is gone
    esac
}

if [ -f "$tool_dir/package.json" ] && [ ! -f "$marker" ] \
   && ! _install_throttled && command -v npm >/dev/null 2>&1; then
    # `rm -rf`, not rmdir: the lock dir holds an `owner` file, and a genuinely
    # dead+aged lock cannot also be a fresh re-acquisition (that would be young),
    # so removing it here cannot clobber a live holder.
    _lock_is_dead && rm -rf "$lock" 2>/dev/null
    if mkdir "$lock" 2>/dev/null; then
        echo "$$" > "$lock/owner" 2>/dev/null || true
        echo "bootstrap: installing mermaid-lint deps (one-time)…"
        if (cd "$tool_dir" && npm install --no-fund --no-audit --silent); then
            : > "$marker" 2>/dev/null && echo "bootstrap: mermaid-lint ready"
            rm -f "$fail_marker" 2>/dev/null || true
        else
            echo "bootstrap: mermaid-lint install failed (lint fails open; will retry after cooldown)" >&2
            mkdir -p "$(dirname "$fail_marker")" 2>/dev/null && : > "$fail_marker" 2>/dev/null || true
        fi
        # Owner-checked release: only remove the lock if we STILL own it. We are
        # alive here, so a stealer could not have taken it (its kill -0 on us
        # would succeed) — the check defends against the unlabelled-owner steal
        # path, where age alone could have handed the lock to someone else.
        [ "$(cat "$lock/owner" 2>/dev/null || echo)" = "$$" ] && rm -rf "$lock" 2>/dev/null
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
