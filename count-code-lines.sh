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

# 4) 출력 — 컬럼 폭을 데이터에 맞춰 동적으로 산출해 라인 수가 커져도 정렬 유지

# 4-1) 모든 행(영역들 + TOTAL)의 표시 문자열을 먼저 수집
row_area=()  row_lf=()  row_ll=()  row_tf=()  row_tl=()
for a in "${areas[@]}"; do
  row_area+=("$a")
  row_lf+=("$(fmt "$(count_files "${tmp}/area.${a}.logic.list")")")
  row_ll+=("$(fmt "$(sum_lines  "${tmp}/area.${a}.logic.list")")")
  row_tf+=("$(fmt "$(count_files "${tmp}/area.${a}.test.list")")")
  row_tl+=("$(fmt "$(sum_lines  "${tmp}/area.${a}.test.list")")")
done

LF=$(count_files "${tmp}/all.logic.list")
LL=$(sum_lines  "${tmp}/all.logic.list")
TF=$(count_files "${tmp}/all.test.list")
TL=$(sum_lines  "${tmp}/all.test.list")
row_area+=("TOTAL")
row_lf+=("$(fmt "$LF")")
row_ll+=("$(fmt "$LL")")
row_tf+=("$(fmt "$TF")")
row_tl+=("$(fmt "$TL")")

# 4-2) 컬럼별 최대 폭 = max(헤더 길이, 모든 셀 표시 길이)
maxw() {
  local m=0 v
  for v in "$@"; do (( ${#v} > m )) && m=${#v}; done
  echo "$m"
}
H_AREA="Area"; H_LF="Logic files"; H_LL="Logic lines"
H_TF="Test files"; H_TL="Test lines"
w_area=$(maxw "$H_AREA" "${row_area[@]}")
w_lf=$(maxw   "$H_LF"   "${row_lf[@]}")
w_ll=$(maxw   "$H_LL"   "${row_ll[@]}")
w_tf=$(maxw   "$H_TF"   "${row_tf[@]}")
w_tl=$(maxw   "$H_TL"   "${row_tl[@]}")

# 4-3) 동적 폭으로 포맷 / 구분선 구성 (GAP: 컬럼 간격, GGAP: logic↔test 그룹 간격)
GAP="  "; GGAP="    "
ROW_FMT="  %-${w_area}s${GAP}%${w_lf}s${GAP}%${w_ll}s${GGAP}%${w_tf}s${GAP}%${w_tl}s\n"
total_w=$(( 2 + w_area + ${#GAP} + w_lf + ${#GAP} + w_ll + ${#GGAP} + w_tf + ${#GAP} + w_tl ))
sep="$(printf '%*s' "${total_w}" '' | tr ' ' '-')"

echo
echo "Codebase line counts  (${TARGET})"
echo "${sep}"
printf "${ROW_FMT}" "$H_AREA" "$H_LF" "$H_LL" "$H_TF" "$H_TL"
echo "${sep}"

# 4-4) 영역 행 출력 → 구분선 → TOTAL 행 (마지막 원소가 TOTAL)
last=$(( ${#row_area[@]} - 1 ))
for i in "${!row_area[@]}"; do
  (( i == last )) && echo "${sep}"
  printf "${ROW_FMT}" \
    "${row_area[i]}" "${row_lf[i]}" "${row_ll[i]}" "${row_tf[i]}" "${row_tl[i]}"
done

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
