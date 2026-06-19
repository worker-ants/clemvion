# 요구사항(Requirement) Review — harness-test-watchdog

## 발견사항

### [INFO] spec 문서 부재 — 이 변경은 개발 인프라(harness) 전용으로 product spec 대상 외
- 위치: 변경 파일 전체 (`.claude/test-stages.sh`, `.claude/tools/run-test.sh`, `codebase/backend/jest.config.ts`, `codebase/backend/test/jest-e2e.json`)
- 상세: 변경 대상이 `spec/` 하위의 어떤 product 요구사항 문서로도 정의되지 않은 개발 도구(harness) 파일이다. `spec/` 전체를 grep 해도 `run-test.sh`, `test-stages.sh`, `RUN_TEST_TIMEOUT`, `forceExit`, `on_timeout`, `STAGE_TIMEOUT` 를 언급하는 spec 문서가 없다. 따라서 spec fidelity 점검은 해당 없음(INFO).
- 제안: product spec 반영 불필요. 코드 주석이 의도를 충분히 설명한다.

---

### [INFO] `RUN_TEST_TIMEOUT=0` 이면 워치독 완전 비활성 — 빈 문자열과 구분 동작 명확
- 위치: `run-test.sh` 라인 63 `if [ "$STAGE_TIMEOUT" -gt 0 ] 2>/dev/null; then`
- 상세: 헤더 주석은 "0/빈값이면 비활성"이라고 명시한다. 빈 문자열(`""`)은 `:-` 치환으로 기본값 `1800` 이 적용되고, 명시적 `0` 이면 비활성화된다. 비정수 값(예: `abc`)은 산술 비교 오류가 `2>/dev/null` 로 무시되어 else 분기(종전 동작)로 빠지는 안전한 폴백이다.
- 제안: 현재 동작 안전. 수정 불필요.

---

### [INFO] 워치독 타이머 최대 5초 오차
- 위치: `run-test.sh` 라인 76–89 (watchdog 루프)
- 상세: 루프가 `sleep 5` 후 `slept` 를 갱신하므로 실제 timeout 발동은 `STAGE_TIMEOUT` 과 최대 5초 차이가 난다. 1800초 기준으로 무의미한 오차다.
- 제안: 수정 불필요.

---

### [INFO] `on_timeout_e2e` cleanup 이 hang 할 경우 2차 보호 없음
- 위치: `.claude/test-stages.sh` 라인 128–130, `run-test.sh` 라인 119
- 상세: `make e2e-down` (docker compose down)이 이미 dockerd 가 불안정한 상황에서 hang 할 수 있다. cleanup 호출부가 `|| true` 로 실행해 cleanup 실패는 흡수하지만, hang 의 경우 wrapper 가 무기한 대기하게 된다. 이는 드문 시나리오이나 원칙적으로 동일한 hang 문제가 cleanup 단계에서 재발할 수 있다.
- 제안: 허용 가능한 설계. 향후 개선 시 `timeout 60 "$CLEANUP" ...` 으로 cleanup 에도 상한을 두는 것을 고려.

---

### [INFO] `forceExit: true` 가 `jest-e2e.json` 에도 추가 — e2e 환경에서의 자원 해제 미완 가능성
- 위치: `codebase/backend/test/jest-e2e.json` 라인 18
- 상세: e2e 환경에서는 TypeORM/Redis/BullMQ 커넥션이 실제 DB 에 연결된다. `forceExit` 가 `afterAll` 보다 먼저 종료하면 커넥션이 닫히지 않아 다음 실행 시 DB 상태가 오염될 가능성이 있다. `jest.config.ts` 주석이 이를 "마스크이며 근본 해결이 아님"으로 명시하고 `--detectOpenHandles` 로 추적하라고 안내하여 기술 부채가 추적된다.
- 제안: pragmatic 선택으로 수용 가능. 코드 버그 아님.

---

### [INFO] TIMEOUT_MARKER 가 KILL 전에 기록됨 — TERM 후 정상 종료 시에도 TIMEOUT 분기 진입
- 위치: `run-test.sh` 라인 80 (marker 기록), 라인 85 (TERM 발송)
- 상세: TERM 후 프로세스가 15초 안에 스스로 종료하더라도 TIMEOUT_MARKER 가 이미 남아 있어 TIMED_OUT=1 로 처리된다. 이는 의도된 동작이다 — timeout limit 이 발동된 이상 TIMEOUT 상태가 맞다.
- 제안: 수정 불필요.

---

### [INFO] `wait "$FUNC_PID"` 의 exit code 모호성을 TIMEOUT_MARKER 파일로 우회 — 올바른 설계
- 위치: `run-test.sh` 라인 94–95, 라인 108–111
- 상세: KILL 로 종료된 프로세스를 `wait` 하면 137(128+9)을 반환한다. 코드는 EXIT 값을 직접 검사하지 않고 TIMEOUT_MARKER 파일 존재 여부로 분기하므로 kill/정상실패 구분이 정확하다.
- 제안: 수정 불필요.

---

## 요약

4개 파일 변경은 `run-test.sh` 에 순수 bash 워치독(TERM→15초 유예→KILL), `test-stages.sh` 에 `on_timeout_e2e` cleanup 훅, `jest.config.ts`·`jest-e2e.json` 에 `forceExit: true` 를 추가한다. 세 계층(Jest teardown hang, runner process hang, orphan 컨테이너 정리)을 각각 독립적으로 방어하는 구조로, 의도와 구현이 일치한다. TIMEOUT_MARKER 파일 기반 timeout 감지는 `wait` exit code 모호성을 올바르게 우회한다. cleanup 훅 자체의 hang 에 대한 2차 보호가 없다는 점은 잠재적 약점이나, `|| true` 가 실패를 흡수해 exit 124 흐름을 보호하므로 실용적 허용 범위 내다. 변경 전체가 product spec 과 무관한 harness 인프라 코드라 spec fidelity 이슈는 없다. CRITICAL·WARNING 발견사항 없음.

## 위험도

LOW
