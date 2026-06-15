# 성능(Performance) 리뷰

## 발견사항

### 발견사항 1
- **[WARNING]** `list()` 에서 `assertWorkflow` 와 실제 데이터셋 쿼리가 순차 실행되는 직렬 2-쿼리 패턴
  - 위치: `/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` — `list()` (lines 1611–1628), `create()` (lines 1630–1646)
  - 상세: `list` 와 `create` 는 `await this.assertWorkflow(...)` 로 workflow 존재 확인 쿼리를 먼저 날리고, 그 결과가 반환된 뒤 데이터셋 쿼리를 별도로 실행한다. 두 쿼리는 서로 의존하지 않으므로 왕복(RTT)이 1회 추가 발생한다. 고빈도 에디터 액션(자동 저장 또는 드롭다운 열기)에서는 누적 레이턴시가 체감된다.
  - 제안: `list` 의 경우 workflow 존재 확인을 JOIN 또는 EXISTS 서브쿼리로 데이터셋 쿼리에 병합하여 1-쿼리로 처리한다. `create` 는 workflow 조회 결과(workspaceId 확정)가 실제로 필요하지 않으므로, UNIQUE 제약 위반(FK violation: workflow_id FK ON DELETE CASCADE)으로 workflow 부재를 감지하는 방식이나 `Promise.all` 병렬화를 검토할 수 있다. 단, 명시적 404 메시지 요건이 있는 경우 병렬화 후 순서대로 결과 처리 필요.

### 발견사항 2
- **[WARNING]** `list()` QueryBuilder 에서 `workflow_id` 와 `workspace_id` 가 AND 조건으로 함께 사용되나, 복합 인덱스가 이 조합을 커버하지 않음
  - 위치: `/codebase/backend/migrations/V097__workflow_test_dataset.sql` lines 65–69, `/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` `list()` QueryBuilder
  - 상세: 현재 인덱스는 `(owner_id, workflow_id)` 와 `(workspace_id, visibility)` 두 개다. `list()` 쿼리의 WHERE 절은 `workflow_id = ?` AND `workspace_id = ?` AND `(owner_id = ? OR visibility = 'workspace')` 이며, ORDER BY `updated_at DESC`, LIMIT 200 이다. 이 쿼리는 두 인덱스 중 어느 것도 선두 컬럼으로 `workflow_id` 를 갖지 않으므로, 플래너가 `(workspace_id, visibility)` 인덱스를 사용하더라도 `workflow_id` 필터는 힙 접근 후 처리된다. 워크스페이스 내 workflow 가 많아질수록 비효율이 커진다.
  - 제안: `(workflow_id, workspace_id, updated_at DESC)` 복합 인덱스를 추가하거나, `(workflow_id, workspace_id, owner_id, visibility, updated_at)` 커버링 인덱스를 검토한다. `assertWorkflow` 를 쿼리에 통합하면 인덱스 설계를 단순화할 수 있다.

### 발견사항 3
- **[INFO]** `findAccessible()` 에서 전체 행을 SELECT 후 애플리케이션 레이어에서 소유권 판단
  - 위치: `/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` `findAccessible()` (lines 1658–1686)
  - 상세: `findOne({ where: { id, workspaceId } })` 로 모든 컬럼(JSONB `data` 포함)을 로드한 뒤, `ownerId === userId` 비교와 `visibility` 확인을 JS 레이어에서 수행한다. `remove` 처럼 `data` 컬럼이 불필요한 경우에도 대형 JSONB payload 를 메모리로 가져온다.
  - 제안: `update`/`remove` 의 권한 확인용 쿼리에는 `select: { id: true, ownerId: true, visibility: true, workflowId: true, workspaceId: true, name: true }` 를 적용해 JSONB 전송을 생략한다. `update` 는 이후 `save` 로 갱신하므로 entity 전체 로딩이 필요하지만, `remove` 는 id 만 있으면 `delete({ id })` 로 처리 가능하다.

### 발견사항 4
- **[INFO]** `list()` soft-limit 200 행은 JSONB `data` 컬럼 전체를 메모리에 적재
  - 위치: `/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` `list()`, entity 정의 `input: Record<string, unknown>`
  - 상세: `.take(200)` 으로 상한을 두었으나 각 행의 `data` JSONB 크기에 제한이 없다. Mock Input 이 대형 JSON(수백 KB)인 경우 목록 API 1회 호출이 수십 MB 를 반환할 수 있다. 현재 spec 에 JSONB 크기 제한이 명시되지 않은 것으로 보인다.
  - 제안: 목록 API 에서는 `data` 컬럼을 제외하고 메타데이터만 반환하거나(`select` 에서 `input` 제외), spec 에 Mock Input 최대 크기 제한을 명시한다. 상세(input) 조회는 단일 `GET /test-datasets/:id` 엔드포인트로 분리하는 방안도 있다.

### 발견사항 5
- **[INFO]** `UNIQUE (workflow_id, owner_id, name)` 제약과 인덱스 중복
  - 위치: `/codebase/backend/migrations/V097__workflow_test_dataset.sql` lines 61–62, 65–66
  - 상세: PostgreSQL 의 UNIQUE 제약은 내부적으로 B-tree 인덱스를 생성한다. `(workflow_id, owner_id, name)` UNIQUE 제약이 있음에도 `(owner_id, workflow_id)` 복합 인덱스를 별도로 만들었다. UNIQUE 인덱스의 선두 컬럼이 `workflow_id` 이므로 `owner_id` 선행 쿼리에는 별도 인덱스가 필요하지만, UNIQUE 인덱스 자체를 `(owner_id, workflow_id, name)` 순으로 변경하면 `(owner_id, workflow_id)` 인덱스를 제거해 쓰기 오버헤드를 줄일 수 있다.
  - 제안: UNIQUE 제약 컬럼 순서를 `(owner_id, workflow_id, name)` 으로 변경하면 `idx_workflow_test_dataset_owner_workflow` 별도 인덱스 없이도 동등한 조회 성능을 확보할 수 있다. 단, 이름 중복 의미(같은 workflow + owner 내 중복)가 바뀌지 않아야 함을 확인.

### 발견사항 6
- **[INFO]** e2e 테스트 `beforeAll` 에서 순차 HTTP 요청으로 셋업 시간 누적
  - 위치: `/codebase/backend/test/workflow-test-dataset.e2e-spec.ts` `beforeAll` (lines 1986–2011)
  - 상세: `registerAndLogin` → `createTeamWorkspace` → `inviteAndAccept` → workflow 생성이 모두 직렬로 실행된다. 테스트 자체의 성능 이슈라기보다는 CI 파이프라인 시간에 영향을 줄 수 있다. 현재 `inviteAndAccept` 내부가 이메일 확인·수락 등 복수 단계라면 병렬 처리 가능한 부분을 `Promise.all` 로 묶을 여지가 있다.
  - 제안: `registerAndLogin` 으로 owner/member 등록을 `Promise.all` 병렬 처리 후, 의존 관계(워크스페이스 생성 → 멤버 초대)만 순서를 유지한다.

## 요약

신규 도입된 `workflow_test_dataset` 모듈은 전반적으로 단순한 CRUD 구조를 가지며 N+1 쿼리나 반복문 내 DB 호출 같은 명확한 고위험 패턴은 없다. 주요 성능 위험은 두 가지다. 첫째, `list`/`create` 에서 workflow 유효성 검사 쿼리와 실제 데이터 쿼리가 순차 직렬 실행되어 RTT 가 2회 발생한다(WARNING). 둘째, `list()` 쿼리의 WHERE 패턴(`workflow_id AND workspace_id AND (owner_id OR visibility)`)이 현재 인덱스 구조와 잘 맞지 않아 행 수 증가 시 플래너가 비효율적인 인덱스를 선택할 수 있다(WARNING). 두 문제 모두 현재 예상 데이터 규모(워크플로우당 소수의 데이터셋)에서는 체감 영향이 낮으나, 인덱스 설계 개선과 직렬 쿼리 통합은 설계 시 반영하기 쉬운 수준의 변경이므로 조기 적용을 권장한다. JSONB `data` 컬럼을 목록 API 에서 전체 로드하는 패턴도 Mock Input 크기 제한이 명시되지 않은 상태에서는 잠재적 메모리 위험이다.

## 위험도

MEDIUM
