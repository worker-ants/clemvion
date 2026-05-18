#!/usr/bin/env bash
# 테스트·빌드·린트 출력 요약 wrapper.
#
# 사용: .claude/tools/run-test.sh <stage>
#   stage: lint | unit | build | e2e
#
# 통과 시 stdout 한 줄로 끝 → main ctx ≤ 100 토큰.
# 실패 시 한 줄 + 마지막 30줄 + 실패 마커 grep → main ctx ≤ 2K 토큰.
# 전체 로그는 디스크 (`_test_logs/<stage>-<ts>.log`) 에 보존.
#
# 프로젝트는 `.claude/test-stages.sh` 에 다음 함수들을 정의:
#   cmd_lint()  — 린트 실행
#   cmd_unit()  — 단위 테스트
#   cmd_build() — 빌드
#   cmd_e2e()   — e2e (실 인프라)
# 각 함수는 명령을 직접 실행하고 그 exit code 를 반환한다.

set -u

STAGE="${1:-}"
if [ -z "$STAGE" ]; then
  echo "usage: $0 <lint|unit|build|e2e>" >&2
  exit 2
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CONFIG="${ROOT}/.claude/test-stages.sh"

if [ ! -f "$CONFIG" ]; then
  echo "stage=${STAGE} status=CONFIG_MISSING path=${CONFIG}" >&2
  echo "" >&2
  echo "프로젝트 채택 시 ${CONFIG} 에 cmd_lint / cmd_unit / cmd_build / cmd_e2e 함수를 정의하세요." >&2
  echo "샘플: ${ROOT}/.claude/test-stages.sh.example" >&2
  exit 2
fi

# shellcheck disable=SC1090
source "$CONFIG"

FUNC="cmd_${STAGE}"
if ! declare -F "$FUNC" >/dev/null; then
  echo "stage=${STAGE} status=NOT_DEFINED func=${FUNC} config=${CONFIG}" >&2
  exit 2
fi

LOG_DIR="${ROOT}/_test_logs"
mkdir -p "$LOG_DIR"
TS=$(date +%Y%m%d-%H%M%S)
LOG="${LOG_DIR}/${STAGE}-${TS}.log"

START=$(date +%s)
"$FUNC" >"$LOG" 2>&1
EXIT=$?
END=$(date +%s)
DURATION=$((END - START))

if [ $EXIT -eq 0 ]; then
  # 통과 시 한 줄. 가능하면 테스트 카운트도.
  COUNT=""
  PASS_LINE=$(grep -Ei "tests:.*pass|passing\b|✓.*passed\b" "$LOG" | tail -1 || true)
  if [ -n "$PASS_LINE" ]; then
    NUM=$(echo "$PASS_LINE" | grep -oE '[0-9]+ (passed|passing)' | head -1 || true)
    [ -n "$NUM" ] && COUNT=" tests=${NUM}"
  fi
  echo "stage=${STAGE} status=PASS duration=${DURATION}s${COUNT} log=${LOG}"
else
  echo "stage=${STAGE} status=FAIL exit=${EXIT} duration=${DURATION}s log=${LOG}"
  echo "--- 마지막 30줄 ---"
  tail -30 "$LOG"
  echo "--- 실패 마커 (FAIL/Error/✗) ---"
  grep -nE "FAIL\b|✗|\bError\b|\berror\b" "$LOG" | head -50 || true
fi

exit $EXIT
