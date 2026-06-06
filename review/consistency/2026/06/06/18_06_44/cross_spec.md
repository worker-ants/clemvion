# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`  
Target: `spec/5-system/9-rag-search.md` (scope), 구현 diff `codebase/backend/src/modules/knowledge-base/search/`

---

## 발견사항

### 1. 데이터 모델 충돌

충돌 없음. diff 가 도입한 `hnswEfSearchFor` / `HNSW_EF_SEARCH_DEFAULT(40)` / `HNSW_EF_SEARCH_MAX(1000)` 는 `spec/1-data-model.md` 의 어떤 엔티티·필드와도 겹치지 않는 module-level 내부 상수다. `spec/1-data-model.md §2.11 KnowledgeBase` 의 `rerank_candidate_k` (1~200) 와 `RAG_RECALL_K`(50) 가 코드의 `hnswEfSearchFor` 입력 범위(5~200)와 일치하고, 명시된 `HNSW_EF_SEARCH_MAX=1000` 상한도 합리적이다.

### 2. API 계약 충돌

충돌 없음. diff 는 `RagSearchService` 내부 `searchVectorGroup` 의 SQL 실행 방식을 `dataSource.query()` → `dataSource.transaction(em => ...)` 로 감싸는 것에 국한된다. 이 서비스의 외부 API 엔드포인트(POST `/api/knowledge-bases/search`, AI Agent tool calling 경로) 의 request/response shape 는 변경되지 않았다. `spec/5-system/9-rag-search.md §3.1` 의 SQL 개념 쿼리도 변경되지 않았다.

### 3. 요구사항 ID 충돌

충돌 없음. diff 에 새로 부여된 요구사항 ID 가 없다. `spec/5-system/9-rag-search.md §3.4` 의 기존 서술(`pgvector HNSW ef_search recall 보전`)이 이 구현의 spec 근거이며, 다른 영역의 요구사항 ID 와 충돌하지 않는다.

### 4. 상태 전이 충돌

충돌 없음. `dataSource.transaction` 래핑은 커넥션 풀 상태를 변경하지 않는 범위(`SET LOCAL` — 트랜잭션 종료 시 자동 revert)이며, 검색 흐름 상태 전이(`pending → running → completed/failed`)에 영향이 없다.

### 5. 권한·RBAC 모델 충돌

해당 없음. 검색 경로 내부의 SQL 실행 메커니즘 변경으로 RBAC 접촉 없음.

### 6. 계층 책임 충돌 — INFO

- **[INFO]** `spec/5-system/9-rag-search.md §3.4` 의 `ef_search` 절과 `spec/5-system/9-rag-search.md` frontmatter `pending_plans` 불일치
  - target 위치: `spec/5-system/9-rag-search.md` frontmatter line 9-11
  - 충돌 대상: `plan/in-progress/rag-followup-efsearch.md` (파일 존재)
  - 상세: spec frontmatter 의 `pending_plans` 목록에 `rag-rerank-followup.md` 와 `rag-dynamic-cut.md` 만 있고, 이번 구현의 driving plan 인 `plan/in-progress/rag-followup-efsearch.md` 가 누락되어 있다. spec 과 plan 간의 traceability 가 끊겨 있다.
  - 제안: `spec/5-system/9-rag-search.md` frontmatter 에 `- plan/in-progress/rag-followup-efsearch.md` 추가 또는 plan 완료 후 `complete/` 이동 시 제거 처리.

### 7. IVFFlat 미사용 선언과 인접 spec 표현 사이 INFO

- **[INFO]** `spec/5-system/9-rag-search.md §3.4` 에 "`ivfflat` 미사용 — 차원별 partial HNSW 만 운용" 이라고 명시하나, `spec/1-data-model.md §3` 인덱스 표와 `spec/5-system/17-agent-memory.md §인덱스` 는 여전히 `HNSW/IVFFlat` 병기를 유지하고 있다.
  - target 위치: `spec/5-system/9-rag-search.md §3.4` — "ivfflat 미사용" 서술
  - 충돌 대상: `spec/1-data-model.md` line 810 (`AgentMemory | partial HNSW/IVFFlat`), `spec/5-system/17-agent-memory.md` line 44 (`DocumentChunk 와 동일 차원별 partial HNSW/IVFFlat 정책`)
  - 상세: `9-rag-search.md` 의 "ivfflat 미사용" 주장은 `document_chunk` 인덱스에만 해당하는 사실이다. `agent_memory` 테이블은 `DocumentChunk` 와 "동일 차원별 partial 인덱스 정책" 을 따른다고 명시되어 있으므로 agent_memory 인덱스도 HNSW 만 운용 중이라면, 해당 표현을 `HNSW` 단독으로 정정해 일관성을 높일 수 있다. 단 agent_memory 인덱스가 실제로 IVFFlat 을 포함하는지 마이그레이션 SQL 로 확인 필요.
  - 제안: `spec/1-data-model.md §3` 와 `spec/5-system/17-agent-memory.md §인덱스` 의 `HNSW/IVFFlat` 표현을 실제 마이그레이션 SQL 과 대조 후 `HNSW` 단독으로 정정하거나, `9-rag-search.md` 의 "document_chunk 한정" 범위를 명시한다.

---

## 요약

이번 diff(`hnswEfSearchFor` 함수 추가, `searchVectorGroup` 트랜잭션 래핑, 테스트 확장)는 `spec/5-system/9-rag-search.md §3.4` 의 기존 서술을 구현한 것으로, 다른 영역의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 정의와 충돌하지 않는다. 발견사항은 spec frontmatter 의 `pending_plans` 항목 누락과 인접 spec(`spec/1-data-model.md`, `spec/5-system/17-agent-memory.md`)의 `HNSW/IVFFlat` 표현 동기화 권고(INFO 2건)에 그친다. 두 건 모두 운영·동작에 영향을 주지 않는 문서 수준 불일치다.

## 위험도

LOW
