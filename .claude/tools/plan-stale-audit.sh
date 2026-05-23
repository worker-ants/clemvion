#!/usr/bin/env bash
# Usage:
#   .claude/tools/plan-stale-audit.sh [--threshold-days N]
#
# Stale plan audit — surfaces in-progress plans that may be forgotten or
# orphaned. Reports the following per plan/in-progress/*.md (excluding
# 0-*.md index files):
#
#   - days since last commit (git log -1 --format=%ai)
#   - checkbox progress (count `[x]` vs `[ ]` in body)
#   - cross-link: which spec frontmatter `pending_plans:` references this plan
#   - worktree existence (frontmatter `worktree:` field still exists?)
#
# Plans with last-commit age >= threshold (default 30 days) are flagged
# STALE. The script never fails — it is an informational audit. SoT:
# .claude/docs/plan-lifecycle.md §6.1.
#
# Exit codes:
#   0  always (information only — fail is reserved for invocation errors)
#   2  invocation error (bad arguments, not in a git repo)

set -euo pipefail

THRESHOLD_DAYS=30

while [[ $# -gt 0 ]]; do
  case "$1" in
    --threshold-days)
      THRESHOLD_DAYS="${2:-}"
      if ! [[ "$THRESHOLD_DAYS" =~ ^[0-9]+$ ]]; then
        echo "plan-stale-audit.sh: --threshold-days requires a non-negative integer" >&2
        exit 2
      fi
      shift 2
      ;;
    -h|--help)
      sed -n '2,/^set -euo/p' "$0" | sed -e '/^set -euo/d' -e 's/^#\{1,2\} \{0,1\}//'
      exit 0
      ;;
    *)
      echo "plan-stale-audit.sh: unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if ! REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "plan-stale-audit.sh: not inside a git repository" >&2
  exit 2
fi

cd "$REPO_ROOT"

IN_PROGRESS_DIR="plan/in-progress"
if [[ ! -d "$IN_PROGRESS_DIR" ]]; then
  echo "plan-stale-audit.sh: $IN_PROGRESS_DIR not found — nothing to audit" >&2
  exit 0
fi

# Collect plan files: plan/in-progress/*.md excluding 0-*.md index files.
PLANS=()
while IFS= read -r f; do
  base="$(basename "$f")"
  case "$base" in
    0-*.md) continue ;;
  esac
  PLANS+=("$f")
done < <(find "$IN_PROGRESS_DIR" -maxdepth 1 -type f -name '*.md' | sort)

if [[ ${#PLANS[@]} -eq 0 ]]; then
  echo "No in-progress plans found under $IN_PROGRESS_DIR — nothing to audit."
  exit 0
fi

# Helper: look up which spec frontmatter pending_plans: references the given plan path.
# bash 3.2 compatible (no associative array — direct grep per plan, acceptable for
# typical scale: ~60 specs * ~35 plans = a few thousand small file scans).
lookup_spec_refs() {
  local plan_rel="$1"
  local pattern="^[[:space:]]*-[[:space:]]+${plan_rel}[[:space:]]*$"
  # -rl returns matching file paths only. Restrict to spec/ to avoid plan/ self-refs.
  # grep returns 1 on zero matches under set -e — wrap with `|| true` to coerce to 0.
  local out
  out="$(grep -rlE --include='*.md' "$pattern" spec/ 2>/dev/null || true)"
  printf '%s' "$out" | tr '\n' ' ' | sed -E 's/[[:space:]]+$//'
}

# Today (epoch seconds)
NOW_EPOCH="$(date +%s)"

# Output header
printf '%-60s  %-10s  %-10s  %-15s  %s\n' \
  'PLAN' 'AGE(days)' 'CHECKBOX' 'WORKTREE?' 'REF FROM SPEC'
printf '%s\n' "----------------------------------------------------------------------------------------------------------------------"

STALE_COUNT=0
TOTAL=${#PLANS[@]}

for plan in "${PLANS[@]}"; do
  rel="${plan#$REPO_ROOT/}"
  rel="${rel#./}"

  # Last commit timestamp
  last_iso="$(git log -1 --format=%ai -- "$plan" 2>/dev/null || true)"
  if [[ -z "$last_iso" ]]; then
    age_days="(untracked)"
  else
    last_epoch="$(date -j -f '%Y-%m-%d %H:%M:%S %z' "$last_iso" +%s 2>/dev/null || date -d "$last_iso" +%s 2>/dev/null || echo "")"
    if [[ -z "$last_epoch" ]]; then
      age_days="?"
    else
      age_days=$(( (NOW_EPOCH - last_epoch) / 86400 ))
    fi
  fi

  # Checkbox progress (grep -c returns 1 on zero matches — coerce to 0 explicitly).
  total_box="$(grep -cE '^[[:space:]]*-[[:space:]]*\[[ x]\]' "$plan" 2>/dev/null)" || total_box=0
  done_box="$(grep -cE '^[[:space:]]*-[[:space:]]*\[x\]' "$plan" 2>/dev/null)" || done_box=0
  if [[ "$total_box" -gt 0 ]]; then
    cb="${done_box}/${total_box}"
  else
    cb="-"
  fi

  # Worktree field check
  wt_value="$(sed -n -E 's/^worktree:[[:space:]]+([^[:space:]]+)/\1/p' "$plan" | head -n1)"
  if [[ -z "$wt_value" ]] || [[ "$wt_value" == "pending" ]]; then
    wt_status="(none)"
  elif [[ -d ".claude/worktrees/$wt_value" ]]; then
    wt_status="exists"
  else
    wt_status="MISSING"
  fi

  # Cross-link from spec pending_plans
  ref="$(lookup_spec_refs "$rel")"
  if [[ -z "$ref" ]]; then
    ref="(no spec ref)"
  fi

  # Stale flag
  stale_tag=""
  if [[ "$age_days" =~ ^[0-9]+$ ]] && [[ "$age_days" -ge "$THRESHOLD_DAYS" ]]; then
    stale_tag=" STALE"
    STALE_COUNT=$((STALE_COUNT + 1))
  fi

  printf '%-60s  %-10s  %-10s  %-15s  %s%s\n' \
    "$rel" "$age_days" "$cb" "$wt_status" "$ref" "$stale_tag"
done

echo ""
echo "Total: ${TOTAL} in-progress plans. Stale (>= ${THRESHOLD_DAYS} days): ${STALE_COUNT}."
echo "(This audit is informational only. To groom stale plans: review checkbox progress,"
echo " move to plan/complete/ if done, or update with current status / new owner.)"
