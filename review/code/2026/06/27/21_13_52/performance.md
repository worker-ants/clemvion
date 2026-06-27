# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `saveMemories` 포지셔널 파라미터 → 옵션 객체 변환 (I3) — 미미한 객체 할당 증가
  - 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` L360–368, 호출부 전체
  - 상세: 호출 시 `{ workspaceId, scopeKey, items, embedCfgSource, ttlDays }` 객체가 매 호출마다 새로 생성된다. 단, 이 메서드 자체가 임베딩 API 호출(수백~수천 ms)과 다수의 DB 쿼리를 포함하므로 객체 할당 비용은 완전히 무시 가능하다.
  - 제안: 현재 구조 유지. 가독성과 명명된 인수의 이점이 비용을 압도한다.

- **[INFO (개선)]** `injectMemoryContext` 이중 thread 읽기 → 단일 읽기로 통합 (W-8)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` L1806–1823 (diff 기준)
  - 상세: 이전 코드는 `getThreadExcludingNode(target, selfNodeId)` (내부적으로 `getThread().turns.filter()` 수행)와 `getThread(target)` 를 별도로 두 번 호출했다. 변경 후 `getThread()` 1회 호출 후 `fullTurns.filter(t => t.nodeId !== args.selfNodeId)` 를 in-memory 로 파생해 서비스 진입 횟수를 2 → 1 로 감소시켰다. 현재는 in-memory 연산이지만 스펙 주석(W-8)에 명시된 "I/O-backed 전환 대비" 를 고려하면 의미 있는 사전 최적화다.
  - 제안: 변경 방향이 올바르다. 유지.

- **[INFO]** `buildCosineMatch` 빌더 추출 (I5) — 문자열 생성 연산 중복 제거
  - 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` L735–768 (diff 기준)
  - 상세: `recall` 과 `findSimilarFact` 에서 각각 독립적으로 `getEmbeddingCastType`, `castExpr`, `scoreExpr`, `whereClause` 를 구성하던 것을 `buildCosineMatch(dim)` 으로 단일화했다. 연산 자체는 O(1) 문자열 연결이라 성능 임팩트는 없지만, 두 경로의 SQL 표현식 일관성을 보장해 인덱스 사용 조건(dim/castExpr 일치)이 한 곳에서 관리되는 올바른 구조다.
  - 제안: 현재 구조 유지.

- **[INFO]** `keepUserExchanges` 계산에서 두 단계 배열 연산
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` L2165–2170 (diff 기준 keepUserExchanges 블록)
  - 상세: `selectVolatileTail(fullTurns, update.summarizedUpToSeq).filter(t => t.source === 'ai_user' || ...).length` 패턴이 중간 배열을 2개 생성한다 (tail 배열 + filter 결과 배열). thread 는 STORAGE_MAX_TURNS=500 으로 상한이 보장되므로 실제 영향은 미미하다. 단일 패스 카운트(`reduce` 또는 `for...of` + 조건 카운터)로 중간 배열 1개를 줄일 수 있다.
  - 제안: 현재 규모에서 무시 가능하다. 500 turns 상한이 있는 한 O(n) × 2회 패스는 수백 마이크로초 이하. 향후 STORAGE_MAX_TURNS 를 크게 늘릴 계획이 있다면 단일 패스 리팩터를 고려할 것.

- **[INFO]** `readExtractionWatermark` — O(1) 단순 속성 접근
  - 위치: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` L2956–2968 (diff 기준)
  - 상세: namespace 우선 + 평면 키 폴백의 두 분기가 모두 O(1) 속성 접근이다. 두 핸들러 공유로 코드 중복이 제거되었으며 성능 영향 없음.
  - 제안: 유지.

- **[INFO]** `ai-turn-executor.ts` 의 `memoryState` spread — 매 turn 소형 객체 생성
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L2848–2349 (diff 기준)
  - 상세: `nextExtractionSeq !== undefined` 조건 하에서만 실행되며, 기존 `state.memoryState` 의 타 키를 보존하기 위해 spread 를 사용한다. 생성 객체는 소형(키 1~수개)이고 resume state 직렬화 경로이므로 성능 비용은 무시 가능하다.
  - 제안: 유지.

## 요약

이번 변경은 (1) `saveMemories` 포지셔널→옵션 객체 리팩터, (2) cosine SQL 빌더 추출, (3) `getThread` 단일화, (4) `updateSummaryState` 캡슐화, (5) `readExtractionWatermark` 헬퍼 신설, (6) watermark namespace 이전으로 구성된다. 성능 관점에서 가장 주목할 변화는 `injectMemoryContext` 의 thread 이중 읽기 → 단일 읽기 통합(W-8)으로, 이는 실질적인 개선이다. 나머지는 refactoring 성격의 변화로 런타임 비용 증가 없이 코드 일관성을 높였다. `keepUserExchanges` 산출 시 두 단계 배열 순회가 있으나 STORAGE_MAX_TURNS=500 상한이 보장되므로 운영 부하에 영향을 줄 수준이 아니다. 전체적으로 성능 회귀 없음, 소폭 개선 포함.

## 위험도

NONE
