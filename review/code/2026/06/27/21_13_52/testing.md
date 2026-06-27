# Testing Review

## 발견사항

### [WARNING] buildCosineMatch 파라미터 순서 계약이 단위 테스트로 검증되지 않음
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `buildCosineMatch` private 메서드 및 두 호출부(`recall`, `findSimilarFact`)
- 상세: `buildCosineMatch`는 `$1`=vector, `$2`=workspaceId, `$3`=scopeKey, `$4`=threshold 순서 계약을 문서화하고 있으나, 이를 직접 검증하는 테스트가 없다. `recall`은 `[vectorStr, workspaceId, scopeKey, threshold, topK]` 5개를 바인딩하고 `findSimilarFact`는 `[vectorStr, workspaceId, scopeKey, MEMORY_DEDUP_SIMILARITY]` 4개를 바인딩한다. `mockDataSource.query` 는 SQL 텍스트 일부(`'SELECT am.id'`, `'INSERT INTO agent_memory'`)만 검사하고 파라미터 배열 순서·개수를 체크하지 않는다. 두 호출부 중 한 쪽이 파라미터 배열을 잘못 수정할 경우 단위 테스트가 통과하면서 런타임에 `$2`/`$3` 역전 등의 묵시적 버그가 발생할 수 있다.
- 제안: `mockDataSource.query.mock.calls` 에서 파라미터 배열(두 번째 인자)을 직접 검사하는 어설션을 recall 및 dedup(findSimilarFact 경유) 테스트에 추가한다. 예: `expect(queryCall[1][0]).toBe(vectorStr); expect(queryCall[1][1]).toBe('ws-1'); expect(queryCall[1][2]).toBe('scope-1'); expect(queryCall[1][3]).toBeCloseTo(threshold)`.

---

### [WARNING] IE hydrateState 구 평면 키 폴백 경로가 통합 테스트로 검증되지 않음
- 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` — `hydrateState` 내 `readExtractionWatermark` 호출부
- 상세: `readExtractionWatermark`의 단위 테스트(`agent-memory-injection.spec.ts`)는 구 평면 키 폴백을 잘 검증한다. 그러나 IE의 `hydrateState` 경로에서 구 평면 키(`lastExtractionTurnSeq`)가 실려 오는 in-flight 파킹 실행 시나리오는 `information-extractor.memory.spec.ts`에 통합 수준 테스트가 없다. 배포 이행 기간에 Redis 캐시에 구 포맷 state가 남아 `processMultiTurnMessage`로 재개될 경우, 실제 watermark 읽기·추출 skip 동작이 맞는지 E2E 외엔 검증 경로가 없다.
- 제안: `information-extractor.memory.spec.ts`에 "구 flat 키 state 로 resume 시 watermark 를 정상 읽어 증분 추출 경계가 맞게 동작한다" 케이스를 추가한다. `_resumeState = { ..., lastExtractionTurnSeq: N }` 형태로 2차 `processMultiTurnMessage` 호출 시 `scheduleExtraction` 에 전달되는 `lastExtractionTurnSeq`가 N임을 검증.

---

### [INFO] readExtractionWatermark seq=0 경계값 케이스 테스트 부재
- 위치: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts` — `readExtractionWatermark` describe 블록
- 상세: turn seq는 0부터 시작한다. `readExtractionWatermark({ memoryState: { lastExtractionTurnSeq: 0 } })`는 구현상 0을 반환하지만(유효한 seq), 이를 명시적으로 검증하는 테스트 케이스가 없다. 테스트가 없어 해당 동작이 의도적 계약인지 우연히 맞는지 판단하기 어렵다.
- 제안: `0` 을 반환해야 하는 케이스를 "숫자가 아니거나 부재면 undefined" 블록과 별도로 추가한다: `expect(readExtractionWatermark({ memoryState: { lastExtractionTurnSeq: 0 } })).toBe(0)`.

---

### [INFO] readExtractionWatermark memoryState가 비-객체인 케이스 미검증
- 위치: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts`
- 상세: 구현에서 `resumeState.memoryState`를 타입 캐스트(`as { lastExtractionTurnSeq?: unknown } | undefined`)로 접근하는데, `memoryState`가 문자열이나 숫자처럼 비-객체인 경우 `ns.lastExtractionTurnSeq`는 `undefined`가 되어 평면 키 폴백으로 넘어간다. 이 동작은 안전하지만 테스트에 명시되어 있지 않아 향후 타입 체크 강화 시 의도치 않은 변경이 생길 수 있다.
- 제안: `readExtractionWatermark({ memoryState: 'invalid' as never })` 케이스를 추가해 `undefined`를 반환하는지 명시적으로 검증한다.

---

### [INFO] updateSummaryState undefined 값으로 요약 초기화 케이스 미검증
- 위치: `codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.spec.ts` — `updateSummaryState` describe 블록
- 상세: 현재 3건의 테스트는 값 설정과 덮어쓰기를 검증하지만, `state.runningSummary = undefined`를 명시적으로 전달해 요약을 초기화하는 시나리오가 없다. 구현은 `thread.runningSummary = state.runningSummary` 로 그대로 대입하므로 undefined 클리어가 가능하나 테스트에 없어 계약이 명시되지 않는다.
- 제안: 요약 클리어 테스트 추가: 먼저 요약 설정 후 `updateSummaryState(context, { runningSummary: undefined, summarizedUpToSeq: undefined })`를 호출해 두 필드 모두 undefined가 되는지 확인.

---

### [INFO] ai-turn-executor memoryState 병합 시 타 키 보존 동작 미검증
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `nextExtractionSeq` persist 블록
- 상세: `state.memoryState`에 `lastExtractionTurnSeq` 외 타 키가 존재할 경우 스프레드 병합(`...state.memoryState`)으로 보존하는 구현이 추가됐다. 이 동작을 검증하는 테스트가 `ai-agent.memory.spec.ts`에 없다. 향후 `memoryState`에 다른 필드가 추가될 때 보존 불변식이 깨지더라도 회귀 테스트가 없다.
- 제안: 초기 `state`에 `memoryState: { lastExtractionTurnSeq: N, someOtherKey: 'val' }`를 세팅하고 한 턴 처리 후 `_resumeState.memoryState.someOtherKey`가 `'val'`로 보존되는지 검증하는 케이스를 추가한다.

---

### [INFO] saveMemories 옵션 객체화 이후 호출부 전수 커버 확인
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts`
- 상세: 14곳의 테스트 call site가 모두 옵션 객체 형태로 정상 갱신됐다. 동일 서비스를 호출하는 다른 모듈(어드민 서비스 등)에서 구 포지셔널 API 잔존 호출이 없는지 컴파일 타임에 TypeScript가 잡아주므로 런타임 회귀 위험은 낮다.
- 제안: 별도 조치 불필요. TypeScript 컴파일 통과 확인으로 충분하다.

---

## 요약

I3(saveMemories 옵션 객체화), I5(buildCosineMatch 공유 빌더), I-7(updateSummaryState 단일 변이 경로), W-8(getThread 이중 호출 단일화), I12(memoryState sub-namespace 및 readExtractionWatermark)의 리팩터링 각각에 대해 테스트가 대체로 잘 갱신됐다. readExtractionWatermark는 namespace 우선·폴백·부재 등 핵심 엣지 케이스를 5개 케이스로 명시적으로 커버하며 updateSummaryState는 3건의 격리된 케이스로 동작을 표현하고 있다. 다만 buildCosineMatch의 파라미터 순서 계약이 SQL mock 어설션 수준에서 직접 검증되지 않아 두 호출부($5 비대칭)의 바인딩 오류를 단위 테스트가 잡기 어렵고(WARNING), IE hydrateState 구 평면 키 폴백의 통합 테스트가 없어 배포 이행 기간 in-flight 실행의 안전성이 E2E에만 의존하는 점(WARNING)이 주요 갭이다. 나머지는 의도적 동작의 문서화 수준 개선 요소(INFO)이므로 전체 위험도는 낮다.

## 위험도

LOW
