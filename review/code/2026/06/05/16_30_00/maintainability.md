# 유지보수성 코드 리뷰 — information_extractor persistent memory (+380줄)

**대상**: `git diff 21fa8194..HEAD -- codebase/`  
**날짜**: 2026-06-05  
**리뷰어 관점**: 유지보수성 (가독성 · 네이밍 · 함수 분해 · 중복 · 복잡도)

---

## CRITICAL

없음.

---

## WARNING

### W-1 `resolveMemoryTtlDays` 완전 복제 — ai_agent ↔ IE 로직 드리프트 위험

- **위치**: `information-extractor.handler.ts` L410–418 vs `ai-agent.handler.ts` L1039–1047
- **상세**: `resolveMemoryTtlDays` 메서드 구현이 두 핸들러 클래스에 **바이트 동일**하게 존재한다. 지금은 일치하지만 하나만 수정되면 동작이 갈라진다. 동일 로직이 세 개 파일에 있다(IE handler, AI Agent handler, 공유 유틸이 없는 상태).
- **제안**: `codebase/backend/src/nodes/ai/shared/memory-utils.ts` 같은 공유 모듈로 추출하거나, `DEFAULT_MEMORY_TOP_K` / `DEFAULT_MEMORY_THRESHOLD` 처럼 `ai-agent.schema.ts` 내 헬퍼로 export. 최소한 두 파일이 같은 소스를 import 하도록 한다.

### W-2 `scheduleMemoryExtraction` 두 클래스에 분리 구현 — 구조적 중복

- **위치**: `information-extractor.handler.ts` L348–403 vs `ai-agent.handler.ts` L950–1033
- **상세**: 워터마크 전진(M1), `resolveScopeKey`, `getThread` → `fresh.filter`, shallow-copy snapshot, `scheduleExtraction` 호출, return-on-no-enqueue 패턴이 거의 동일하다. IE 버전에는 ai_agent 에 없는 `selfNodeId` 인자가 없어서 차이는 그것 하나뿐이다. 약 50라인의 실질적 중복. 주석도 "ai_agent `scheduleMemoryExtraction` 모방"이라고 직접 밝히고 있다.
- **제안**: 공유 헬퍼 함수(`scheduleMemoryExtractionImpl` 등)로 추출하고 두 핸들러가 호출하도록 리팩터. 아니면 `agent-memory-injection.ts` 에 top-level 함수로 추가(이 파일은 이미 두 핸들러가 import 중).

### W-3 `injectRecallPrefix` 내 인라인 verbose 타입 — `RecalledMemory[]` 대신 사용

- **위치**: `information-extractor.handler.ts` L305–309
- **상세**: 
  ```typescript
  let recalled: Awaited<ReturnType<
    import('../../../modules/agent-memory/agent-memory.service').AgentMemoryService['recall']
  >> = [];
  ```
  `agent-memory.service.ts`에 `RecalledMemory` 인터페이스가 이미 export되어 있고 ai-agent 핸들러는 `import(...).RecalledMemory[]`를 쓴다. IE 핸들러는 더 장황한 `Awaited<ReturnType<...>>` 형식을 쓴다. 두 파일의 스타일이 불일치하며 읽기 어렵다.
- **제안**: `RecalledMemory` 를 named import 하거나 최소한 ai-agent 핸들러와 동일한 `import(...).RecalledMemory[]` 패턴을 사용.

### W-4 `memoryConfig` 타입이 `Record<string, unknown>` — 구조 불투명

- **위치**: `information-extractor.handler.ts` L158, `MultiTurnState` 인터페이스
- **상세**: `memoryConfig?: Record<string, unknown>`은 실제로 `memoryKey, llmConfigId, model, extractionModel, embeddingModel, memoryTtlDays` 6개 필드만 담는 고정 구조다. ai_agent 핸들러는 이 패턴을 쓰지 않고 각 필드를 state 최상위에 직접 놓는다(`config.memoryKey as string | undefined` 형태로 꺼냄). `Record<string, unknown>`으로 타입을 지운 채 state에 직렬화하면 소비 지점(`state.memoryConfig ?? {}`)에서 매번 `as` 캐스팅이 필요하고 필드 누락이 컴파일 타임에 잡히지 않는다.
- **제안**: `interface MemoryConfigSnapshot { memoryKey?: string; llmConfigId?: string; model?: string; ... }` 정의 후 사용. 또는 ai_agent 처럼 필드를 state 최상위에 직접 추가.

---

## INFO

### I-1 `injectRecallPrefix` 두 호출 지점의 recall 패턴 완전 중복

- **위치**: `information-extractor.handler.ts` L499–515 (single-turn), L772–786 (multi-turn 첫 진입)
- **상세**: `recalledSystemContent` 추출 → `injectRecallPrefix` 호출 → `recall.recalledCount > 0`이면 `messages.map` 패턴이 두 곳에서 완전히 동일하다(12라인 × 2). 두 경로 모두 `strategy`, `config`, `workspaceId`, `executionId`, `queryText`를 받는 상황도 동일하다. 현재는 동작 상 문제 없지만 recall 정책 변경(예: `recalledCount === 0`에도 적용)시 두 곳을 동시에 수정해야 한다.
- **제안**: `applyRecallToMessages(messages, recall)` 헬퍼로 분리.

### I-2 `pushExtractorTurn` / `pushExtractorTurnTo` 두 메서드 분리 필요성

- **위치**: `information-extractor.handler.ts` L213–247
- **상세**: `pushExtractorTurn`은 `pushExtractorTurnTo`의 thin wrapper다. `pushExtractorTurn`은 사실상 `context`에서 `nodeId`, `config`를 추출해 `pushExtractorTurnTo`에 넘기는 역할뿐이다. 단순 리다이렉션을 위한 두 개의 메서드 존재는 최소한이지만, 이름이 너무 유사(`pushExtractorTurn` vs `pushExtractorTurnTo`)해 호출자 입장에서 어느 쪽을 써야 하는지 즉각적이지 않다.
- **제안**: `pushExtractorTurnTo`에 `context: ExecutionContext` 오버로드를 추가하거나 단일 메서드로 통합하는 방향 검토.

### I-3 `stateBase` persistent 분기 spread — 조건부 필드 7개가 한 블록에

- **위치**: `information-extractor.handler.ts` L710–725
- **상세**: `...(memoryStrategy === 'persistent' ? { conversationThreadRef, executionId, nodeId, memoryConfig: { ... } } : {})` 패턴은 ai_agent 에는 없는 IE 고유 패턴이다. 7개 필드가 조건부로 들어가는 삼항 spread는 `stateBase` 구조를 한눈에 읽기 어렵게 만든다.
- **제안**: `buildPersistentStateFields(memoryStrategy, context, config)` 헬퍼로 추출하거나, `stateBase` 객체를 먼저 만들고 persistent면 Object.assign으로 보강하는 두 단계 패턴.

### I-4 `maxRetries = 2` 매직 넘버 (single-turn)

- **위치**: `information-extractor.handler.ts` L518
- **상세**: `const maxRetries = 2` — 상수 이름 없이 인라인 리터럴. 이 값은 이번 변경에서 추가된 것은 아니지만, 새 메모리 경로를 추가하는 김에 지적. 동일 파일의 `FINALIZE_TOOL_NAME` 같은 상수로 관리하는 것이 일관적이다.
- **제안**: `const SINGLE_TURN_MAX_RETRIES = 2` 상수로 추출.

### I-5 `order: 14` 소수점 값 사용 (14, 14.5, 14.6, 14.7)

- **위치**: `information-extractor.schema.ts` L196, L211, L229, L243
- **상세**: `memoryThreshold`가 `order: 14`이고, 이후 3개 필드가 14.5, 14.6, 14.7을 사용한다. 소수점 order는 나중에 새 필드를 삽입할 때 14.1~14.4 사이에 넣어야 하는 제약이 생긴다. ai_agent 스키마는 5 단위 정수 간격(44, 45, 46, 47, 48, 49, 49.5)을 사용한다. 15 단위로 처음부터 조정했으면 삽입 여지가 더 크다.
- **제안**: 현재는 기능에 영향 없으나, 다음 필드 추가 시 15, 16, 17, 18로 간격 재조정 검토.

### I-6 `MultiTurnState` 필드 7개 추가 — 인라인 `import()` 타입 참조 2건

- **위치**: `information-extractor.handler.ts` L144, L476
- **상세**: `conversationThreadRef?: import('../../../shared/...').ConversationThread` 타입이 인터페이스 선언 본문과 `hydrateState` 내에서 인라인 `import()`로 참조된다. 파일 상단에 ai_agent 핸들러처럼 named import로 올리면 IDE 탐색과 리팩터가 용이해진다.
- **제안**: `import type { ConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';` 파일 상단에 추가.

---

## 요약

이번 변경(+380줄)은 `ai_agent` 핸들러의 persistent memory 패턴을 `information_extractor`로 확장한 것으로, 구조적 결정(import 재사용, 동형 패턴)은 적절하다. `buildRecallBlock`, `appendStablePrefix`는 import로 공유되어 복제가 아니다. 그러나 `resolveMemoryTtlDays`와 `scheduleMemoryExtraction`의 핵심 로직이 두 핸들러 클래스에 **바이트 수준으로 복제**된 점은 향후 드리프트 위험(W-1, W-2)이다. `memoryConfig`의 타입 소거(W-4)는 소비 지점에서 `as` 캐스팅 필요를 만들어 타입 안전성을 약화시킨다. 나머지는 가독성 수준의 INFO 항목으로, 기능 정확성에 즉각적 영향은 없다.

---

## 위험도

**LOW** — 기능 버그는 없고 테스트 커버리지도 충분하나, W-1/W-2 중복 로직은 중기적으로 유지보수 부채가 될 수 있다.

---

BLOCK: NO
