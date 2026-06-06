# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### [INFO] SOLID — 단일 책임 원칙 준수
- 위치: `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts`
- 상세: `hnswEfSearchFor` 함수가 `dynamic-cut.util.ts`에 추가됐다. 이 파일은 이미 RAG 검색 파라미터 상수(`RAG_RECALL_K`, `RAG_INJECT_TOKEN_BUDGET`, `RAG_MAX_INJECT_COUNT`) 및 `applyDynamicCut` 로직을 담당하고 있다. `hnswEfSearchFor`는 recall 파라미터 계산이라는 동일 관심사에 속하므로 단일 책임 관점에서 위치가 적절하다. 새 HNSW 상수(`HNSW_EF_SEARCH_DEFAULT`, `HNSW_EF_SEARCH_MAX`)도 같은 파일에 집약돼 추후 HNSW 관련 조정이 한 파일에 집중된다.
- 제안: 없음. 현행 배치가 응집도·단일 책임 모두 만족한다.

### [INFO] 개방-폐쇄 원칙 — 기존 searchVectorGroup 인터페이스 불변
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts`
- 상세: `searchVectorGroup` 의 public 시그니처, 반환 타입, 호출자(`search`/`searchWithMeta`)는 변경되지 않았다. ef_search 상향 로직이 내부 구현에만 캡슐화되어 호출자는 트랜잭션 래핑을 인식하지 않는다. 확장(ef_search 정책 변경)에 대해 `hnswEfSearchFor`를 교체하는 것만으로 충분하며 호출자 수정 불요.
- 제안: 없음.

### [WARNING] 레이어 책임 — 서비스 레이어에 SQL GUC 보간 로직 인라인 포함
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` (diff 내 `SET LOCAL hnsw.ef_search = ${efSearch}` 라인)
- 상세: `SET LOCAL hnsw.ef_search = ${efSearch}` SQL 문이 서비스 메서드 안에 직접 문자열로 작성됐다. 현재는 `hnswEfSearchFor`가 `[40, 1000]` 정수를 보장하고 주석에 인젝션 안전 근거를 명시해 보안상 문제는 없다. 그러나 pgvector GUC 적용 패턴(SET LOCAL SQL, 트랜잭션 스코프)이 서비스 레이어에 직접 노출되면 이 패턴이 향후 다른 서비스에 복제될 경우 안전 제약(정수 clamp 보장 함수)이 누락될 위험이 있다. 데이터 레이어 추상화(`VectorSearchRepository` 등)가 이 GUC 적용을 캡슐화하면 레이어 책임이 더 명확해진다.
- 제안: 단기적으로는 현행 구조 수용 가능(변경 규모 대비 과한 리팩터링). 중기적으로 `searchVectorGroup` 로직이 별도 repository/query-object로 분리될 때 GUC 적용도 함께 이전하는 것을 고려한다.

### [INFO] 디자인 패턴 — Transaction 스코프 격리 패턴 적절
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` (`dataSource.transaction(async (em) => { ... })`)
- 상세: `SET LOCAL`이 트랜잭션 스코프라는 pgvector 특성을 활용해 커넥션 풀 오염 없이 단일 쿼리에만 GUC를 적용하는 패턴은 올바르다. 기존 단일 `dataSource.query` 호출을 `dataSource.transaction` 래퍼로 교체한 변경이 최소 침습적이며, transaction callback 내에서 `em.query`를 통해 동일한 쿼리 인터페이스를 유지한다. 이는 pgvector GUC 적용의 표준 패턴이다.
- 제안: 없음.

### [INFO] 추상화 수준 — hnswEfSearchFor 함수 추상화 적절
- 위치: `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts`
- 상세: `hnswEfSearchFor(limit)` 함수는 "LIMIT에서 ef_search 계산"이라는 단일 규칙(LIMIT × 2, clamp to [40, 1000])을 캡슐화한다. 매직 넘버가 모두 명명 상수(`HNSW_EF_SEARCH_DEFAULT`, `HNSW_EF_SEARCH_MAX`)로 추출됐고 JSDoc에 설계 근거(ef_search ≥ LIMIT 정설, 2× 헤드룸, GUC 보간 안전성)가 명시됐다. 과도하거나 부족한 추상화 모두 해당 없음.
- 제안: 없음.

### [INFO] 모듈 경계 — graph seed 경로의 ef_search 미적용에 대한 명시적 설계 결정
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` (diff 내 graph seed 경로 주석)
- 상세: graph seed의 `seedTopK`(기본 5) < `HNSW_EF_SEARCH_DEFAULT`(40) 이므로 ef_search 상향이 불필요하다는 근거가 주석으로 명시됐다. `seedTopK ≥ 40` 시나리오가 발생하면 재검토가 필요하다는 후속 안내도 포함됐다. 두 코드 경로(wide 회수 vs graph seed)의 분기가 의도적임이 문서화돼 모듈 경계 관점에서 혼동이 없다.
- 제안: 없음. 다만 `seedTopK`가 40 초과로 확장될 경우 `hnswEfSearchFor(seedTopK)` 호출을 자연스럽게 추가할 수 있는 구조이므로 확장성도 확보됐다.

### [INFO] 확장성 — rerank candidateK 경로도 동일 함수로 일관 처리
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts`, `rag-search.service.spec.ts`
- 상세: off 경로(`RAG_RECALL_K=50`)와 rerank 경로(`candidateK` 최대 200) 모두 동일한 `hnswEfSearchFor(topK)` 호출을 통해 ef_search가 계산된다. 향후 새로운 recall 폭(예: hybrid search, re-ranking cascade)이 추가될 때도 `topK` 파라미터만 올바르게 전달하면 ef_search 계산이 자동으로 적용된다. 별도 분기나 상수 추가 없이 확장 가능한 구조다.
- 제안: 없음.

### [INFO] 순환 의존성 — 없음
- 위치: `dynamic-cut.util.ts` ↔ `rag-search.service.ts`
- 상세: `rag-search.service.ts`가 `dynamic-cut.util.ts`를 단방향으로 import한다. `dynamic-cut.util.ts`는 서비스 레이어를 역참조하지 않는다. 순환 의존성 없음.
- 제안: 없음.

### [INFO] e2e 테스트 — DB 직접 insert 우회 제거로 테스트 레이어 경계 개선
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts`
- 상세: 기존 e2e 테스트가 `db.query(INSERT INTO llm_config ...)` 직접 삽입으로 비즈니스/데이터 레이어 경계를 우회했던 구조가 `POST /api/llm-configs` 공개 API 경로로 교체됐다. 이는 테스트가 내부 DB 스키마 직접 의존에서 벗어나 서비스 레이어 공개 인터페이스를 통해 상태를 설정하는 올바른 e2e 패턴으로의 전환이다. 아키텍처 레이어 경계 준수 측면에서 개선이다.
- 제안: 없음.

---

## 요약

이번 변경은 두 개의 독립적인 개선으로 구성된다. 첫째, `hnswEfSearchFor` 유틸리티 함수 추가와 `searchVectorGroup` 내 `SET LOCAL` 트랜잭션 래핑은 SOLID 원칙과 응집도 모두 잘 준수하며, pgvector GUC의 커넥션 풀 오염 방지 패턴도 올바르게 적용됐다. 확장성 측면에서 off/rerank 두 경로가 동일 함수를 공유하고 graph seed 미적용 근거도 문서화돼 있어 향후 recall 폭 확장에 유연하다. 유일한 아키텍처 관찰은 SQL GUC 보간 로직이 서비스 레이어에 직접 노출된 점인데, 현재 규모에서는 수용 가능하며 repository 레이어 분리 시 이전을 권고하는 수준이다. 둘째, e2e 테스트의 DB 직접 insert 우회 제거는 테스트 레이어가 내부 스키마에 직접 의존하던 구조를 공개 API 경계로 올바르게 정렬한 개선이다. 전체적으로 아키텍처 위험 요인은 없다.

---

## 위험도

NONE
