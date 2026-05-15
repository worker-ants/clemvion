### 발견사항

---

**[WARNING] StuckDocumentRecoveryService - N+1 DB·큐 호출**
- 위치: `stuck-document-recovery.service.ts:90-100` (`recoverStuckEmbedding`), `117-127` (`recoverStuckGraphExtraction`)
- 상세: `for (const row of rows)` 안에서 `dataSource.query(UPDATE ... WHERE id = $1)`과 `embeddingQueue.add()`를 **각 행마다 순차 await** 한다. N개 stuck 문서 → N번 DB 라운드트립 + N번 큐 add. 부팅 시 실행되므로 규모가 커질수록 기동 지연이 선형 증가한다.
- 제안:
  ```typescript
  // 단일 배치 UPDATE
  await this.dataSource.query(
    `UPDATE document SET embedding_status='pending', ...
     WHERE id = ANY($1) AND embedding_status = 'processing'`,
    [rows.map(r => r.id)],
  );
  // addBulk으로 단일 호출
  await this.embeddingQueue.addBulk(rows.map(r => ({ name: 'embed', data: {...} })));
  ```

---

**[WARNING] stuck 회수 쿼리에 대한 인덱스 미비**
- 위치: `V037__kb_retry_failed_status.sql:57-58` / `stuck-document-recovery.service.ts:65-69`
- 상세: 마이그레이션에서 생성한 `idx_document_kb_embedding_status`는 `(knowledge_base_id, embedding_status)` 복합 인덱스이다. 그러나 stuck 회수 쿼리는 `knowledge_base_id` 없이 `embedding_status = 'processing' AND embedding_last_attempted_at < NOW() - X` 조건으로 **전체 테이블을 status 기준으로 스캔**한다. 해당 인덱스는 이 쿼리를 효율적으로 cover하지 못한다.
- 제안: partial index 추가
  ```sql
  CREATE INDEX idx_document_embedding_processing_stuck
    ON document(embedding_last_attempted_at)
    WHERE embedding_status = 'processing';
  -- graph도 동일
  CREATE INDEX idx_document_graph_processing_stuck
    ON document(graph_last_attempted_at)
    WHERE graph_extraction_status = 'processing';
  ```

---

**[WARNING] withTimeout race — 고아 HTTP 커넥션 누적 가능성**
- 위치: `llm.service.ts:83-88`, `retry-with-backoff.util.ts:77`
- 상세: `withTimeout`은 Promise.race로 구현되어 있어, 60s(embed) / 90s(graph) timeout이 발생하면 로컬에서는 reject되지만 **하위 provider의 HTTP 요청은 계속 살아있다**. `retryWithBackoff`가 1s 백오프 후 2번째 attempt를 시작하면, 이전 attempt의 hang 커넥션과 새 커넥션이 동시에 열린다. 3회 모두 timeout되면 최대 `(60+60+60) + (1+4)` ≈ 186s 동안 3개 커넥션이 pool에 묶인다. 동시 문서 처리량(BullMQ concurrency)에 따라 pool 고갈 가능.
- 제안: 단기적으로는 코드 주석에 명시된 대로 LLMClient에 AbortSignal 전파를 후속 PR 우선순위로 올릴 것. 현재는 BullMQ worker concurrency를 HTTP 커넥션 pool 크기의 1/4 이하로 설정해 완화.

---

**[WARNING] 재시도 시 jitter 없음 — 동시 실패 시 thundering herd**
- 위치: `retry-with-backoff.util.ts:96`
  ```typescript
  const delay = baseDelayMs * Math.pow(4, attemptIdx);
  ```
- 상세: 동일 시점에 여러 문서가 동시에 LLM timeout을 받으면, 동일 backoff 구간(1s / 4s / 16s) 이후 동시에 재시도를 트리거한다. LLM rate limit(429)이 원인인 경우 thundering herd가 발생해 재시도도 연속 실패할 가능성이 높다.
- 제안:
  ```typescript
  const jitter = Math.random() * 0.3 * delay; // ±30% jitter
  const delay = baseDelayMs * Math.pow(4, attemptIdx) + jitter;
  ```

---

**[WARNING] useKbEvents — O(N) 채널 구독 + 문서 추가/삭제 시 전체 재구독**
- 위치: `use-kb-events.ts:83-85`
- 상세: 문서 N개가 있으면 `kb:${docId}` 채널을 N개 구독한다. `documentIds` 배열이 바뀔 때마다(새 문서 업로드 등) cleanup에서 N개 unsubscribe 후 새 N개를 재구독한다. 문서 수 100+ KB에서 비선형 WebSocket 오버헤드 발생. 또한 `documentIds.join(",")` 비교 문자열이 렌더마다 O(N) 생성된다.
- 제안: backend에서 `kb:${knowledgeBaseId}` 단일 채널로 emit 하도록 변경. Frontend는 채널 1개만 구독하면 된다. join string 대신 `documentIds.length` + 특정 ID 해시 비교로 변경도 고려.

---

**[INFO] getEmbeddingStats — KB 존재 확인 + 집계 쿼리 2회 분리**
- 위치: `knowledge-base.service.ts:361-385`
- 상세: `findById()`로 1차 쿼리 후 집계 SELECT로 2차 쿼리. 5s polling 환경에서 초당 호출 횟수가 많을 경우 불필요한 왕복이 추가된다.
- 제안: 단일 쿼리로 합칠 수 있다.
  ```sql
  SELECT kb.reembed_status,
         COUNT(*) FILTER (WHERE embedding_status='completed')::int AS completed, ...
    FROM knowledge_base kb
    LEFT JOIN document d ON d.knowledge_base_id = kb.id
   WHERE kb.id = $1 AND kb.workspace_id = $2
   GROUP BY kb.reembed_status
  ```

---

**[INFO] graph / embedding 이중 polling — 5s × 2 요청**
- 위치: `[id]/page.tsx:169-186`
- 상세: graph 모드 KB의 경우 `graphStats`(5s)와 `embeddingStats`(5s) 두 쿼리가 동시에 polling되어 10s당 최소 4번의 API 호출이 발생한다. 문서가 많은 KB에서 대량 사용자가 동시에 페이지를 열면 집계 쿼리 부하가 배가된다.
- 제안: 두 통계를 단일 `GET /knowledge-bases/:id/stats` 엔드포인트로 병합하거나, WS 이벤트가 정상 수신되는 동안 polling 간격을 30s로 완화.

---

**[INFO] Interval 계산을 SQL 내 문자열 concat으로 처리**
- 위치: `stuck-document-recovery.service.ts:69`
  ```sql
  AND d.embedding_last_attempted_at < NOW() - ($1::text || ' ms')::interval
  ```
- 상세: 파라미터를 문자열로 변환한 후 interval 캐스팅을 매 쿼리마다 수행. 부팅 시 1회 실행이라 영향은 미미하지만 불필요한 타입 변환이다.
- 제안:
  ```typescript
  const threshold = new Date(Date.now() - this.STUCK_THRESHOLD_MS);
  // SQL: AND d.embedding_last_attempted_at < $1
  // params: [threshold]
  ```

---

### 요약

전체적으로 재시도·실패·회복 시스템의 설계는 명확하고 BullMQ와 PostgreSQL의 특성을 잘 활용했다. 가장 즉각적인 성능 위험은 두 가지다: `StuckDocumentRecoveryService`의 **N+1 패턴**(부팅 시 N번 순차 DB·큐 호출)과 **stuck 회수 쿼리를 cover하는 인덱스 부재**(전체 테이블 스캔 가능성). `withTimeout` race로 인한 **고아 커넥션 누적**은 현재 LLMClient 구조의 구조적 한계로 허용된 trade-off지만, 고부하 환경에서 pool 고갈로 이어질 수 있어 AbortSignal 전파를 후속 PR에서 우선 처리해야 한다. Frontend의 per-document 채널 구독과 이중 polling은 규모 확장 시 눈에 띄는 오버헤드가 된다.

### 위험도

**MEDIUM** — 서비스 장애를 즉시 유발하는 CRITICAL 이슈는 없으나, N+1 패턴과 인덱스 미비는 문서 수가 늘어남에 따라 부팅 지연과 slow query로 표면화될 수 있으며, 고아 커넥션 문제는 LLM timeout이 잦은 환경에서 HIGH로 격상될 수 있다.