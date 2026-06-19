# Testing Review — harness watchdog + forceExit

## 발견사항

### [WARNING] 워치독 핵심 로직(run-test.sh)에 대한 자동화 테스트 부재
- 위치: `.claude/tools/run-test.sh` — 워치독 전체 블록(line 179–218)
- 상세: `.claude/tests/` 디렉터리에 `test_orchestrator_state.py`, `test_branch_guard.py` 등 하네스 컴포넌트 단위 테스트가 존재하지만, `run-test.sh`의 워치독 로직(timeout 발화 → TERM→KILL → TIMEOUT_MARKER 생성 → cleanup hook 호출 → exit 124)을 검증하는 테스트는 없다. 이 스크립트의 기존 기능(PASS/FAIL 출력 포맷, log 저장)도 마찬가지로 테스트되지 않는다.
- 제안: `RUN_TEST_CONFIG` override 환경변수(이미 이번 변경에 추가됨)를 활용해 `bats` 또는 표준 라이브러리만 쓰는 Python subprocess 기반 통합 테스트를 `.claude/tests/`에 추가한다. 핵심 시나리오: (1) `RUN_TEST_TIMEOUT=5`로 3초 이상 hang하는 stub cmd를 실행 → exit code 124 확인, (2) `on_timeout_e2e` cleanup hook이 실제로 호출되는지 확인, (3) `RUN_TEST_TIMEOUT=0`일 때 워치독 비활성 경로가 종전 동작을 유지하는지 확인.

### [WARNING] `on_timeout_e2e` hook에 대한 테스트 없음
- 위치: `.claude/test-stages.sh` — `on_timeout_e2e()` (line 127–129)
- 상세: 함수 자체는 단순하게 `make e2e-down`을 호출하나, run-test.sh가 `declare -F "on_timeout_${STAGE}"` 로 hook을 탐색하는 로직과의 연동이 검증되지 않는다. STAGE 이름 불일치(예: `on_timeout_E2E`처럼 대소문자 오입력) 시 hook이 무음으로 무시된다.
- 제안: stub `test-stages.sh`를 픽스처로 만들어 `on_timeout_unit` 등 다른 스테이지에는 hook이 없음을 확인하는 테스트와, `on_timeout_e2e`가 실제로 dispatch되는지 확인하는 테스트를 추가한다.

### [WARNING] TIMEOUT_MARKER 파일 기반 통신의 경쟁 조건 — 테스트로 검증 불가한 상태
- 위치: `.claude/tools/run-test.sh` — line 196–228
- 상세: 워치독 서브셸이 `TIMEOUT_MARKER` 파일을 생성한 직후 KILL을 보내고, 메인 셸은 `wait "$FUNC_PID"` 후에 마커 파일을 검사한다. KILL이 완료되기 전에 메인 셸의 `wait`가 먼저 반환되면(PID가 다른 이유로 종료된 경우) 마커 파일이 아직 생성 중일 수 있다. 테스트 없이는 이 타이밍 의존성을 발견하기 어렵다.
- 제안: 타임아웃 경계 케이스(정상 종료 vs timeout 발화가 거의 동시에 일어나는 경우)를 커버하는 테스트를 추가해 마커 파일 검출 정확도를 검증한다.

### [INFO] `RUN_TEST_CONFIG` 환경변수 — 테스트 용이성을 위한 좋은 설계, 활용 권장
- 위치: `.claude/tools/run-test.sh` — line 163
- 상세: `RUN_TEST_CONFIG` override가 이번 변경으로 도입되어 테스트 격리가 가능해졌다. 실제 `.claude/test-stages.sh`를 변경하지 않고 stub stage 파일을 지정해 워치독 시나리오를 테스트할 수 있는 기반이 마련됐다. 이 인프라를 활용한 테스트가 아직 없으므로 해당 인프라의 가치를 충분히 실현하지 못하고 있다.
- 제안: `RUN_TEST_CONFIG` + `RUN_TEST_TIMEOUT` 조합으로 워치독 시나리오를 구동하는 `.claude/tests/test_run_test_watchdog.py` (또는 `.sh`) 작성을 후속 작업으로 계획한다.

### [INFO] `forceExit: true` — 누수 마스킹을 인정하는 주석은 훌륭하나 검증 테스트 부재
- 위치: `codebase/backend/jest.config.ts` line 421, `codebase/backend/test/jest-e2e.json` line 497
- 상세: 주석에 "It masks (does not fix) the leak — run `npm test -- --detectOpenHandles` to locate..." 라고 명시돼 있어 의도는 명확하다. 그러나 실제 어떤 테스트 파일이 핸들을 열어두고 있는지에 대한 추적 이슈나 `afterAll` 정리 체크 테스트가 없다.
- 제안: `forceExit`는 임시 완화책임을 plan에 기록하고, `detectOpenHandles` 실행 결과를 `plan/`에 트래킹해 실제 핸들 누수의 근본 수정을 별도 티켓으로 관리한다. 현 상태에서의 리스크는 hang이 teardown 단계 이후가 아니라 실행 도중 발생할 때 `forceExit`가 무력해진다는 점이며, 이 경우 워치독이 백스톱이 된다(주석에도 명시됨).

### [INFO] 워치독 슬립 폴링 간격 5초 — 경계값 테스트 부재
- 위치: `.claude/tools/run-test.sh` — line 192–205
- 상세: 폴링 루프가 5초 단위로 `slept`를 누적한다. `STAGE_TIMEOUT=7`이면 실제 발화는 10초 후다(5+5=10). 이 오차가 의도된 것인지 테스트로 검증된 바 없다. 정확한 초 단위 타임아웃이 아닌 "최소 STAGE_TIMEOUT초 후" 발화임을 문서화하거나 테스트로 명시할 필요가 있다.
- 제안: 타임아웃 오차(최대 +4초)를 주석이나 docstring에 명기한다.

### [INFO] 회귀 테스트: 기존 경로(`RUN_TEST_TIMEOUT=0`) 동작 보장
- 위치: `.claude/tools/run-test.sh` — line 214–218
- 상세: `RUN_TEST_TIMEOUT=0` 비활성 경로는 기존 동작을 그대로 유지하지만, 이를 검증하는 회귀 테스트가 없다. 이번 변경으로 추가된 분기 때문에 기존 동작이 변경됐을 리스크를 테스트 없이는 단언하기 어렵다.
- 제안: `RUN_TEST_TIMEOUT=0`으로 단순 성공/실패 stub을 실행해 PASS/FAIL 출력 포맷이 변경 이전과 동일함을 assertion하는 테스트를 추가한다.

---

## 요약

이번 변경은 harness의 핵심 인프라(run-test.sh 워치독, jest.config.ts forceExit)를 개선하지만, 변경된 로직 자체에 대한 자동화 테스트가 전혀 없다. `.claude/tests/`에 하네스 컴포넌트 단위 테스트 인프라가 이미 존재하고, 이번에 추가된 `RUN_TEST_CONFIG` override로 격리 테스트 기반도 마련됐으나 이를 활용한 테스트 파일이 작성되지 않았다. 워치독의 핵심 시나리오(timeout 발화 → cleanup hook → exit 124, TIMEOUT_MARKER 경쟁 조건, `RUN_TEST_TIMEOUT=0` 회귀)는 테스트 없이는 리그레션 위험이 남는다. `forceExit: true`는 주석이 누수 마스킹임을 잘 인정하고 있으나 근본 수정 추적이 없다.

---

## 위험도

MEDIUM
