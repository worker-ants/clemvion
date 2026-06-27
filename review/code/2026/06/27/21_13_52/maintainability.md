# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [WARNING] `buildCosineMatch` SQL 파라미터 순서 계약 — 타입 시스템 미강제
- 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `buildCosineMatch` 반환 `whereClause`
- 상세: `buildCosineMatch` 는 `$1`=벡터, `$2`=workspaceId, `$3`=scopeKey, `$4`=임계치 순서를 JSDoc 주석으로만 명시한다. `whereClause` 문자열 안에 이 인덱스들이 하드코딩되어 있어, 호출부가 바인딩 배열을 잘못된 순서로 전달해도 컴파일 타임에 탐지되지 않는다. 현재 두 호출부(recall `[vectorStr, workspaceId, scopeKey, threshold, topK]` / findSimilarFact `[vectorStr, workspaceId, scopeKey, MEMORY_DEDUP_SIMILARITY]`)는 모두 올바르지만, 신규 호출부 추가 시 런타임에 조용히 잘못된 결과가 나올 위험이 있다. private 메서드라 외부 노출 범위는 제한되나, 향후 리팩토링 시 취약점이 된다.
- 제안: `buildCosineMatch` 반환 타입에 파라미터 개수를 주석으로 명기하거나(`@param-binding-count 4`), 호출부 근처에 assertion 또는 inline 상수로 예시 바인딩을 남겨 계약을 시각적으로 고정한다. 또는 `buildCosineMatch` 가 파라미터 값을 함께 받아 완전한 SQL + 바인딩 배열 쌍을 반환하도록 설계를 강화할 수 있다.

---

### [INFO] `hydrateState` 내 IIFE — 불필요한 중첩
- 위치: `/codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` 라인 ~3420-3423 (`hydrateState` 함수 내)
- 상세: 아래 패턴이 사용된다:
  ```ts
  memoryState: ((): MultiTurnState['memoryState'] => {
    const seq = readExtractionWatermark(raw);
    return seq !== undefined ? { lastExtractionTurnSeq: seq } : undefined;
  })(),
  ```
  객체 리터럴 내 IIFE는 같은 파일의 다른 필드 hydration 패턴(직접 프로퍼티 접근)과 일관성이 없고, 숙련도가 낮은 독자가 한눈에 파악하기 어렵다.
- 제안: 객체 리터럴 이전에 `const` 로 분리한다:
  ```ts
  const rawSeq = readExtractionWatermark(raw);
  const memoryState = rawSeq !== undefined
    ? { lastExtractionTurnSeq: rawSeq }
    : undefined;
  return {
    ...
    memoryState,
  };
  ```

---

### [INFO] `wmOf` 헬퍼 — 테스트 내 축약 이름
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-agent.memory.spec.ts` — `wmOf` 함수
- 상세: JSDoc 이 잘 작성되어 있으나, `wmOf` 라는 이름은 도메인 맥락 없이는 뜻을 즉시 파악하기 어렵다. 테스트 파일 내 private 헬퍼이므로 영향 범위는 작다.
- 제안: `extractionWatermark` 또는 `getWatermark` 처럼 의도가 명확한 이름을 사용한다.

---

### [INFO] `memoryState` 병합 spread 시 런타임 타입 가드 — 타입 캐스트 불일치
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — watermark 영속 spread 블록
- 상세:
  ```ts
  ...(typeof state.memoryState === 'object' && state.memoryState
    ? (state.memoryState as Record<string, unknown>)
    : {}),
  ```
  `typeof x === 'object' && x` 가드 이후 `as Record<string, unknown>` 캐스트는 실용적이지만, `state` 의 정적 타입이 `memoryState` 를 명시적으로 포함하지 않을 경우 미래 리팩토링 시 타입 불일치가 잠재된다. 현재 코드는 동작하며 주석으로 의도가 설명되어 있다.
- 제안: `ai-turn-executor.ts` 내 resume state 타입 정의가 있다면 `memoryState?: Record<string, unknown>` 를 명시적으로 포함하도록 갱신해 런타임 가드 대신 정적 타입으로 처리한다.

---

### [INFO] `buildCosineMatch` whereClause 선두 공백 — SQL 포맷 일관성
- 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `buildCosineMatch` 반환 `whereClause`
- 상세: 반환되는 `whereClause` 문자열에 정렬용 선두 공백(스페이스)이 포함되어 있다. SQL 실행에는 무해하나, 로그/디버그 출력 시 의도치 않은 들여쓰기가 포함될 수 있고, 호출부 SQL 템플릿과 시각적 정합이 묵시적으로 결합된다.
- 제안: `whereClause` 를 공백 없이 반환하고, 들여쓰기는 호출부 SQL 리터럴에서 관리한다. 또는 현 상태 유지(SQL 실행에는 무관)로도 수용 가능.

---

## 요약

이번 변경은 전반적으로 유지보수성을 **향상**시키는 방향의 리팩토링이다. `saveMemories` 포지셔널 5파라미터를 옵션 객체로 전환(I3)하면서 호출부 가독성이 크게 개선되었고, `buildCosineMatch` 추출(I5)로 중복 SQL 표현식이 제거되었으며, `updateSummaryState` 신설(I-7)로 thread 직접 mutate 패턴이 단일 writer 경유로 캡슐화되었다. `readExtractionWatermark` 공유 헬퍼는 두 핸들러에 흩어진 watermark 읽기 로직과 폴백 규칙을 단일화했다. 단일 `getThread` 읽기로의 전환(W-8)은 I/O-backed 전환 대비 방어적 최적화이자 이중 호출 제거다. 주목할 경계 사항은 `buildCosineMatch` 의 SQL 파라미터 바인딩 순서가 타입 시스템에서 강제되지 않는다는 점으로, 현재 두 호출부는 올바르나 신규 호출부 추가 시 무언 회귀 위험이 있다. `hydrateState` 내 IIFE 패턴은 동일 파일의 다른 hydration 관용구와 스타일 불일치가 있어 가독성 미세 개선 여지가 있다.

## 위험도

LOW
