# 성능(Performance) 리뷰

## 발견사항

### [INFO] 트랜잭션 래핑 오버헤드 — 단순 SELECT 에 트랜잭션 비용 추가
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` diff +257 (`dataSource.transaction(async (em) => { ... })`)
- 상세: 기존에는 단일 `dataSource.query(SELECT ...)` 호출이었으나, 변경 후 `SET LOCAL` GUC 설정을 위해 `dataSource.transaction` 안으로 래핑되었다. TypeORM `DataSource.transaction`은 내부적으로 `BEGIN` / `COMMIT` 라운드트립을 추가하며, 커넥션 풀에서 커넥션을 체크아웃한 채로 전체 콜백이 완료될 때까지 유지한다. `SET LOCAL hnsw.ef_search` + `SELECT` 두 쿼리를 단일 커넥션에서 직렬로 실행하므로, 커넥션 체크아웃 기간이 늘어나고 풀 경합 가능성이 소폭 증가한다.
- 제안: 현재 구조는 `SET LOCAL` 의 트랜잭션 스코프 요구사항(풀 커넥션 오염 방지)을 올바르게 충족한다. 추가 오버헤드는 `BEGIN`/`COMMIT` 2회 라운드트립 + 커넥션 유지 시간 증가이며, 이는 HNSW recall@LIMIT 정확도 보전이라는 correctness gain 과 충분히 trade-off 가 성립한다. 다만 고트래픽 환경에서 커넥션 풀 포화가 관측된다면, `dataSource.query('SET LOCAL ...')` 직후 `dataSource.query('SELECT ...')` 를 같은 커넥션에서 실행하는 명시적 커넥션 재사용 패턴(QueryRunner)으로 전환해 `BEGIN`/`COMMIT` 없이 동일 세션 보장을 달성할 수 있다.

### [INFO] `hnswEfSearchFor` — O(1) 순수 함수, 성능 문제 없음
- 위치: `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts` diff +92~98
- 상세: `Number.isFinite` 가드 + `Math.ceil` + `Math.min`/`Math.max` 조합으로 O(1) 상수 시간. 메모리 할당 없음. 결과가 `[40, 1000]` 정수로 결정론적이므로 재계산 비용도 무시 가능하다. 호출 측(`rag-search.service.ts`)에서 매 `searchVectorGroup` 마다 1회 호출되는 구조도 적절하다.
- 제안: 없음.

### [INFO] `SET LOCAL` SQL 보간 — 파라미터 바인딩 불가로 인한 정수 직접 보간
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` diff +258 `` `SET LOCAL hnsw.ef_search = ${efSearch}` ``
- 상세: pgvector GUC(`SET LOCAL`)는 `$1` 파라미터 바인딩을 지원하지 않아 직접 보간이 불가피하다. `hnswEfSearchFor` 가 반환값을 `[40, 1000]` 정수로 clamp·보장하므로, 보간 결과는 항상 안전한 정수 리터럴이다. 성능 관점에서도 문자열 보간은 정수 1~4자리이므로 비용 무시.
- 제안: 없음. 현재 구조(clamp 함수의 정수 보장을 SQL 보간 안전의 근거로 삼는 설계)가 적절하다.

### [INFO] 비정상 입력 방어(NaN/Infinity) — 기본값 반환으로 안전하나 호출자 계층에서 추가 검증 불필요
- 위치: `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts` diff +93 (`if (!Number.isFinite(limit)) return HNSW_EF_SEARCH_DEFAULT;`)
- 상세: `topK` 가 NaN/Infinity 인 경우 기본값 40을 반환해 최소한의 recall 을 보장한다. 호출 측에서 `topK` 는 `RAG_RECALL_K`(상수 50) 또는 `rerankCandidateK`(설정 정수)로 전달되므로, 비유한 입력이 런타임에 도달할 가능성은 낮다. 방어 코드가 있어도 브랜치 비용은 무시 가능하다.
- 제안: 없음.

### [INFO] graph seed 경로 미래 확장 시 ef_search 적용 필요성 주석화
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` diff +512~515 (주석)
- 상세: `seedTopK < HNSW_EF_SEARCH_DEFAULT(40)` 이라는 전제 하에 graph seed 경로는 트랜잭션 래핑을 생략한다. 주석에 "seedTopK 를 40 초과로 설정하는 시나리오를 지원하면 `hnswEfSearchFor(seedTopK)` 적용을 재검토" 라는 가이드가 명시되어 있다. 현재 기본값 기준에서는 성능/recall 양쪽 모두 문제 없음.
- 제안: 없음. 현재 설계 결정이 명확히 문서화되어 있다.

---

## 요약

이번 변경의 핵심 성능 영향은 `searchVectorGroup` 의 단일 SELECT 가 `dataSource.transaction` 으로 래핑된 것이다. `SET LOCAL hnsw.ef_search` 는 트랜잭션 스코프 없이는 커넥션 오염을 일으키므로 이 래핑은 correctness 요구사항이다. 추가 비용은 `BEGIN`/`COMMIT` 2회 라운드트립 및 커넥션 체크아웃 기간 증가로 제한되며, HNSW recall@LIMIT 보전이라는 명확한 correctness gain 과 trade-off 가 성립한다. `hnswEfSearchFor` 유틸리티는 O(1) 순수 함수로 성능 부담이 없으며, SQL 보간 역시 clamp 보장 정수이므로 안전하다. 나머지 변경(테스트·plan·review 문서)은 런타임 성능과 무관하다. 전체적으로 성능 관점의 critical 또는 high 위험 요소는 없다.

## 위험도

LOW
