# 신규 식별자 충돌 검토 결과

**검토 대상**: `spec/5-system/4-execution-engine.md` (구현 완료 후 검토)
**diff base**: `claude/engine-split-s1-nodebootstrap`
**신규 파일**: 3개
- `codebase/backend/src/modules/execution-engine/ai-conversation-helpers.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts`

---

## 발견사항

- **[WARNING]** `LlmCallRecord` vs 기존 `LlmCallTrace` — 유사한 역할의 중복 타입
  - target 신규 식별자: `interface LlmCallRecord` (`ai-conversation-helpers.ts:102`)
  - 기존 사용처: `interface LlmCallTrace` (`codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:74`)
  - 상세: 두 인터페이스는 "단일 LLM 호출의 request/response/latency 기록"으로 동일한 도메인 역할을 수행한다. `LlmCallTrace`는 `{ requestPayload: unknown; responsePayload: unknown; durationMs: number; }` (모든 필드 필수)로 정의되어 있고, 신규 `LlmCallRecord`는 `{ requestPayload?: unknown; responsePayload?: unknown; durationMs?: number; startedAt?: string; finishedAt?: string; }` (모든 필드 선택)로 정의된다. 의미적으로 동형이나 이름이 달라 `ai-agent.handler.ts`의 인라인 익명 객체 배열(`llmCalls: Array<{...}>`)까지 포함하면 같은 shape를 세 곳에서 독립 정의하는 구조가 된다. 주석에 "Mirrors `LlmCallTrace` defined in the AI handlers"라고 명시되어 있어 의도적 분리임을 알 수 있으나, 혼동 가능한 이름 분기다.
  - 제안: 공유 타입을 `codebase/backend/src/nodes/ai/shared/` 또는 `codebase/backend/src/shared/` 경로에 단일 export로 정의하고 두 곳에서 import하거나, 최소한 `LlmCallRecord`를 `LlmCallTrace`로 이름을 통일하거나 `LlmCallTrace` → `LlmCallRecord`로 rename 마이그레이션을 계획한다.

- **[WARNING]** `AiTurnDebugEntry` vs 기존 `TurnDebugEntry` — 유사한 역할의 중복 타입
  - target 신규 식별자: `interface AiTurnDebugEntry` (`ai-conversation-helpers.ts:115`)
  - 기존 사용처: `interface TurnDebugEntry` (`codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:80`)
  - 상세: 둘 다 "한 turn 의 디버그 기록 항목 (`turnIndex`, `llmCalls[]`, `totalDurationMs`)"을 표현한다. `TurnDebugEntry`는 필드가 모두 필수이고 `llmCalls: LlmCallTrace[]`를 참조하며, `AiTurnDebugEntry`는 필드가 선택적이고 `llmCalls?: LlmCallRecord[]`를 참조한다. 두 타입이 직렬화된 `turnDebugHistory` 배열의 원소 shape를 정의하므로 런타임에서 동일한 JSONB 데이터를 서로 다른 타입으로 역직렬화할 가능성이 있다.
  - 제안: `LlmCallRecord`·`AiTurnDebugEntry`를 별도 공유 모듈로 승격하고 `information-extractor.handler.ts`가 동일 타입을 import하도록 정리하거나, 기존 `TurnDebugEntry`와 `LlmCallTrace`를 확장(`& { startedAt?: string; finishedAt?: string }`)해 단일 타입으로 통합한다.

- **[INFO]** `RehydrationError` 정의 위치 — `ai-conversation-helpers.ts`에 위치하나 엔진 전반이 사용
  - target 신규 식별자: `export class RehydrationError extends Error` (`ai-conversation-helpers.ts:34`)
  - 기존 사용처: `execution-engine.service.ts` 전역에서 28회 이상 throw/catch, `workflow-errors.ts:81` 주석에서 참조
  - 상세: `workflow-errors.ts`는 이미 `ExecutionError`, `WorkflowNotFoundError`, `SubWorkflowTimeoutError`, `ExecutionTimeLimitError` 등 엔진 전반 에러를 집중 정의한 파일이다. `RehydrationError`만 `ai-conversation-helpers.ts`에 위치하여 에러 타입의 단일 집결점 컨벤션과 맞지 않는다. 기능상 충돌은 없으나 일관성 저하.
  - 제안: `RehydrationError`를 `workflow-errors.ts`로 이동하거나, 현재 위치를 유지한다면 `workflow-errors.ts`에 re-export를 추가해 에러 타입 일괄 import 경로를 통일한다.

- **[INFO]** `LlmCallRecord.startedAt/finishedAt` — `LlmCallTrace`에는 없는 추가 필드
  - target 신규 식별자: `startedAt?: string; finishedAt?: string` in `LlmCallRecord` (`ai-conversation-helpers.ts:108-109`)
  - 기존 사용처: `information-extractor.handler.ts`의 `LlmCallTrace`에는 이 두 필드가 없다. `ai-agent.handler.ts`의 익명 인라인 타입에는 `startedAt?/finishedAt?`이 포함되어 있어 (`ai-agent.handler.ts:1491-1493`), information-extractor의 `LlmCallTrace`만 이 필드를 누락한 상태.
  - 상세: 런타임 데이터는 동일한 `turnDebugHistory` JSONB 구조를 공유하는데 타입 정의가 다르므로, information-extractor에서 생성한 항목을 `LlmCallRecord`로 역직렬화하면 `startedAt/finishedAt`은 optional이라 문제없지만 타입 불일치 인식이 어려워진다.
  - 제안: information-extractor의 `LlmCallTrace`에도 `startedAt?/finishedAt?` 필드를 추가하거나, 공통 타입으로 통합할 때 함께 처리한다.

---

## 요약

이번 diff는 3개의 신규 파일(`ai-conversation-helpers.ts`, `ai-turn-orchestrator.service.ts`, `ai-turn-orchestrator.service.spec.ts`)을 추가하며, 이 중 핵심 식별자 충돌은 **type 레벨의 중복 정의** 2건이다. `LlmCallRecord`와 `AiTurnDebugEntry`는 기존 `information-extractor.handler.ts`의 `LlmCallTrace`, `TurnDebugEntry`와 동일 도메인 역할을 수행하는 private 인터페이스들로, 의도적으로 분리되었음을 주석(`"Mirrors LlmCallTrace"`)으로 밝히고 있어 런타임 오작동은 없다. 그러나 같은 JSONB shape를 다른 이름의 타입으로 두 곳에서 병렬 관리하면 향후 필드 추가 시 한쪽만 갱신되는 drift가 발생할 위험이 있다. `RehydrationError`의 배치 위치는 기존 `workflow-errors.ts` 컨벤션과 어긋나는 INFO 수준 사항이다. API endpoint·이벤트명·환경변수·요구사항 ID·파일 경로 충돌은 발견되지 않았다.

---

## 위험도

LOW
