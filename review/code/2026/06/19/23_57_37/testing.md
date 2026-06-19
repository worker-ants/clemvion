# Testing Review

## 발견사항

### [INFO] 테스트 커버리지 완비 — 두 가지 테스트 벡터 모두 추가됨
- 위치: `execution-failure-classifier.spec.ts` 라인 170, 200
- 상세: `WORKFLOW_FORBIDDEN_WORKSPACE` 가 (1) executionFailedInternal 분류 파라미터 배열(라인 170)과 (2) "no CCH-ERR-04 warn" 파라미터 배열(라인 196–209) 양쪽 모두에 추가됐다. 기존 `CODE_MEMORY_LIMIT`, `HTTP_BLOCKED` 의 W1 패턴을 정확히 복제하고 있으며, 분류 결과와 부작용(warn 미발생) 양쪽을 검증한다.
- 제안: 없음. 충분.

### [INFO] warnSpy 격리 패턴 — `afterEach` 없이 인라인 `mockRestore()`
- 위치: `execution-failure-classifier.spec.ts` 라인 143–149, 155–169, 173–178, 264–280
- 상세: jest 설정에 `restoreMocks: true` 가 없고 (`jest.config.ts` 확인), `afterEach(() => jest.restoreAllMocks())` 훅도 없다. 각 테스트가 직접 `warnSpy.mockRestore()` 를 호출해 격리를 유지한다. 이 패턴은 기존 파일 전체에서 일관되게 사용되고 있으므로 이번 변경이 회귀를 도입하지는 않는다. 그러나 향후 테스트가 중간에 throw 하면 `mockRestore()` 가 호출되지 않아 후속 테스트가 오염될 수 있다.
- 제안: 장기적으로는 `afterEach(() => jest.restoreAllMocks())` 를 describe 블록 상단에 추가하거나 jest 설정에 `restoreMocks: true` 를 추가하는 것을 고려. 단, 이번 PR 범위 밖.

### [INFO] `it.each` 배열에 WORKFLOW_FORBIDDEN_WORKSPACE 추가 — 기존 no-warn 배열과 분류 배열 일관성 확인
- 위치: `execution-failure-classifier.spec.ts` 라인 108–115 (분류 배열), 196–201 (no-warn 배열)
- 상세: 두 배열 모두에 `WORKFLOW_FORBIDDEN_WORKSPACE` 가 추가되어 있고 순서도 `SUB_WORKFLOW_FAILED` 인접 그룹을 유지한다. 구현 파일의 INTERNAL_CODES Set 순서(라인 67)와 일치한다.
- 제안: 없음.

### [INFO] 엔드-투-엔드 분류 경로 — 상위 레이어 테스트에서 이미 검증됨
- 위치: `execution-engine.service.spec.ts` (라인 879, 944, 1844, 1854, 1962, 1969), `workflow.handler.spec.ts` (라인 665–684)
- 상세: `WORKFLOW_FORBIDDEN_WORKSPACE` 에러가 실제로 throw 되는 경로(assertSameWorkspace fail-closed)는 상위 레이어 테스트에서 이미 커버된다. 분류기 자체는 순수 함수이므로 분리 테스트로 충분하며 통합 테스트 추가 필요 없음.
- 제안: 없음.

### [INFO] 경계값 테스트 — 신규 코드에는 해당 없음
- 위치: `execution-failure-classifier.spec.ts` `extractStatusCode boundary values (W#4)` 섹션
- 상세: 이번 변경은 Set에 문자열 리터럴 하나를 추가하는 것이므로 경계값 테스트 필요 없다. 기존 경계값 테스트(W#4, W#5 섹션)는 이번 변경 후에도 유효하다.
- 제안: 없음.

### [INFO] spec 동반 업데이트 — `chat-channel-adapter.md §3.1` 분류 표 행 수정 포함
- 위치: `spec/conventions/chat-channel-adapter.md` 라인 625
- 상세: 코드 변경과 함께 spec SoT 가 동기화됐다. 분류 표의 internal 행에 `WORKFLOW_FORBIDDEN_WORKSPACE(W-6 워크스페이스 격리 차단)` 가 명시됐다. 이는 테스트가 spec 문서와 drift 없이 일치하도록 보장한다.
- 제안: 없음.

## 요약

이번 변경은 `WORKFLOW_FORBIDDEN_WORKSPACE` 를 `INTERNAL_CODES` Set에 명시 등재하고 이에 대응하는 테스트를 기존 W1 패턴(CODE_MEMORY_LIMIT/HTTP_BLOCKED)과 동일하게 두 개의 it.each 배열에 추가했다. 분류 결과 검증과 warn 로그 비발생 검증 모두 커버되며, 상위 레이어(workflow.handler, execution-engine.service)에서도 에러 생성 경로가 이미 테스트되어 있다. 테스트 격리는 인라인 mockRestore 패턴으로 유지되며 기존 코드와 일관된다. `jest.config.ts` 에 `restoreMocks: true` 가 없어 향후 예외 발생 시 스파이 오염 가능성은 있으나 이번 PR 범위를 벗어난다. 전반적으로 테스트 관점에서 변경의 완성도가 높다.

## 위험도

NONE
