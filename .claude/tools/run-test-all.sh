#!/usr/bin/env bash
# Usage:
#   .claude/tools/run-test-all.sh [stage ...]     # 기본: lint unit build e2e
#
# `run-test.sh` 를 4단계 순서대로 돌리고 **각 단계의 종료 코드를 그대로** 판정한다.
# 첫 실패에서 멈춘다(fail-fast) — 뒤 단계는 앞 단계에 의존하고(build→e2e) 느리다.
#
# ## 왜 이 도구가 있나 — 파이프가 종료 코드를 먹는다
#
# 단계를 하나씩 돌리면 출력이 길어서 `| tail` 을 붙이게 되는데, 그러면 **파이프라인의 종료
# 코드는 `tail` 의 것**(거의 항상 0)이 된다. `run-test.sh` 는 실패에 정확히 비-0 을 내지만
# 그 신호가 호출자에게 도달하지 못한다:
#
#     .claude/tools/run-test.sh lint            # exit 1  (정상)
#     .claude/tools/run-test.sh lint | tail -2  # exit 0  ← 실패가 사라진다
#
# 2026-09-11 세션에서 이 형태로 **두 번** 속았다. 한 번은 `&&` 로 이어붙인 체인이 lint 실패
# 뒤에도 계속 돌았고, 한 번은 오타(`run-test.sh all`)의 `status=NOT_DEFINED`(exit 2)가
# `| tail -40` 에 먹혀 "4단계 통과" 로 보였다.
#
# ## 그래서 실패를 **stdout 에도** 적는다
#
# 종료 코드만 고치면 같은 함정이 남는다 — 호출자가 또 파이프를 붙일 수 있기 때문이다.
# 이 스크립트는 마지막 줄에 `run-test-all: ALL PASS` 또는 `run-test-all: FAILED stage=<name>`
# 을 찍는다. **`| tail -1` 로 읽어도 결과가 참**이다. 종료 코드는 그것대로 정확히 전파한다.
#
# 출력: 단계마다 `run-test.sh` 의 한 줄 status 를 그대로 통과시키고, 끝에 요약 한 줄.
#
# 종료 코드:
#   0  전 단계 통과
#   N  첫 실패 단계의 종료 코드 (그대로 전파 — run-test.sh 의 1/2/124 등)
#   2  호출 오류 (알 수 없는 단계 이름)
#
# `RUN_TEST_CONFIG` 등 `run-test.sh` 의 환경변수는 그대로 상속된다(테스트에서 stub 주입).

set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
RUN_TEST="${SCRIPT_DIR}/run-test.sh"

DEFAULT_STAGES=(lint unit build e2e)

if [ "$#" -gt 0 ]; then
  STAGES=("$@")
else
  STAGES=("${DEFAULT_STAGES[@]}")
fi

# 알 수 없는 단계는 **돌리기 전에** 거른다 — 오타 한 번이 "통과" 로 보이던 사고의 재발 방지.
for STAGE in "${STAGES[@]}"; do
  case "$STAGE" in
    lint | unit | build | e2e) ;;
    *)
      echo "run-test-all.sh: unknown stage '${STAGE}' (expected: ${DEFAULT_STAGES[*]})" >&2
      echo "run-test-all: FAILED stage=${STAGE} reason=unknown-stage"
      exit 2
      ;;
  esac
done

for STAGE in "${STAGES[@]}"; do
  # 파이프 없이 직접 실행한다 — 이 스크립트의 존재 이유가 그것이다.
  "$RUN_TEST" "$STAGE"
  RC=$?
  if [ "$RC" -ne 0 ]; then
    echo "run-test-all: FAILED stage=${STAGE} exit=${RC}"
    exit "$RC"
  fi
done

echo "run-test-all: ALL PASS stages=${STAGES[*]}"
