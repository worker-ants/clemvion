### 발견사항

---

**[WARNING] `loadTimeline`에 LIMIT 없음 — 루프 실행 시 페이로드 폭발 위험**
- **위치:** `explore-tools.service.ts` — `loadTimeline()` 메서드
- **상세:** `nodeExecutionRepo.find({ where: { executionId }, relations: ['node'], order: ... })` 에 `take` 제한이 없다. 루프 노드가 수천 번 반복 실행된 워크플로 (`forEach`, `while` 류)의 경우 한 번의 `getExecutionDetails` 호출이 수만 row를 메모리로 올린다. 게다가 `getExecutionDetails` 는 `directChildren.map(child => loadTimeline(child.id))`로 자식 실행의 타임라인도 동일하게 무제한 로드한다.
- **제안:** `take: 500` (또는 스펙에서 확정한 임계값) 을 두고, 잘린 경우 `timelineTruncated: true` 힌트를 응답에 포함해 LLM이 인지하도록 한다. 스펙 §4.1.1 "크기 제한 없음" 정책 자체를 재검토하는 것도 권장한다.

---

**[WARNING] 자식 실행 타임라인 N+1 쿼리**
- **위치:** `explore-tools.service.ts` — `getExecutionDetails()` 내 `Promise.all(directChildren.map(async (child) => ({ timeline: await this.loadTimeline(child.id) })))`
- **상세:** `Promise.all` 로 병렬화되어 있지만 자식 실행이 N개이면 DB 히트가 N회 발생한다. 각 `loadTimeline` 내부에는 `relations: ['node']` JOIN도 포함되어 있어 단순 row 조회보다 무겁다. 자식 실행이 많을 경우(예: 병렬 fan-out 패턴) 커넥션 풀 고갈로 이어질 수 있다.
- **제안:** `nodeExecutionRepo.find({ where: { executionId: In(childIds) }, relations: ['node'], order: { executionId: 'ASC', startedAt: 'ASC' } })` 단일 쿼리로 모든 자식 타임라인을 한 번에 가져온 뒤 `executionId` 기준으로 메모리에서 그룹핑한다. `loadNodeStats`가 이미 동일한 패턴(`In()` + 메모리 집계)을 올바르게 사용하고 있으므로 참고할 수 있다.

---

**[WARNING] 인덱스 존재 미확인 — `parent_execution_id` 컬럼**
- **위치:** `explore-tools.service.ts` — `executionRepo.find({ where: { parentExecutionId: execution.id } })` 및 `createQueryBuilder(...).where('e.parent_execution_id IN (:...childIds)')`
- **상세:** `parent_execution_id` 컬럼이 이번 diff에 처음 쿼리 조건으로 사용되는데, 해당 컬럼에 인덱스가 없으면 `execution` 테이블 전체 스캔이 발생한다. 실행 이력이 누적될수록 성능이 선형으로 저하된다.
- **제안:** `Execution` 엔티티 또는 관련 마이그레이션 파일에 `@Index()` 혹은 `CREATE INDEX idx_executions_parent_id ON executions(parent_execution_id)` 가 이미 있는지 확인한다. 없다면 인덱스 추가 마이그레이션이 필요하다.

---

**[WARNING] 인덱스 존재 미확인 — `execution_id` + `started_at` 복합 쿼리**
- **위치:** `explore-tools.service.ts` — `getWorkflowExecutions()` QueryBuilder: `.where('e.workflow_id = :workflowId').orderBy('e.started_at', 'DESC').limit(limit)`
- **상세:** `(workflow_id, started_at DESC)` 복합 인덱스 없이는 `workflow_id` 단일 인덱스로 필터한 후 filesort 가 발생한다. `status` 필터가 추가될 때(`(workflow_id, status, started_at DESC)`)도 동일 문제다.
- **제안:** `execution` 테이블에 `(workflow_id, started_at DESC)` 복합 인덱스, 선택적으로 `(workflow_id, status, started_at DESC)` 인덱스를 확인·추가한다.

---

**[INFO] `loadNodeStats` — `In()` 패턴으로 N+1 올바르게 회피**
- **위치:** `explore-tools.service.ts` — `loadNodeStats()`
- **상세:** 최대 50개 `executionId`를 단일 `IN` 쿼리로 묶어 node_execution 통계를 한 번에 가져오고 메모리에서 집계한다. N+1 없이 설계된 올바른 패턴이다. `node_execution.execution_id` 인덱스가 있다면 성능 문제 없음.

---

**[INFO] 모든 쿼리가 TypeORM 파라미터 바인딩 사용 — SQL 인젝션 없음**
- **위치:** 전체 `explore-tools.service.ts`
- **상세:** `':workflowId'`, `':status'`, `':...childIds'` 등 모두 named parameter 방식. 문자열 직접 보간(interpolation) 없음. 안전.

---

**[INFO] 마이그레이션 변경 없음 — 배포 위험 없음**
- **위치:** `workflow-assistant.module.ts`
- **상세:** `TypeOrmModule.forFeature([Execution, NodeExecution])` 추가는 기존 엔티티를 새 모듈에서 DI 주입하는 것이며 스키마 변경이 아니다. 무중단 배포에 안전하다.

---

### 요약

변경 코드는 신규 DB 스키마를 도입하지 않고 기존 `Execution`·`NodeExecution` 테이블을 read-only로 조회한다. `loadNodeStats`가 `In()` 패턴으로 N+1을 올바르게 회피하는 것은 좋은 설계다. 그러나 `loadTimeline`에 row 수 상한이 없어 루프가 많은 워크플로 실행에서 메모리·응답 폭발 위험이 있고, 자식 실행 타임라인 조회가 N개 병렬 쿼리로 발생하는 실질적 N+1이 남아 있다. `parent_execution_id`와 `(workflow_id, started_at DESC)` 인덱스 존재 여부는 이번 diff에서 확인되지 않아 인덱스 누락 시 운영 중 성능 저하가 불가피하다.

### 위험도

**MEDIUM**