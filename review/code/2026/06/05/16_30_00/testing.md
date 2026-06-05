# Testing Review — information-extractor.memory.spec.ts

**대상**: `git diff 21fa8194..HEAD -- codebase/`  
**신규 파일**: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.memory.spec.ts` (+353 lines)  
**검토일**: 2026-06-05  

---

## CRITICAL

없음.

---

## WARNING

### W1 — `lastExtractionTurnSeq` (watermark) 가 `_resumeState` 에서 살아남는지를 단언하는 핀 없음

- **위치**: `information-extractor.memory.spec.ts:282–331` (A3-style 테스트)
- **상세**: A3 스타일 resume 테스트는 `_resumeState` 에서 `memoryStrategy`, `conversationThreadRef`, `memoryConfig.memoryKey`, `executionId` 를 검증한다. 그런데 **`lastExtractionTurnSeq`(watermark) 가 state 에 실리는지는 전혀 단언하지 않는다.** 핸들러 주석(`handler.ts:164–167`)이 "A3 교훈: 이 필드는 반드시 stateBase → resume state 로 운반돼야 한다"고 명시하고 있으나, 현재 IE 멀티턴에서는 종결 1회 push 구조여서 watermark 는 `buildMultiTurnFinalOutput` 에서만 소비되고 resume 으로 전파되지 않는다. 따라서 현재 구현에서 watermark 가 state 에 없어도 테스트가 통과한다. `ai-agent.memory.spec.ts`(`AGM-08`, `M1`)에 해당하는 증분 watermark 테스트가 IE spec 에는 전무하다. IE 가 미래에 waiting-tick-per-turn extraction(ai_agent 패턴)으로 진화하거나 `lastExtractionTurnSeq` 초기화 버그가 생겼을 때 탐지 불가.
- **제안**: `_resumeState.lastExtractionTurnSeq` 가 `undefined`(또는 숫자)임을 핀한다. 현재 종결 1회 push 구조라면 `state.lastExtractionTurnSeq === undefined`(waiting turn 에서 추출 안 함)를 단언하고, 향후 waiting-tick 추출 패턴 전환 시 증분 watermark 테스트로 교체하는 TODO 코멘트를 남긴다.

### W2 — `scheduleExtraction` 실패 graceful 테스트 누락

- **위치**: `information-extractor.memory.spec.ts` (전체) — 대응 ai-agent 패턴 `ai-agent.memory.spec.ts` 에는 존재
- **상세**: `recall` 실패 graceful 은 single-turn 에 테스트(line 162)가 있다. 그러나 **`scheduleExtraction` 이 throw/reject 했을 때 hot-path 를 차단하지 않는지(응답이 정상 반환되는지)를 확인하는 테스트가 없다.** `buildMultiTurnFinalOutput` 에서 `void scheduleMemoryExtraction(...).catch(() => undefined)` 패턴으로 fire-and-forget 하지만, single-turn 경로(`await scheduleMemoryExtraction`)는 `catch` 가 없어 throw 시 스택이 전파된다. 실제 `scheduleMemoryExtraction` 내부에서 `agentMemoryService.scheduleExtraction` 예외를 catch 하지 않으므로 서비스 레벨 throw 가 single-turn 응답을 깨뜨릴 수 있다.
- **제안**: `memory.scheduleExtraction.mockRejectedValueOnce(new Error('queue full'))` 시나리오로 single-turn persistent 응답이 `port: 'out'` 을 반환하는지 테스트한다.

### W3 — multi-turn manual 완료 시 thread push 가 실제로 일어나지 않는 이유를 잘못 핀하고 있음

- **위치**: `information-extractor.memory.spec.ts:246–248` 주석 및 단언
- **상세**: 주석("only persistent populates [thread holder in] state")은 `conversationThreadRef` 가 persistent 에만 stateBase 에 실린다는 사실을 설명한다. 그러나 **single-turn manual 은 동일한 `pushExtractorTurn(context, config, extracted)` 를 무조건 호출**(`handler.ts:581`)하므로 thread 에 turn 이 쌓인다. single-turn 테스트는 thread push 에 대한 어떤 단언도 없다 — `thread.getThread(context).turns` 를 전혀 확인하지 않아, manual single-turn 이 thread 를 오염시키거나 오히려 push 를 빠뜨려도 탐지되지 않는다.
- **제안**: manual single-turn 성공 케이스에 `expect(thread.getThread(context).turns).toHaveLength(1)` 을 추가해 push 계약을 단언한다(기존 `ai-agent` 패턴과 동일).

---

## INFO

### I1 — `summary_buffer` 부재를 보장하는 음성 테스트(enum 단언) 없음

- **위치**: `information-extractor.memory.spec.ts` (전체); schema: `information-extractor.schema.ts:139`
- **상세**: `z.enum(['manual', 'persistent'])` 가 스키마 SSOT 이므로 `summary_buffer` 가 IE config enum 에 없다는 사실은 타입 시스템이 이미 강제한다. 별도 음성 테스트가 없어도 컴파일러 레벨에서 보호된다. 그러나 **스키마 문서화 목적의 단언**(예: `memoryStrategy` 스키마의 허용 값이 정확히 `['manual', 'persistent']` 임을 단언하는 1-line 테스트)이 있으면 향후 `summary_buffer` 가 오류로 추가됐을 때 즉시 신호를 준다. 필수는 아니나 spec 주석과 테스트 의도 일치를 높인다.
- **제안**: schema unit 테스트(또는 본 파일의 describe 블록 하나)에서 `informationExtractorNodeConfigSchema.shape.memoryStrategy._def.values` 가 `['manual', 'persistent']` 임을 단언한다.

### I2 — recall mock 이 `embedCfgSource` (4번째 인자) 전달 여부를 검증하지 않음

- **위치**: `information-extractor.memory.spec.ts:106–109`
- **상세**: 실제 `AgentMemoryService.recall` 시그니처는 `(workspaceId, scopeKey, queryText, embedCfgSource, opts?)`. 테스트는 `mock.calls[0][0]`(workspaceId)과 `mock.calls[0][1]`(scopeKey)만 단언한다. `embedCfgSource` 에 올바른 `llmConfigId`/`embeddingModel` 이 전달되는지는 검증되지 않는다. mock 반환값이 고정이라 실제 embedding 경로를 전혀 타지 않아도 테스트가 통과한다. 임베딩 모델 불일치가 조용한 실패(0 recall)로 이어지는 실제 위험(handler 주석 참조)에 비해 커버리지가 약하다.
- **제안**: `expect(memory.recall.mock.calls[0][2]).toBeTruthy()` (queryText 비어있지 않음) 및 `expect(memory.recall.mock.calls[0][3]).toMatchObject({ llmConfigId: undefined })` 수준의 단언을 추가한다.

### I3 — cross-workspace 격리 테스트 없음

- **위치**: `information-extractor.memory.spec.ts:145–160` (scope isolation 테스트)
- **상세**: `empty memoryKey falls back to executionId` 테스트는 동일 workspace 내 scope 격리를 검증한다. **두 다른 workspace 의 같은 memoryKey 가 독립 recall/enqueue 를 발행하는지(workspaceId 가 호출 인자에 항상 포함되는지)** 를 확인하는 테스트가 없다. 현재 구현은 `workspaceId` 를 모든 호출에 전달하므로 동작은 올바를 가능성이 높으나, 핀이 없으면 workspaceId 누락 리그레션 탐지가 어렵다.
- **제안**: `ws-2` 로 두 번 실행해 두 recall/enqueue 호출의 `[0][0]` 인자가 각각 올바른 workspaceId 임을 단언하는 테스트를 추가한다.

### I4 — multi-turn `nodeId` 가 `_resumeState` 에 실려야 하는지 단언 없음

- **위치**: `information-extractor.memory.spec.ts:282–307`
- **상세**: A3 테스트는 `state.memoryStrategy`, `state.conversationThreadRef`, `state.memoryConfig.memoryKey`, `state.executionId` 를 검증한다. `state.nodeId` 는 `pushExtractorTurnTo` 에서 NodeRef 구성에 사용되므로(`handler.ts:1204`) 필수 필드이나 단언이 없다.
- **제안**: `expect(state.nodeId).toBe('ie-1')` 를 A3 테스트의 state 단언 블록에 추가한다.

---

## 요약

신규 353-line 스펙은 검토 요청의 6개 축 중 (1) manual 무영향 회귀, (2) A3-style _resumeState 생존(scopeKey 핀), (3) extraction enqueue payload, (4) workspace/scope 격리(단방향), (5) 멀티턴 종결 push + waiting 미push 를 커버하며 기본 계약을 충분히 핀한다. 그러나 **watermark(`lastExtractionTurnSeq`)가 resume state 에 실리는지 단언하는 핀이 없고**, **`scheduleExtraction` 실패 graceful 테스트가 없으며**, **manual single-turn 에서 thread push 계약이 검증되지 않는 점**이 MEDIUM 위험 갭이다. summary_buffer 부재는 타입 시스템이 이미 보호하므로 별도 테스트 필요성은 낮다.

---

## 위험도

**MEDIUM** — CRITICAL 없음. W1(watermark 핀 부재)과 W2(scheduleExtraction graceful 미검증)가 향후 추출 패턴 변경 또는 서비스 throw 시 회귀를 탐지하지 못하는 실질적 위험을 남긴다.

---

BLOCK: NO
