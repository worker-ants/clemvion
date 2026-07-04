# 성능(Performance) Review

대상: PR3 — `recoverStuckExecutions` 를 "일괄 FAILED 마킹"에서 "started_at 원자 re-claim + §7.5 case B rehydration 재구동"으로 전환.

## 발견사항

- **[INFO]** `recoverStuckExecutions` 가 N건의 재구동을 순차 루프에서 fire-and-forget 으로 kick-off — 병렬 실행 자체는 문제 없음
  - 위치: `execution-engine.service.ts` `recoverStuckExecutions()` (`reclaimedIds` 순회 `for` 루프, `void this.redriveStuckExecution(executionId).catch(...)`)
  - 상세: 재구동 대상 각 execution 에 대해 `void redriveStuckExecution(id).catch(...)` 로 즉시 다음 루프로 넘어가므로 loop 자체는 블로킹하지 않는다. 다만 각 `redriveStuckExecution` 내부에서 `findOneBy` → `rehydrateContext`(다건 쿼리, 아래 참고) → `loadAndBuildGraph`(노드/엣지 전체 재조회) → `runNodeDispatchLoop` 를 실행하므로, stale RUNNING 이 동시에 다량(예: 장애 후 수백 건) 발생하면 재구동 스캔 한 번에 수백 개의 독립 rehydration/그래프 로드 작업이 동시에 fire 된다. DB 커넥션 풀·워커 이벤트루프에 순간 부하가 몰릴 수 있다.
  - 제안: 기존 코드에도 이미 존재하던 패턴(case A rehydration 도 동일 구조)이라 신규 회귀는 아니나, 운영 규모가 커지면 동시 re-drive 건수에 상한(예: batch/concurrency limit, `p-limit` 류)을 두는 것을 고려. 현재 스코프(30분 stale 임계값 + 부팅시 1회 스캔)에서는 동시 발생량이 제한적이라 CRITICAL 은 아님.

- **[INFO]** `redriveStuckExecution` 이 execution 당 `loadAndBuildGraph` 를 매번 새로 실행 — workflow 노드/엣지 전체 재조회 + topological sort 재계산
  - 위치: `execution-engine.service.ts:redriveStuckExecution` → `this.loadAndBuildGraph(savedExecution.workflowId)`
  - 상세: 같은 workflow 에 속한 여러 stale execution 이 동시에 re-claim 되면(예: 동일 workflow 를 대량 트리거한 뒤 크래시), 각각에 대해 동일한 workflow 그래프를 중복으로 DB 조회 + `buildGraph`/`identifyBackEdges`/`topologicalSort` 를 반복 수행한다. 이는 case A(`driveResumeAwaited`)에서도 이미 존재하는 기존 패턴이므로 이번 PR 의 신규 회귀는 아니다.
  - 제안: 현재 규모(30분 간격 stale recovery, 부팅시 드문 이벤트)에서는 실질적 영향이 작음. 향후 대량 재구동 시나리오가 빈번해지면 workflowId 기준 그래프 캐시(스캔 1회 내 재사용)를 고려할 수 있음 — 지금 시점 CRITICAL 아님.

- **[INFO]** `driveStuckRedrive` 의 reachability seeding 이 `executedNodes` 전체를 순회하며 `propagateReachability` 호출
  - 위치: `execution-engine.service.ts:driveStuckRedrive` — `for (const nid of executedNodes) { reachable.add(nid); this.graphTraversal.propagateReachability(...) }`
  - 상세: `executedNodes` 크기(=완료된 노드 수)에 비례한 O(완료노드 수 × 평균 out-degree) 순회. 그래프 규모가 일반적으로 작아(워크플로우 노드 수 수십~수백 단위) 문제되지 않음. `propagateReachability` 자체는 outgoing edge map 조회 O(1) + 해당 노드의 out-degree 만큼 순회이므로 알고리즘적으로 적절 (전체 그래프 O(V+E) 수준).
  - 제안: 없음 — 정상 범위.

- **[INFO]** `runNodeDispatchLoop` 의 `skipExecutedNodes` 가드 — `executedNodes.has(nodeId)` Set 조회로 O(1), 성능에 부정적 영향 없음
  - 위치: `execution-engine.service.ts` `runNodeDispatchLoop` 내 신규 분기 `if (params.skipExecutedNodes && executedNodes.has(nodeId))`
  - 상세: `executedNodes` 가 `Set<string>` 이므로 조회 비용이 상수 시간. dispatch loop 매 iteration 마다 한 번 추가되는 조건 검사로 무시할 수준.
  - 제안: 없음.

- **[INFO]** `reclaimStuckRunningExecution` — 단일 원자 UPDATE...RETURNING 으로 N건을 일괄 re-claim (N+1 아님, 배치 처리 양호)
  - 위치: `execution-engine.service.ts:reclaimStuckRunningExecution`
  - 상세: 옛 코드와 동일하게 단일 SQL 문으로 여러 row 를 한 번에 재점유한다. `for (const id of ids) this.recordRunningSegmentStart(id)` 는 순수 인메모리(Map/타이머) 기록으로 보이며 DB 호출이 아니므로 N+1 문제 없음(코드베이스 관례상 in-memory tracking).
  - 제안: 없음 — 이 부분은 오히려 이전 "일괄 UPDATE" 패턴을 그대로 계승해 우수함.

- **[INFO]** e2e 테스트의 폴링 루프(`poll`, `nodeExecRowCount` while 루프) — `setTimeout` 기반 200ms 간격 폴링, 테스트 코드 한정
  - 위치: `codebase/backend/test/execution-crash-redrive.e2e-spec.ts` `poll()` 및 재구동 검증 while 루프
  - 상세: 프로덕션 코드가 아니라 e2e 테스트이므로 성능 문제로 분류하지 않음. 20초 타임아웃 + 200ms 간격은 다른 e2e 스펙과 일관된 패턴.
  - 제안: 없음.

## 요약

이번 변경은 `recoverStuckExecutions` 를 "일괄 UPDATE 한 번으로 끝나는 단순 FAILED 마킹"에서 "원자 re-claim(단일 배치 UPDATE, N+1 아님) + 재구동 대상 각각에 대한 fire-and-forget rehydration/그래프 재실행"으로 바꾸는 구조적 전환이다. 알고리즘 복잡도 측면에서 그래프 reachability 전파나 skip 가드는 모두 Set/Map 기반 O(1)~O(V+E) 로 적절하며, re-claim 자체는 단일 SQL 문으로 배치 처리돼 N+1 쿼리 패턴이 아니다. 다만 재구동 단계(`redriveStuckExecution`)는 execution 개별로 `findOneBy` + `loadAndBuildGraph`(workflow 노드/엣지 전체 재조회 및 topological sort 재계산)를 수행하므로, 동시에 다량의 stale RUNNING execution 이 재구동될 경우 DB 부하가 순간적으로 몰릴 수 있다 — 그러나 이는 case A(waiting 재개) 경로에서도 이미 존재하던 기존 패턴을 그대로 재사용한 것이라 이번 PR 이 신규로 도입한 회귀가 아니며, 스캔이 부팅 시 1회 + 30분 stale 임계값으로 트리거 빈도 자체가 낮아 실질적 성능 리스크는 낮다. 전반적으로 CRITICAL/WARNING 급 성능 이슈는 발견되지 않았다.

## 위험도

LOW
