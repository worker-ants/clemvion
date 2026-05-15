### 발견사항

---

**[CRITICAL]** `reextract_status` stuck 상태 — 비정상 종료 시 영구 잠금

- **위치**: `graph-extraction.processor.ts` `process()` / `GraphExtractionService.extractDocument()`
- **상세**: `extractDocument`는 내부 try-catch 로 에러를 흡수하고 `graphExtractionStatus = 'error'` 로 업데이트한 뒤 정상 반환한다. 그러나 BullMQ 워커가 OOM·강제 종료 등으로 `process()` 자체가 reject 되면 `extractDocument` 의 finally 경로가 실행되지 않아 해당 문서가 `'processing'` 상태로 남는다. `maybeFinalizeKbBatch` 는 `pending | processing` 카운트가 0 일 때만 `reextract_status = 'idle'` 로 되돌리므로, 해당 문서가 단 1 건이라도 `'processing'` 으로 잔류하면 KB 전체 재추출 잠금이 영구적으로 해제되지 않는다. 수동 DB 개입 없이는 복구 불가.
- **제안**: `GraphExtractionProcessor.process()` 에 `try-finally` 래퍼를 추가해 어떤 경우에도 document status 를 'error' 로 fallback 설정하도록 보장한다. 또는 BullMQ `removeOnFail` 대신 `attempts + backoff` 설정으로 재시도 후 최종 실패 시 `onFailed` 에서 강제 'error' 업데이트.

---

**[WARNING]** `reExtractAll` 비원자 시퀀스 — 서버 재기동 시 stuck

- **위치**: `knowledge-base.service.ts` `reExtractAll()` (CAS UPDATE → DELETE entity → UPDATE document → addBulk)
- **상세**: CAS 로 `reextract_status = 'in_progress'` 잠금 획득 후 DELETE/UPDATE/addBulk 가 별도 쿼리로 실행된다. **"UPDATE document SET ... 'pending'"** 과 **`graphQueue.addBulk()`** 사이에서 프로세스가 중단되면 문서 상태는 모두 `pending` 이지만 큐에 job 이 없어 처리가 시작되지 않고, `reextract_status` 는 `'in_progress'` 에 고착된다. 이 상태는 후속 API 호출도 409 로 거절하므로 복구 경로가 없다.
- **제안**: DELETE/UPDATE document/addBulk 를 하나의 DB 트랜잭션으로 묶고, 큐 추가(`addBulk`)는 트랜잭션 commit 이후에만 실행하는 "transactional outbox" 패턴 적용. 단기 방어책으로 재시작 후 `in_progress` 상태가 N분 이상 지속된 KB 를 `idle` 로 복구하는 스케줄러 추가.

---

**[WARNING]** `maybeFinalizeKbBatch` SELECT + UPDATE 비원자 TOCTOU

- **위치**: `graph-extraction.processor.ts:53–67`
- **상세**: `concurrency: 2` 로 두 워커가 거의 동시에 완료될 때, **Worker A** 가 COUNT 조회 시 Worker B 의 문서가 아직 DB에 `'processing'` 으로 남아 있으면 `remaining > 0` 으로 판단해 잠금 해제를 포기한다. 직후 Worker B 가 DB를 `'completed'` 로 갱신하고 COUNT 조회하면 `remaining = 0` 이어서 해제된다. **정상 경로에서는 최종적으로 해제**되지만, 위 CRITICAL 케이스(문서가 `'processing'` 에 잔류)와 결합하면 finalize 가 영구적으로 실패한다. 또한 SELECT → UPDATE 사이에 새 문서가 삽입되면 count 가 부풀어 finalize 가 지연될 수 있다.
- **제안**: SELECT/UPDATE 를 단일 원자 쿼리로 통합:
  ```sql
  UPDATE knowledge_base SET reextract_status = 'idle'
  WHERE id = $1 AND reextract_status = 'in_progress'
    AND NOT EXISTS (
      SELECT 1 FROM document
      WHERE knowledge_base_id = $1
        AND graph_extraction_status IN ('pending', 'processing')
    )
  ```

---

**[INFO]** `refreshKbStats` 비원자 SELECT+UPDATE (두 곳에 중복)

- **위치**: `graph-extraction.service.ts:~295` / `graph-query.service.ts:~300`
- **상세**: COUNT SELECT 와 UPDATE knowledge_base 사이에 entity/relation 삭제 이벤트가 끼어들면 캐시가 일시적으로 부정확해진다. "캐시" 컬럼이므로 허용 가능하지만, 완전히 동일한 private helper 가 두 서비스에 복사되어 있어 향후 수정 시 하나를 빠뜨릴 위험이 있다.
- **제안**: 공통 `GraphStatsHelper` 서비스로 분리하거나, 단일 `UPDATE ... SET entity_count = (SELECT COUNT(*) ...), relation_count = (SELECT COUNT(*) ...)` 서브쿼리 형태로 원자화.

---

**[INFO]** LLM 동시 호출 — concurrency=2 가 KB 간 격리 없음

- **위치**: `graph-extraction.processor.ts:21` (`{ concurrency: 2 }`) / `graph-extraction.service.ts:callLlmForChunk()`
- **상세**: 워커 concurrency=2 는 전역 제한이다. KB A 의 job 과 KB B 의 job 이 동시에 각자 LLM 을 호출할 수 있으며, KB 가 늘어날수록 실질 동시 LLM 호출 수는 상한을 넘을 수 있다. 현재 코드에는 API rate limit 초과 시 재시도 로직이 없다 (LlmService 내부에 있을 수 있으나 이 diff 에서는 확인 불가).
- **제안**: `graphQueue.add` 에 BullMQ `rateLimiter` 옵션 설정 또는 LlmService 레벨에서 exponential backoff retry 보장.

---

### 요약

가장 심각한 동시성 문제는 두 가지다. 첫째, BullMQ 워커가 예외 없이 종료되는 비정상 케이스(OOM 등)에서 문서가 `'processing'` 에 잔류해 `reextract_status` 잠금이 영구적으로 해제되지 않는 stuck 상태다. 둘째, `reExtractAll` 의 CAS-잠금 이후 DELETE/UPDATE/addBulk 시퀀스가 트랜잭션 밖에서 실행되어, 큐 등록 직전 프로세스 재시작 시 동일한 stuck 상태에 빠진다. `maybeFinalizeKbBatch` 의 SELECT+UPDATE TOCTOU 는 단독으로는 idempotent 하지만 위 두 케이스와 결합하면 복구 경로를 완전히 차단한다. 나머지는 캐시 inaccuracy(INFO) 및 잠재적 LLM rate limit 초과(INFO) 수준이다.

### 위험도
**HIGH**