### 발견사항

---

**[CRITICAL] `reExtractAll` 작업이 단일 트랜잭션으로 묶이지 않음**
- 위치: `knowledge-base.service.ts` — `reExtractAll`
- 상세: CAS lock (UPDATE reextract_status), `DELETE FROM entity`, `UPDATE document SET graph_extraction_status = 'pending'`, `graphQueue.addBulk` 가 각각 독립 쿼리로 실행됨. 서버가 entity DELETE 후 document status 리셋 전에 크래시되면 entity 는 삭제됐으나 문서는 여전히 `completed` 상태로 남고, `reextract_status`는 `in_progress` 에 영구 잠금됨.
- 제안: entity DELETE + document status reset 을 DataSource.transaction() 하나로 묶어야 함. `addBulk` 는 트랜잭션 외부에 두되, 트랜잭션이 성공한 뒤에만 호출.

---

**[WARNING] `reExtractDocument` 가 KB 전체 재추출 잠금(`reextract_status`)을 확인하지 않음**
- 위치: `knowledge-base.service.ts` — `reExtractDocument`
- 상세: KB 전체 재추출이 진행 중(`in_progress`)인 동안 단건 재추출 API 를 호출하면, 이미 삭제·리셋 중인 entity/chunk_entity 에 동시 쓰기가 발생해 카운트 캐시 및 중간 상태가 불일치할 수 있음.
- 제안: `reExtractDocument` 진입 시 `kb.reextractStatus === 'in_progress'` 이면 409 반환.

---

**[WARNING] `extractDocument` pre-try 예외 발생 시 KB가 `in_progress` 영구 잠금될 수 있음**
- 위치: `graph-extraction.service.ts` — `extractDocument`, `graph-extraction.processor.ts` — `maybeFinalizeKbBatch`
- 상세: `documentRepository.findOne` 또는 `kbRepository.findOne` (try 블록 바깥)이 DB 오류로 throw 하면 `graphExtractionStatus`가 `'pending'` 그대로 남음. `maybeFinalizeKbBatch` 는 `'pending'`을 미완료로 집계하므로 해당 문서의 job 이 완료/실패 이벤트를 발생시켜도 `remaining > 0` 이 돼 KB 잠금이 해제되지 않음.
- 제안: `extractDocument` 의 lookup 실패(doc/kb not found 제외) 도 catch 로 감싸 `graphExtractionStatus = 'error'` 로 설정하거나, processor `onFailed` 에서 강제로 해당 문서 상태를 `'error'` 로 UPDATE.

---

**[WARNING] `document.graph_extraction_status` 컬럼에 인덱스 없음**
- 위치: `V025__graph_rag.sql`, `graph-extraction.processor.ts` — `maybeFinalizeKbBatch`
- 상세: `COUNT(*) FILTER (WHERE graph_extraction_status IN ('pending', 'processing'))` 쿼리가 `knowledge_base_id` 조건과 함께 실행되지만 `graph_extraction_status`에 인덱스가 없어 대규모 KB 에서 매 job 완료마다 전체 스캔 발생.
- 제안: `CREATE INDEX idx_doc_kb_graph_status ON document(knowledge_base_id, graph_extraction_status)` 추가.

---

**[WARNING] vector 모드 KB 에 graph 파라미터 설정 가능 — 서버 레이어 무검증**
- 위치: `update-knowledge-base.dto.ts`, `knowledge-base.service.ts` — `update`
- 상세: `UpdateKnowledgeBaseDto` 에 `maxHops`, `vectorSeedTopK`, `expandedChunkLimit`, `extractionLlmConfigId` 가 포함되어 있으나 서비스의 `update()` 메서드는 `ragMode` 검증 없이 무조건 KB 에 저장. vector 모드 KB 에 이 값이 저장되어도 무해하지만, 의미 없는 데이터 오염 + 클라이언트 혼란.
- 제안: `update()` 에서 graph 파라미터가 포함된 요청이 들어오면 `kb.ragMode !== 'graph'` 시 400 반환 또는 해당 필드 무시 처리 명시.

---

**[WARNING] `reExtractDocument` 컨트롤러의 Swagger `@ApiAcceptedWrappedResponse` 타입 오류**
- 위치: `knowledge-base.controller.ts` — `reExtractDocument`
- 상세: `@ApiAcceptedWrappedResponse(ReEmbedAcceptedDto, ...)` 를 사용하고 있으나 실제 반환값은 `{ message: string }` 이고 `ReEmbedAcceptedDto`는 `documentCount`를 포함. API 문서가 실제 응답 스키마와 다름.
- 제안: `reExtractDocument` 전용 최소 DTO 또는 `{ message: string }` 에 맞는 DTO 로 교체.

---

**[WARNING] `maybeChainGraphExtraction` 에러 시 silent swallow — graph 추출 누락**
- 위치: `document-embedding.processor.ts` — `maybeChainGraphExtraction`
- 상세: graph-extraction 큐 `add` 실패 시 `catch` 에서 `warn` 로그만 기록하고 document 의 `graphExtractionStatus` 는 여전히 `'pending'` 으로 남음. 해당 문서는 이후에 재시도되지 않아 그래프가 영구적으로 불완전해짐.
- 제안: 큐 add 실패 시 `documentRepository.update(documentId, { graphExtractionStatus: 'error' })` 호출하거나, dead-letter 메커니즘 마련.

---

**[WARNING] `document.graph_extraction_status` 기본값 `'pending'` — vector 모드 KB 에도 동일 적용**
- 위치: `V025__graph_rag.sql`, `document.entity.ts`
- 상세: vector 모드 KB 의 모든 문서가 `graph_extraction_status = 'pending'` 으로 초기화됨. `graph-stats` API 는 graph 모드 KB 에서만 호출되므로 직접 문제는 없으나, 향후 전체 문서 쿼리나 모니터링 시 오인 가능.
- 제안: vector 모드 KB 문서에는 NULL 허용 또는 별도 상태값(`'not_applicable'`) 사용 검토.

---

**[INFO] `refreshKbStats` 로직 `GraphExtractionService`·`GraphQueryService` 양쪽 중복**
- 위치: `graph-extraction.service.ts:L315`, `graph-query.service.ts:L307`
- 상세: 코드 주석에 "동일 helper 를 둔다"고 명시했으나 두 서비스가 분리된 private 메서드로 동일 SQL을 중복 관리. 한쪽만 수정할 경우 불일치 발생 위험.
- 제안: `GraphStatsHelper` 같은 별도 provider 로 추출 또는 `GraphQueryService` 를 `GraphExtractionService` 에서 의존하도록 재구성.

---

**[INFO] `@ApiQuery` 데코레이터 누락 — `type` 필터 문서화 불완전**
- 위치: `knowledge-base.controller.ts` — `listEntities`
- 상세: `@Query('type') type?: string` 파라미터에 `@ApiQuery({ name: 'type', enum: EntityType, required: false })` 데코레이터가 없어 Swagger UI 에서 타입 제약 확인 불가.
- 제안: `@ApiQuery` 추가.

---

### 요약

Graph RAG 의 핵심 비즈니스 로직(entity/relation 추출·검색·시각화)은 스펙에 정의된 요구사항을 전반적으로 잘 구현했으나, **운영 안전성 측면에서 중요한 요구사항이 미완성**이다. 특히 KB 전체 재추출(`reExtractAll`) 작업이 트랜잭션 없이 여러 단계로 분리되어 있어 중간 장애 시 KB 가 `in_progress` 상태로 영구 잠금될 수 있고, 단건 재추출이 KB-wide lock 을 무시하는 점은 concurrent modification 요건에 미충족이다. 그래프 추출 큐 연결 실패 시 silent swallow 로 인한 데이터 유실 가능성과 대량 문서 환경에서의 인덱스 누락도 운영 요건에 영향을 준다.

### 위험도

**HIGH**