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
# 워치독: 스테이지가 open-handle 누수("Jest did not exit ...") 등으로 영원히
# 끝나지 않는 hang 을 방지한다. 한도 초과 시 프로세스 그룹을 TERM→유예→KILL 하고
# status=TIMEOUT (exit 124) 으로 끝낸다 → wrapper 가 무한 블록되지 않는다.
#   RUN_TEST_TIMEOUT       스테이지 한도(초). 기본 1800(30분). 0 이면 워치독 비활성.
#   RUN_TEST_POLL_INTERVAL 한도 도달 확인 폴링 간격(초). 기본 5 → 실제 발화는
#                          STAGE_TIMEOUT~STAGE_TIMEOUT+POLL_INTERVAL 사이.
#   RUN_TEST_KILL_GRACE    TERM 후 KILL 까지 유예(초). 기본 15.
#   RUN_TEST_CONFIG        test-stages.sh 경로 override (테스트·특수 환경용).
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
CONFIG="${RUN_TEST_CONFIG:-${ROOT}/.claude/test-stages.sh}"

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

STAGE_TIMEOUT="${RUN_TEST_TIMEOUT:-1800}"
POLL_INTERVAL="${RUN_TEST_POLL_INTERVAL:-5}"
KILL_GRACE="${RUN_TEST_KILL_GRACE:-15}"
TIMEOUT_MARKER="${LOG}.timeout"
rm -f "$TIMEOUT_MARKER"

START=$(date +%s)

if [ "$STAGE_TIMEOUT" -gt 0 ] 2>/dev/null; then
  # 스테이지 함수를 자기 process group 의 leader 로 백그라운드 실행한다(set -m).
  # 그래야 KILL 대상이 함수가 띄운 자식(npm/jest/docker compose 등) 트리 전체가
  # 된다 — leader 만 죽이면 자식이 orphan 으로 계속 돌 수 있다.
  # `timeout` 바이너리는 macOS 호스트에 없으므로(=coreutils gtimeout) 의존 없이
  # 순수 bash `kill -0` 폴링 워치독으로 구현한다.
  set -m
  "$FUNC" >"$LOG" 2>&1 &
  FUNC_PID=$!
  set +m

  (
    slept=0
    while kill -0 "$FUNC_PID" 2>/dev/null; do
      sleep "$POLL_INTERVAL"
      slept=$((slept + POLL_INTERVAL))
      if [ "$slept" -ge "$STAGE_TIMEOUT" ]; then
        : >"$TIMEOUT_MARKER"
        {
          echo ""
          echo "[run-test] TIMEOUT after ${STAGE_TIMEOUT}s — terminating stage process group (pgid ${FUNC_PID})"
        } >>"$LOG"
        kill -TERM "-${FUNC_PID}" 2>/dev/null
        sleep "$KILL_GRACE"
        kill -KILL "-${FUNC_PID}" 2>/dev/null
        break
      fi
    done
  ) &
  WATCHDOG=$!

  wait "$FUNC_PID" 2>/dev/null
  EXIT=$?
  kill "$WATCHDOG" 2>/dev/null
  wait "$WATCHDOG" 2>/dev/null
else
  # 워치독 비활성(RUN_TEST_TIMEOUT=0): 종전 동작 그대로.
  "$FUNC" >"$LOG" 2>&1
  EXIT=$?
fi

END=$(date +%s)
DURATION=$((END - START))

TIMED_OUT=0
if [ -f "$TIMEOUT_MARKER" ]; then
  TIMED_OUT=1
  rm -f "$TIMEOUT_MARKER"
fi

if [ "$TIMED_OUT" -eq 1 ]; then
  # 스테이지별 정리 훅(예: e2e → make e2e-down). make e2e-test 의 후행
  # e2e-down 이 hang 때문에 실행 못 됐을 수 있어 orphan 컨테이너·볼륨을 정리한다.
  CLEANUP="on_timeout_${STAGE}"
  if declare -F "$CLEANUP" >/dev/null; then
    echo "[run-test] running ${CLEANUP} (cleanup) ..." >>"$LOG"
    "$CLEANUP" >>"$LOG" 2>&1 || true
  fi
  echo "stage=${STAGE} status=TIMEOUT limit=${STAGE_TIMEOUT}s duration=${DURATION}s log=${LOG}"
  echo "--- 마지막 30줄 ---"
  tail -30 "$LOG"
  exit 124
elif [ $EXIT -eq 0 ]; then
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
