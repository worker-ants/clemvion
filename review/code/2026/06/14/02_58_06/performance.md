# Performance Review

## 발견사항

### **[WARNING]** `last_run` correlated subquery — 인덱스 없을 시 O(N×M) 스캔
- 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` — `findAll` 정렬 분기 (`sort === 'last_run'`)
- 상세: `ORDER BY (SELECT MAX(e.started_at) FROM execution e WHERE e.workflow_id = w.id)` correlated subquery 는 결과 행마다 서브쿼리를 한 번씩 실행한다. `execution` 테이블에 `(workflow_id, started_at)` 복합 인덱스가 없으면, 워크플로우 N건 × execution 행 M개의 O(N×M) 풀 스캔이 발생한다. 페이지네이션이 있지만 `getCount()` 를 먼저 실행하므로 전체 집합에 대해 서브쿼리가 평가된다.
- 제안: `CREATE INDEX idx_execution_workflow_started ON execution (workflow_id, started_at DESC)` 를 마이그레이션에 추가한다. 대안으로 `workflow` 테이블에 `last_run_at` 비정규화 컬럼을 추가하고 execution 완료 이벤트 시 갱신하는 방식도 고려할 수 있다(쓰기 비용 vs 읽기 비용 트레이드오프).

### **[WARNING]** `findAll` — `getCount()` 와 `getMany()` 가 동일 조건으로 DB 를 2회 조회
- 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` — `findAll` (라인 1455-1459)
- 상세: `totalItems = await qb.getCount()` 와 `data = await qb.skip(...).take(...).getMany()` 가 순차적으로 두 번의 DB 왕복을 발생시킨다. `last_run` 정렬 시 서브쿼리가 두 번 평가된다. TypeORM 의 `getManyAndCount()` 는 단일 쿼리로 처리할 수 없지만, 최소한 두 쿼리를 `Promise.all` 로 병렬화할 수 있다.
- 제안:
  ```ts
  const [data, totalItems] = await Promise.all([
    qb.clone().skip((page - 1) * limit).take(limit).getMany(),
    qb.getCount(),
  ]);
  ```
  단, `qb` 에 `skip/take` 가 mutate 로 적용되는 TypeORM 특성을 고려해 `clone()` 사용이 필요하다.

### **[WARNING]** `exportWorkflow` — `nodes.findIndex` 를 edges 수만큼 반복 호출 (O(N×E))
- 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` — `exportWorkflow` (라인 1554-1581)
- 상세: edges 매핑 시 `nodes.findIndex((n) => n.id === e.sourceNodeId)` 와 `targetNodeId` 에 대해 각각 O(N) 탐색을 edges 수(E)만큼 반복한다 (O(N×E)). 노드 수가 적으면 실질적 영향은 작지만, 구조적으로 비효율적이다. 같은 패턴이 `containerIndex`, `toolOwnerIndex` 에도 적용되어 nodes 배열에서 총 4×N 스캔이 발생한다.
- 제안: export 시작 시 `Map<string, number>` 로 id→index 역인덱스를 한 번만 구성한다.
  ```ts
  const nodeIndexMap = new Map(nodes.map((n, i) => [n.id, i]));
  ```
  이후 `findIndex` 대신 `nodeIndexMap.get(n.containerId)` 로 O(1) 조회.

### **[INFO]** 프론트엔드 — `SORT_OPTIONS.find()` 를 queryFn 호출마다 반복
- 위치: `codebase/frontend/src/app/(main)/workflows/page.tsx` — `queryFn` 내부 (라인 2307-2314)
- 상세: `SORT_OPTIONS.find((o) => o.key === sortKey)` 는 쿼리가 실행될 때마다 배열 선형 탐색을 수행한다. 현재 배열 크기가 4로 고정이므로 실질 비용은 무시할 수준이지만, `useMemo` 또는 `Map` 으로 `SortKey → option` 룩업을 상수 시간으로 만들 수 있다.
- 제안: 모듈 최상단에 `const SORT_OPTION_MAP = new Map(SORT_OPTIONS.map((o) => [o.key, o]))` 를 추가하고 `queryFn` 에서 `SORT_OPTION_MAP.get(sortKey)` 로 조회.

### **[INFO]** `syncEdges` — 기존 edges 전량 삭제 후 재삽입 (delete-all + batch insert)
- 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` — `syncEdges` (라인 1978-2008)
- 상세: edges 는 현재 전체 삭제(`manager.remove(Edge, existingEdges)`) 후 재생성하는 전략을 쓴다. `existingEdges` 를 먼저 `find` 로 로드하므로 read-delete-insert 3단계 왕복이 발생한다. 변경이 없는 경우도 불필요하게 삭제·재삽입된다.
- 제안: `DELETE FROM edge WHERE workflow_id = :id` 직접 쿼리(`manager.delete(Edge, { workflowId })`)를 사용하면 `find` 왕복을 생략할 수 있다. 또는 `syncNodes` 처럼 diff 기반 upsert 로 변경된 edges 만 처리할 수 있다. 다만 edges 는 일반적으로 개수가 적고 직접 `manager.delete` 가 단 1번 쿼리로 처리되므로 `find` + `remove` 2왕복보다 효율적이다.

### **[INFO]** `importWorkflow` — 트랜잭션 외부에서 `modelConfigService.findDefault` 를 단독 호출 (의도적 설계)
- 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` — `importWorkflow` (라인 1604-1608)
- 상세: `findDefault` 를 트랜잭션 외부에서 1회 호출하는 것은 "loop 내 호출 방지 + write 트랜잭션에 read 미포함" 을 의도한 올바른 설계 (주석 명시, 테스트 'hoisting guard' 로 고정). 추가 성능 개선 여지는 없음.
- 제안: 없음. 현행 유지.

---

## 요약

이번 변경의 핵심은 `last_run` correlated subquery 정렬 추가와 프론트엔드 정렬 드롭다운 연동이다. 로직 자체는 injection-safe 하게 구현되어 있고 `importWorkflow` 의 배치 insert 및 LLM lookup 호이스팅 등 기존 성능 최적화는 올바르게 유지되고 있다. 그러나 `last_run` 정렬 시 `execution` 테이블에 `(workflow_id, started_at)` 인덱스가 없으면 행마다 서브쿼리 스캔이 발생하는 O(N×M) 위험이 실 서비스에서 병목이 될 수 있고, `exportWorkflow` 의 `findIndex` 반복 패턴은 구조적으로 O(N×E) 비효율을 내포한다. `getCount`/`getMany` 순차 2회 왕복은 `Promise.all` 병렬화로 레이턴시를 줄일 수 있다. 나머지 항목은 INFO 수준으로 현 트래픽에서 실질 영향은 낮다.

## 위험도

MEDIUM
