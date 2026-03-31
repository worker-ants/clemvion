## 성능 코드 리뷰

### 발견사항

---

**[WARNING] auth-configs.service.ts — getUsage: 2번의 분리된 쿼리로 실행 가능한 단일 집계 쿼리**
- 위치: `auth-configs.service.ts` — `getUsage()` 메서드
- 상세: `triggerRepository.find()` 후 triggerIds 배열을 추출하고, 이를 `IN (:...triggerIds)` 절로 두 번의 추가 쿼리(`getCount`, `getMany`)에 사용. auth config → trigger → execution 관계는 조인 한 번으로 처리 가능. triggerIds 개수가 클 경우 `IN` 절 성능 저하 우려도 있음.
- 제안:
```ts
// triggerRepository.find() 제거 후 직접 조인
const totalCalls = await this.executionRepository
  .createQueryBuilder('e')
  .innerJoin('e.trigger', 't')
  .where('t.auth_config_id = :id', { id })
  .getCount();
```

---

**[WARNING] dashboard.service.ts — runs7dPrevious: 동일 시간대 집계를 단일 쿼리로 처리 가능**
- 위치: `dashboard.service.ts`, `runs7dPrevious` 조회 블록
- 상세: 현재 7일 / 이전 7일을 각각 별도 `getCount()` 쿼리로 조회. `CASE WHEN ... THEN 1 ELSE 0 END` 또는 `DATE_TRUNC` 기반 조건부 집계로 단일 쿼리로 합칠 수 있음. DB 왕복 1회 절감.
- 제안:
```sql
SELECT
  COUNT(*) FILTER (WHERE e.started_at >= :sevenDaysAgo) AS current,
  COUNT(*) FILTER (WHERE e.started_at >= :fourteenDaysAgo AND e.started_at < :sevenDaysAgo) AS previous
FROM executions e
INNER JOIN workflows w ON e.workflow_id = w.id
WHERE w.workspace_id = :workspaceId AND e.started_at >= :fourteenDaysAgo
```

---

**[WARNING] statistics.service.ts — exportData: 4개 쿼리 병렬화되어 있으나 불필요한 전체 데이터 로딩**
- 위치: `statistics.service.ts` — `exportData()`
- 상세: `Promise.all`로 병렬 처리는 올바르나, CSV 포맷 요청 시 `errors`, `topWorkflows`까지 모두 조회 후 사용하지 않음. 특히 대규모 데이터에서 불필요한 DB 쿼리 3개 발생.
- 제안: format에 따라 필요한 쿼리만 선택적으로 실행.
```ts
if (format === 'csv') {
  const executions = await this.getExecutionsByPeriod(workspaceId, query);
  // CSV 생성 후 반환
}
```

---

**[WARNING] workflows.service.ts — importWorkflow: 트랜잭션 내 노드별 개별 save 및 containerId update**
- 위치: `workflows.service.ts` — `importWorkflow()`, nodeIdMap 루프
- 상세: 노드를 하나씩 `manager.save(Node, node)` 후, 다시 containerId 업데이트를 위해 `manager.update()` 반복. N개 노드에 대해 최대 2N번 DB 쿼리 발생. edge 루프도 동일.
- 제안: `manager.save(Node, nodes배열)` 벌크 insert 후, containerId 참조가 있는 노드만 필터링해 일괄 업데이트. 또는 nodesDto를 두 패스로 나눠 containerId가 없는 노드 먼저 bulkSave.

---

**[INFO] execution-store.ts — addNodeResult: 매 호출마다 새 배열 생성**
- 위치: `execution-store.ts` — `addNodeResult()`
- 상세: `[...state.nodeResults, result]`는 Zustand 불변성 패턴으로 정상적이나, 실행 중 노드 수가 많을 경우 (수백 노드) 매 업데이트마다 배열 복사가 발생. 대부분의 워크플로우에서는 문제 없음.
- 제안: 현재 규모에서는 수용 가능. 노드 수가 수백 이상이 될 경우 Immer 도입 고려.

---

**[INFO] integrations/page.tsx — filteredIntegrations: useMemo 적용 적절**
- 위치: `integrations/page.tsx` — `filteredIntegrations`
- 상세: `useMemo`로 올바르게 메모이제이션 처리됨. 검색 입력 시 매 keystroke마다 재계산되지만 클라이언트 필터링이므로 DB 부하 없음. 양호.

---

**[INFO] schedules.service.ts — computeNextRuns: CronExpressionParser 인스턴스를 매 요청마다 생성**
- 위치: `schedules.service.ts` — `computeNextRuns()`
- 상세: 요청 범위 내 동작으로 문제없음. 단, count 입력값 검증 없이 `limit` 없는 for 루프를 사용하므로 클라이언트가 `count=100000` 전송 시 CPU 블로킹 가능.
- 제안: count 최대값 제한 (예: `Math.min(count, 20)`).

---

**[INFO] run-results-drawer.tsx — 테이블 렌더링: 최대 50행으로 slice 처리**
- 위치: `run-results-drawer.tsx` — `ResultContent`, `tableData.rows.slice(0, 50)`
- 상세: 50행으로 제한하는 것은 적절. 다만 `columns` 계산 시 `Object.keys(tableData.rows[0])` 매 렌더마다 수행됨. `useMemo` 외부화 여지 있으나 현재 규모에서 무시 가능.

---

### 요약

전반적으로 비동기 처리와 병렬 쿼리(`Promise.all`)는 적절하게 활용되고 있으며, 프론트엔드 필터링에는 `useMemo`/`useCallback`이 올바르게 적용되어 있다. 주요 성능 위험은 백엔드 집계 레이어에 집중되어 있다: `getUsage()`의 3-쿼리 구조, `exportData()`의 불필요한 전체 데이터 조회, `importWorkflow()`의 트랜잭션 내 N×2 DB 왕복이 핵심 개선 대상이다. 이 중 `importWorkflow()`의 노드 대량 import 시나리오는 트랜잭션 잠금 시간을 늘릴 수 있어 주의가 필요하다. `computeNextRuns()`의 count 상한 미검증은 간단히 해결 가능한 잠재적 DoS 벡터다.

### 위험도

**MEDIUM**