# 성능(Performance) 리뷰

## 발견사항

### 발견사항 1
- **[INFO]** W-1 런타임 가드 — 성능 영향 없음
  - 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` L395–396, `saveMemories` 첫 줄
  - 상세: 추가된 `typeof args !== 'object' || args === null` 검사는 O(1) 연산이다. `saveMemories` 는 이미 LLM embed 호출(`llmService.resolveEmbedding` + `llmService.embed`) 과 N 개의 DB 쿼리(`findSimilarFact`, `insertMemory`, `updateMemory`)를 포함하는 비동기 I/O 중심 경로이므로, 이 가드는 측정 불가 수준의 오버헤드를 추가할 뿐이다.
  - 제안: 없음. 가드 추가로 인한 성능 문제 없음.

### 발견사항 2
- **[INFO]** `recall` — `scoreExpr` SELECT·WHERE 이중 평가
  - 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts`, `recall` 쿼리 (`${scoreExpr} AS score … AND ${whereClause}`)
  - 상세: `buildCosineMatch`(I5)가 반환하는 `scoreExpr`(`1 - (am.embedding::<castExpr> <=> $1::<castExpr>)`)가 SELECT 절과 WHERE 절에 각각 삽입된다. PostgreSQL은 WHERE alias를 SELECT alias로 참조할 수 없으므로 cosine 거리 표현식이 행마다 두 번 계산된다. HNSW partial index 환경에서 ANN 탐색 자체가 O(log n) 이고 후보 행은 top-K 수준(기본 5)으로 적으므로, 이중 평가 비용은 현재 운용 규모에서 무시 가능하다. 이번 변경(buildCosineMatch 추출)으로 새로 발생한 것이 아닌 기존 패턴이며, I5 리팩터는 이를 단일 빌더로 통일해 유지보수성을 개선한 것이다.
  - 제안: 대용량 범위에서 성능 이슈가 관찰될 경우, `SELECT * FROM (SELECT am.content, ${scoreExpr} AS score FROM agent_memory am WHERE am.workspace_id = $2 AND am.scope_key = $3 AND vector_dims(am.embedding) = <dim> ORDER BY score DESC LIMIT $5) sub WHERE sub.score >= $4` 형태의 서브쿼리 래핑을 검토한다. 현재는 조치 불필요.

### 발견사항 3
- **[INFO]** `saveMemories` 루프 내 `findSimilarFact` 순차 DB 호출
  - 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` L464–481, `saveMemories` for 루프
  - 상세: `valid` 배열의 각 항목마다 `findSimilarFact`(pgvector cosine 쿼리)를 순차 await 한다. N개 항목이면 최대 N개 DB 왕복이 트랜잭션 안에서 발생한다. `batchSeen` 인메모리 코사인 비교(O(batchSeen.length))로 배치 내 중복은 DB 없이 단락하지만, 완전히 다른 신규 항목은 여전히 DB 조회가 필요하다. 이 패턴은 이번 변경 이전부터 존재했으며 I3(옵션 객체 전환)으로 변경된 것이 아니다. 배치 임베딩은 루프 전 `llmService.embed`로 일괄 처리되어 LLM 호출은 단 1회다. DB N+1이 문제가 되려면 한 추출 배치에 수십 개의 신규·중복 없는 fact가 동시에 생성되는 경우인데, LLM 추출 결과는 통상 소수(~5개)이므로 현재 규모에서 실질 병목이 아니다.
  - 제안: 대규모 배치가 예상될 경우, 단일 `findSimilarFact` 쿼리에 다수 벡터를 처리하는 배치 dedup 쿼리(`ANY` + `UNNEST` 등)로 개선 가능하나 알고리즘 복잡도가 크게 증가한다. 현재 사용 패턴(소수 fact/배치)에서는 불필요.

### 발견사항 4
- **[INFO] (긍정)** W-8 — `getThread` 이중 호출 → 단일 호출 최적화
  - 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts`
  - 상세: 이번 Batch 2 변경(W-8)에서 `getThreadExcludingNode` + `getThread` 두 번의 서비스 호출이 `getThread` 1회 + `fullTurns.filter(nodeId)` 인메모리 파생으로 단일화됐다. I/O 지원 thread 저장소로 전환 시 N+1 호출이 될 수 있는 잠재 위험이 제거됐다. 알고리즘 복잡도는 O(n) (turns 배열 filter)이며 인메모리 연산이므로 DB 호출보다 훨씬 빠르다. 명시적 성능 개선.
  - 제안: 없음. 긍정적 변경.

### 발견사항 5
- **[INFO]** `stripMemoryBlocks` — 호출마다 RegExp 객체 생성
  - 위치: `/codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts`, `stripMemoryBlocks` 함수 내 `esc` 헬퍼
  - 상세: `stripMemoryBlocks` 호출마다 `esc(RECALL_BLOCK_HEADER)`, `esc(RECALL_BLOCK_FOOTER)`, `esc(SUMMARY_BLOCK_HEADER)`, `esc(SUMMARY_BLOCK_FOOTER)` 가 평가되어 두 개의 RegExp 객체가 생성된다. 이들 헤더/푸터는 모듈 레벨 상수이므로 RegExp 결과도 항상 동일하다. 이번 changeset에서 새로 도입된 것은 아니며 기존 코드 패턴이다. 함수가 AI turn 처리당 1회 호출되는 빈도를 감안하면 GC 압력은 매우 낮다.
  - 제안: 규모가 커지면 두 RegExp 를 모듈 상수로 사전 컴파일하면 반복 생성 비용이 제거된다. 현재 규모에서는 불필요.

### 발견사항 6
- **[INFO]** `estimateTokensLanguageAware` — 대형 텍스트의 코드포인트 순회
  - 위치: `/codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts`, `estimateTokensLanguageAware`
  - 상세: `for...of` 루프로 텍스트의 모든 코드포인트를 순회하며 스크립트군 분류 및 누적 합산을 수행한다. 시간복잡도 O(n), n = 텍스트 길이. turn 수가 많거나 systemPrompt가 긴 경우 `estimateWorkingMemoryTokens` 호출 시 모든 turn에 대해 이 함수가 실행된다. 그러나 `buildSummaryBufferUpdate` 내 예산 초과 판단은 실제 LLM 요약 호출 전에만 실행되며, 추정치 자체는 순수·동기로 외부 I/O 없다. 메모리 예산(token_budget) 제약으로 처리 텍스트 크기에 상한이 있어 실질 병목이 아니다.
  - 제안: 없음. 동기 순수 함수로 hot-path 적합성이 이미 설계 의도다.

---

## 요약

이번 변경(W-1 가드 + 테스트 추가)의 실제 프로덕션 코드 수정은 `saveMemories` 첫 줄의 `typeof` 가드 한 줄뿐이다. 이는 O(1) 연산으로 I/O 중심 비동기 경로에서 측정 불가 수준의 오버헤드를 추가하며 성능에 영향이 없다. Batch 2 전체 변경 맥락에서 가장 주목할 성능 사항은 W-8(getThread 이중 호출 단일화)로, 명시적 성능 개선이다. `recall`의 `scoreExpr` 이중 평가와 `saveMemories` 루프 내 순차 DB 호출은 이번 변경 이전부터 존재하던 패턴이며 현재 운용 규모(소수 fact/배치, HNSW top-K)에서 실질 병목이 아니다. 성능 회귀 없이 안전한 리팩터링이다.

## 위험도

NONE

STATUS: SUCCESS
