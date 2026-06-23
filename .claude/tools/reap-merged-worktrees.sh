#!/usr/bin/env bash
# Reap git worktrees + local branches whose PR has already merged.
#
# LOCAL-ONLY by design: this never touches remote refs — GitHub deletes the PR
# head branch on merge, so cleanup here is purely about the local checkout. It
# is conservative (acts only on a strong merge signal), skips the worktree the
# current shell is in and any worktree with uncommitted work, and FAILS SAFE
# (leaves things in place) whenever it cannot prove a merge.
#
# Invoked from bootstrap-session.sh (SessionStart) and runnable by hand:
#   .claude/tools/reap-merged-worktrees.sh [--dry-run] [--force]
#
# Detection (per worktree under .claude/worktrees/<name>/ on a claude/* branch):
#   - skip if it is the worktree the current shell is in,
#   - skip if it has uncommitted changes (dirty) — preserve in-flight work,
#   - remove (worktree + local branch) IFF `gh pr view <branch>` reports MERGED.
#     Removal uses cleanup-worktree.sh --force: a squash-merged branch is NOT an
#     ancestor of the default branch, so `git branch -d` would refuse it; gh's
#     MERGED verdict authorises the -D (the work is on the default branch as the
#     squash commit), and dirty work was already filtered out above.
# Dangling local claude/* branch (no worktree):
#   - `git branch -d` first (succeeds only for ancestor-merged; git refuses
#     otherwise — a built-in safety net),
#   - if -d refuses AND gh says MERGED → `git branch -D`.
#
# Fail-safe: with gh missing / unauthenticated / erroring, worktree removal is
# skipped entirely (ancestor-merged dangling branches are still pruned via the
# git-enforced `-d`). A merge that cannot be proven is left alone; the manual
# `cleanup-worktree.sh <name>` covers those.
#
# Throttle: to bound the per-session-start `gh` cost, a real run is rate-limited
# to once per REAP_MIN_INTERVAL seconds (marker: .claude/state/reap_last_run).
# --force bypasses the throttle; --dry-run ignores it (read-only).
#
# Env:
#   REAP_GH_BIN        gh binary (default: gh). Test/CI seam.
#   REAP_MIN_INTERVAL  throttle window in seconds (default: 21600 = 6h; 0 = off).
#   REAP_DRY_RUN=1     same as --dry-run.
#
# Always exits 0 — a SessionStart helper must never block a session.

set -u

GH="${REAP_GH_BIN:-gh}"
MIN_INTERVAL="${REAP_MIN_INTERVAL:-21600}"
# A non-integer override must not leak into the arithmetic below — fall back to
# the default rather than silently disabling the throttle on a bad value.
case "$MIN_INTERVAL" in ''|*[!0-9]*) MIN_INTERVAL=21600 ;; esac
DRY_RUN=0
FORCE=0
[ "${REAP_DRY_RUN:-0}" = "1" ] && DRY_RUN=1

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run|-n) DRY_RUN=1 ;;
    --force|-f)   FORCE=1 ;;
    -h|--help)
      sed -n '2,/^set -u/p' "$0" | sed -e '/^set -u/d' -e 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "reap-merged-worktrees.sh: unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

# --- locate the main checkout (worktrees share one git common dir) -----------
common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
# Resolve to PHYSICAL paths (pwd -P) so a /var ↔ /private/var symlink mismatch
# between `git worktree list` output and the session cwd can never defeat the
# current-worktree skip below. That skip is the PRIMARY guard against deleting
# the worktree we are running in — cleanup-worktree.sh's own "current shell"
# check is bypassed by the `cd "$main_root"` here, so this must hold on its own.
realpath_p() { (cd "$1" 2>/dev/null && pwd -P) || printf '%s' "$1"; }
main_root=$(realpath_p "$(dirname "$common")")
current_top=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
[ -n "$current_top" ] && current_top=$(realpath_p "$current_top")
# Operate from the main checkout so worktree/branch ops resolve consistently.
cd "$main_root" 2>/dev/null || exit 0

cleanup="$main_root/.claude/tools/cleanup-worktree.sh"

# --- throttle ----------------------------------------------------------------
marker="$main_root/.claude/state/reap_last_run"
file_mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo 0; }
now_epoch()  { date +%s; }

if [ "$DRY_RUN" -eq 0 ] && [ "$FORCE" -eq 0 ] && [ "$MIN_INTERVAL" -gt 0 ] 2>/dev/null \
   && [ -f "$marker" ]; then
  last=$(file_mtime "$marker")
  if [ $(( $(now_epoch) - last )) -lt "$MIN_INTERVAL" ]; then
    exit 0  # ran recently — stay quiet.
  fi
fi

# --- helpers -----------------------------------------------------------------
gh_state() {
  # MERGED / OPEN / CLOSED for a branch's PR, or "" when gh can't answer.
  local branch="$1"
  command -v "$GH" >/dev/null 2>&1 || { echo ""; return; }
  "$GH" pr view "$branch" --json state --jq .state 2>/dev/null || echo ""
}

default_ref=""
if d=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null); then
  default_ref="$d"                       # e.g. origin/main
else
  for n in main master; do
    if git rev-parse --verify "refs/heads/$n" >/dev/null 2>&1; then
      default_ref="$n"; break
    fi
  done
fi

is_ancestor() {
  # True when <branch> is an ancestor of the default ref (a plain merge or a
  # rebase/ff — deletable via `git branch -d`). False for squash merges.
  [ -n "$default_ref" ] || return 1
  git merge-base --is-ancestor "$1" "$default_ref" 2>/dev/null
}

# --- enumerate worktrees -----------------------------------------------------
# Emit one "path<TAB>branch" record per worktree from `git worktree list
# --porcelain`. Parsed with parameter expansion (not awk $2) so a path with
# spaces is not truncated. Defined as a FUNCTION — a `case` whose patterns end
# in `)` misparses inside `$( … )` on bash 3.2 (macOS default), but a function
# body is parsed at definition time, sidestepping that bug.
_parse_worktrees() {
  wt=""; br=""
  while IFS= read -r line; do
    case "$line" in
      "worktree "*) wt=${line#worktree }; br="" ;;
      "branch "*)   br=${line#branch refs/heads/} ;;
      "")           [ -n "${wt:-}" ] && printf '%s\t%s\n' "$wt" "${br:-}"; wt=""; br="" ;;
    esac
  done
  [ -n "${wt:-}" ] && printf '%s\t%s\n' "$wt" "${br:-}"
}

# Map worktree path -> branch (newline records, "path<TAB>branch").
wt_records=$(git worktree list --porcelain | _parse_worktrees)

# Branch names that are checked out in *some* worktree (so NOT dangling).
checked_out_branches=$(printf '%s\n' "$wt_records" | awk -F'\t' '$2!=""{print $2}')

removed_wt=0
removed_br=0
skipped=0

action() {  # action "<message>" — printed for both real and dry-run.
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "reap[dry-run]: $1"
  else
    echo "reap: $1"
  fi
}

# --- pass 1: worktrees whose PR merged -------------------------------------
while IFS=$'\t' read -r wt_path wt_branch; do
  [ -n "$wt_path" ] || continue
  # Normalise to the physical path so the current-worktree skip and the
  # prefix match below compare like-for-like (see realpath_p rationale above).
  wt_path=$(realpath_p "$wt_path")
  case "$wt_path" in
    "$main_root"/.claude/worktrees/*) : ;;   # only manage our own worktrees
    *) continue ;;
  esac
  case "$wt_branch" in
    claude/*) : ;;                            # only claude/* branches
    *) continue ;;
  esac
  # Never touch the worktree the current shell is in (primary safety guard).
  if [ -n "$current_top" ] && [ "$wt_path" = "$current_top" ]; then
    continue
  fi
  # Preserve in-flight work.
  if [ -n "$(git -C "$wt_path" status --porcelain 2>/dev/null)" ]; then
    skipped=$((skipped + 1))
    continue
  fi
  state=$(gh_state "$wt_branch")
  if [ "$state" != "MERGED" ]; then
    continue   # fail-safe: only act on a proven merge.
  fi
  name=$(basename "$wt_path")
  if [ "$DRY_RUN" -eq 1 ]; then
    action "WOULD remove worktree $name + branch $wt_branch (PR MERGED)"
    removed_wt=$((removed_wt + 1))
    continue
  fi
  if bash "$cleanup" "$name" --force >/dev/null 2>&1; then
    action "removed worktree $name + branch $wt_branch (PR MERGED)"
    removed_wt=$((removed_wt + 1))
  else
    action "FAILED to remove worktree $name (left in place)"
  fi
done <<EOF
$wt_records
EOF

# --- pass 2: dangling local claude/* branches ------------------------------
while IFS= read -r branch; do
  [ -n "$branch" ] || continue
  # Skip branches still checked out in a worktree.
  if printf '%s\n' "$checked_out_branches" | grep -qxF "$branch"; then
    continue
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    if is_ancestor "$branch"; then
      action "WOULD delete dangling branch $branch (merged ancestor)"
      removed_br=$((removed_br + 1))
    elif [ "$(gh_state "$branch")" = "MERGED" ]; then
      action "WOULD delete dangling branch $branch (PR MERGED, squash)"
      removed_br=$((removed_br + 1))
    fi
    continue
  fi
  # Real run: try the safe `-d` first; escalate to `-D` only on a gh MERGED.
  # `--` guards against a branch name that begins with `-` being read as a flag.
  if git branch -d -- "$branch" >/dev/null 2>&1; then
    action "deleted dangling branch $branch (merged ancestor)"
    removed_br=$((removed_br + 1))
  elif [ "$(gh_state "$branch")" = "MERGED" ]; then
    if git branch -D -- "$branch" >/dev/null 2>&1; then
      action "deleted dangling branch $branch (PR MERGED, squash)"
      removed_br=$((removed_br + 1))
    fi
  fi
done <<EOF
$(git for-each-ref --format='%(refname:short)' refs/heads/claude/ 2>/dev/null)
EOF

# --- finish ------------------------------------------------------------------
if [ "$DRY_RUN" -eq 0 ]; then
  mkdir -p "$(dirname "$marker")" 2>/dev/null && : > "$marker"
  git worktree prune 2>/dev/null || true
fi

if [ "$removed_wt" -gt 0 ] || [ "$removed_br" -gt 0 ] || [ "$DRY_RUN" -eq 1 ]; then
  action "summary — worktrees=${removed_wt} branches=${removed_br} skipped(dirty/current)=${skipped}"
fi

exit 0
