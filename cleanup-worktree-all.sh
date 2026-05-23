#!/usr/bin/env bash
# Usage:
#   ./cleanup-worktree-all.sh [--force] [--yes]
#
# Bulk wrapper for .claude/tools/cleanup-worktree.sh — iterates over every
# git worktree registered under .claude/worktrees/ and deletes it along
# with its corresponding branch.
#
# Flags:
#   --force,-f  Pass --force to cleanup-worktree.sh (uncommitted changes
#               in the worktree and unmerged branches are allowed).
#   --yes,-y    Skip the interactive confirmation prompt. Required when
#               running non-interactively (stdin not a TTY).
#
# Safety:
#   - The main worktree is never a target — only entries under
#     <repo_root>/.claude/worktrees/ are touched.
#   - Refuses to run if the current shell is inside one of the targets
#     (you would end up standing in a deleted directory).
#   - Shows the full target list and prompts for confirmation unless
#     --yes is supplied.
#   - Per-worktree failures are reported but do not abort the loop, so
#     one bad worktree doesn't strand the rest.
#
# Exit codes:
#   0  all targets deleted (or nothing to do)
#   1  one or more per-worktree deletions failed (or user aborted)
#   2  bad arguments / safety refusal / cleanup-worktree.sh missing

set -euo pipefail

FORCE=0
ASSUME_YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force|-f)
      FORCE=1
      shift
      ;;
    --yes|-y)
      ASSUME_YES=1
      shift
      ;;
    -h|--help)
      sed -n '2,/^set -euo/p' "$0" | sed -e '/^set -euo/d' -e 's/^#\{1,2\} \{0,1\}//'
      exit 0
      ;;
    *)
      echo "cleanup-worktree-all.sh: unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "cleanup-worktree-all.sh: not inside a git repository" >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
CLEANUP="$REPO_ROOT/.claude/tools/cleanup-worktree.sh"

if [[ ! -x "$CLEANUP" ]]; then
  echo "cleanup-worktree-all.sh: $CLEANUP not found or not executable" >&2
  exit 2
fi

# Collect target worktree paths: every `git worktree list` entry that
# lives under <repo_root>/.claude/worktrees/.
WT_PREFIX="$REPO_ROOT/.claude/worktrees/"
TARGETS=()
while IFS= read -r line; do
  if [[ "$line" == "worktree "* ]]; then
    p="${line#worktree }"
    case "$p" in
      "$WT_PREFIX"*) TARGETS+=("$p") ;;
    esac
  fi
done < <(git -C "$REPO_ROOT" worktree list --porcelain)

if [[ ${#TARGETS[@]} -eq 0 ]]; then
  echo "No worktrees found under $WT_PREFIX — nothing to do."
  exit 0
fi

# Refuse if CWD is inside any target.
CUR_TOPLEVEL="$(git rev-parse --show-toplevel)"
for t in "${TARGETS[@]}"; do
  if [[ "$CUR_TOPLEVEL" == "$t" ]]; then
    echo "cleanup-worktree-all.sh: refusing to run — current shell is inside target worktree:" >&2
    echo "  $t" >&2
    echo "  cd to $REPO_ROOT (main worktree) and re-run." >&2
    exit 2
  fi
done

echo "About to delete the following worktrees and their branches:"
echo ""
for t in "${TARGETS[@]}"; do
  echo "  $t"
done
echo ""
echo "Total: ${#TARGETS[@]} worktree(s)"
if [[ $FORCE -eq 1 ]]; then
  echo "Mode:  --force (uncommitted changes and unmerged branches allowed)"
else
  echo "Mode:  safe (worktrees with uncommitted changes / unmerged branches will be skipped as failures)"
fi
echo ""

if [[ $ASSUME_YES -ne 1 ]]; then
  if [[ ! -t 0 ]]; then
    echo "cleanup-worktree-all.sh: stdin is not a TTY — re-run with --yes to confirm non-interactively." >&2
    exit 2
  fi
  printf "Proceed? [y/N] "
  read -r ans
  case "$ans" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

# Drive cleanup-worktree.sh per target. Continue on individual failures.
FAIL=0
for t in "${TARGETS[@]}"; do
  echo ""
  echo "=== $t ==="
  if [[ $FORCE -eq 1 ]]; then
    if ! "$CLEANUP" "$t" --force; then
      echo "FAILED: $t" >&2
      FAIL=$((FAIL + 1))
    fi
  else
    if ! "$CLEANUP" "$t"; then
      echo "FAILED: $t" >&2
      FAIL=$((FAIL + 1))
    fi
  fi
done

echo ""
echo "Done. Failures: $FAIL / ${#TARGETS[@]}"
if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
