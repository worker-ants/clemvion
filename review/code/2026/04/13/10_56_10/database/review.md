### 발견사항

- **[WARNING]** `node` 테이블에 `(workflow_id, category)` 복합 인덱스 누락
  - 위치: `HooksService.loadTriggerParameterSchema()`, `ScheduleRunnerService.loadTriggerParameterSchema()`, `WorkflowsController.loadTriggerParameterSchema()`
  - 상세: 세 곳 모두 동일한 패턴으로 쿼리를 실행한다.
    ```typescript
    await this.nodeRepository.findOne({
      where: { workflowId, category: NodeCategory.TRIGGER },
    });
    ```
    webhook 수신·스케줄 실행·수동 실행마다 이 쿼리가 발생한다. `node` 테이블이 수백 노드 이상으로 커질 경우 `workflow_id` 단독 인덱스만으로는 `category` 필터가 seq-scan을 유발할 수 있다. 현재 마이그레이션(`V011`)에 해당 인덱스 추가가 없다.
  - 제안: 마이그레이션에 아래를 추가한다.
    ```sql
    CREATE INDEX IF NOT EXISTS idx_node_workflow_category
        ON node (workflow_id, category);
    ```

- **[WARNING]** `loadTriggerParameterSchema` 로직이 3곳에 복제되어 쿼리 경로가 분산됨
  - 위치: `hooks.service.ts`, `schedule-runner.service.ts`, `workflows.controller.ts`
  - 상세: 동일한 `nodeRepository.findOne` 쿼리·검증 로직이 복사되어 있다. 향후 인덱스 힌트, 캐싱, 쿼리 튜닝을 적용할 때 세 곳을 모두 수정해야 하고, 하나라도 놓치면 동작이 달라진다. 또한 `WorkflowsController`에서 `nodeRepository`를 직접 주입받는 것은 controller 계층이 DB에 직접 접근하는 구조로, 서비스 계층 우회가 된다.
  - 제안: `ExecutionEngineModule`에서 이미 export하는 `ExpressionResolverService`처럼, trigger 파라미터 스키마 조회를 전담하는 서비스 메서드(예: `TriggerParameterSchemaService` 또는 `NodeHandlerRegistry`의 메서드)로 위임하여 단일 소스로 관리한다.

- **[INFO]** V011 마이그레이션 안전성 확인 (PostgreSQL 버전 의존)
  - 위치: `backend/migrations/V011__schedule_parameter_values.sql`
  - 상세: `ADD COLUMN ... NOT NULL DEFAULT '{}'`는 PostgreSQL 11 이상에서 테이블 rewrite 없이 처리된다(상수 default는 메타데이터만 갱신). PostgreSQL 10 이하에서는 전체 테이블 lock + rewrite가 발생한다. `IF NOT EXISTS`는 재실행 안전성을 보장하므로 올바른 사용이다.
  - 제안: 프로젝트의 최소 지원 PostgreSQL 버전이 11 이상임을 확인한다. 이미 그렇다면 이 마이그레이션은 무중단 배포에 안전하다.

- **[INFO]** `HooksService.handleWebhook()`에서 execution 생성과 `lastTriggeredAt` 업데이트 간 트랜잭션 부재
  - 위치: `hooks.service.ts`, 84~101행 구간
  - 상세: `executionEngineService.execute()` 완료 후 `triggerRepository.save(trigger)`가 별도로 실행된다. 두 작업 사이에 프로세스가 종료되거나 DB 에러가 발생하면 `lastTriggeredAt`이 갱신되지 않는다. 이 필드는 통계성 메타데이터이므로 데이터 정합성 손상은 아니지만, 모니터링 화면에서 마지막 실행 시각이 누락될 수 있다.
  - 제안: 현재 구조에서는 허용 가능한 수준이나, `lastTriggeredAt` 신뢰성이 중요하다면 execution 생성과 동일한 트랜잭션 내에서 처리하거나 execution 완료 이벤트에서 업데이트하는 방식을 검토한다.

---

### 요약

이번 변경은 `schedule` 테이블에 `parameter_values JSONB` 컬럼을 추가하는 마이그레이션(PostgreSQL 11+ 기준 무중단 배포 안전), 세 가지 트리거 경로(Manual, Webhook, Schedule) 모두에 파라미터 스키마 조회 쿼리를 추가하는 구조이다. 가장 주목할 점은 `node(workflow_id, category)` 복합 인덱스 없이 해당 쿼리가 모든 실행 진입 경로에서 반복 실행된다는 것으로, 트래픽이 늘어날수록 성능 병목이 될 수 있다. 동일한 DB 접근 로직이 세 서비스에 복제된 구조도 유지보수 위험을 높이므로 중앙화가 필요하다.

### 위험도
**MEDIUM**