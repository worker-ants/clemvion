### 발견사항

---

**[CRITICAL] `reExtractAll` 비원자적 흐름 — DB·큐 불일치 시 영구 교착**
- 위치: `knowledge-base.service.ts` — `reExtractAll`
- 상세: CAS(`reextract_status = 'in_progress'`) → DELETE entity → UPDATE document → queue.addBulk 순서가 트랜잭션 없이 실행됨. addBulk가 실패하거나 프로세스가 죽으면 entity는 삭제됐고 job은 없으며 status는 `in_progress`로 영구 고착. 수동 DB 복구 없이는 해소 불가.
- 제안: DB 조작(CAS + DELETE + UPDATE)을 `dataSource.transaction()`으로 묶고, 큐 enqueue 실패 시에도 `reextract_status`를 `idle`로 되돌리는 보상 로직 추가. (큐는 트랜잭션에 포함할 수 없으므로 at-least-once 설계 + 멱등성 보장으로 보완)

---

**[WARNING] CHECK 제약 추가 시 테이블 전체 스캔 락 — 무중단 배포 위험**
- 위치: `V025__graph_rag.sql` — `ADD CONSTRAINT chk_kb_rag_mode`, `chk_kb_max_hops`, `chk_kb_reextract_status`, `chk_doc_graph_extraction_status`
- 상세: `ADD CONSTRAINT ... CHECK` 는 기본적으로 기존 모든 행을 검증하며 `ACCESS EXCLUSIVE` 락을 잡음. 트래픽이 있는 상태에서 migration 적용 시 서비스 중단 발생 가능.
- 제안:
  ```sql
  ALTER TABLE knowledge_base ADD CONSTRAINT chk_kb_rag_mode
    CHECK (rag_mode IN ('vector', 'graph')) NOT VALID;
  -- 이후 별도 트랜잭션에서
  ALTER TABLE knowledge_base VALIDATE CONSTRAINT chk_kb_rag_mode;
  ```
  `NOT VALID` + `VALIDATE CONSTRAINT` 분리 시 검증은 `SHARE UPDATE EXCLUSIVE` 락만 취득하여 읽기/쓰기를 차단하지 않음.

---

**[WARNING] FK 제약 추가 — `SHARE ROW EXCLUSIVE` 락**
- 위치: `V025__graph_rag.sql` — `fk_kb_extraction_llm_config`
- 상세: FK 추가도 양쪽 테이블에 `SHARE ROW EXCLUSIVE` 락을 요구. `llm_config` 테이블이 크거나 동시 쓰기가 많다면 중단 위험.
- 제안: `NOT VALID`로 추가 후 `VALIDATE CONSTRAINT`로 분리 적용.

---

**[WARNING] `refreshKbStats` — 문서 완료마다 COUNT(*) 전수 집계, O(n²) DB 부하**
- 위치: `graph-extraction.service.ts` (line ~), `graph-query.service.ts` — `refreshKbStats`
- 상세: 문서 n개가 순차 처리될 때, 각 완료마다 `COUNT(*) FROM entity WHERE knowledge_base_id = $1` / `COUNT(*) FROM relation WHERE ...` 를 실행. entity·relation이 수십만 건인 KB에서 n번의 전수 카운트가 발생 → 부하 급증. 또한 두 서비스에 동일 메서드 중복 존재 (drift 위험).
- 제안: 증분 방식으로 전환. UPSERT 결과로 반환된 `inserted` 플래그를 누적해 `UPDATE knowledge_base SET entity_count = entity_count + $delta WHERE id = $1` 사용. `refreshKbStats`는 재추출 완료(finalizeKbBatch) 시점에만 1회 호출하거나, 별도 shared 서비스로 추출.

---

**[WARNING] `document(knowledge_base_id, graph_extraction_status)` 인덱스 누락**
- 위치: `V025__graph_rag.sql`, `graph-extraction.processor.ts` — `maybeFinalizeKbBatch`
- 상세: finalization 체크 쿼리 및 `getGraphStats`의 `COUNT FILTER (WHERE graph_extraction_status = 'completed')` 모두 `document WHERE knowledge_base_id = $1 AND graph_extraction_status IN (...)` 조건 사용. `document` 테이블에 `graph_extraction_status` 컬럼 인덱스가 없으므로 문서가 많아질수록 풀스캔.
- 제안: 마이그레이션에 추가:
  ```sql
  CREATE INDEX idx_document_kb_graph_status
    ON document(knowledge_base_id, graph_extraction_status);
  ```

---

**[WARNING] `maybeChainGraphExtraction` — 모든 임베딩 완료마다 DB 조회**
- 위치: `document-embedding.processor.ts` — `maybeChainGraphExtraction`
- 상세: 모든 문서 임베딩 완료(vector 모드 포함)마다 document+knowledge_base JOIN 쿼리 실행. 99%의 경우(vector 모드) 결과가 `rag_mode != 'graph'`여서 no-op이지만 DB 조회는 발생.
- 제안: `DocumentEmbeddingJob`에 `ragMode: string`을 포함시켜 전달하거나, KB 생성 시 임베딩 큐에 `ragMode` 메타데이터를 포함. 또는 최소한 document 테이블 단일 row 조회 후 KB JOIN 제거.

---

**[WARNING] `ILIKE %...%` 검색에 trigram 인덱스 없음**
- 위치: `graph-query.service.ts` — `listEntities` (`e.name ILIKE :search OR e.display_name ILIKE :search`), `listRelations` (`r.predicate ILIKE :search OR head.name ILIKE :search OR tail.name ILIKE :search`)
- 상세: 선행 와일드카드 `%search%`는 B-tree 인덱스를 활용할 수 없음. entity/relation이 수만 건 이상이면 KB 전체 풀스캔 발생.
- 제안: `pg_trgm` 확장 활성화 후 GIN 인덱스 추가:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX idx_entity_name_trgm ON entity USING GIN (name gin_trgm_ops);
  CREATE INDEX idx_entity_display_name_trgm ON entity USING GIN (display_name gin_trgm_ops);
  CREATE INDEX idx_relation_predicate_trgm ON relation USING GIN (predicate gin_trgm_ops);
  ```

---

**[WARNING] 그래프 시각화 쿼리 — head·tail 동시 필터링 인덱스 미스**
- 위치: `graph-query.service.ts` — `getGraphVisualization` raw SQL
- 상세: `WHERE knowledge_base_id = $1 AND head_entity_id = ANY($2) AND tail_entity_id = ANY($2)` 조건에서 현재 인덱스(`idx_relation_kb_head`, `idx_relation_kb_tail`)는 각각 head 또는 tail 단방향만 커버. 두 조건을 동시에 만족하는 행을 찾으려면 head 인덱스로 후보를 좁힌 뒤 tail 조건으로 재필터. 상위 200개 entity의 relation을 조회할 때 KB 규모에 따라 느릴 수 있음.
- 제안: 시각화 쿼리 전용 인덱스 고려:
  ```sql
  CREATE INDEX idx_relation_kb_head_tail
    ON relation(knowledge_base_id, head_entity_id, tail_entity_id);
  ```

---

**[INFO] `entity_count`/`relation_count` 캐시 — 서비스 분리로 인한 관리 복잡성**
- 위치: `graph-extraction.service.ts`, `graph-query.service.ts` — 동일 `refreshKbStats` private 메서드 중복
- 상세: 두 서비스가 동일 SQL을 독립적으로 유지. 한쪽만 업데이트되면 로직 불일치 발생.
- 제안: `KbStatsService` 또는 `GraphSharedService` 등 공유 서비스로 추출.

---

**[INFO] `graph_extraction_status DEFAULT 'pending'` — vector 모드 문서에서 의미 없는 컬럼**
- 위치: `V025__graph_rag.sql`, `document.entity.ts`
- 상세: vector 모드 KB의 문서는 항상 `pending` 상태로 남음. 기능적 오류는 없으나, 향후 혼란 가능성(예: monitoring 쿼리에서 오해).
- 제안: 허용 가능한 설계 trade-off이나, 필요 시 `graph_extraction_status IS NOT NULL AND kb.rag_mode = 'graph'` 조건을 보수적으로 적용하도록 내부 문서화.

---

**[INFO] OFFSET 기반 페이지네이션 — 대용량 데이터에서 성능 저하**
- 위치: `graph-query.service.ts` — `listEntities`, `listRelations`
- 상세: `SKIP((page-1)*limit)` 방식은 deep pagination 시 O(offset) 스캔. entity/relation이 수십만 건이고 후반 페이지를 요청하면 느려짐. 현재 서비스 규모에서는 허용 가능하나 성장 시 주의.

---

### 요약

Graph RAG 스키마 설계 자체(entity-relation-chunk_entity 3단 구조, UNIQUE 제약을 활용한 UPSERT dedup, KB 단위 cascade 삭제)는 견고하고 논리적으로 올바르다. 핵심 위험은 두 곳에 집중된다. 첫째, `reExtractAll`이 CAS·DELETE·큐 enqueue를 하나의 트랜잭션으로 묶지 않아 장애 시 status가 영구 교착될 수 있다(Critical). 둘째, migration의 CHECK/FK 제약이 `NOT VALID` 없이 추가되어 운영 중 배포 시 테이블 락을 초래할 수 있다(Warning). 그 외에도 매 문서 완료마다 전수 COUNT 집계(`refreshKbStats` O(n²) 부하), `graph_extraction_status` 컬럼 인덱스 누락, ILIKE 검색의 trigram 인덱스 부재가 운영 규모 확장 시 병목이 될 수 있다.

### 위험도
**HIGH**