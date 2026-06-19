# Testing Review

## 발견사항

### **[INFO] 신규 shared 모듈(`llm-call-record.ts`)에 대한 직접 단위 테스트 없음**
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/llm-record-types-194991/codebase/backend/src/shared/llm-tracing/llm-call-record.ts`
- 상세: `LlmCallRecord` / `TurnDebugEntry` 는 순수 TypeScript interface 선언이므로 런타임 동작이 없어 독립 테스트가 필수는 아니다. 다만 spec comment 가 "모든 필드 optional — 핸들러가 채울 수 있는 만큼만 채운다" 와 "Information Extractor 는 payload/duration, AI Agent 멀티턴 경로는 startedAt/finishedAt" 를 명시하고 있어, 두 노드 간 필드 채움 계약을 regression-safe 하게 문서화하는 타입 수준 테스트(`satisfies`/`tsd` 등)가 있으면 이상적이다.
- 제안: 이 PR 범위에서 강제할 사항은 아니나, 향후 필드 추가 시 두 노드가 여전히 호환 superset 임을 컴파일 시 보장하는 타입 단언 테스트(`LlmCallRecord satisfies` 패턴) 추가를 고려한다.

### **[INFO] `ai-agent.handler.ts` 는 여전히 인라인 익명 배열 타입을 사용 — 새 공유 타입과 구조적으로만 호환**
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1488–1494, L2413–2419
- 상세: `information-extractor.handler.ts` 와 `ai-conversation-helpers.ts` 는 `LlmCallRecord` / `TurnDebugEntry` 를 shared 모듈에서 import 하도록 마이그레이션됐지만, `ai-agent.handler.ts` 는 동일 shape 를 두 군데에서 inline 익명 타입(`Array<{ requestPayload: unknown; ... }>`)으로 여전히 정의하고 있다. TypeScript 구조적 타이핑으로 현재는 호환되지만, 향후 `LlmCallRecord` 에 필드가 추가될 때 `ai-agent.handler.ts` 가 자동으로 컴파일 오류를 얻지 못해 drift 가 생길 수 있다. 이 PR 의 "단일 진실" 목표가 ai-agent 에 대해서는 완전히 달성되지 않은 상태다.
- 제안: `ai-agent.handler.ts` 의 두 `llmCalls` 배열 선언을 `LlmCallRecord[]` 로 교체하고 shared 모듈을 명시 import 하도록 후속 작업을 추적한다.

### **[INFO] 기존 테스트가 리네임된 타입을 충분히 커버 — 회귀 위험 낮음**
- 위치:
  - `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts` L1016–1354
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` L4800–4802
- 상세: `buildAiMessageDebugFromResumeState` 는 단일 turn, 멀티 turn, llmCalls 없음, null 방어, 얕은 복사 mutation guard 등 여러 시나리오를 검증하는 충분한 단위 테스트를 갖추고 있다. `buildConversationMetaFromResumeState`, `userMessageSignalApplies`, `RehydrationError` 도 유사하게 커버된다. 타입 rename(`AiTurnDebugEntry` → `TurnDebugEntry`, `LlmCallTrace` → `LlmCallRecord`)은 런타임 shape 를 바꾸지 않으므로 기존 테스트가 회귀 방어 역할을 그대로 유지한다.
- 제안: 추가 테스트 불필요.

### **[INFO] IE 핸들러 spec 이 `meta.turnDebug` 배열 내부 shape 를 검증하지 않음**
- 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` L362, L564
- 상세: IE 핸들러 spec 은 `Array.isArray(meta.turnDebug)` 만 확인하고 배열 내 `LlmCallRecord` 요소의 구체 shape(`requestPayload`, `responsePayload`, `durationMs`)는 검증하지 않는다. `buildSingleTurnDebug` 가 shared `TurnDebugEntry` 타입을 사용하게 됐지만, 실제로 올바른 필드가 채워지는지 integration 수준에서 보장하는 테스트가 없다.
- 제안: 단일턴 성공 케이스에서 `meta.turnDebug[0].llmCalls[0]` 의 `requestPayload`, `responsePayload`, `durationMs` 필드를 구체적으로 검증하는 테스트 1건을 추가하면, shared 타입으로 전환 이후 payload 계약을 명시적으로 잠글 수 있다.

## 요약

이번 변경은 `LlmCallRecord` / `TurnDebugEntry` 를 노드별 중복 정의에서 `shared/llm-tracing/llm-call-record.ts` 의 단일 진실로 통합하는 순수 타입 리팩토링이다. 런타임 shape 는 전혀 바뀌지 않으며, 기존 테스트(특히 `ai-turn-orchestrator.service.spec.ts` 의 `buildAiMessageDebugFromResumeState` suite 와 `execution-engine.service.spec.ts`)가 rename 이후에도 동일한 회귀 보호를 제공한다. 주요 미완성은 `ai-agent.handler.ts` 의 인라인 익명 타입이 shared 모듈로 완전히 전환되지 않아 PR goal 이 반쪽만 달성된 점이며, IE 핸들러 spec 이 `turnDebug` 배열의 내부 shape 를 검증하지 않는 것은 낮은 위험 수준의 커버리지 갭이다. 새 공유 모듈 자체는 인터페이스만 export 하므로 독립 단위 테스트는 필수가 아니다.

## 위험도

LOW
