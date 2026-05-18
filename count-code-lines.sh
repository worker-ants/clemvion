#!/usr/bin/env bash
# count-code-lines.sh
#
# codebase/ 하위의 TS/JS 소스를 logic vs test 로 분류해 파일 수·라인 수를 집계한다.
#
# 분류 기준:
#   대상 확장자  .ts .tsx .js .jsx .mts .cts .mjs .cjs
#   제외 경로    node_modules / dist / .next / build / coverage / .turbo
#   테스트 판정  파일명 *.spec.* / *.test.* / *.e2e-spec.*
#               또는 경로에 /__tests__/, /backend/test/, /frontend/e2e/ 포함
#
# Usage: ./count-code-lines.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${ROOT}/codebase"

if [[ ! -d "${TARGET}" ]]; then
  echo "Error: codebase directory not found at ${TARGET}" >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT

# 1) 후보 파일을 찾아 awk 로 분류 → 영역(area)별 / 전체 list 파일에 적재
find "${TARGET}" \
  \( -path '*/node_modules' -o -path '*/dist' -o -path '*/.next' \
     -o -path '*/build' -o -path '*/coverage' -o -path '*/.turbo' \) -prune -o \
  -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \
             -o -name '*.mts' -o -name '*.cts' -o -name '*.mjs' -o -name '*.cjs' \) -print \
  | awk -v dir="${tmp}" '
      function area(p,    s) {
        s = p
        sub(/.*\/codebase\//, "", s)
        sub(/\/.*/, "", s)
        return s
      }
      function bucket(p) {
        if (p ~ /\.(spec|test)\.(ts|tsx|js|jsx)$/) return "test"
        if (p ~ /\.e2e-spec\.(ts|tsx)$/)            return "test"
        if (p ~ /\/__tests__\//)                    return "test"
        if (p ~ /\/backend\/test\//)                return "test"
        if (p ~ /\/frontend\/e2e\//)                return "test"
        return "logic"
      }
      {
        k = bucket($0)
        a = area($0)
        print $0 >> (dir "/area." a "." k ".list")
        print $0 >> (dir "/all." k ".list")
      }
    '

# 2) 집계 헬퍼
count_files() {
  local list="$1"
  [[ -s "${list}" ]] || { echo 0; return; }
  wc -l < "${list}" | tr -d ' '
}
sum_lines() {
  local list="$1"
  [[ -s "${list}" ]] || { echo 0; return; }
  # 파일이 많으면 wc 가 여러 번 호출되어 "total" 라인이 섞일 수 있으므로 합산 시 제외.
  # macOS xargs 는 -a 미지원 → stdin 경유. -0 으로 공백 포함 경로도 안전 처리.
  tr '\n' '\0' < "${list}" | xargs -0 wc -l 2>/dev/null \
    | awk '$2 != "total" { s += $1 } END { print s+0 }'
}
fmt() {
  # 천 단위 구분자. locale 미지원이면 그대로 출력.
  LC_ALL=en_US.UTF-8 printf "%'d" "$1" 2>/dev/null || printf "%d" "$1"
}

# 3) 영역 목록 (codebase/<area> 의 area 만)
areas=()
shopt -s nullglob
for f in "${tmp}"/area.*.logic.list "${tmp}"/area.*.test.list; do
  base="$(basename "$f")"          # area.<name>.{logic,test}.list
  name="${base#area.}"
  name="${name%.logic.list}"
  name="${name%.test.list}"
  areas+=("${name}")
done
shopt -u nullglob
IFS=$'\n' areas=($(printf '%s\n' "${areas[@]}" | sort -u))
unset IFS

# 4) 출력
HEAD_FMT="  %-12s %12s %14s    %12s %14s\n"
ROW_FMT="  %-12s %12s %14s    %12s %14s\n"

echo
echo "Codebase line counts  (${TARGET})"
echo "----------------------------------------------------------------------------"
printf "${HEAD_FMT}" "Area" "Logic files" "Logic lines" "Test files" "Test lines"
echo "----------------------------------------------------------------------------"

for a in "${areas[@]}"; do
  lf=$(count_files "${tmp}/area.${a}.logic.list")
  ll=$(sum_lines  "${tmp}/area.${a}.logic.list")
  tf=$(count_files "${tmp}/area.${a}.test.list")
  tl=$(sum_lines  "${tmp}/area.${a}.test.list")
  printf "${ROW_FMT}" "$a" "$(fmt "$lf")" "$(fmt "$ll")" "$(fmt "$tf")" "$(fmt "$tl")"
done

echo "----------------------------------------------------------------------------"

LF=$(count_files "${tmp}/all.logic.list")
LL=$(sum_lines  "${tmp}/all.logic.list")
TF=$(count_files "${tmp}/all.test.list")
TL=$(sum_lines  "${tmp}/all.test.list")
printf "${ROW_FMT}" "TOTAL" "$(fmt "$LF")" "$(fmt "$LL")" "$(fmt "$TF")" "$(fmt "$TL")"

TOTAL_LINES=$((LL + TL))
TOTAL_FILES=$((LF + TF))
if (( LL > 0 )); then
  RATIO=$(awk -v t="$TL" -v l="$LL" 'BEGIN { printf "%.1f", (t / l) * 100 }')
else
  RATIO="n/a"
fi

echo
printf "  Total files: %s    Total lines: %s    Test/Logic line ratio: %s%%\n" \
  "$(fmt "$TOTAL_FILES")" "$(fmt "$TOTAL_LINES")" "${RATIO}"
echo
