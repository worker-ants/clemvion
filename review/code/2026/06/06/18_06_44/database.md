### 발견사항

- **[INFO] SET LOCAL GUC 직접 보간 — 정수 범위 clamp 로 인젝션 방어 확인됨**
  - 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts`, diff hunk +261 (`SET LOCAL hnsw.ef_search = ${efSearch}`)
  - 상세: pgvector GUC(`hnsw.ef_search`)는 TypeORM/pg 드라이버의 파라미터 바인딩($n) 대상이 아니라 `SET` 구문 자체가 literal 값을 받는 DDL-like 명령이다. 따라서 보간이 불가피하며, `hnswEfSearchFor`가 `[40, 1000]` 범위 정수를 보장(`Number.isFinite` 가드 + `Math.ceil` + `Math.min`/`Math.max`)하므로 임의 SQL 삽입이 불가하다. 현 구현이 올바른 방어 방식이다.
  - 제안: 현 수준 유지. 향후 `efSearch`를 인자로 받는 래퍼가 추가될 경우 동일 범위 보증을 유지해야 한다.

- **[INFO] 트랜잭션 스코프 — SET LOCAL 의도에 부합**
  - 위치: `rag-search.service.ts` diff +260-275 (`this.dataSource.transaction(async (em) => { ... })`)
  - 상세: `SET LOCAL`은 현재 트랜잭션 종료 시 자동 롤백되는 세션-로컬 설정이다. 트랜잭션 래핑으로 커넥션 풀 오염(ef_search 가 다른 쿼리에 누출)을 원천 차단한 설계가 정확하다. 단, TypeORM의 `DataSource.transaction()` 콜백 안에서 예외 발생 시 자동 ROLLBACK되므로 SET LOCAL 포함 전체가 원자적으로 취소된다.
  - 제안: 현재 패턴 유지. ROLLBACK 시 recall 결과가 없으므로 호출 측에서 빈 결과를 정상 처리하는지 확인을 권장하나, 이는 로직 관점이고 DB 안전성 문제는 아니다.

- **[INFO] graph seed 경로 ef_search 미상향 — 의도적 설계 확인됨**
  - 위치: `rag-search.service.ts` diff +512-515 (주석), `rag-search.service.spec.ts` diff +179-180
  - 상세: seedTopK 기본값이 `HNSW_EF_SEARCH_DEFAULT(40)` 미만이라 기본 ef_search로 충분하다는 판단이 코드·테스트·주석에 일관되게 문서화되어 있다. seedTopK가 40을 초과하는 시나리오를 지원할 경우 재검토가 필요하다는 안내도 명시되어 있다.
  - 제안: 현재 상태 적절. seedTopK를 동적으로 설정할 수 있는 경로가 추가되면 `hnswEfSearchFor(seedTopK)` 적용을 그 시점에 반드시 재평가해야 한다.

- **[INFO] e2e DB 직접 INSERT 제거 — 정식 API 경로로 교체 확인**
  - 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` diff +323-342
  - 상세: 이전 코드가 `INSERT INTO llm_config ... VALUES ($1, ...)` 로 DB에 직접 삽입하던 패턴을 `POST /api/llm-configs` 정식 HTTP 경로로 교체했다. DB 직접 삽입은 암호화 경로를 우회하고 스키마 변경에 취약하므로 정식 API 경로 사용이 올바른 방향이다.
  - 제안: 현재 개선 방향 유지.

### 요약

이번 변경의 핵심 DB 관련 코드는 `searchVectorGroup`에서 pgvector HNSW `ef_search` GUC를 `SET LOCAL`로 트랜잭션 스코프 안에서 상향 설정하는 패턴이다. `SET LOCAL`을 `dataSource.transaction()` 안에 배치해 커넥션 풀 오염을 방지했고, 직접 보간되는 숫자 값은 `hnswEfSearchFor`가 `[40, 1000]` 정수로 clamp 보증하여 SQL 인젝션 위험이 없다. 인덱스·N+1·마이그레이션·스키마 설계·커넥션 풀 측면에서 새로운 문제가 없으며, e2e의 DB 직접 INSERT 제거는 정합성 개선이다. 전체적으로 DB 관점의 위험 요소가 없는 안전한 변경이다.

### 위험도
NONE
