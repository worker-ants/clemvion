## 발견사항

---

### **[CRITICAL] chunk 단위 LLM 호출 순차 실행 — N×LLM 지연**
- **위치**: `graph-extraction.service.ts` — `extractDocument()` for 루프
- **상세**: 청크마다 `await callLlmForChunk()` 를 직렬 실행. 문서에 청크가 50개면 LLM 왕복 50회가 순서대로 처리됨. LLM 평균 지연 2초 가정 시 100초 소요. 임베딩 서비스(`EmbeddingService`)가 비슷한 문제를 배치 처리로 해결한 것과 대조적.
- **제안**: `p-limit` 등으로 concurrency=2~3 병렬 처리. `GraphExtractionProcessor` 가 이미 `concurrency: 2`로 Worker를 제한하고 있으므로 chunk 레벨에서는 3~5 정도 허용 가능.

```typescript
import pLimit from 'p-limit';
const limit = pLimit(3);
const results = await Promise.all(
  chunks.map((chunk) => limit(() => this.callLlmForChunk(llmConfig, chunk)))
);
```

---

### **[CRITICAL] `(knowledge_base_id, graph_extraction_status)` 복합 인덱스 누락**
- **위치**: `V025__graph_rag.sql`, `graph-extraction.processor.ts` — `maybeFinalizeKbBatch()`
- **상세**: `maybeFinalizeKbBatch`는 모든 extraction job 완료/실패 시마다 다음 쿼리를 실행:
  ```sql
  SELECT COUNT(*) FROM document
  WHERE knowledge_base_id = $1 AND graph_extraction_status IN ('pending','processing')
  ```
  KB 문서 1,000건 재추출 시 이 쿼리가 1,000번 실행되는데, `document.graph_extraction_status` 에 인덱스가 없어 `knowledge_base_id` 범위 스캔 후 상태 필터를 적용하는 풀 스캔에 가까운 처리가 반복됨.
- **제안**: 마이그레이션에 인덱스 추가.
  ```sql
  CREATE INDEX idx_document_kb_graph_status
    ON document(knowledge_base_id, graph_extraction_status);
  ```

---

### **[HIGH] `refreshKbStats` — 문서마다 전체 COUNT 쿼리 실행**
- **위치**: `graph-extraction.service.ts:refreshKbStats()`, `graph-query.service.ts:refreshKbStats()`
- **상세**: 문서 추출 완료 시마다 `entity`/`relation` 테이블 전체 `COUNT(*)` 를 실행. 100개 문서 배치 재추출 시 100번의 전체 카운트. KB 엔티티 수만 개일 때 쿼리당 비용 증가.
- **제안**: INSERT 시 `xmax=0`(신규 행) 감지로 delta 를 이미 계산하고 있으므로, 이를 활용해 `UPDATE knowledge_base SET entity_count = entity_count + $delta` 방식의 increment UPDATE 로 대체. 정합성이 우려된다면 배치 완료 시점(`reextract_status idle 복귀` 직전)에만 full COUNT.

---

### **[HIGH] entity/relation 개별 INSERT — 배치 가능**
- **위치**: `graph-extraction.service.ts:persistExtraction()` — entity UPSERT 루프, chunk_entity INSERT 루프
- **상세**: 추출된 entity마다 단건 `INSERT ... ON CONFLICT` 를 별도 쿼리로 실행. 청크당 entity 20개면 20회 개별 왕복. 트랜잭션 내부이므로 레이턴시보다 CPU/connection 오버헤드가 누적.
- **제안**: `unnest` 기반 bulk UPSERT 또는 `VALUES ($1,$2,...),($3,$4,...)` 형태의 다행 INSERT 사용. PostgreSQL의 `ON CONFLICT DO UPDATE` 는 멀티행 VALUES 에서도 동작함.

---

### **[HIGH] `maybeChainGraphExtraction` — 임베딩 완료마다 추가 DB JOIN 쿼리**
- **위치**: `document-embedding.processor.ts:maybeChainGraphExtraction()`
- **상세**: 모든 임베딩 완료 이벤트(vector 모드 포함)에서 `document JOIN knowledge_base` 쿼리를 실행해 `rag_mode` 를 조회. Vector 모드 KB 문서가 대다수인 경우 쿼리 비용 낭비.
- **제안**: `DocumentEmbeddingJob` 인터페이스에 `ragMode` 필드를 포함시켜 큐잉 시점에 전달. DB 조회 없이 `if (data.ragMode !== 'graph') return` 으로 처리.

---

### **[MEDIUM] `assertGraphKb` — API 호출마다 별도 SELECT**
- **위치**: `graph-query.service.ts:assertGraphKb()` — listEntities, getEntityDetail, deleteEntity 등 모든 핸들러
- **상세**: 모든 graph API 메서드가 KB 조회 SELECT → 실제 작업 SELECT 의 2회 직렬 쿼리를 수행. `deleteEntity` 는 KB SELECT + entity SELECT + DELETE + refreshKbStats(2× COUNT) = 5회 쿼리.
- **제안**: entity/relation 쿼리 조건에 `knowledge_base_id = :kbId` 를 포함시키면 KB 조회 없이 404 를 처리 가능. graph 모드 검증은 `rag_mode` 컬럼을 entity/relation 조회 JOIN 에 포함하거나, KB 메타데이터를 인메모리 캐시(NestJS `CACHE_MANAGER`, TTL 30초)로 유지.

---

### **[MEDIUM] ILIKE 앞치환 와일드카드 — 인덱스 무효화**
- **위치**: `graph-query.service.ts:listEntities()`, `listRelations()`
- **상세**: `e.name ILIKE '%search%'` 형태는 B-tree 인덱스를 사용할 수 없어 entity 테이블 전체 스캔. `listRelations` 는 head/tail entity 조인 후 3개 컬럼에 ILIKE 적용으로 더 비쌈.
- **제안**: `pg_trgm` 확장 설치 후 GIN 인덱스 추가.
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX idx_entity_name_trgm ON entity USING gin(name gin_trgm_ops);
  CREATE INDEX idx_entity_display_trgm ON entity USING gin(display_name gin_trgm_ops);
  ```

---

### **[MEDIUM] 전체 청크 메모리 적재**
- **위치**: `graph-extraction.service.ts` — `chunkRepository.find({ where: { documentId } })`
- **상세**: 문서 청크 전체를 한 번에 SELECT. 청크가 수천 개이고 `content` 컬럼이 포함되면 수십 MB 를 한 번에 메모리에 올림.
- **제안**: cursor/pagination 방식으로 청크를 배치 단위(예: 50개)로 스트리밍 처리. TypeORM stream 또는 `skip/take` 루프 사용.

---

### **[LOW] 그래프 시각화 쿼리 — `ANY(uuid[])` 양방향 필터**
- **위치**: `graph-query.service.ts:getGraphVisualization()` — relation 조회 SQL
- **상세**: `head_entity_id = ANY($2) AND tail_entity_id = ANY($2)` 에서 최대 200개 UUID 배열을 양방향으로 검사. `idx_relation_kb_head` 는 head 쪽만 cover하며 tail 필터는 인덱스 후 재필터. 노드 200개 KB에서 relation 수만 건이면 느려질 수 있음.
- **제안**: 일단 현행 유지 허용 가능(시각화는 read-only 비주요 경로). 관계 수가 많아지면 `materialized view` 또는 application 레벨 필터링 고려.

---

### **[LOW] `getGraphVisualization` — staleTime 없음 (프론트엔드)**
- **위치**: `graph-visualization.tsx` — `useQuery`
- **상세**: `staleTime` 미설정으로 컴포넌트 마운트/포커스 시마다 서버 재요청. 시각화 데이터는 추출 작업 사이에는 변하지 않음.
- **제안**: `staleTime: 60_000` 추가.

---

## 요약

Graph RAG 구현의 핵심 성능 병목은 두 곳에 집중된다. 첫째, 청크별 LLM 호출 순차 실행으로 인해 대형 문서 추출이 선형적으로 느려지며 — 이는 청크 레벨 concurrency 3~5 병렬화로 즉시 개선 가능하다. 둘째, `maybeFinalizeKbBatch` 가 모든 job 완료 이벤트에서 인덱스 없이 `COUNT(*)` 를 실행하므로 배치 재추출 중 DB 부하가 문서 수에 비례해 증가하며, `(knowledge_base_id, graph_extraction_status)` 인덱스 추가로 해결된다. 그 외 entity 개별 INSERT 배치화, ILIKE 검색의 trigram 인덱스 적용, `refreshKbStats` 의 full-count → delta-increment 전환은 운영 규모가 커질수록 중요해지는 중기 개선 사항이다.

## 위험도

**HIGH**