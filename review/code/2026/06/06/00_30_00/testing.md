# Testing Review — memory-internals-refactor (2b793ffa..HEAD)

## 발견사항

### WARNING: resolveMemoryTtlDays — 공유 승격 후 직접 단독 테스트 없음
- **위치**: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts:134` (export), `codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts` 전체
- **상세**: `resolveMemoryTtlDays`는 공유 순수 함수로 승격·export 됐으나, `agent-memory-injection.spec.ts`에 직접 `describe` / `it` 블록이 없다. 현재는 `ai-agent.memory.spec.ts:1185` 의 `W7` 케이스에서 핸들러 경유 간접 커버만 된다 (입력 `memoryTtlDays: raw`를 `handler.execute`로 흘려 `scheduleExtraction` 호출 인자의 `ttlDays`를 검증). 공유 헬퍼 승격의 목적이 두 핸들러가 동일 코드를 쓰는 것임을 감안하면, 공유 모듈 자체에 경계값 테스트(0, -5, NaN, 문자열, 1.7, 90)가 있어야 IE 쪽 회귀도 별도 핸들러 테스트 없이 커버된다.
- **제안**: `agent-memory-injection.spec.ts`에 `describe('resolveMemoryTtlDays')` 블록을 추가해 순수 함수 경계값을 직접 단독 검증. 현재 `W7` 케이스의 커버리지는 유효하지만 간접 경유이므로 핸들러 변경 시 부러지는 coupling이 있다.

### WARNING: scheduleMemoryExtraction — 공유 헬퍼 직접 테스트 완전 부재
- **위치**: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts:601` (export scheduleMemoryExtraction), `agent-memory-injection.spec.ts` 전체
- **상세**: `scheduleMemoryExtraction`은 이번 리팩토링의 핵심 추출 대상이며 deps 객체(`AgentMemoryScheduler`, `ConversationThreadReader`) + args 객체를 받는 순수-의존성-주입 설계로 테스트 용이성이 높다. 그러나 `agent-memory-injection.spec.ts`에 단 한 개의 케이스도 없다. 현재 커버리지는 `ai-agent.memory.spec.ts` / `information-extractor.memory.spec.ts`에서 각 핸들러를 통한 간접 커버뿐이다. 공유 승격의 취지는 ai_agent·IE 두 핸들러 모두에 동일 로직이 적용됨을 단일 소스로 보장하는 것인데, 이것이 공유 레벨에서 직접 검증되지 않는다.
- **검증 갭 목록** (직접 테스트 없는 케이스):
  - `strategy !== 'persistent'` → prevWatermark 반환 (no-op)
  - `agentMemoryService` 미주입 → no-op
  - `conversationThreadService` / `target` 없음 → no-op
  - fresh.length === 0 (신규 turn 0개) → prevWatermark 유지 (M1)
  - `enqueued === false` → watermark 미전진 (M1 dedup 경로)
  - watermark 갱신: `maxSeq` 계산 정확성
- **제안**: `describe('scheduleMemoryExtraction')` 블록을 `agent-memory-injection.spec.ts`에 추가. mock `AgentMemoryScheduler` / `ConversationThreadReader` 주입으로 완전 격리 테스트 가능. 핸들러 수준의 memory.spec.ts 케이스는 integration 커버로 유지하고 이를 unit 핀으로 보완.

### WARNING: buildAgentMemorySchemaFields — 공유 빌더 직접 테스트 없음, IE 측 schema 필드 커버리지 0
- **위치**: `codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts:81` (export), `codebase/backend/src/nodes/ai/information-extractor/information-extractor.schema.spec.ts` 전체
- **상세**: `buildAgentMemorySchemaFields`는 새로 추출된 공유 빌더다. ai-agent 측 테스트(`ai-agent.schema.spec.ts`)는 schema에 메모리 필드가 올바르게 존재하는지(memoryStrategy, memoryTokenBudget, memoryKey, memoryTopK, memoryThreshold)를 검증하지만, IE 측 `information-extractor.schema.spec.ts`에는 memory 관련 테스트가 전혀 없다. IE는 `summary_buffer` 전략이 없고 `memoryTokenBudget`/`summaryModel`이 미방출(tokenBudgetOrder/summaryModelOrder 미전달)되어야 하는데, 이 차이가 schema 수준에서 검증되지 않는다.
- **추가 갭**: `ai-agent.schema.spec.ts`에도 `extractionModel`, `embeddingModel`, `summaryModel`, `memoryTtlDays` 필드의 JSON Schema 직렬화(visibleWhen, group, widget 등)를 검증하는 케이스가 없다. `buildAgentMemorySchemaFields`는 이 필드들의 단일 진실(SoT)이지만 결과를 snapshot 또는 toMatchObject로 핀하는 테스트가 없어 빌더 변경 시 silent regression 위험이 있다.
- **제안**:
  1. `information-extractor.schema.spec.ts`에 메모리 필드 테스트 추가: IE는 `summary_buffer` 전략이 없고 `memoryTokenBudget`/`summaryModel`이 없음을 JSON Schema로 검증.
  2. `ai-agent.schema.spec.ts`에 `extractionModel`, `embeddingModel`, `summaryModel`, `memoryTtlDays`의 `ui.visibleWhen`/`ui.group` 검증 추가.
  3. 또는 `agent-memory-schema.ts`에 별도 spec 파일을 두어 빌더 직접 테스트.

### WARNING: ai_agent / IE schema 동치(equivalence) — JSON Schema snapshot 없음
- **위치**: `codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts` (공유 빌더), 두 노드 schema spec 파일
- **상세**: 리팩토링의 명시 목표는 "방출되는 필드 객체의 키 순서·meta 내용은 종전 인라인 정의와 100% 동일하다"이다. 이를 보장하는 자동화된 회귀 핀이 없다. 현재 검증 방법은 커밋 메시지에 적힌 "z.toJSONSchema 산출 diff 로 검증"(수작업)뿐이고, 이후 `buildAgentMemorySchemaFields`나 `buildConversationContextSchemaFields`가 변경될 때 자동으로 탐지되는 메커니즘이 없다.
- **제안**: `ai-agent.schema.spec.ts`와 `information-extractor.schema.spec.ts` 각각에 `z.toJSONSchema(configSchema).properties`를 `toMatchSnapshot()` 또는 `toStrictEqual(expectedMemoryFields)`로 핀하는 1개 케이스 추가. 특히 두 노드가 공통으로 갖는 필드(`memoryKey`, `memoryTopK`, `memoryThreshold`, `memoryTtlDays`, `embeddingModel`, `extractionModel`)의 label/widget/hint/visibleWhen가 동일한지, IE에는 없어야 하는 `memoryTokenBudget`/`summaryModel`이 실제로 없는지를 assert.

### INFO: mapTailToChatMessages — 직접 단독 테스트 없음 (간접 커버)
- **위치**: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts:495`
- **상세**: `mapTailToChatMessages`는 6개 source 타입(presentation_user, ai_user, ai_assistant, ai_tool, system, default)을 ChatMessage role로 변환하는 함수다. spec 파일에 직접 테스트가 없고 핸들러 통합 테스트에서 간접 커버된다. `ai_tool` source(toolCallId 전파)와 `system` source 경로는 핸들러 테스트에서도 거의 커버되지 않을 가능성이 있다.
- **제안**: 6개 source 케이스 + toolCalls 전파 + toolCallId 전파를 커버하는 `describe('mapTailToChatMessages')` 블록 추가 권장. 우선순위는 WARNING 항목들보다 낮음.

### INFO: wrapMemoryContent — 이미 W-2 describe에서 간접 커버
- **위치**: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts:178`, spec:415-448
- **상세**: `wrapMemoryContent`는 export되어 있으나 직접 `describe('wrapMemoryContent')`가 없다. W-2 섹션의 `buildRecallBlock` / `buildSummaryBlock` escape 테스트에서 `[/memory]` 카운트 방식으로 효과를 검증한다. 빈 문자열 입력에 대한 early return(`if (!text) return text`) 분기는 직접 테스트되지 않는다. 위험도는 낮으나 pure 함수이므로 직접 단독 테스트로 보완 가능.

### INFO: 이동된 spec 파일의 new location 정상 경로 확인
- **위치**: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts:14`
- **상세**: import `from './agent-memory-injection'`로 새 위치에서 상대 경로가 올바르게 갱신됐다. Jest testRegex `.*\\.spec\\.ts$` 패턴에 포함되므로 런타임 pickup에 문제 없다. 파일 내용은 100% rename (bc726b4d) 후 3줄 추가(`estimateTokensLanguageAware` 경계 케이스 — 36c2d1fe)이며, 기존 966개 테스트 케이스가 그대로 보존된다.

### INFO: ai-agent.memory.spec.ts 기존 테스트 회귀 가능성 — handler 위임 경로 확인
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.memory.spec.ts:1185` (W7), `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
- **상세**: `W7` 케이스는 `resolveMemoryTtlDays` 로직을 핸들러 경유로 검증하는데, 핸들러가 이제 `private resolveMemoryTtlDays`를 제거하고 `sharedScheduleMemoryExtraction`에 위임한다. `sharedScheduleMemoryExtraction` 내부에서 `resolveMemoryTtlDays(args.config.memoryTtlDays)`를 호출하므로 W7 케이스는 새 경로에서도 동일하게 통과한다. 회귀 위험 없음. (확인 완료)

## 요약

이번 리팩토링(behavior-preserving)에서 `agent-memory-injection.spec.ts`의 이동은 정상적이며 기존 테스트 케이스가 새 위치에서 그대로 동작한다. 그러나 공유 승격된 세 헬퍼(`resolveMemoryTtlDays`, `scheduleMemoryExtraction`, `buildAgentMemorySchemaFields`)는 공유 모듈 레벨의 직접 단독 테스트가 없고 핸들러 경유 간접 커버에만 의존하고 있어, 이 헬퍼들을 향후 수정할 때 회귀를 즉시 포착하기 어렵다. 특히 `scheduleMemoryExtraction`은 M1 watermark 정확성·dedup no-op·graceful no-op 등 중요한 계약을 가진 함수임에도 공유 레벨 테스트가 0개다. IE schema의 memory 필드 커버리지 완전 부재도 `buildAgentMemorySchemaFields`의 공유 빌더 계약(IE에 tokenBudget/summaryModel 미방출)을 자동으로 검증하지 않는다는 점에서 취약하다. 기존 ai-agent/IE handler 회귀 케이스는 0 — 동작 불변 리팩토링 목표는 테스트 관점에서 충족됐다.

## 위험도
MEDIUM

---
BLOCK: NO
