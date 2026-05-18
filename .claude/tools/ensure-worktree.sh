#!/usr/bin/env bash
# Usage:
#   .claude/tools/ensure-worktree.sh <task_name> [slug]
#
# Creates a new git worktree under .claude/worktrees/<task_name>-<slug>/
# on a fresh branch claude/<task_name>-<slug>, branched from origin's
# default branch when available (falls back to current HEAD).
#
# Effects:
#   - If the current shell is already inside .claude/worktrees/<...>/,
#     prints a notice and exits 0 without creating anything.
#   - Otherwise creates the worktree and prints the `cd` command on
#     the last line of stdout so the caller can copy-paste it.
#
# The script CANNOT change the caller's CWD (subprocess limitation).
# The caller must run the printed `cd` command to enter the worktree.
#
# This script is the canonical entry point for the worktree setup step
# referenced by .claude/hooks/guard_default_branch_*.py and CLAUDE.md.

set -euo pipefail

TASK="${1:-}"
SLUG="${2:-}"

if [[ -z "$TASK" ]]; then
  cat >&2 <<'EOF'
ensure-worktree.sh — task_name argument is required.

Usage:
  .claude/tools/ensure-worktree.sh <task_name> [slug]

Examples:
  .claude/tools/ensure-worktree.sh auth-refactor
  .claude/tools/ensure-worktree.sh webhook-spec-draft c41f58

If [slug] is omitted, a random 6-hex-char slug is generated.
EOF
  exit 2
fi

# task_name must be kebab-case-ish; reject obvious garbage.
if ! [[ "$TASK" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "ensure-worktree.sh: task_name must match ^[a-z0-9][a-z0-9-]*$ (kebab-case)" >&2
  exit 2
fi

# Are we already inside a worktree under .claude/worktrees/?
case "$PWD" in
  */.claude/worktrees/*)
    echo "Already inside a worktree: $PWD"
    echo "No new worktree created."
    exit 0
    ;;
esac

# Must be inside a git repo to add a worktree.
if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "ensure-worktree.sh: not inside a git repository" >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Generate slug if not supplied. Prefer openssl; fall back to /dev/urandom.
if [[ -z "$SLUG" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    SLUG="$(openssl rand -hex 3)"
  else
    SLUG="$(head -c 64 /dev/urandom | LC_ALL=C tr -dc 'a-f0-9' | head -c 6)"
  fi
fi

WT_DIR=".claude/worktrees/${TASK}-${SLUG}"
BRANCH="claude/${TASK}-${SLUG}"

if [[ -e "$WT_DIR" ]]; then
  echo "ensure-worktree.sh: $WT_DIR already exists — pick a different slug" >&2
  exit 2
fi

# Resolve base ref: prefer origin's default branch, fall back to HEAD.
BASE_REF=""
if git symbolic-ref --short refs/remotes/origin/HEAD >/dev/null 2>&1; then
  BASE_REF="$(git symbolic-ref --short refs/remotes/origin/HEAD)"
fi
if [[ -z "$BASE_REF" ]]; then
  BASE_REF="HEAD"
fi

git worktree add "$WT_DIR" -b "$BRANCH" "$BASE_REF" >/dev/null
echo "Created worktree: $REPO_ROOT/$WT_DIR"
echo "On branch:       $BRANCH"
echo "Based on:        $BASE_REF"
echo ""
echo "Next step — run this in the same shell:"
echo "  cd $REPO_ROOT/$WT_DIR"
