### 발견사항

- **[INFO]** `maybeFinalizeKbBatch` NOT EXISTS 서브쿼리 — 복합 인덱스 의존
  - 위치: `document-embedding.processor.ts` / `graph-extraction.processor.ts` (컨텍스트 코드)
  - 상세: `WHERE knowledge_base_id = $1 AND embedding_status IN ('pending', 'processing')` / `graph_extraction_status IN ('pending', 'processing')` 패턴은 `document(knowledge_base_id, embedding_status)` 와 `document(knowledge_base_id, graph_extraction_status)` 복합 인덱스가 없으면 문서 수가 많은 KB에서 매 job 완료마다 full scan 이 발생. Diff 에 직접 추가된 쿼리는 아니지만 동 파일 컨텍스트 내 확인.
  - 제안: 마이그레이션에서 `CREATE INDEX CONCURRENTLY` 로 두 복합 인덱스 확보 여부 점검.

- **[INFO]** `persistExtraction` 내 entity/relation 개별 UPSERT — 트랜잭션 내 N+1
  - 위치: `graph-extraction.service.ts` (컨텍스트 코드, 이번 diff 변경 없음)
  - 상세: `for (const e of result.entities)` 루프에서 entity마다 `manager.query()` 1회, relation마다 1회 추가 실행. 트랜잭션 안이어서 정합성은 보장되지만, 청크당 entity 수가 클 경우 왕복 횟수가 선형 증가. 일반적 LLM 추출 결과(5–20개)에서는 허용 범위이나 상한이 없음.
  - 제안: 향후 성능 이슈 발생 시 `unnest` + 단일 bulk UPSERT로 교체 고려.

- **[INFO]** `cleanup-invalid-queue-jobs.ts` — Redis 전체 스캔, 페이지네이션 없음
  - 위치: `cleanup-invalid-queue-jobs.ts:57`
  - 상세: `queue.getJobs([...QUEUE_STATES])` 는 해당 상태의 모든 job 을 메모리로 로드. 수만 건 이상 누적 시 프로세스 메모리 문제 가능. 이번 diff 에서 신규 추가된 스크립트.
  - 제안: 1회성 정리 도구이므로 현 상황에서는 허용 가능. 단, 주석 또는 README 에 대규모 큐(`>10k jobs`)에서의 메모리 제한 경고 추가 권장.

- **[INFO]** `assertDocumentIdPayload` 가드 — TypeORM `update(undefined, …)` 차단 (긍정 평가)
  - 위치: `embedding.service.ts:60–70`, `graph-extraction.service.ts:97–109`
  - 상세: `documentId` 가 falsy 일 때 `documentRepository.update(undefined, {...})` 를 TypeORM 이 "Empty criteria(s)" 로 거부 → catch 블록이 동일 `update` 재호출해 2차 에러 연쇄가 발생하던 회귀를 진입부에서 차단. DB 관점에서 올바른 방어적 설계.

- **[INFO]** `correlated DELETE` — 서브쿼리 인덱스 의존
  - 위치: `graph-extraction.service.ts` (컨텍스트, doExtract 내)
  - 상세: `DELETE FROM chunk_entity WHERE chunk_id IN (SELECT id FROM document_chunk WHERE document_id = $1)` 패턴은 `document_chunk(document_id)` 와 `chunk_entity(chunk_id)` 인덱스 여부에 따라 성능 차이 큼.
  - 제안: 두 컬럼 모두 외래 키이므로 일반적으로 인덱스가 존재하겠지만 마이그레이션 스크립트에서 확인 필요.

---

### 요약

이번 diff 의 핵심 DB 관련 변경은 **TypeORM `update(undefined, …)` 연쇄 에러 방지 가드 추가**이며, 이는 DB 안전성 측면에서 명확히 긍정적이다. 신규 쿼리나 스키마 변경은 없고, SQL Injection 은 기존 코드 포함 전부 파라미터화 쿼리로 처리되어 문제 없다. 잠재적 우려는 컨텍스트 코드에 있는 `maybeFinalizeKbBatch` NOT EXISTS 서브쿼리의 복합 인덱스 미확보 시 성능 저하, 그리고 `persistExtraction` 내 트랜잭션 내 N+1 패턴으로, 두 항목 모두 현재 규모에서는 허용 가능하나 데이터 증가 시 모니터링이 필요하다.

### 위험도
**LOW**