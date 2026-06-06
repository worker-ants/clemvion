# 동시성(Concurrency) Review

## 발견사항

### 발견사항 없음 — 동시성 위험 없음

이번 변경의 실질적 코드 변경은 두 파일에 집중된다.

1. `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts` — 순수 함수 `hnswEfSearchFor` 추가 및 상수 2개 추가
2. `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` — `searchVectorGroup` 내 벡터 쿼리를 `dataSource.transaction(async em => { SET LOCAL ...; SELECT ... })` 트랜잭션으로 래핑

나머지 변경(spec, plan, e2e 테스트, docker-compose, review 산출물)은 동시성과 무관하다.

---

**[INFO] `hnswEfSearchFor` — 순수 함수, 공유 상태 없음**
- 위치: `dynamic-cut.util.ts` L95~101
- 상세: `hnswEfSearchFor`는 입력값만으로 결과를 결정하는 순수 계산 함수다. `Math.ceil`, `Math.min`, `Math.max` 외에 어떠한 외부 상태도 참조하거나 변경하지 않는다. 스레드 안전성 이슈 없음.
- 제안: 해당 없음.

**[INFO] `SET LOCAL hnsw.ef_search` — 트랜잭션 스코프로 올바르게 격리됨**
- 위치: `rag-search.service.ts` diff, `dataSource.transaction(async (em) => { ... })` 블록
- 상세: `SET LOCAL`은 PostgreSQL GUC 변경을 현재 트랜잭션 스코프로 한정한다. 트랜잭션 커밋/롤백 시 자동 복원되므로 커넥션 풀 내 다른 커넥션(또는 동일 커넥션의 후속 쿼리)이 오염될 수 없다. NestJS TypeORM `dataSource.transaction`은 동일 커넥션을 트랜잭션 콜백에 독점 제공하므로, 병렬 요청이 서로 다른 `efSearch` 값을 필요로 해도 커넥션 풀 레벨에서 격리된다. 코드 주석("`SET LOCAL 이라 트랜잭션 스코프 — 풀 커넥션 오염 없음`")도 이를 명시하고 있다.
- 제안: 해당 없음.

**[INFO] `efSearch` 직접 SQL 보간 — 정수 clamp 보장으로 인젝션 안전**
- 위치: `rag-search.service.ts` — `` `SET LOCAL hnsw.ef_search = ${efSearch}` ``
- 상세: `SET LOCAL` GUC는 파라미터 바인딩(`$n`)이 불가하므로 직접 보간이 불가피하다. `hnswEfSearchFor`가 `[40, 1000]` 정수 범위를 clamp+Math.ceil+isFinite 가드로 보장하므로, 외부 입력이 직접 보간에 도달하지 않는다(`topK`는 내부 계산값). SQL 인젝션 위험 없음.
- 제안: 해당 없음.

**[INFO] async/await — 트랜잭션 콜백 내 await 정상**
- 위치: `rag-search.service.ts` — `await this.dataSource.transaction(async (em) => { await em.query(...); return em.query(...); })`
- 상세: 트랜잭션 콜백 내 두 쿼리(`SET LOCAL`, `SELECT`)가 순차적으로 `await`되어 있다. SET LOCAL 후 recall SELECT 가 실행되는 순서가 코드 구조로 보장된다. await 누락 없음.
- 제안: 해당 없음.

---

## 요약

이번 변경에서 동시성 관련 코드는 `rag-search.service.ts`의 `dataSource.transaction` 래핑이 유일하다. `SET LOCAL hnsw.ef_search`를 트랜잭션 스코프로 격리함으로써 커넥션 풀 오염 경쟁 조건을 원천적으로 방지하고 있다. `hnswEfSearchFor`는 순수 함수이며, async/await 체인도 순서 보장이 명확하다. 공유 변수, 락, 병렬 접근, 이벤트 루프 블로킹 등의 동시성 위험 요소가 없다.

## 위험도

NONE

STATUS=success ISSUES=0
