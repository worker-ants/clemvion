## 발견사항

### **[WARNING]** `getRecentWorkflows` orderBy에 DB 컬럼명(snake_case) 사용
- **위치**: `dashboard.service.ts` — `getRecentWorkflows` 메서드
- **상세**: `orderBy('w.updated_at', 'DESC')`는 DB 컬럼명을 사용하고 있음. 같은 파일의 `getRecentExecutions`는 TypeORM `orderBy` 버그 수정으로 `e.startedAt`(entity property명)으로 이미 교체됨. `getRecentWorkflows`는 현재 `leftJoin` + `skip/take` 조합이 없어 오류가 재현되지 않지만, 향후 쿼리 변경 시 `Cannot read properties of undefined (reading 'databaseName')` 버그가 재발할 수 있음.
- **제안**: `orderBy('w.updatedAt', 'DESC')`로 통일 — 이미 수정한 `getRecentExecutions`와 동일한 규칙 적용.

---

### **[WARNING]** workspace 범위 실행 쿼리의 잠재적 인덱스 취약 경로
- **위치**: `dashboard.service.ts` — `getRecentExecutions`, `getSummary`
- **상세**: 두 메서드 모두 `executions → workflows JOIN` 후 `w.workspace_id = :workspaceId`로 필터링함. `executions` 테이블에 `workspace_id` 컬럼이 없어, 모든 workspace 범위 실행 쿼리가 JOIN을 필수로 거침. `executions.workflow_id` FK 인덱스와 `workflows.workspace_id` 인덱스가 없거나 실행 건수가 많을 경우 full scan + nested loop 가능성이 있음.
- **제안**: 다음 인덱스 존재 여부 확인 및 마이그레이션 추가:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON executions(workflow_id);
  CREATE INDEX IF NOT EXISTS idx_workflows_workspace_id ON workflows(workspace_id);
  -- 특히 getRecentExecutions의 startedAt 정렬까지 커버하려면:
  CREATE INDEX IF NOT EXISTS idx_executions_workflow_started ON executions(workflow_id, started_at DESC);
  ```

---

### **[INFO]** `getSummary` 초반 2개 쿼리가 직렬 실행
- **위치**: `dashboard.service.ts` — `getSummary` 메서드 상단
- **상세**: `totalWorkflows`와 `activeWorkflows` count 쿼리가 순차 실행된 후 `Promise.all`로 진입함. 두 쿼리는 서로 독립적이므로 직렬 실행이 불필요한 지연을 추가함 (약 1 RTT 손실).
- **제안**:
  ```typescript
  const [totalWorkflows, activeWorkflows] = await Promise.all([
    this.workflowRepository.count({ where: { workspaceId } }),
    this.workflowRepository.count({ where: { workspaceId, isActive: true } }),
  ]);
  ```

---

### **[INFO]** N+1 문제 올바르게 처리됨
- **위치**: `load-parent-workflow-names.ts`
- **상세**: 부모 실행 workflow명을 단일 `IN` 쿼리로 일괄 로드하고, `parentIds.length === 0` 시 즉시 반환. `executionsService`, `dashboardService` 양쪽에서 재사용 가능한 유틸로 추출되어 중복 제거 완료. 설계가 올바름.

---

### **[INFO]** 파라미터화 쿼리로 SQL 인젝션 방지
- **위치**: 전 파일
- **상세**: TypeORM의 `:param` 바인딩을 일관되게 사용. `getSortColumn`의 화이트리스트 매핑으로 동적 컬럼명 삽입도 안전하게 처리됨. `order` 값(`'asc'`/`'desc'`)은 TypeScript 타입으로만 제한되므로, DTO 레이어에서 런타임 검증(enum validator 등)이 있는지 별도 확인 권장.

---

### **[INFO]** `loadParentWorkflowNames` IN 절 크기 상한
- **위치**: `load-parent-workflow-names.ts`
- **상세**: 함수 자체에 IN 리스트 크기 제한이 없음. 현재 호출 측이 `limit(10)`, `take(20)`으로 제한하므로 실질적 문제는 없으나, 함수 계약이 암묵적으로 호출자에 의존함. PostgreSQL의 경우 IN 절 수천 개까지는 실용적으로 문제없지만, 향후 `limit`이 확대될 경우를 대비해 내부적으로 사이즈 경고 로그나 주석 명시를 고려할 수 있음.

---

## 요약

데이터베이스 쿼리 전반의 품질은 양호하다. N+1 문제는 `loadParentWorkflowNames`의 배치 IN 쿼리로 올바르게 해소되었고, SQL 인젝션 방어도 충분하다. 주요 리스크는 두 가지다: `getRecentWorkflows`의 `orderBy`에 DB 컬럼명이 남아있어 향후 쿼리 확장 시 TypeORM 버그가 재발할 수 있으며, workspace 범위 실행 쿼리가 JOIN을 통해 workspace를 필터링하는 구조상 `executions.workflow_id`와 `workflows.workspace_id` 인덱스의 존재가 성능에 핵심적이다. 두 인덱스가 마이그레이션에 포함되어 있는지 확인이 필요하다.

## 위험도

**LOW**