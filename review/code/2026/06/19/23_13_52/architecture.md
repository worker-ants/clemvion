# 아키텍처(Architecture) 리뷰 결과

**대상 변경**: C-1 dev 잔꼬리 (작업 1b) — WorkflowForbiddenWorkspaceError typed error 도입, LlmCallRecord 공유 타입 통합, TurnDebugEntry→TurnRagDelta rename, spec/plan/review 문서 갱신
**리뷰 일시**: 2026-06-19

---

## 발견사항

### [INFO] WorkflowForbiddenWorkspaceError — 도메인 오류 계층 정합성 확보
- **위치**: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` (신규 클래스)
- **상세**: `Error` 직접 상속 + `readonly targetWorkspaceId`·`callerWorkspaceId?` 구조화 필드 + `this.name` 명시 패턴은 동일 파일의 `WorkflowNotFoundError`·`SubWorkflowTimeoutError` 와 완전히 일관된다. 단일 클래스가 두 케이스(mismatch / caller-context 누락)를 선택적 인수로 흡수해 호출부 분기를 최소화했다. SRP 관점에서 에러 생성 책임이 클래스 내부에 집중된다.
- **제안**: 없음. 기존 도메인 오류 계층 패턴과 완전히 정합.

### [INFO] mapSubWorkflowError — typed 분기 + message backstop 이중 방어 레이어
- **위치**: `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` L256–289
- **상세**: `instanceof WorkflowForbiddenWorkspaceError` 분기가 in-process executor 경로를 처리하고, `lower.includes('workflow_forbidden_workspace')` backstop 이 외부/queue layer 의 plain Error 경로를 방어한다. 책임 분리가 명확하고, `WorkflowNotFoundError`·`SubWorkflowTimeoutError` 에서 이미 확립된 패턴을 일관되게 확장한다. 레이어 경계(execution-engine 모듈 → flow/workflow 핸들러 모듈)를 가로지르는 에러 매핑 책임이 `mapSubWorkflowError` 단일 함수에 집중되어 있어 OCP 관점에서도 새 케이스를 추가하기 용이하다.
- **제안**: 없음.

### [INFO] assertSameWorkspace — inline Error → typed error 승격, 레이어 책임 명확화
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (assertSameWorkspace 메서드)
- **상세**: 기존 `throw new Error('WORKFLOW_FORBIDDEN_WORKSPACE: ...')` 는 에러 분류 정보를 문자열 메시지에만 의존했다. 이번 변경으로 의미론적 타입 정보가 에러 객체에 구조화되어 `mapSubWorkflowError` 가 `instanceof` 기반 타입 분기를 사용할 수 있게 된다. 비즈니스 레이어(execution-engine)에서의 도메인 예외 정의와, 노드 핸들러 레이어에서의 에러 코드 매핑이 각자 책임 범위를 명확히 유지한다.
- **제안**: 없음.

### [INFO] LlmCallRecord 공유 타입 — shared 레이어 의존 방향 준수, DRY 강화
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1489, L2410
- **상세**: `nodes/` 레이어가 `shared/llm-tracing/LlmCallRecord` 를 참조하는 방향성은 레이어 의존 원칙과 일치한다(shared → nodes 역방향 의존 없음). 동일 파일 내 두 함수에 중복 정의되던 인라인 익명 구조 타입을 단일 canonical 타입으로 통합해 DRY 원칙을 강화한다. 단, `LlmCallRecord` 가 all-optional superset(`durationMs?` 등)으로 설계된 점은 push site 정적 계약을 약화시킨다. trace/debug 용도에서는 수용 가능하지만, 향후 consumer 가 추가될 경우 required subset 보장이 없어 런타임 보호가 테스트에 의존하게 된다.
- **제안**: 현 상태 수용 가능(trace 구조 특성). 중기적으로 `LlmCallRecord` 에서 push-guaranteed 필드를 required 서브타입으로 분리하거나, push site 에 `satisfies` 연산자 적용 검토(비차단).

### [INFO] TurnDebugEntry → TurnRagDelta rename — ISP 준수, 명칭 명확성 향상
- **위치**: `codebase/frontend/src/components/editor/run-results/output-shape.ts`
- **상세**: 동명 충돌(`conversation-utils.ts` file-private `TurnDebugEntry` 는 llmCalls/toolCalls/totalDurationMs, `output-shape.ts` exported `TurnDebugEntry` 는 ragSources/ragDiagnostics)을 `TurnRagDelta` 로 rename 해 해소한다. 인터페이스 분리 원칙(ISP) 관점에서 두 타입이 서로 다른 관심사(LLM 실행 trace vs RAG delta)를 담당하므로 명칭 분리가 적절하다. 변경 범위가 단일 파일 4개 참조로 제한되어 파급 영향이 없다.
- **제안**: 없음. rename 방향과 구현이 일치.

### [INFO] WORKFLOW_FORBIDDEN_WORKSPACE enum 등재 — 에러 코드 카탈로그 일관성
- **위치**: `codebase/backend/src/nodes/core/error-codes.ts`
- **상세**: `ErrorCode` const 객체에 신규 항목을 추가하는 것은 개방-폐쇄 원칙(OCP) 관점에서 안전한 확장(additive)이다. 기존 enum 순회 패턴이 있더라도 에러 코드 추가는 해당 패턴의 의도된 적용 범위 내에 있다. 주석에 발생 조건·관련 함수·spec 좌표가 기술되어 있어 모듈 경계 문서화가 충실하다.
- **제안**: 없음.

---

## 요약

이번 변경은 세 가지 독립적인 아키텍처 정합 작업으로 구성된다. (1) `assertSameWorkspace` 의 inline generic Error 를 `WorkflowForbiddenWorkspaceError` typed error 로 승격 — 도메인 오류 계층의 단일 책임 원칙을 강화하고 `mapSubWorkflowError` 의 타입 기반 분기(typed branch + message backstop 이중 방어)를 정확히 연결한다. (2) `ai-agent.handler.ts` 인라인 익명 타입 2곳을 `shared/llm-tracing/LlmCallRecord` 로 교체 — 올바른 레이어 의존 방향을 유지하며 중복 정의를 제거한다(all-optional superset 설계는 수용 가능한 트레이드오프). (3) 프론트엔드 `TurnDebugEntry` → `TurnRagDelta` rename — 동명 충돌을 해소하고 ISP 관점에서 두 관심사를 명확히 분리한다. 세 변경 모두 SOLID 원칙 준수, 레이어 책임 분리, 기존 아키텍처 패턴 일관성 강화 방향이며, 순환 의존성 도입 없이 모듈 경계를 명확히 한다. 신규 아키텍처 위험 요소가 없다.

---

## 위험도

NONE
