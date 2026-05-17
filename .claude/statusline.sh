#!/usr/bin/env bash
# Claude Code statusLine — 2-line layout
#   line 1: model · dir · context · cost · style
#   line 2: git · plan

set -u

input=$(cat)

model=$(jq -r '.model.display_name // "Claude"' <<<"$input")
model_id=$(jq -r '.model.id // ""' <<<"$input")
cwd=$(jq -r '.workspace.current_dir // .cwd // "."' <<<"$input")
cost_usd=$(jq -r '.cost.total_cost_usd // 0' <<<"$input")
output_style=$(jq -r '.output_style.name // "default"' <<<"$input")
transcript=$(jq -r '.transcript_path // ""' <<<"$input")

dir_name=$(basename "$cwd")
cost_fmt=$(awk -v c="$cost_usd" 'BEGIN { printf "$%.2f", c }')

case "$model_id" in
  *1m*|*1M*) window=1000000 ;;
  *)         window=200000  ;;
esac

ctx_tokens=0
total_tokens=0
if [ -n "$transcript" ] && [ -f "$transcript" ]; then
  last_usage_line=$(tail -r "$transcript" 2>/dev/null | awk '/"usage"/ {print; exit}')
  if [ -n "$last_usage_line" ]; then
    ctx_tokens=$(jq -r '
      (.message.usage.input_tokens // 0)
      + (.message.usage.cache_read_input_tokens // 0)
      + (.message.usage.cache_creation_input_tokens // 0)
    ' <<<"$last_usage_line" 2>/dev/null || echo 0)
  fi
  total_tokens=$(jq -s '
    [ .[] | select(.message.usage) |
      (.message.usage.input_tokens // 0)
      + (.message.usage.output_tokens // 0)
      + (.message.usage.cache_read_input_tokens // 0)
      + (.message.usage.cache_creation_input_tokens // 0)
    ] | add // 0
  ' "$transcript" 2>/dev/null || echo 0)
fi
ctx_pct=$(( ctx_tokens * 100 / window ))

fmt_tok() {
  awk -v n="$1" 'BEGIN {
    if (n+0 >= 1000000) printf "%.1fM", n/1000000;
    else if (n+0 >= 1000) printf "%dk", n/1000;
    else printf "%d", n;
  }'
}
ctx_tok_fmt=$(fmt_tok "$ctx_tokens")
total_tok_fmt=$(fmt_tok "$total_tokens")

git_segment=""
if git -C "$cwd" rev-parse --git-dir >/dev/null 2>&1; then
  branch=$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
  if ab=$(git -C "$cwd" rev-list --left-right --count "@{upstream}...HEAD" 2>/dev/null); then
    behind=$(awk '{print $1}' <<<"$ab")
    ahead=$(awk '{print $2}' <<<"$ab")
    git_segment="${branch} ↑${ahead} ↓${behind}"
  else
    git_segment="${branch} (no upstream)"
  fi
fi

DIM=$'\033[2m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
CYAN=$'\033[36m'; BLUE=$'\033[34m'; YELLOW=$'\033[33m'
GREEN=$'\033[32m'; MAGENTA=$'\033[35m'; GRAY=$'\033[90m'
SEP="${DIM} │ ${RESET}"

plan_segment=""
plan_dir="$cwd/plan/in-progress"
if [ -d "$plan_dir" ]; then
  plan_count=$(find "$plan_dir" -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
  plan_current=""
  if [ "$plan_count" -gt 0 ]; then
    latest=$(find "$plan_dir" -type f -name '*.md' -exec stat -f '%m %N' {} \; 2>/dev/null \
              | sort -rn | head -1 | cut -d' ' -f2-)
    [ -n "$latest" ] && plan_current=$(basename "$latest" .md)
  fi
  plan_segment=$(printf '%splan: %s%d%s in-progress%s▶ %s%s%s' \
    "$SEP" \
    "${BOLD}" "$plan_count" "${RESET}" \
    "$SEP" \
    "${BOLD}" "${plan_current:-none}" "${RESET}")
fi

# line 1: model · dir · ctx · cost · style
printf '%s%s%s%s%s%s%s%sctx %s%d%%%s (%s)%s%s%s%s (%s tok)%sstyle: %s%s%s\n' \
  "${BOLD}${CYAN}" "$model" "${RESET}" \
  "$SEP" \
  "${BLUE}" "$dir_name" "${RESET}" \
  "$SEP" \
  "${YELLOW}" "$ctx_pct" "${RESET}" "$ctx_tok_fmt" \
  "$SEP" \
  "${GREEN}" "$cost_fmt" "${RESET}" "$total_tok_fmt" \
  "$SEP" \
  "${GRAY}" "$output_style" "${RESET}"

# line 2: git (+ plan if plan/in-progress/ exists)
printf '  %s%s%s%s' \
  "${MAGENTA}" "${git_segment:-no-git}" "${RESET}" \
  "$plan_segment"
