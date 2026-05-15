### 발견사항

---

**[CRITICAL] `GraphExtractionService` 테스트 파일 없음**
- 위치: `backend/src/modules/knowledge-base/graph/graph-extraction.service.ts` (343줄)
- 상세: Graph RAG의 핵심 파이프라인인 `extractDocument`, `callLlmForChunk`, `parseExtraction`, `persistExtraction`, `refreshKbStats` 등 모든 메서드에 대한 테스트가 전혀 없습니다. 특히 `persistExtraction`의 PostgreSQL-specific `xmax = 0 AS inserted` 신규 삽입 감지 로직, entity/relation 중복 처리(mention_count += 1, weight += 1), 트랜잭션 원자성은 비즈니스 크리티컬함에도 테스트되지 않습니다.
- 제안: `graph-extraction.service.spec.ts` 생성 필요. 최소 커버 케이스: (1) vector 모드 KB silent skip, (2) 빈 chunk 완료 처리, (3) LLM 응답 파싱 실패 시 빈 결과 반환, (4) entity dedup — 기존 entity는 mention_count 증가 반환, (5) 재추출 시 기존 chunk_entity 선삭제, (6) persistExtraction 트랜잭션 원자성

---

**[CRITICAL] `GraphQueryService` 테스트 파일 없음**
- 위치: `backend/src/modules/knowledge-base/graph/graph-query.service.ts` (323줄)
- 상세: `assertGraphKb`, `listEntities`, `getEntityDetail`, `deleteEntity`, `listRelations`, `deleteRelation`, `getGraphVisualization` 전체 미테스트. 특히 `type` 파라미터 검증(INVALID_ENTITY_TYPE 400), `getGraphVisualization`의 limit 클램핑(1~200), entity 삭제 후 cascade로 relation도 삭제됨을 검증하는 KB stats 재계산 로직이 누락됩니다.
- 제안: `graph-query.service.spec.ts` 생성. vector 모드 KB에 graph API 호출 시 `KB_NOT_GRAPH_MODE` 400 반환 케이스를 포함해야 합니다.

---

**[CRITICAL] `GraphExtractionProcessor` 테스트 파일 없음**
- 위치: `backend/src/modules/knowledge-base/queues/graph-extraction.processor.ts`
- 상세: `maybeFinalizeKbBatch`의 reextract_status idle 복원 로직이 미테스트. "pending/processing 문서가 0건일 때만 idle" 조건은 `COUNT` 조회와 `UPDATE` 사이에 TOCTOU race가 내재되어 있으나, 이를 감지하는 테스트가 없습니다. 실패한 job도 `onFailed`에서 동일 finalize를 호출하는 설계 의도도 검증되지 않습니다.

---

**[WARNING] `reExtractAll` 테스트에서 DELETE/UPDATE 호출 미검증**
- 위치: `knowledge-base.service.spec.ts:175`
- 상세: 실제 `reExtractAll`은 dataSource.query를 3회 호출합니다(CAS UPDATE → DELETE entity → UPDATE document status). 테스트는 1번째 호출만 `toHaveBeenNthCalledWith`로 검증하고, entity 삭제와 document status reset은 검증하지 않습니다. 이 두 호출이 제거돼도 테스트는 통과합니다.
- 제안:
```typescript
expect(mockDataSource.query).toHaveBeenNthCalledWith(
  2,
  expect.stringMatching(/DELETE FROM entity WHERE knowledge_base_id/),
  ['kb-1'],
);
expect(mockDataSource.query).toHaveBeenNthCalledWith(
  3,
  expect.stringMatching(/UPDATE document SET graph_extraction_status = 'pending'/),
  ['kb-1'],
);
```

---

**[WARNING] `parseExtraction`이 entity/relation 필드 shape을 검증하지 않음 — 런타임 오류 위험**
- 위치: `graph-extraction.service.ts:185`
- 상세: `parsed.entities`가 배열임은 확인하지만, 개별 항목의 `name`이 null/undefined인 경우를 걸러내지 않습니다. 이후 `normalizedName = e.name.trim().toLowerCase()`에서 TypeError가 발생합니다. 테스트도 이 경우를 커버하지 않습니다.
- 제안: `persistExtraction` 내 `if (!normalizedName) continue`가 일부 방어하지만, LLM이 `name: null`을 반환하면 `null.trim()` 시점에 먼저 터집니다. `parseExtraction`에서 name 필드 유효성 검사 추가 및 테스트 케이스 추가 필요.

---

**[WARNING] `maybeChainGraphExtraction` 실패 경로 미테스트**
- 위치: `document-embedding.processor.ts:106`
- 상세: DB 조회 실패 시 `logger.warn` 후 silently return하는 로직이 있습니다. graph 모드 KB의 문서가 임베딩은 되었지만 graph-extraction 큐에 적재되지 않는 상황을 아무도 감지하지 못합니다. 이 실패 경로에 대한 테스트가 없습니다.

---

**[WARNING] `getGraphStats` 테스트 누락**
- 위치: `knowledge-base.service.ts`에서 새로 추가된 `getGraphStats` 메서드
- 상세: `knowledge-base.service.spec.ts`에 `getGraphStats` describe 블록이 없습니다. vector 모드 KB 호출 시 `KB_NOT_GRAPH_MODE` 반환, document 카운트 쿼리 결과 매핑 등이 미검증입니다.

---

**[WARNING] `refreshKbStats` 중복 구현으로 테스트 커버리지 분산**
- 위치: `graph-extraction.service.ts:300`, `graph-query.service.ts:307`
- 상세: 동일 SQL을 두 곳에 중복 구현하면서 "별도 서비스가 의존성 없이 호출할 수 있어"라고 주석으로 설명합니다. 한 쪽의 SQL이 수정되어도 테스트가 없어 divergence를 감지할 수 없습니다.

---

**[INFO] `makeKbRow()` fixture helper 설계 양호**
- 위치: `rag-search.service.spec.ts:3`
- 상세: 신규 컬럼 default를 중앙에서 관리하는 패턴. 향후 컬럼 추가 시 테스트 수정 비용을 최소화합니다. 동일 패턴을 다른 spec 파일에도 적용하면 좋습니다.

---

**[INFO] 그래프 검색 모드 라우팅 테스트 구조 적절**
- 위치: `rag-search.service.spec.ts:243`
- 상세: `searchWithMeta`를 통한 graph KB 라우팅 테스트가 SQL CTE 구조(`WITH seed AS`, `expanded_entities`, `chunk_entity`)를 문자열 매칭으로 검증합니다. 구현 변경 시 감지 가능합니다.

---

### 요약

Graph RAG 도입의 테스트 커버리지 상태는 **서비스 계층의 상위 CRUD는 잘 커버되었지만, 실제 비즈니스 로직의 핵심인 graph extraction 파이프라인 전체(GraphExtractionService·GraphQueryService·GraphExtractionProcessor)가 완전히 미테스트**입니다. `knowledge-base.service.spec.ts`에서 `reExtractAll`·`reExtractDocument`의 happy path와 guard 케이스는 잘 작성되었고, `rag-search.service.spec.ts`의 graph 검색 모드 분기 테스트도 의도가 명확합니다. 그러나 LLM 호출·dedup UPSERT·chunk_entity 매핑·KB stats 캐시 갱신을 수행하는 `GraphExtractionService.persistExtraction`과, `reextract_status` 복원을 담당하는 `GraphExtractionProcessor.maybeFinalizeKbBatch`가 테스트되지 않아, graph 모드 추출이 잘못 동작해도 자동화된 방어막이 없는 상태입니다.

### 위험도
**HIGH**