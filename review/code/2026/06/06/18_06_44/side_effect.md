# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] SQL 직접 보간 — efSearch 정수 보장에 의존한 SQL 인젝션 방어
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-followup-efsearch-b6c8e8/codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` L428
- 상세: `SET LOCAL hnsw.ef_search = ${efSearch}` 에서 `efSearch` 값이 SQL 에 직접 보간된다. `hnswEfSearchFor` 가 [40, 1000] 정수를 보장(`Math.ceil` + `Math.min/max` + `Number.isFinite` 가드)하므로 현재는 안전하다. 그러나 이 보안 불변식이 `hnswEfSearchFor` 의 구현 변경이나 다른 경로에서 `efSearch` 에 직접 보간하는 코드가 추가될 때 무너질 수 있다. GUC 파라미터는 `$n` 바인딩이 PostgreSQL 상 불가하다는 근거가 주석에 기재되어 있어 회피 방법이 없는 것은 맞으나, 방어 계층으로 `typeof efSearch !== 'number' || !Number.isInteger(efSearch)` 런타임 어서션을 삽입하면 향후 회귀에 대한 명시적 방어가 추가된다.
- 제안: `hnswEfSearchFor` 반환 직전 또는 `SET LOCAL` 보간 직전에 `Number.isInteger` + 범위 어서션을 추가하거나, 반환 타입을 branded integer 로 명시해 호출부에서 잘못된 값이 보간되지 않도록 타입 레벨에서 제약. (현재 구현의 안전성은 충분하나 방어 심도 강화 권장)

---

### [INFO] 트랜잭션 래핑 도입 — 커넥션 풀 동작 변화 (풀 오염 없음, 단 커넥션 점유 시간 증가)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-followup-efsearch-b6c8e8/codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` L427–449
- 상세: 기존 `this.dataSource.query(...)` 단일 호출이 `this.dataSource.transaction(async (em) => { ... })` 으로 변경됐다. `SET LOCAL` 은 트랜잭션 스코프이므로 커넥션이 트랜잭션에 묶여 있는 동안만 적용되고 커밋/롤백 후 커넥션이 풀에 반납될 때 GUC 가 자동 해제된다. 풀 커넥션 오염은 없다(의도한 동작). 그러나 단일 쿼리에서 트랜잭션(`BEGIN … COMMIT`)으로 바뀌므로 커넥션 점유 시간이 미세하게 증가한다. `searchVectorGroup` 이 `Promise.all` 로 병렬 실행되는 멀티-KB 경로에서는 동시 트랜잭션 수가 벡터 그룹 수만큼 늘어난다. 부하가 높은 환경에서 커넥션 풀 고갈 위험이 미세하게 상승할 수 있다.
- 제안: 커넥션 풀 크기와 동시 검색 부하를 모니터링. 고부하 시 트랜잭션 오버헤드가 문제가 된다면 각 그룹별 순차 실행 또는 풀 크기 조정 검토. 현재 규모에서는 수용 가능한 트레이드오프.

---

### [INFO] `searchGraphKb` 의 ef_search 미상향 — 설계 의도 명시이나 seedTopK > 40 시 recall 저하 잠재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-followup-efsearch-b6c8e8/codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` L515–517 (주석)
- 상세: graph seed CTE(`searchGraphKb`)는 `seedTopK` 기본 5 < `HNSW_EF_SEARCH_DEFAULT`(40) 이라는 전제 하에 ef_search 상향을 생략한다. 이 전제가 유지되는 한 부작용 없다. 단, `vectorSeedTopK` 를 KB 설정에서 40 초과로 변경하면 주석이 경고한 시나리오가 발생한다. 현재 코드에는 이 경계 조건을 방어하는 런타임 검사나 assert 가 없다.
- 제안: 코드 레벨에서 `if (seedTopK > HNSW_EF_SEARCH_DEFAULT)` 경고 로그를 삽입하거나, 향후 seedTopK 상향 시 `hnswEfSearchFor(seedTopK)` 트랜잭션 경로로 분기하는 준비. 현재는 INFO 수준이나 추후 KB 설정 확장 시 부작용으로 전환될 수 있다.

---

### [INFO] 신규 exported 상수 및 함수 — 기존 사용자 인터페이스에 추가만 발생, breaking 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-followup-efsearch-b6c8e8/codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts` L21–38
- 상세: `HNSW_EF_SEARCH_DEFAULT`, `HNSW_EF_SEARCH_MAX`, `hnswEfSearchFor` 가 신규 `export` 로 추가됐다. 기존 exports(`RAG_RECALL_K`, `RAG_INJECT_TOKEN_BUDGET`, `RAG_MAX_INJECT_COUNT`, `applyDynamicCut`, `DynamicCutOptions`, `DynamicCutResult`)의 시그니처·동작은 변경 없다. 추가만 이루어졌으므로 기존 import 사용자에 대한 breaking 없음.
- 제안: 없음. 의도한 확장이며 부작용 없음.

---

### [INFO] `docker-compose.e2e.yml` ENCRYPTION_KEY 변경 — ephemeral e2e DB 에만 영향
- 위치: `docker-compose.e2e.yml` L368 (diff 기준)
- 상세: `ENCRYPTION_KEY` 가 32-char(16B)에서 64-hex(32B)로 변경된다. e2e DB 는 컨테이너 기동마다 초기화되는 ephemeral 환경이므로 기존 암호화 데이터와의 불일치 문제가 없다. `INTEGRATION_ENCRYPTION_KEY` 는 SHA-256 derive 경로라 길이 무관 — 기존 값 유지. 프로덕션 환경과 독립된 e2e 전용 변수다.
- 제안: 없음. ephemeral 특성상 기존 데이터 부작용 없음.

---

### [INFO] e2e 테스트 — DB 직접 INSERT에서 공개 API 호출로 교체
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` diff hunk L326–339
- 상세: 기존 `db.query(INSERT INTO llm_config ...)` 직접 DB 조작이 `POST /api/llm-configs` REST API 호출로 교체됐다. 테스트 데이터 생성 경로가 변경됐을 뿐 서비스 상태에 대한 부작용은 없다. 오히려 암호화 경로를 포함한 정식 API 흐름이 커버되어 테스트의 신뢰도가 향상된다. teardown 로직(있다면)이 llm_config 행을 정리하는지는 별도로 확인 필요하나, e2e DB 가 ephemeral 이므로 실질 오염 위험은 없다.
- 제안: 없음.

---

### [INFO] 테스트 픽스처의 `mockDataSource.transaction` 도입 — 기존 mock 인덱스 단언 유지
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.spec.ts` L122–143 (diff)
- 상세: `mockDataSource.transaction` mock 이 추가되고, 내부 `em.query` 는 `SET LOCAL` SQL 을 흡수하고 나머지를 `mockDataSource.query` 로 위임한다. 이 설계로 기존 테스트의 `mockDataSource.query.mock.calls` 인덱스 단언이 유지된다. `beforeEach` 에서 초기화되므로 테스트 간 상태 유출이 없다. 의도한 격리 설계.
- 제안: 없음.

---

## 요약

이번 변경의 핵심 부작용 리스크는 `SET LOCAL hnsw.ef_search = ${efSearch}` SQL 직접 보간이다. `hnswEfSearchFor` 함수가 [40, 1000] 정수를 수학적으로 보장하고 `Number.isFinite` 가드로 비유한 입력을 방어하므로 현재 구현에서 SQL 인젝션 위험은 없다. 그러나 이 안전성이 함수 구현에 암묵적으로 위임되어 있어 향후 변경 시 방어가 깨질 수 있다는 점이 WARNING 수준 주의 사항이다. 트랜잭션 래핑으로 인한 커넥션 점유 시간 증가는 고부하 환경에서 모니터링 대상이나 현재 규모에서는 수용 가능하다. 신규 exports, e2e 인프라 변경(ENCRYPTION_KEY, API 경로 교체), plan/review 문서 추가는 부작용이 없거나 의도된 변경이다. 전반적으로 부작용 위험은 낮다.

## 위험도

LOW
