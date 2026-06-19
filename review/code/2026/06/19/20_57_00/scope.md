### 발견사항

범위 이탈 항목 없음.

모든 4개 파일의 변경이 "run-test.sh 워치독 추가 — hang 스테이지 강제 종료 + TIMEOUT(exit 124) 처리" 라는 단일 의도 안에 있다:

- `.claude/tools/run-test.sh`: 워치독 핵심 구현 + `RUN_TEST_CONFIG` 경로 override (테스트 환경용, 같은 PR 범위). 기존 비활성 fallback(`RUN_TEST_TIMEOUT=0`)으로 하위 호환 유지.
- `.claude/test-stages.sh`: `on_timeout_${STAGE}` 훅 컨벤션에 맞는 `on_timeout_e2e()` 추가 — orphan 컨테이너 정리, 워치독 콜백의 직접 수신자.
- `codebase/backend/jest.config.ts`: `forceExit: true` — Jest open-handle hang(= 워치독이 막는 바로 그 증상)을 teardown 단계에서 완화. 긴 주석은 mask/fix 구분, detectOpenHandles 안내, 워치독과의 역할 분리를 설명하며 의사결정 근거로서 필요.
- `codebase/backend/test/jest-e2e.json`: `forceExit: true` — unit과 e2e 일관 적용.

포맷팅·임포트·무관한 리팩토링 없음. 설정 변경(jest.config.ts, jest-e2e.json)은 hang 방지 의도에 직결.

### 요약

변경 4개 파일 전체가 "테스트 harness hang 방지 — run-test.sh 워치독 + Jest forceExit + e2e cleanup 훅" 이라는 단일 목적에 직접 기여한다. 범위 이탈, 불필요한 리팩토링, 무관한 수정, 포맷팅 노이즈는 발견되지 않는다.

### 위험도

NONE
