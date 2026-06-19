# 유지보수성(Maintainability) 리뷰 결과

**리뷰 대상**: C-1 dev 잔꼬리(작업 1b) — WorkflowForbiddenWorkspaceError 타입화, ai-agent LlmCallRecord 통합, frontend TurnRagDelta rename, plan 완료 이동
**리뷰 일시**: 2026-06-19

---

## 발견사항

### [INFO] WorkflowForbiddenWorkspaceError 생성자 — callerWorkspaceId 존재 여부에 따른 조건 분기 메시지 생성
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` L88–93
- 상세: 생성자 내부의 `super(callerWorkspaceId ? ... : ...)` 삼항 메시지 분기는 기능적으로 명확하며 기존 `WorkflowNotFoundError`·`SubWorkflowTimeoutError` 패턴과 일관된다. 단, 두 메시지가 공통 prefix `WORKFLOW_FORBIDDEN_WORKSPACE:` 를 공유하고 suffix 만 다르므로 prefix 상수 추출로 오타 위험을 줄일 수 있다. 현재 규모에서는 INFO 수준이다.
- 제안: 필요 시 파일 상단에 `const FORBIDDEN_WORKSPACE_PREFIX = 'WORKFLOW_FORBIDDEN_WORKSPACE:'` 상수 선언 후 두 메시지에서 재사용. 강제 사항 아님.

### [INFO] workflow.handler.ts — 문자열 중첩 매칭 backstop 와 typed instanceof 분기 병존
- 위치: `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` L270–284
- 상세: `mapSubWorkflowError` 함수에 typed error 분기(`instanceof WorkflowForbiddenWorkspaceError`) 와 message-prefix backstop(`lower.includes('workflow_forbidden_workspace')`) 두 경로가 공존한다. 같은 패턴이 `WorkflowNotFoundError`·`SubWorkflowTimeoutError` 에도 있어 코드베이스 내 일관 패턴이다. 다만, 동일 에러 코드를 두 경로로 반환하는 구조는 "외부 plain Error 경로가 언제 활성화되는지" 를 후속 유지보수자가 파악하기 어렵다.
- 제안: 기존 패턴 일관성 유지 차원에서 현행 구조 수용 가능. 선택적으로 backstop 분기에 in-process executor 도달 불가를 명시한 주석을 현재 L274 수준으로 유지(이미 존재)하면 충분.

### [INFO] ai-agent.handler.ts — 동일 패턴 로컬 변수 선언 두 곳에서 동시 교체
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1488, L2413 (diff 기준)
- 상세: 두 함수 내부의 `llmCalls` 변수 타입이 동일한 인라인 shape 에서 `LlmCallRecord[]` 로 교체됐다. 동일 타입을 두 곳에서 독립 선언한 원래 코드가 중복이었으므로, 이번 변경은 그 중복을 shared type 으로 해소하는 올바른 방향이다. 주석 "all-optional superset 이지만 아래 push site 는 항상 전 필드를 공급한다"가 두 곳에서 동일 문구로 복사 기재된 점은 사소한 중복이다.
- 제안: 두 함수가 같은 역할인지, 또는 하나가 다른 하나의 변형인지 검토해 공통 헬퍼 추출 여부를 장기적으로 고려. 주석은 한 곳에서 한 번 설명하는 형태가 더 간결하지만, 두 함수가 서로 독립된 호출 경로를 가진다면 현행 유지도 무방.

### [INFO] output-shape.ts — TurnDebugEntry → TurnRagDelta 네이밍 개선
- 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts` L307, L312, L321, L323
- 상세: `TurnDebugEntry` 는 실제 내용이 RAG delta(ragSources, ragDiagnostics, turnIndex)이므로 `TurnRagDelta` 로 rename 하는 것이 의도를 명확히 드러낸다. conversation-utils.ts 의 file-private `TurnDebugEntry`(llmCalls/toolCalls canonical) 와의 동명 충돌 해소도 겸한다. 이름이 구조를 설명하게 되어 유지보수성이 향상된다. 변경 범위가 단일 파일 4곳으로 제한적이고, 외부 import 가 없음을 플랜이 명시하고 있어 회귀 위험이 낮다.
- 제안: 변경 방향 적절. 추가 조치 불필요.

### [INFO] error-codes.ts — 블록 주석 스타일 일관성
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` L179–184
- 상세: `WORKFLOW_FORBIDDEN_WORKSPACE` enum 항목 위의 주석이 여러 줄 `//` 스타일로 작성됐다. 동일 파일의 다른 enum 항목들도 동일 스타일을 사용하므로 일관성 측면에서 문제 없다. 주석 내용이 에러 코드의 발생 조건, 관련 함수, spec 참조를 모두 담고 있어 설명이 충분하다.
- 제안: 없음. 기존 컨벤션 준수.

---

## 요약

이번 변경(1b-1 WorkflowForbiddenWorkspaceError 타입화 / 1b-2 LlmCallRecord 통합 / 1b-3 TurnRagDelta rename)은 기존 코드의 중복과 불명확한 이름을 제거하는 작은 리팩토링이다. 세 변경 모두 기존 코드베이스 패턴(WorkflowNotFoundError, SubWorkflowTimeoutError, shared/llm-tracing 분리 등)을 일관되게 따르고 있으며, 새로운 추상화나 복잡도 도입 없이 인라인 타입과 동명 충돌을 해소한다. 함수 길이나 중첩 깊이 문제는 diff 범위 내에 없고, 매직 넘버나 하드코딩된 문자열도 추가되지 않았다. 발견사항은 전부 INFO 수준으로, 기능 정확성과 유지보수성 모두 양호하다.

## 위험도

NONE
