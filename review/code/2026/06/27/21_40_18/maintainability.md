# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [WARNING] `buildCosineMatch` SQL 파라미터 바인딩 순서 — 타입 시스템 미강제 (잔존)
- 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `buildCosineMatch` 반환 `whereClause` / `scoreExpr`
- 상세: 이전 리뷰(21_13_52)에서 W#5로 지적됐고 RESOLUTION에서 테스트 어설션 추가(I5 테스트 2건)로 처리됐으나, 설계 자체는 변경되지 않았다. `whereClause` 문자열은 `$1`(vector)·`$2`(workspaceId)·`$3`(scopeKey)·`$4`(threshold)의 고정 인덱스를 하드코딩하며, 호출부가 바인딩 배열을 잘못된 순서로 전달해도 컴파일 타임에 탐지되지 않는다. `recall`과 `findSimilarFact` 두 호출부는 현재 올바른 순서를 사용하며, 테스트로 계약이 검증되어 있다. 그러나 서비스가 커지면서 세 번째 호출부가 추가될 경우 무언 회귀 위험이 잔존한다.
- 제안: `buildCosineMatch`가 바인딩 파라미터 자체를 받아 `{ sql: string; params: unknown[] }` 형태로 완전한 쌍을 반환하도록 설계를 강화하면 바인딩 순서를 호출부가 직접 결정할 필요가 없어진다. 단기 대안은 현 상태 유지(테스트가 계약을 고정) — private 메서드이며 현재 호출부가 2개로 제한적이므로 LOW 위험.

---

### [INFO] `ai-turn-executor.ts` `memoryState` 병합 spread — 중첩 복잡도
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — watermark 영속 블록 (`...(nextExtractionSeq !== undefined ? {...} : {})`)
- 상세: 다음 패턴이 사용된다:
  ```ts
  ...(nextExtractionSeq !== undefined
    ? {
        memoryState: {
          ...(typeof state.memoryState === 'object' && state.memoryState
            ? (state.memoryState as Record<string, unknown>)
            : {}),
          lastExtractionTurnSeq: nextExtractionSeq,
        },
      }
    : {}),
  ```
  조건부 spread 안에 또 다른 조건부 spread가 중첩되어 있어, 동일 파일의 다른 `_resumeState` 필드 설정 방식(직접 할당)과 스타일이 다르다. 기능적으로는 정확하고 주석이 의도를 설명하지만, 독자가 패턴을 파악하는 데 시간이 필요하다.
- 제안: 헬퍼 함수로 추출한다:
  ```ts
  function mergeMemoryState(
    existing: unknown,
    seq: number,
  ): Record<string, unknown> {
    const base = typeof existing === 'object' && existing
      ? (existing as Record<string, unknown>)
      : {};
    return { ...base, lastExtractionTurnSeq: seq };
  }
  ```
  호출부에서 `...(nextExtractionSeq !== undefined ? { memoryState: mergeMemoryState(state.memoryState, nextExtractionSeq) } : {})` 로 단순화. 기능 변경 없이 가독성 개선.

---

### [INFO] 테스트 내 매직 넘버 — 임베딩 차원 `1536`
- 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts` — `new Array(1536).fill(0.01)`
- 상세: `1536`은 OpenAI `text-embedding-3-small` 차원 수이나 인라인 리터럴로만 쓰인다. 동일 파일에서 해당 값이 반복 사용되며(I5 테스트 포함), 상수 이름 없이 `1536`이 의미를 즉시 전달하지는 않는다. 테스트 파일 내에서만 사용되어 영향 범위는 작다.
- 제안: 파일 상단에 `const EMBEDDING_DIM = 1536;` 상수를 선언해 의미를 명시한다. 서비스 코드에 `SUPPORTED_EMBEDDING_DIMS` 등 관련 상수가 있다면 그 값을 import해서 사용하는 것이 더 일관적이다.

---

### [INFO] `typeof state.memoryState === 'object' && state.memoryState` 런타임 가드 — 정적 타입 불일치
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `memoryState` 병합 spread 내 `as Record<string, unknown>` 캐스트
- 상세: `state`의 정적 타입이 `memoryState` 필드를 명시적으로 선언하지 않는 경우, 런타임 가드 후 `as Record<string, unknown>` 캐스트로 타입 안전성을 우회한다. 현재 동작은 올바르며 주석으로 설명되어 있다. 그러나 `state` 타입 정의가 리팩터링될 때 이 패턴이 조용히 잘못 동작할 수 있다.
- 제안: `ai-turn-executor.ts` 내 resume state 타입 정의(있다면)에 `memoryState?: Record<string, unknown>`를 명시적으로 추가해 런타임 가드 대신 정적 타입으로 보장한다.

---

### [INFO] `buildCosineMatch` `whereClause` 선두 공백 — SQL 포맷 일관성
- 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `buildCosineMatch` 반환값
- 상세: 반환되는 `whereClause` 문자열이 들여쓰기 정렬용 선두 공백을 포함한다. SQL 실행에 무해하나, 호출부 SQL 리터럴의 들여쓰기 구조에 암묵적으로 결합되어 있어, 향후 SQL 서식 변경 시 불일치가 발생할 수 있다. 이전 리뷰(21_13_52 INFO #6)에서 비채택됐으며, 현 상태도 수용 가능.
- 제안: 현 상태 유지 또는 `whereClause`를 선두 공백 없이 반환하고 들여쓰기를 호출부 SQL 리터럴에서 관리하는 방향으로 통일. 우선순위 낮음.

---

## 요약

이번 변경은 이전 리뷰(21_13_52) RESOLUTION에서 채택된 수정 사항을 포함한 Batch 2 전체의 재검토다. `saveMemories` 옵션 객체화(I3), `buildCosineMatch` SQL 빌더 추출(I5), `updateSummaryState` 단일 writer 캡슐화(I-7), `memoryState` sub-namespace 마이그레이션(I12)의 네 가지 리팩터링 모두 유지보수성을 실질적으로 향상시켰다. 이전 리뷰에서 지적된 IIFE 패턴(`hydrateState`)과 `wmOf` 축약 이름은 이미 수정됐다. 잔존 우려는 `buildCosineMatch`의 파라미터 바인딩 순서가 타입 시스템에서 강제되지 않는다는 점(테스트로 보완됨)과, `ai-turn-executor.ts`의 `memoryState` 병합 spread 중첩 복잡도다. 두 사항 모두 현재 호출부가 제한적이고 주석으로 의도가 명시되어 있어 실질 위험은 낮다. 코드베이스 스타일(TypeScript, NestJS, JSDoc 관행)과의 일관성은 전반적으로 양호하게 유지된다.

## 위험도

LOW

STATUS: SUCCESS
