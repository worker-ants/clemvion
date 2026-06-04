# Performance Review

## 발견사항

### [WARNING] saveMemories — N+1 DB 쿼리 패턴 (dedup 경로)
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `saveMemories` 루프 내 `findSimilarFact` + `updateMemory` / `insertMemory` 호출
- 상세: 변경 전 코드는 단일 bulk INSERT를 사용했으나 변경 후에는 각 `item`마다 최대 2번의 DB 쿼리(SELECT 1건 + UPDATE/INSERT 1건)가 발생한다. items 배열 길이가 N이면 최악 2N round-trip이 된다. 추출 batch가 소규모(통상 3~10 items)인 현재 운용 전제라면 절대 비용은 낮지만, 배치 크기가 커지면 선형으로 악화된다.
- 제안: 허용 범위 내라면 현 구조를 유지하되, items 배열 상한(LLM 응답 크기)이 실질적으로 작아 실용상 문제없음을 문서화. 향후 대량 처리 필요 시 임베딩 벡터를 한 번에 모아 `ANY($1::vector[])` 방식의 single bulk-lookup으로 교체 가능 — 이 경우 pgvector cosine 정렬을 배열 형태로 재작성 필요.

### [WARNING] findSimilarFact — 코사인 표현식 ORDER BY 중복 계산
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `findSimilarFact` 메서드 SQL
- 상세: `ORDER BY 1 - (am.embedding::${castExpr} <=> $1::${castExpr}) DESC` 에서 cosine 식이 `WHERE` 절과 `ORDER BY` 절에 두 번 등장한다. PostgreSQL 쿼리 플래너가 CSE(common subexpression elimination)를 항상 보장하지 않으므로 동일 벡터 거리를 두 번 평가할 수 있다. LIMIT 1이라 영향은 미미하지만, 쿼리를 `ORDER BY score DESC`로 재작성(CTE 또는 subquery alias)하면 명확히 단일 계산이 된다.
- 제안:
  ```sql
  SELECT id FROM (
    SELECT am.id,
           1 - (am.embedding::${castExpr} <=> $1::${castExpr}) AS score
    FROM agent_memory am
    WHERE am.workspace_id = $2
      AND am.scope_key = $3
      AND vector_dims(am.embedding) = ${dim}
      AND am.embedding IS NOT NULL
      AND (am.expires_at IS NULL OR am.expires_at > now())
  ) sub
  WHERE score >= $4
  ORDER BY score DESC
  LIMIT 1
  ```

### [WARNING] cosineSimilarity — Math.sqrt 두 번 호출 (미미하지만 최적화 여지)
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `cosineSimilarity` 함수 (라인 `return dot / (Math.sqrt(normA) * Math.sqrt(normB))`)
- 상세: `Math.sqrt(normA) * Math.sqrt(normB)` 는 `Math.sqrt(normA * normB)` 와 수학적으로 동일하지만 sqrt 호출이 두 번이다. 1536차원 벡터를 루프 내에서 반복 비교할 때 batch 내 dedup(`findSimilarInBatch`)에서 누적된다.
- 제안: `return dot / Math.sqrt(normA * normB)` 로 변경. sqrt 1회 절약 + 곱셈 1회 감소.

### [WARNING] batchSeen 배열 — 선형 스캔 O(N²) (batch 크기 클 때)
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `findSimilarInBatch` + `batchSeen` 배열
- 상세: `findSimilarInBatch`는 `batchSeen` 배열 전체를 선형 순회한다. 한 batch 에 K개 항목이 있으면 최악 O(K²) 비교가 발생한다. 현재 LLM 추출 응답 크기가 수십 건 이하이므로 실용상 무시 가능하지만, 배열이 아니라 Map을 쓰거나 embedding 간 유사도 임계치 구조를 바꿀 경우 고려.
- 제안: 현재 운용 전제(batch ≤ 20)에서는 INFO 수준. 배치 상한이 커질 경우 `batchSeen`을 embedding → id 해시 구조로 변경 검토.

### [INFO] evictExpiredAndOldest — 두 DELETE 가 별도 round-trip
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `evictExpiredAndOldest`
- 상세: TTL 만료 삭제(`DELETE WHERE expires_at < now()`)와 FIFO 초과분 삭제가 두 번의 독립 DB 쿼리로 실행된다. partial index(`idx_agent_memory_expires_at`)가 있으므로 첫 번째 DELETE는 이미 경량화되어 있다. 그러나 두 쿼리를 CTE(`WITH expired AS (DELETE ...) DELETE ...`)로 묶으면 단일 round-trip으로 줄일 수 있다.
- 제안: 현 상태로 기능상 충분. 성능 극도 최적화 필요 시 단일 CTE DELETE 검토.

### [INFO] `[${embedding.join(',')}]` 문자열 생성 반복
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `findSimilarFact`, `insertMemory`, `updateMemory` 각각에서 `vectorStr` 구성
- 상세: 같은 `embedding` 배열에 대해 `findSimilarFact` → `updateMemory`/`insertMemory` 경로에서 `vectorStr`이 2번 직렬화된다(각 메서드 독립 호출). 1536차원 float 배열을 문자열화하면 약 10KB 문자열이 생성된다.
- 제안: `saveMemories` 루프에서 `vectorStr`을 한 번만 계산해 `findSimilarFact` / `insertMemory` / `updateMemory` 에 전달하도록 시그니처 조정. 단, 현재 메서드 분리 설계를 유지하려면 허용 가능한 수준.

### [INFO] resolveMemoryTtlDays — 매 turn 재계산 (무비용이지만 캐시 여지)
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `resolveMemoryTtlDays`
- 상세: 순수 함수이고 연산도 경미하므로 실질적 성능 문제 없음. 동일 config 값에 대해 멀티턴 매 turn마다 호출되지만 비용은 무시 가능.
- 제안: 변경 불필요.

### [INFO] expiresAtSql — 문자열 보간으로 SQL injection 위험 없음, 다만 주의 요망
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `expiresAtSql` 계산부
- 상세: `ttlDays` 값이 `Math.floor(n)` + `n > 0` 검증을 거친 양의 정수이므로 injection 위험 없음. 그러나 SQL 리터럴 보간 패턴(`INTERVAL '${ttlDays} days'`)은 향후 유지보수 시 주의가 필요하다. 성능상 인덱스 사용 저해 없음(리터럴 상수로 플래너가 처리).
- 제안: 현 구조 유지. 향후 parameterized interval(`$n::interval`)로 전환 가능하지만 필수는 아님.

---

## 요약

이번 변경(persistent 증분 추출 AGM-08, 의미 dedup AGM-09, TTL 만료 AGM-10, 추출 분류 AGM-11)의 핵심 성능 변화는 `saveMemories` 의 단일 bulk INSERT → item별 SELECT+UPDATE/INSERT 전환이다. N+1 패턴이 도입됐으나, 추출 batch가 LLM 응답 1건 분량(실용적으로 5~20 items)으로 제한되기 때문에 절대 비용은 낮다. `findSimilarFact` SQL의 cosine 표현식 중복 계산과 `cosineSimilarity`의 sqrt 이중 호출은 소폭 최적화 여지가 있으나 운용상 병목 수준에는 미치지 않는다. TTL 관련 partial index 설계는 적절하며, evict의 두 쿼리 분리도 현 규모에서 문제없다. 전반적으로 성능 설계는 합리적이며, 주요 고부하 경로(recall cosine 쿼리, 임베딩 bulk 생성)는 이번 변경에서 건드리지 않았다.

## 위험도

LOW
