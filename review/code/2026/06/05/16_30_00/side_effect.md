# Side Effect Review — information_extractor persistent memory + multi-turn thread push

**Worktree**: memory-strategy-extend-ad5987  
**Range**: git diff 21fa8194..HEAD -- codebase/  
**Date**: 2026-06-05  
**Reviewer**: side-effect agent

---

## CRITICAL

없음.

---

## WARNING

### WARNING-1: `conversation-context-schema.ts` 공유 헬퍼 주석 — information_extractor 기술 오류 (stale comment)

- **위치**: `/codebase/backend/src/nodes/ai/shared/conversation-context-schema.ts` 14행, 33행
- **상세**: 헬퍼 상단 JSDoc 에 "text_classifier / information_extractor 는 `memoryStrategy` 필드가 없으므로 가드 없이 항상 노출" 이라 기술되어 있으나, 이번 변경으로 information_extractor 에 `memoryStrategy` 필드가 추가되었다. 실제 schema 호출은 `gateOnManualMemoryStrategy: true` 로 정확히 수정되었으므로 런타임 동작에는 영향이 없다. 그러나 주석이 IE 가 이 가드를 쓰지 않는다는 잘못된 사실을 계속 기술하므로, 다음 개발자가 IE 의 contextScope 동작을 혼동할 수 있다.
- **제안**: 해당 헬퍼 주석을 "information_extractor 는 `memoryStrategy` 필드를 가지므로 `gateOnManualMemoryStrategy: true` 로 호출한다" 로 갱신.

### WARNING-2: `buildMultiTurnFinalOutput` 의 `void scheduleMemoryExtraction` — 엔진 동기 호출부와의 fire-and-forget 비대칭

- **위치**: `information-extractor.handler.ts` 1211행
- **상세**: `buildMultiTurnFinalOutput` 은 동기 메서드(`: NodeHandlerOutput` 반환 타입)이며, 엔진이 `endMultiTurnConversation` → `buildMultiTurnFinalOutput` 을 동기 호출 후 즉시 결과를 정규화·캐시 갱신한다. 이 경로에서 `scheduleMemoryExtraction` 은 `void ... .catch(() => undefined)` fire-and-forget 패턴으로 분리된다. enqueue Promise 는 event-loop 의 다음 microtask/macrotask 에서 resolved 되므로, 엔진의 `setStructuredOutput` / `setNodeOutput` 이 완료된 뒤에 비동기 추출이 실행된다. 이는 의도된 설계(hot-path 비차단)이나 다음 부작용이 잠재한다:
  1. **추출 실패 무시**: `.catch(() => undefined)` 로 enqueue 실패(예: DB/큐 연결 에러)가 완전히 삼켜진다. 추출 누락이 로그에도 남지 않는다. 단, `scheduleMemoryExtraction` 내부의 enqueue 실패는 서비스 자체에서 처리한다고 주석으로 기술되어 있으므로 설계 의도이긴 하나, 외부 catch 에서도 warn 로그 없이 억제하는 것은 관측성이 낮다.
  2. **프로세스 종료 타이밍**: 엔진이 response 를 반환한 직후 프로세스가 shutting down 되는 경우(예: 테스트 환경 또는 서버리스 cold-start 종료), fire-and-forget Promise 가 실행되지 않을 수 있다. 이는 ai_agent 의 동일 패턴과 일치하므로 신규 부작용은 아니다.
- **제안**: `.catch(() => undefined)` 를 `.catch((err) => this.logger.warn('IE multi-turn memory extraction enqueue failed (fire-and-forget)', err))` 으로 교체해 추출 누락 관측성을 확보.

---

## INFO

### INFO-1: `memoryStrategy: 'manual'` 기본값 — recall/extract 미호출, messages/결과 불변 (회귀 없음 확인)

- **위치**: `information-extractor.handler.ts` 177행, 251행 (`injectRecallPrefix`, `scheduleMemoryExtraction`)
- **상세**: 두 메서드 모두 첫 번째 조건 `if (args.strategy !== 'persistent' || !this.agentMemoryService) return` 으로 즉시 early-return 한다. single-turn / multi-turn 첫 진입 모두 `memoryStrategy` 기본값이 `'manual'` 이므로 `agentMemoryService` 미주입·미설정 기존 환경에서 동작 변화 없음. 테스트로도 확인됨(`manual (default): recall/extract never invoked`).

### INFO-2: `MultiTurnState` 필드 추가 — 기존 resume 직렬화 영향 없음

- **위치**: `MultiTurnState` 인터페이스 + `hydrateState` 메서드
- **상세**: 신규 필드 5개(`memoryStrategy`, `conversationThreadRef`, `executionId`, `nodeId`, `memoryConfig`, `lastExtractionTurnSeq`)가 모두 optional(`?`)로 선언되었고, `hydrateState` 에서 `as ... | undefined` cast 로 hydrate 된다. 기존 DB 영속 state row 에 해당 키가 없으면 `undefined` 로 처리되어 `manual` 폴백(`?? 'manual'`)이 적용된다. 엔진의 `_resumeState` 직렬화는 단순 JSON pass-through 이므로 구조 변경 없이 호환.

### INFO-3: `conversationThreadRef` state 직렬화 — in-memory 객체 영속 패턴 (ai_agent 동형)

- **위치**: `information-extractor.handler.ts` 710행, `hydrateState` 1829행
- **상세**: `persistent` 전략일 때만 `context.conversationThread` (in-memory object) 를 state 에 실어 DB 에 JSON 직렬화한다. 이 패턴은 ai_agent 의 `conversationThreadRef` (2062행) 와 완전히 동형이며 이미 검증된 방식이다. ConversationThread 는 `turns: ReadonlyArray<ConversationTurn>` 등 JSON-serializable 필드만 갖는다. `manual` 전략에서는 spread conditional `...(memoryStrategy === 'persistent' ? { conversationThreadRef: ... } : {})` 로 해당 필드가 state 에 포함되지 않는다.

### INFO-4: `agentMemoryService` 주입 추가 — 다른 노드/ai_agent 영향 없음

- **위치**: `information-extractor.component.ts` 19행
- **상세**: `HandlerDependencies.agentMemoryService` 는 기존에도 optional 필드(`?:`)로 선언되어 있었고, ai_agent 가 이미 사용 중이다. IE component 에서 `deps.agentMemoryService` 를 추가 소비하는 것은 같은 인스턴스를 공유하는 것이며, 다른 노드 핸들러에는 영향이 없다. text_classifier 는 변경 없음 확인.

### INFO-5: `gateOnManualMemoryStrategy: true` 전달 — contextScope 필드 숨김 부작용

- **위치**: `information-extractor.schema.ts` 868행
- **상세**: 기존 사용자 중 `memoryStrategy` 를 명시하지 않은 경우 기본값 `'manual'` 이므로 contextScope 계열 5필드의 `visibleWhen` 가드가 `manual` 조건을 만족해 그대로 노출된다. UI 동작 변화 없음. `persistent` 로 전환 시 contextScope 필드가 숨겨지는 것은 스펙 의도이며 단방향 opt-in.

### INFO-6: single-turn `scheduleMemoryExtraction` — `await` 사용 (multi-turn fire-and-forget 과 비대칭)

- **위치**: `information-extractor.handler.ts` 585행
- **상세**: single-turn 경로는 `await this.scheduleMemoryExtraction(...)` 으로 enqueue 완료까지 대기한다. multi-turn 종결 경로(`buildMultiTurnFinalOutput`)는 `void ... .catch()` fire-and-forget 을 사용한다. 설계 의도(코드 주석에 "본 메서드는 엔진이 동기 호출 후 즉시 정규화하므로 await 불가")에 의한 의도적 비대칭이다. 다만 single-turn 의 `await` 는 `scheduleExtraction` enqueue 만 기다리는 것(실제 추출 LLM 콜은 비동기 백그라운드)으로, hot-path 비차단 불변식은 유지된다.

---

## 요약

`memoryStrategy: 'manual'`(기본) 경로는 `injectRecallPrefix` / `scheduleMemoryExtraction` 두 메서드 모두 첫 분기에서 즉시 early-return 하므로 recall/extract 미호출, messages 불변, 결과 100% 불변이다 (single+multi-turn 회귀 없음). multi-turn thread push 신규 추가(`buildMultiTurnFinalOutput` 종결 경로)는 `target = threadHolderFromState(state)` 가 `persistent` 전략에서만 non-null 이므로 `manual` 에서는 push 자체가 발생하지 않는다. 엔진 호출 경계에서 `buildMultiTurnFinalOutput` 이 동기 반환을 유지하고 추출 enqueue 만 fire-and-forget 으로 분리한 것은 ai_agent 패턴과 동형이다. `MultiTurnState` 신규 필드는 전부 optional 이므로 기존 resume 직렬화 호환에 문제가 없다. 발견된 실질 위험은 WARNING-2의 fire-and-forget 추출 실패 로그 누락(관측성 저하)과 WARNING-1의 stale 주석 두 건이며, 모두 동작 회귀가 아닌 유지보수성 이슈다.

---

## 위험도

LOW

---

BLOCK: NO
