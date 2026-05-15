### 발견사항

---

**[HIGH] StuckDocumentRecoveryService — 다중 인스턴스 동시 부팅 시 이중 처리 경쟁 조건**
- 위치: `stuck-document-recovery.service.ts` `recoverStuckEmbedding` / `recoverStuckGraphExtraction`
- 상세: SELECT와 UPDATE+Queue add 사이에 원자성이 없음. 두 인스턴스가 동시에 부팅되면 두 인스턴스 모두 동일한 `processing` 문서를 SELECT로 읽어 `rows`에 담은 뒤, 각자 `WHERE id = $1 AND embedding_status = 'processing'` UPDATE(→ 두 번째 인스턴스는 0행 업데이트)를 실행해도 **두 인스턴스 모두 `embeddingQueue.add`를 호출**한다. 결과적으로 동일 문서가 두 워커에서 동시에 `reEmbed=true`로 처리된다. `doProcess` 진입부가 `DELETE chunk WHERE documentId` → 재삽입하는 구조이므로, Worker A가 삽입 중인 청크를 Worker B가 삭제하는 시나리오가 발생해 **청크 중복 또는 유실**이 일어날 수 있다.
- 제안: SELECT를 `FOR UPDATE SKIP LOCKED`로 교체하거나, UPDATE RETURNING을 SELECT 대신 단독으로 사용해 "성공적으로 UPDATE된 행"만 큐에 추가:
  ```sql
  UPDATE document
     SET embedding_status = 'pending'
   WHERE id IN (
     SELECT id FROM document
      WHERE embedding_status = 'processing'
        AND embedding_last_attempted_at IS NOT NULL
        AND embedding_last_attempted_at < NOW() - interval '10 min'
      FOR UPDATE SKIP LOCKED
   )
   RETURNING id, knowledge_base_id, ...
  ```

---

**[MEDIUM] withTimeout — 타임아웃 후 HTTP 소켓 Lingering (연결 풀 고갈 위험)**
- 위치: `llm.service.ts` `chat()` / `embed()` + `embedding.service.ts` `EMBED_TIMEOUT_MS = 60_000`, `graph-extraction.service.ts` `GRAPH_CHUNK_TIMEOUT_MS = 90_000`
- 상세: `withTimeout`은 `Promise.race`로 구현되어 있어 타임아웃이 먼저 resolve되면 내부 `client.chat/embed` Promise는 GC될 때까지 계속 실행된다. `retryWithBackoff`가 최대 4회 시도하고, 그래프 추출은 `pLimit(3)` 동시 청크 처리이므로, 타임아웃 시나리오에서 **최대 4 × 3 = 12개의 Dangling HTTP 요청**이 90초간 연결을 점유할 수 있다. AbortSignal 미전파는 코드에 명시되어 있으나, 대용량 KB에서 다수 문서가 동시에 재시도될 경우 provider HTTP 클라이언트의 keep-alive 풀이 고갈될 수 있다.
- 제안: 단기적으로는 `withTimeout`에서 reject 시 내부 promise를 `.catch(() => undefined)` 처리해 unhandled rejection을 억제하는 것 외에, 후속 PR에서 언급된 AbortSignal 전파를 우선 처리할 것을 권장. 그 전까지는 연결 풀 크기(`maxSockets`)를 충분히 확보해 완화.

---

**[WARNING] retryFailedDocuments — DB UPDATE ↔ Queue addBulk 비원자성**
- 위치: `knowledge-base.service.ts` `retryFailedDocuments`
- 상세: `UPDATE ... RETURNING id`(성공) 직후 `embeddingQueue.addBulk(...)`가 실패하면, 문서 상태는 `'failed' → 'pending'`으로 전환되었지만 큐에는 들어가지 않은 채 방치된다. Stuck recovery는 `embedding_status = 'processing'`만 대상으로 하므로 `'pending'` 상태의 문서는 자동 회수되지 않는다. `embedding_last_attempted_at`이 NULL 또는 최신값이면 10분 임계 조건도 통과하지 못한다.
- 제안: `addBulk` 실패 시 해당 문서들을 다시 `'failed'`로 롤백하거나, 아니면 최소한 `logger.error`로 알림 + 문서 ID 목록을 기록해 운영자가 수동 복구할 수 있게 처리.

---

**[INFO] onAttempt의 update + increment 비원자성**
- 위치: `embedding.service.ts` `onAttempt` 콜백
- 상세: `embeddingStatus='error'` UPDATE와 `embeddingRetryCount` INCREMENT는 별개 쿼리. 단일 워커 내에서는 await로 순차 실행되어 안전하나, 두 쿼리 사이에 프로세스가 종료되면 status='error' 상태에서 retry_count가 증가하지 않는 불일치가 남는다. 재기동 시 stuck recovery가 이를 회수하므로 데이터 손상은 없지만 카운트 정확도가 떨어진다.
- 제안: 허용 가능한 수준의 정확도 이슈이나, 단일 UPDATE로 `SET embedding_status='error', embedding_retry_count = embedding_retry_count + 1, ...`을 처리하면 원자성 보장 + 쿼리 수 감소.

---

**[INFO] 잠재적 재시도 증폭 — LlmService.withRetry ↔ retryWithBackoff 이중 레이어**
- 위치: `llm.service.ts` `withRetry` 내부에서 `client.embed/chat` 호출 → 이를 `retryWithBackoff` 안에서 다시 감쌈
- 상세: `withRetry`가 rate limit(429)에 대해 자체 재시도를 수행하고, 외부 `retryWithBackoff`도 429를 재시도 대상으로 분류하면 4(외부) × N(내부) 배로 재시도가 증폭될 수 있다. `withRetry` 구현이 diff에 없어 정확한 영향 범위는 확인 불가.
- 제안: `retryWithBackoff`가 적용되는 경로에서는 `withRetry`의 rate limit 재시도를 비활성화하거나, `isRetryable`에서 429를 제외하는 것 검토.

---

### 요약

전반적으로 재시도·실패 상태 관리 로직은 BullMQ 분산 큐를 통해 기본 동시성을 처리하고 있으며, DB UPDATE에 조건부 WHERE절(`AND embedding_status = 'failed'`)을 적용해 낙관적 잠금 역할을 하는 패턴은 적절하다. 가장 심각한 문제는 `StuckDocumentRecoveryService`의 다중 인스턴스 부팅 시 SELECT→UPDATE 비원자성으로, 동일 문서가 두 워커에서 동시에 `reEmbed=true`로 처리되어 청크 데이터가 손상될 수 있다. `withTimeout`의 Dangling Promise는 코드에서 인지하고 있으나, 재시도 조합 시 연결 풀 고갈 리스크가 현실적이다. JavaScript 단일 스레드 모델 덕분에 `pLimit` 내의 공유 변수 누적이나 throttle 로직 등 프론트엔드 동시성 이슈는 실질적으로 안전하다.

### 위험도

**MEDIUM**