# 요구사항(Requirement) Review

## 발견사항

### [INFO] WORKFLOW_FORBIDDEN_WORKSPACE 가 SUB_WORKFLOW_FAILED 와 동일 그룹으로 분류된 근거 명확성
- 위치: `execution-failure-classifier.ts` `INTERNAL_CODES` Set (추가된 라인)
- 상세: `WORKFLOW_FORBIDDEN_WORKSPACE` 는 sub-workflow error-port 의 전용 surface 코드 (spec `4-nodes/2-flow/1-workflow.md §6` 표 명시)로, `SUB_WORKFLOW_FAILED` 와 동일한 `executionFailedInternal` 분류가 적절하다. 차단은 내부 격리 정책 결정이지 third-party 실패가 아니므로 분류 방향이 올바르다. 인접 코드 `HTTP_BLOCKED`(SSRF 차단) 와 동일 패턴.
- 제안: 현행 유지.

### [INFO] spec/conventions/chat-channel-adapter.md §3.1 내부 카테고리 행 동기화 완료
- 위치: `spec/conventions/chat-channel-adapter.md` line 388 (워크트리 버전)
- 상세: 변경 후 해당 행이 `WORKFLOW_FORBIDDEN_WORKSPACE(W-6 워크스페이스 격리 차단)` 를 `SUB_WORKFLOW_FAILED` 뒤에 명시하고 있어 코드 구현(`INTERNAL_CODES` Set)과 일치한다. spec `5-system/3-error-handling.md` 의 sub-workflow 그룹 표 및 `4-nodes/2-flow/1-workflow.md §6` 에도 `WORKFLOW_FORBIDDEN_WORKSPACE` 가 이미 등재돼 있어 삼각 일치가 확인된다.
- 제안: 현행 유지.

### [INFO] 테스트 커버리지 — "no CCH-ERR-04 warn" 테스트에 WORKFLOW_FORBIDDEN_WORKSPACE 추가
- 위치: `execution-failure-classifier.spec.ts` lines 197-210
- 상세: 기존 `CODE_MEMORY_LIMIT`, `HTTP_BLOCKED`, `DB_HOST_BLOCKED` 와 동일한 패턴으로 warn spy 를 통해 CCH-ERR-04 unknown-fallback 경고가 발생하지 않음을 검증한다. `INTERNAL_CODES.has('WORKFLOW_FORBIDDEN_WORKSPACE')` 가 `true` 이므로 unknown-fallback 분기로 떨어지지 않는 것이 보장된다. 두 곳(일반 internal 배열 + no-warn 배열)에 모두 추가된 것도 기존 W1 패턴과 일치.
- 제안: 현행 유지.

### [INFO] EiaFailedEvent 타입 — error.code 가 runtime 에서 WORKFLOW_FORBIDDEN_WORKSPACE 로 도달하는 경로 확인
- 위치: `execution-failure-classifier.ts` (런타임 진입 경로)
- 상세: `workflow.handler.ts` 의 `mapSubWorkflowError` 가 `WorkflowForbiddenWorkspaceError` → `ErrorCode.WORKFLOW_FORBIDDEN_WORKSPACE` 로 매핑하고 error-port 에 surface 한다 (codebase 확인). EIA `execution.failed` payload 의 `error.code` 필드로 전달된다. 분류기가 이 코드를 수신하는 경로는 실제 구현에서 닫혀 있다.
- 제안: 현행 유지.

## 요약

이번 변경은 기능적으로 이미 internal로 분류되던 `WORKFLOW_FORBIDDEN_WORKSPACE` 코드를 `INTERNAL_CODES` Set에 명시 등재하여 CCH-ERR-04 unknown-fallback warn 노이즈를 제거하고 spec §3.1 매핑 표와 동기화하는 단순 명시화 작업이다. 코드 구현, 테스트, spec 세 곳 모두 일관되게 반영되었으며, `WORKFLOW_FORBIDDEN_WORKSPACE` 의 정의와 분류 근거가 관련 spec 문서들(4-nodes/2-flow/1-workflow.md §6, 5-system/3-error-handling.md, conventions/chat-channel-adapter.md §3.1)과 line-level로 일치한다. 기존 W1 패턴(CODE_MEMORY_LIMIT/HTTP_BLOCKED)을 정확히 복제하였으며, 엣지 케이스 처리, 반환값, 에러 시나리오, 입력 유효성 등 모든 요구사항 항목이 충족된다.

## 위험도

NONE
