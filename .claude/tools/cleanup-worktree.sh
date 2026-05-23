#!/usr/bin/env bash
# Usage:
#   .claude/tools/cleanup_worktree.sh <name> [--force]
#
# Companion to ensure-worktree.sh: removes a git worktree under
# .claude/worktrees/<name>/ AND deletes the branch that was checked out
# in it.
#
# Arguments:
#   <name>      Worktree directory name or path. Accepted forms:
#                 - bare:     "auth-refactor-c41f58"
#                 - relative: ".claude/worktrees/auth-refactor-c41f58"
#                 - absolute: "/abs/.../.claude/worktrees/auth-refactor-c41f58"
#   --force,-f  Forward --force to `git worktree remove` (allow uncommitted
#               changes) and use `git branch -D` for unmerged branches.
#
# Effects:
#   1. Resolves the branch checked out in the target worktree.
#   2. Refuses to act if the current shell is inside that worktree.
#   3. `git worktree remove [--force] <path>`.
#   4. `git branch -d|-D <branch>` (skipped for detached HEAD).
#   5. `git worktree prune` to clean stale metadata.
#
# Exit codes:
#   0  success
#   2  bad arguments / target not found / safety refusal
#   other  underlying git command failure

set -euo pipefail

NAME=""
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force|-f)
      FORCE=1
      shift
      ;;
    -h|--help)
      sed -n '2,/^set -euo/p' "$0" | sed -e '/^set -euo/d' -e 's/^#\{1,2\} \{0,1\}//'
      exit 0
      ;;
    -*)
      echo "cleanup_worktree.sh: unknown option: $1" >&2
      exit 2
      ;;
    *)
      if [[ -n "$NAME" ]]; then
        echo "cleanup_worktree.sh: unexpected extra argument: $1" >&2
        exit 2
      fi
      NAME="$1"
      shift
      ;;
  esac
done

if [[ -z "$NAME" ]]; then
  cat >&2 <<'USAGE_EOF'
cleanup_worktree.sh — <name> argument is required.

Usage:
  .claude/tools/cleanup_worktree.sh <name> [--force]

Examples:
  .claude/tools/cleanup_worktree.sh auth-refactor-c41f58
  .claude/tools/cleanup_worktree.sh .claude/worktrees/auth-refactor-c41f58 --force

Run `git worktree list` to see existing worktrees.
USAGE_EOF
  exit 2
fi

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "cleanup_worktree.sh: not inside a git repository" >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"

# Normalize NAME -> absolute worktree path.
case "$NAME" in
  /*)
    WT_PATH="$NAME"
    ;;
  .claude/worktrees/*|./.claude/worktrees/*)
    WT_PATH="$REPO_ROOT/${NAME#./}"
    ;;
  *)
    WT_PATH="$REPO_ROOT/.claude/worktrees/$NAME"
    ;;
esac
WT_PATH="${WT_PATH%/}"

# Look up the target block in `git worktree list --porcelain`.
WT_LIST="$(git -C "$REPO_ROOT" worktree list --porcelain)"

if ! printf '%s\n' "$WT_LIST" | grep -qx "worktree $WT_PATH"; then
  echo "cleanup_worktree.sh: no worktree registered at $WT_PATH" >&2
  echo "" >&2
  echo "Existing worktrees:" >&2
  git -C "$REPO_ROOT" worktree list >&2
  exit 2
fi

# Extract branch name from the matched block (empty if detached HEAD).
BRANCH="$(printf '%s\n' "$WT_LIST" | awk -v t="$WT_PATH" '
  $1 == "worktree" { in_block = ($2 == t) ? 1 : 0; next }
  in_block && $1 == "branch" {
    sub(/^refs\/heads\//, "", $2)
    print $2
    exit
  }
')"

# Refuse to delete the worktree the current shell is inside.
CUR_TOPLEVEL="$(git rev-parse --show-toplevel)"
if [[ "$CUR_TOPLEVEL" == "$WT_PATH" ]]; then
  echo "cleanup_worktree.sh: refusing to delete the worktree the current shell is inside" >&2
  echo "  cd to $REPO_ROOT (main worktree) and re-run." >&2
  exit 2
fi

echo "Target worktree: $WT_PATH"
echo "Target branch:   ${BRANCH:-<detached HEAD>}"
echo ""

if [[ $FORCE -eq 1 ]]; then
  git -C "$REPO_ROOT" worktree remove --force "$WT_PATH"
else
  git -C "$REPO_ROOT" worktree remove "$WT_PATH"
fi
echo "Removed worktree:  $WT_PATH"

if [[ -n "$BRANCH" ]]; then
  if [[ $FORCE -eq 1 ]]; then
    git -C "$REPO_ROOT" branch -D "$BRANCH"
  else
    git -C "$REPO_ROOT" branch -d "$BRANCH"
  fi
  echo "Deleted branch:    $BRANCH"
else
  echo "No branch to delete (detached HEAD worktree)."
fi

git -C "$REPO_ROOT" worktree prune
echo "Pruned stale worktree metadata."
