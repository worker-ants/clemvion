# 부작용(Side Effect) 리뷰

## 발견사항

### [WARNING] saveMemories 시그니처 파괴적 변경 — 런타임 호출부 감지 공백
- **위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` (파일 2), `saveMemories` 메서드
- **상세**: 포지셔널 5인자 → 단일 옵션 객체로 변경. TypeScript 컴파일은 빌드 통과로 모든 정적 호출부가 갱신됨을 확인했다. 그러나 NestJS 의존성 주입 컨텍스트에서 `AgentMemoryService` 를 mock 으로 교체하거나 `jest.spyOn` 으로 감싸는 외부 테스트 파일, 또는 동적으로 `service['saveMemories']` 를 호출하는 경우 런타임에서 구 시그니처 인자가 전달될 수 있다. 이때 TypeScript 는 이를 감지하지 못하고 첫 번째 인자(`workspaceId` 문자열)가 옵션 객체로 해석되어 `workspaceId`가 `undefined` 가 되며 `if (!workspaceId || !scopeKey) return` 에 의해 **무음 no-op** 로 귀결된다.
- **제안**: 옵션 객체 첫 줄에 `if (typeof args !== 'object' || args === null) throw new Error('saveMemories: args must be an object')` 런타임 타입 가드를 추가하면 마이그레이션 누락 호출부가 즉시 에러를 발생시켜 디버그 가능. 또는 `AgentMemoryService` 를 직접 주입해 테스트하는 파일 전체를 `grep -r "saveMemories"` 로 재확인하여 정적 분석 외 호출부를 보완.

---

### [WARNING] updateSummaryState 무조건 대입 계약 — 호출자 오용 시 필드 소실
- **위치**: `codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts` (파일 6), `updateSummaryState`
- **상세**: 메서드는 `runningSummary` 와 `summarizedUpToSeq` 를 `state` 로부터 무조건 대입(`thread.runningSummary = state.runningSummary`). `state.runningSummary` 가 `undefined` 이면 기존 값을 덮어 소실시킨다. JSDoc 에 "항상 함께 제공" 계약이 명시돼 있고 현재 호출부(`ai-memory-manager.ts`)는 두 필드를 항상 함께 전달하므로 현재는 안전하다. 그러나 메서드가 `public` 이므로 향후 호출자가 한 필드만 갱신하려는 의도로 `{}` 또는 `{ runningSummary: '...' }` 만 넘기면 나머지 필드가 소실된다.
- **제안**: 매개변수 타입을 `{ runningSummary: string; summarizedUpToSeq: number } | Record<never, never>` 처럼 좁히거나, 단순히 `Required<>` 또는 두 필드 모두 `undefined` 를 허용하되 "반드시 함께" 를 Branded type(`SummaryState` 인터페이스)으로 분리하면 호출자 오용 시 컴파일 타임 포착 가능. 또는 내부 `if/else` 로 `undefined` 인 경우 기존 값 보존(덮지 않음) 로직을 두어 방어적 구현도 고려.

---

### [INFO] memoryState 키 보존 — information-extractor hydrateState 재구성 시 미래 키 소실 위험
- **위치**: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` (파일 10), `hydrateState` 메서드
- **상세**: `hydrateState` 는 `readExtractionWatermark(raw)` 로 watermark 를 읽은 뒤 `memoryState: extractionSeq !== undefined ? { lastExtractionTurnSeq: extractionSeq } : undefined` 로 `memoryState` 를 새로 구성한다. `raw.memoryState` 에 다른 키(`someOtherKey` 등)가 있어도 **모두 버려진다**. 현재 스키마에서는 `memoryState` 에 `lastExtractionTurnSeq` 하나만 있으므로 무해하다. 그러나 `ai-turn-executor.ts` 는 스프레드(`...memoryState`)로 기존 키를 보존하는데 IE 는 그렇지 않아 두 핸들러 간 비대칭이다.
- **제안**: 현재 배포 안전. 향후 `memoryState` 에 새 키 추가 시 `hydrateState` 도 스프레드 보존으로 함께 갱신해야 함을 주석에 명시하거나, `raw.memoryState` 를 그대로 스프레드하여 미래 안전성 확보: `memoryState: { ...(raw.memoryState as object | undefined ?? {}), ...(extractionSeq !== undefined ? { lastExtractionTurnSeq: extractionSeq } : {}) }`.

---

### [INFO] 구 평면 키 lastExtractionTurnSeq 파킹 상태 잔존 — 읽기는 안전, 쓰기는 신 namespace 만
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (파일 9), resume state 구성
- **상세**: 신 코드는 `memoryState.lastExtractionTurnSeq` 로만 쓴다. 구 flat 키 `lastExtractionTurnSeq` 가 이미 `_resumeState` 에 존재하는 파킹 세션이 resume 되면, 한 사이클 후 `memoryState.lastExtractionTurnSeq` 가 추가되면서 구 flat 키는 그대로 남아 있게 된다. `readExtractionWatermark` 는 신 namespace 를 우선 읽으므로 실제 동작에는 영향 없다. 다만 `_resumeState` 객체에 stale 한 구 flat 키가 영구히 남아 Redis 직렬화 크기를 약간 증가시킨다.
- **제안**: 기능 정확성 무해. 필요 시 resume state 구성 시 `delete state.lastExtractionTurnSeq` 로 구 키를 명시 제거하면 상태 객체 정리 가능. 단순 누적이므로 즉각 조치 필요 없음.

---

### [INFO] buildCosineMatch — dim 파라미터 SQL 직접 인터폴레이션
- **위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` (파일 2), `buildCosineMatch` private 메서드
- **상세**: `dim` 이 SQL 에 직접 인터폴레이션된다(`vector(${dim})`). 이 메서드는 `SUPPORTED_EMBEDDING_DIMS` 화이트리스트 검사(`has(dim)`) 이후에만 호출되므로 SQL 주입 위험은 없다. 그러나 `buildCosineMatch` 자체는 화이트리스트 확인을 포함하지 않아 미래 호출 경로 추가 시 보호 의존성이 암묵적이다.
- **제안**: 기능 정확성 무해. `buildCosineMatch` 내부에 `if (!SUPPORTED_EMBEDDING_DIMS.has(dim)) throw new Error(...)` 방어 어설션을 추가하면 자가 완결적(self-contained) 메서드가 된다.

---

### [INFO] ai-memory-manager.ts 단일 thread 읽기 — fullTurns 폴백 값 변경
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` (파일 8)
- **상세**: 구 코드는 `getThreadExcludingNode` 실패 시 `turns = []`, `fullTurns = turns = []`. 신 코드는 `getThread` 실패 시 `fullTurns = []`, `turns = []`. service/target 부재 경우 동치이므로 기능 변화 없다. 그러나 `fullTurns` 의 폴백이 구에서는 `turns`(지역 참조), 신에서는 `[]` 리터럴로 변경되어, 향후 `fullTurns` 분기를 수정할 때 동치 전제를 재확인해야 한다.
- **제안**: 현재 안전. 코드 자체에 `// fullTurns 폴백=[] 은 !service||!target 경우이며 turns 도 [] 임` 주석으로 동치 이유를 명시하면 미래 수정 시 혼선 방지.

---

## 요약

이번 변경의 핵심 부작용은 `saveMemories` 포지셔널→옵션 객체 시그니처 파괴, `updateSummaryState` 무조건 대입 계약, watermark namespace 이전(`memoryState`) 세 축이다. 빌드 통과 및 diff 내 모든 호출부 갱신으로 현재 배포 위험은 낮다. `saveMemories` 의 무음 no-op 가능성(옵션 객체 대신 문자열이 넘어오면 조용히 반환)은 런타임 가드가 없어 마이그레이션 누락이 있을 경우 추적하기 어렵다는 점이 가장 주요한 경고 사항이다. `updateSummaryState` 의 무조건 대입은 현재 호출부(ai-memory-manager 단일)가 항상 두 필드를 함께 제공하므로 안전하나 public API 이므로 향후 오용 위험이 있다. 나머지 INFO 항목(stale 평면 키, hydrateState 재구성 손실, dim 인터폴레이션)은 현재 배포에서 실질 부작용 없음.

## 위험도

LOW
