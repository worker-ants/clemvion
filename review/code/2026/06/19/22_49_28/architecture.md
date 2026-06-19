# 아키텍처(Architecture) 리뷰 결과

**대상 변경**: C-1 dev 잔꼬리 (작업 1b) — `WorkflowForbiddenWorkspaceError` typed error 도입, `LlmCallRecord` shared 타입 통합, `TurnDebugEntry` → `TurnRagDelta` rename
**리뷰 일시**: 2026-06-19

---

## 발견사항

### [INFO] WorkflowForbiddenWorkspaceError — 도메인 오류 계층 설계 올바름
- **위치**: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` (신규 클래스)
- **상세**: `Error` 직접 상속 + 구조화된 필드(`targetWorkspaceId`, `callerWorkspaceId?`) 추가 패턴은 기존 `WorkflowNotFoundError` / `SubWorkflowTimeoutError` 와 일관되다. `readonly` 필드로 불변성 보장, `this.name` 설정으로 스택트레이스 식별 가능. 두 케이스(mismatch / 누락)를 단일 클래스의 선택적 인수로 처리해 호출부 복잡도를 낮게 유지했다.
- **제안**: 없음. 기존 도메인 오류 패턴과 완전히 정합.

### [INFO] mapSubWorkflowError — 타입 기반 분기 + 메시지 backstop 이중 방어 구조
- **위치**: `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` L256–284
- **상세**: `instanceof WorkflowForbiddenWorkspaceError` 분기를 먼저 두고, 외부 plain Error 가 도달할 경우를 대비한 메시지 prefix 검사를 backstop 으로 유지하는 구조는 방어적이고 적절하다. 타입 기반 분기가 in-process executor 경로를 커버하고, 메시지 backstop 은 외부/queue layer 경계를 커버하는 명확한 책임 분리다.
- **제안**: 없음.

### [INFO] LlmCallRecord 공유 타입 — shared 레이어 경계 설계
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1489, L2410 (inline 타입 → `shared/llm-tracing/LlmCallRecord` 참조)
- **상세**: 인라인 익명 구조 타입 2곳을 `shared/llm-tracing/llm-call-record` 의 canonical 타입으로 교체하는 것은 DRY 원칙과 단일 진실(SoT) 원칙에 부합한다. `shared/` 레이어가 `nodes/` 레이어에 참조되는 방향성이 레이어 의존 방향과 일치한다.
- **제안**: shared 타입(`LlmCallRecord`)이 all-optional superset 으로 설계되어 push site 에서의 정적 보장이 약화된다. trace/debug 구조에서는 수용 가능하나, 미래에 consumer 가 없어도 되는 필드를 로드할 가능성이 있다. 중기적으로 required subset + optional extension 구분 검토를 권장한다(비차단).

### [INFO] TurnDebugEntry → TurnRagDelta rename — 네이밍 명확성 개선
- **위치**: `codebase/frontend/src/components/editor/run-results/output-shape.ts`
- **상세**: `TurnDebugEntry` 라는 이름이 `conversation-utils.ts` 의 file-private `TurnDebugEntry`(llmCalls/toolCalls)와 충돌하는 동명 이중 정의를 해소한다. `TurnRagDelta` 는 역할(RAG 소스 delta)을 명확히 표현하며 ISP 관점에서도 더 좁은 의미를 정확히 전달한다. 외부 import 가 없으므로 rename 의 파급 범위가 1파일 4곳에 국한되어 리스크가 낮다.
- **제안**: 없음.

### [INFO] 테스트 커버리지 — 두 케이스 모두 단위 검증
- **위치**: `codebase/backend/src/nodes/flow/workflow/workflow.handler.spec.ts` L658–239
- **상세**: mismatch 케이스, 누락(callerWorkspaceId 미공급) 케이스, plain Error backstop 케이스를 각각 독립 테스트로 작성해 세 경로를 모두 검증한다. 계층별 테스트(typed branch / message backstop)가 구현 계층 구조를 그대로 반영하는 좋은 패턴이다.
- **제안**: 없음.

---

## 요약

이번 변경은 세 가지 독립적인 정합 작업으로 구성된다. (1) `assertSameWorkspace` 의 inline generic Error 를 `WorkflowForbiddenWorkspaceError` typed error 로 승격 — 도메인 오류 계층의 일관성을 확보하고 `mapSubWorkflowError` 의 타입 기반 분기를 정확히 연결한다. (2) `ai-agent.handler.ts` inline 익명 타입 2곳을 `shared/llm-tracing/LlmCallRecord` 로 교체 — 레이어 경계를 올바른 방향으로 유지하며 중복 정의를 제거한다. (3) 프론트엔드 `TurnDebugEntry` → `TurnRagDelta` rename — 동명 충돌을 해소하고 타입 의미를 명확히 한다. 세 변경 모두 SOLID 원칙(특히 단일 책임, 인터페이스 분리), 레이어 책임 분리, 모듈 경계 명확성을 강화하는 방향이며, 순환 의존성 도입 없이 기존 아키텍처 패턴과 일관성을 유지한다. 아키텍처 관점에서 신규 위험 요소가 없다.

## 위험도

NONE
