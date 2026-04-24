## Performance Code Review

---

### 발견사항

---

**[WARNING]** `loadNodeStats` — 애플리케이션 레벨 GROUP BY (DB-level 집계 미사용)
- **위치:** `explore-tools.service.ts` `loadNodeStats()` (diff +237~256)
- **상세:** `limit` 상한이 50인 상황에서 해당 실행들의 모든 `node_execution` 로우를 IN 쿼리로 끌어온 뒤 JavaScript for 루프로 집계한다. 실행 50건 × 노드 평균 30개 = 1,500개 로우를 메모리에 올린다. 반환값은 고작 50개의 `{total, completed, failed}` 레코드인데 네트워크 왕복과 메모리 할당이 불필요하게 크다.
- **제안:** DB 레벨 GROUP BY로 교체하면 반환 로우 수가 최대 50개로 고정된다.
  ```typescript
  // before: find(...) → JS 집계
  // after:
  const rows = await this.nodeExecutionRepo
    .createQueryBuilder('ne')
    .select('ne.execution_id', 'execId')
    .addSelect('COUNT(*)', 'total')
    .addSelect(`SUM(CASE WHEN ne.status = 'completed' THEN 1 ELSE 0 END)`, 'completed')
    .addSelect(`SUM(CASE WHEN ne.status = 'failed' THEN 1 ELSE 0 END)`, 'failed')
    .where('ne.execution_id IN (:...ids)', { ids: executionIds })
    .groupBy('ne.execution_id')
    .getRawMany();
  ```

---

**[WARNING]** `getExecutionDetails` — 자식 실행 타임라인 N개 병렬 쿼리
- **위치:** `explore-tools.service.ts` `getExecutionDetails()` (diff +304~311)
- **상세:** `Promise.all(directChildren.map(child => loadTimeline(child.id)))` 구조는 병렬 실행이므로 직렬보다 낫지만, 자식 수(N)만큼 별도 DB 커넥션을 소비한다. 각 `loadTimeline`은 `relations: ['node']`가 포함된 JOIN 쿼리이므로 N × (node_execution_count) 로우를 각각 처리한다. 일반적 sub-workflow 사용에서는 N이 적어 무해하지만, 노드가 반복 호출하는 패턴(loop + sub-workflow)에서는 10+ 병렬 쿼리가 발생할 수 있다.
- **제안:** 자식 실행 ID 목록을 하나의 IN 쿼리로 일괄 조회한 뒤 `executionId` 기준으로 메모리 분배한다.
  ```typescript
  const allChildIds = directChildren.map(c => c.id);
  const allNodeExecs = await this.nodeExecutionRepo.find({
    where: { executionId: In(allChildIds) },
    relations: ['node'],
    order: { startedAt: 'ASC' },
  });
  // Map<executionId, rows[]> 으로 분배
  ```

---

**[INFO]** `loadTimeline` — 타임라인 무제한 로딩 (페이지네이션 없음)
- **위치:** `explore-tools.service.ts` `loadTimeline()` (diff +321~340)
- **상세:** 단일 실행의 전체 노드 실행 레코드를 제한 없이 로드한다. 스펙도 "크기 제한 없음"을 명시하고 있어 의도적인 선택이지만, 매우 긴 워크플로우(노드 수백 개, 반복 실행 포함)에서는 대형 페이로드가 LLM 토큰과 메모리 양쪽을 소비한다. 현재 2-step 패턴 프롬프트로 LLM 남용을 억제하고 있으나, 서버-사이드 가드는 없다.
- **제안:** 즉각 수정 불필요. 향후 대형 실행이 문제가 된다면 `take: N` + `OFFSET` 또는 `maxNodes` 상한 파라미터 추가 검토.

---

**[INFO]** `maskSensitiveFields` 반복 호출 오버헤드
- **위치:** `explore-tools.service.ts` `toExecutionEnvelope()` (diff +342~356), `loadTimeline()` (diff +321~340)
- **상세:** `toExecutionEnvelope`에서 `inputData`/`outputData`/`error` 3회, `loadTimeline`의 각 node execution row마다 3회 재귀 순회한다. 중첩이 깊은 JSON 객체(예: AI Agent의 대화 이력)에서는 순회 비용이 누적될 수 있다.
- **제안:** 성능 문제가 확인된다면 순회를 한 번에 처리하도록 `maskSensitiveFields`가 객체 전체를 한 번에 순회하는 API 제공을 검토. 현재는 보안 요구사항 대비 허용 가능 수준.

---

**[INFO]** 복합 인덱스 의존 — 명시적 가이드 없음
- **위치:** `explore-tools.service.ts` `getWorkflowExecutions()` (diff +229~235)
- **상세:** `WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?` 쿼리는 `(workflow_id, started_at DESC)` 복합 인덱스가 없으면 풀 테이블 스캔 후 소트가 발생한다. 실행 이력이 많은 워크플로우에서 응답 지연의 주범이 될 수 있다.
- **제안:** 마이그레이션에 `CREATE INDEX IF NOT EXISTS idx_executions_workflow_started ON executions(workflow_id, started_at DESC)` 추가 확인.

---

### 요약

`explore-tools.service.ts`의 신규 실행 조회 메서드 2종은 N+1 패턴을 명시적으로 피하려 했으나, `loadNodeStats`에서 DB GROUP BY 대신 애플리케이션 레벨 집계를 사용하고, `getExecutionDetails`에서 자식 타임라인을 N개 병렬 쿼리로 로드하는 두 가지 개선 포인트가 남아 있다. 두 이슈 모두 현재 상한(limit 50, 일반적 sub-workflow 수)에서는 체감 성능에 큰 영향이 없으나, 트래픽이 증가하거나 서브워크플로우 호출이 많은 복잡한 워크플로우에서는 DB 부하와 메모리 사용량이 비선형으로 증가할 수 있다. 나머지 변경사항(tool-definitions, stream service dispatch, i18n, tsconfig)은 성능 관점의 우려 사항이 없다.

### 위험도

**LOW** — 현재 스펙 상한(limit 50, 일반적 자식 수) 내에서는 안전하나, 두 WARNING 항목은 고부하 시나리오를 대비해 조기에 수정하는 것이 권장됨.