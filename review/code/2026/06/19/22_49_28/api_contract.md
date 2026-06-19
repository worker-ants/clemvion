# API 계약(API Contract) 리뷰

## 발견사항

### [WARNING] 에러 코드 surface 변경 — 기존 클라이언트 영향 가능성
- 위치: `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` `mapSubWorkflowError` + `codebase/backend/src/nodes/core/error-codes.ts`
- 상세: Cross-workspace sub-workflow 호출이 기존에는 `SUB_WORKFLOW_FAILED` 로 fallthrough 되어 클라이언트에게 전달되었으나, 변경 후에는 `WORKFLOW_FORBIDDEN_WORKSPACE` 로 surface 된다. 실행 결과(노드 error port)를 통해 클라이언트(프론트엔드, webhook, API 소비자)가 에러 코드를 직접 파싱하거나 분기하는 경우 기존 `SUB_WORKFLOW_FAILED` 핸들링이 동작하지 않을 수 있다.
- 제안: breaking change 가 맞지만 보안 강화(fail-closed) 목적으로 의도된 변경이므로 CRITICAL 은 아니다. API 변경 이력(changelog) 또는 마이그레이션 가이드에 "Cross-workspace 호출 시 에러 코드가 `SUB_WORKFLOW_FAILED` → `WORKFLOW_FORBIDDEN_WORKSPACE` 로 변경됨" 을 명시할 것을 권장한다. 기존 `SUB_WORKFLOW_FAILED` 를 체크하는 클라이언트 코드가 있다면 업데이트 필요.

### [INFO] `TurnDebugEntry` → `TurnRagDelta` 프론트엔드 타입 rename — 외부 API 계약 영향 없음
- 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts`
- 상세: 프론트엔드 내부 TypeScript 타입명 rename(`TurnDebugEntry` → `TurnRagDelta`)이며 diff 주석에 "외부 type import 0" 으로 명시되어 있다. 백엔드 API 응답 스키마 변경 없음. HTTP 계약 영향 없음.
- 제안: 없음.

### [INFO] `WorkflowForbiddenWorkspaceError` typed error 도입 — 내부 엔진 오류 정형화
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- 상세: 기존 plain `Error` throw 를 typed class 로 교체하는 내부 리팩토링이다. 이 에러는 HTTP 레이어로 직접 전파되지 않고 `mapSubWorkflowError` 를 통해 ErrorCode 로 변환된 후 실행 결과 페이로드에 포함된다. HTTP 상태 코드·응답 구조 자체는 변경 없음.
- 제안: 없음.

### [INFO] `LlmCallRecord[]` 타입 alias 변경 — trace 필드 내부 타입만 변경
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
- 상세: `Array<{ requestPayload; responsePayload; durationMs; startedAt?; finishedAt? }>` 인라인 타입을 공유 `LlmCallRecord[]` 로 교체한 것이다. push site 가 여전히 동일 필드를 공급하므로 실제 직렬화 데이터 구조는 변경 없다. 백엔드 API 응답 JSON shape 변화 없음.
- 제안: 없음.

## 요약

이번 변경은 대부분 내부 실행 엔진 리팩토링(typed error 도입, 공유 타입 통합, 프론트엔드 타입 rename)으로, HTTP API 엔드포인트·요청/응답 스키마·인증·URL 경로 등 외부 API 계약에 직접 영향을 주는 변경은 없다. 단, `mapSubWorkflowError` 함수의 에러 코드 surface 변경(`SUB_WORKFLOW_FAILED` → `WORKFLOW_FORBIDDEN_WORKSPACE`)은 실행 결과 페이로드의 에러 코드 필드 값이 달라지는 behavioral breaking change 로, 이 값을 직접 파싱하는 클라이언트 코드가 존재하면 영향을 받을 수 있다. 보안 강화 목적의 의도된 변경이므로 차단 수준은 아니나 변경 이력 문서화가 권장된다.

## 위험도

LOW
