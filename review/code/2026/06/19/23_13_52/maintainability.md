# 유지보수성(Maintainability) 리뷰 결과

**리뷰 대상**: C-1 dev 잔꼬리(작업 1b) — WorkflowForbiddenWorkspaceError 타입화, ai-agent LlmCallRecord 통합, frontend TurnRagDelta rename, plan/review 문서 추가
**리뷰 일시**: 2026-06-19

---

## 발견사항

### [INFO] WorkflowForbiddenWorkspaceError 생성자 — 공통 prefix 상수 미추출
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` L88-93
- 상세: 생성자 `super(...)` 내부의 삼항 분기에서 두 메시지가 모두 `'WORKFLOW_FORBIDDEN_WORKSPACE:'` prefix 를 공유한다. 이 prefix 는 `workflow.handler.ts` 의 backstop(`lower.includes('workflow_forbidden_workspace')`)과 의미적으로 연결되어 있지만 상수로 추출되지 않았다. prefix 에 오타가 생기면 backstop 이 동작하지 않는다. 단일 생성자 안에 집중된 구조라 현재 위험은 낮으나, 향후 메시지 패턴이 증가할 경우 비용이 높아진다.
- 제안: 선택적 개선. `const FORBIDDEN_WORKSPACE_PREFIX = 'WORKFLOW_FORBIDDEN_WORKSPACE:'` 상수 추출 후 생성자에서 재사용. 강제 사항 아님.

### [INFO] workflow.handler.ts mapSubWorkflowError — instanceof 분기와 message backstop 이중 경로 병존
- 위치: `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` L256-284
- 상세: 동일 에러 코드(`WORKFLOW_FORBIDDEN_WORKSPACE`)를 반환하는 경로가 두 개 존재한다 — `instanceof WorkflowForbiddenWorkspaceError` 분기와 `lower.includes('workflow_forbidden_workspace')` backstop. 기존 `WorkflowNotFoundError`·`SubWorkflowTimeoutError` 에도 동일 패턴이 적용되어 코드베이스 내 일관성은 유지된다. 다만 "두 경로 중 어느 쪽이 언제 실행되는가" 를 이해하려면 in-process vs external executor 구분을 알아야 하며, 이 문맥이 없으면 후속 유지보수자가 중복으로 오해하고 제거할 위험이 있다. 현재 L274 인라인 주석("외부 executor 경우의 defensive backstop")이 존재하나 짧다.
- 제안: 현행 구조 수용 가능. 선택적으로 `mapSubWorkflowError` JSDoc 에 "typed branch (instanceof) is the primary path for in-process executors; the message-prefix backstop handles external executors that re-throw as plain Error preserving the WORKFLOW_FORBIDDEN_WORKSPACE prefix" 한 줄 추가 권장.

### [INFO] ai-agent.handler.ts — 동일 주석 문구 두 함수에 복사 기재
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1487-1489, L2407-2410
- 상세: `llmCalls` 변수 선언 바로 위의 인라인 주석이 두 함수에서 동일 문구로 반복된다. 주석 자체의 내용은 정확하나, 동일 설명이 두 곳에 존재하면 나중에 한 곳만 갱신되어 불일치가 생길 수 있다. 두 함수가 독립 호출 경로를 가지므로 이 구조 자체는 수용 가능하다.
- 제안: 향후 `LlmCallRecord` 설계 변경 시 두 곳 모두 갱신해야 한다는 점을 인지. 현행 유지도 무방.

### [INFO] output-shape.ts — TurnRagDelta rename 이력 주석 부재
- 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts` L307-412
- 상세: `TurnDebugEntry` → `TurnRagDelta` rename 이후 인터페이스 JSDoc 에 rename 이력이 기재되지 않았다. `conversation-utils.ts` 의 파일-private `TurnDebugEntry`(llmCalls/toolCalls)와의 충돌 해소가 rename 의 핵심 동기이나, 이를 코드에서 파악하려면 git 이력을 추적해야 한다.
- 제안: 인터페이스 JSDoc 에 "(formerly `TurnDebugEntry` — renamed to disambiguate from the canonical `TurnDebugEntry` in `conversation-utils.ts` which holds llmCalls/toolCalls/totalDurationMs)" 한 줄 추가.

### [INFO] error-codes.ts — 주석 내 surface 경로 기술 stale
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` L61-66
- 상세: `WORKFLOW_FORBIDDEN_WORKSPACE` 항목 위 주석 마지막 줄 "Surfaced at the Sub-Workflow node's error port." 는 이제 `mapSubWorkflowError` typed branch 를 통해 직접 surface 되어 더 이상 `SUB_WORKFLOW_FAILED` 로 fallthrough 하지 않는다는 점을 반영하지 못한다. 기능 정확성과는 무관하지만 독자 오해 가능성이 있다.
- 제안: 주석 마지막 줄을 "Surfaced at the Sub-Workflow node's error port via mapSubWorkflowError typed branch (no longer falls through to SUB_WORKFLOW_FAILED)." 로 보강(선택적).

### [INFO] workflow-errors.ts WorkflowForbiddenWorkspaceError — 생성자 파라미터 의미 미문서화
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` L177-190
- 상세: 클래스 JSDoc 은 동작 조건·spec 참조를 잘 기술하나, 생성자 파라미터 `callerWorkspaceId?` 가 optional 인 의미(undefined = missing context → deny-by-default, 제공 = mismatch)가 문서화되어 있지 않다. 두 케이스가 하나의 생성자에 통합된 이유를 파악하려면 코드를 직접 읽어야 한다.
- 제안: 클래스 JSDoc 또는 생성자 주석에 "If `callerWorkspaceId` is omitted, the error represents a missing-context case (deny-by-default); if provided, it represents a cross-workspace mismatch." 추가(선택적).

---

## 요약

이번 변경(1b-1 WorkflowForbiddenWorkspaceError 타입화 / 1b-2 LlmCallRecord 공유 타입 통합 / 1b-3 TurnRagDelta rename)은 기존 코드의 인라인 타입 중복과 불명확한 이름을 정리하는 소규모 리팩토링이다. 세 변경 모두 기존 코드베이스 패턴(WorkflowNotFoundError 계층, shared/llm-tracing 분리, readonly 필드 불변성 등)을 일관되게 따르며, 새로운 추상화나 복잡도를 도입하지 않는다. 함수 길이·중첩 깊이 문제는 diff 범위 내에 없고, 매직 넘버나 하드코딩된 문자열도 추가되지 않았다. 발견사항 전부가 INFO 수준으로, 기능 정확성과 유지보수성 모두 양호하다. 핵심 관찰은 (1) prefix 상수 미추출로 인한 오타 위험(marginal), (2) mapSubWorkflowError 이중 경로 패턴의 문서화 필요성, (3) TurnRagDelta rename 이력 주석 부재 세 가지이며, 모두 선택적 개선 사항이다.

## 위험도

NONE
