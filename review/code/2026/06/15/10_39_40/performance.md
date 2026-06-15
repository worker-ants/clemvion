# 성능(Performance) 리뷰

## 발견사항

### [INFO] `list()` 에서 `assertWorkflow` 선행 쿼리 — 2회 왕복
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` — `list()` L78, `create()` L98
- 상세: `list`·`create` 둘 다 `assertWorkflow(workflowId, workspaceId)` 를 먼저 실행하여 `workflow` 테이블에 존재 확인 쿼리를 한 번 발행한 뒤, 실제 데이터셋 쿼리를 별도로 발행한다. 이로 인해 매 호출마다 DB 왕복이 2회 발생한다. 현 규모(단건 확인)에서 절대 지연은 작지만, workflow 조회와 dataset 조회를 하나의 JOIN 또는 EXISTS 서브쿼리로 합칠 경우 왕복을 1회로 줄일 수 있다.
- 제안: `list` 의 경우 `createQueryBuilder` 에 `.innerJoin(Workflow, 'w', 'w.id = d.workflow_id AND w.workspace_id = :workspaceId')` 를 추가해 단일 쿼리로 workflow 존재 검증과 데이터셋 조회를 결합한다. `create` 는 현재 구조상 먼저 workspaceId 를 확정해야 하므로 허용 수준이나, 마찬가지로 INSERT 전 SELECT 를 피하는 방식(FK 제약 위반을 catch) 도 고려할 수 있다.

### [INFO] `list()` 에서 전체 행 메모리 적재 후 `map()` — 페이지네이션 부재
- 위치: `workflow-test-datasets.service.ts` — `list()` L79-89
- 상세: `getMany()` 로 조건에 맞는 모든 행을 메모리에 적재한 뒤 `rows.map(r => this.toDto(r, userId))` 로 변환한다. 현재 spec §2.2 에 페이지네이션 요구사항이 명시돼 있지 않고, 한 워크플로우에 대한 데이터셋 수가 수십~수백 건을 넘지 않을 가능성이 높다. 그러나 사용자가 대량 데이터셋을 누적한 극단적 경우, 단일 요청에서 JSONB 열(`input`)을 포함한 전체 행을 메모리에 적재하므로 메모리 압박이 발생할 수 있다.
- 제안: 단기적으로는 `.take(200)` 등 합리적 상한(소프트 리미트)을 추가해 단일 요청에서 메모리 폭발을 방지한다. 중장기적으로 목록 API 에 페이지네이션(cursor 또는 offset/limit)을 도입하거나, 목록 응답에서 `input`(JSONB 전체) 를 제외하고 상세 조회 시에만 포함하는 방식을 고려한다.

### [INFO] `clone()` 에서 `copyName()` 이 이름 충돌 시 단순 UNIQUE 위반 — 반복 시도 미구현
- 위치: `workflow-test-datasets.service.ts` — `clone()` L169-184, `copyName()` L207-211
- 상세: `copyName` 은 항상 `<name> (Copy)` 고정 접미어를 생성한다. "이름 (Copy)" 이 이미 존재하면 `saveUnique` 가 `ConflictException(DUPLICATE_NAME)` 을 던지고 `clone` 은 실패한다. 주석에 "충돌 시 '이름 (Copy 2)' …" 방식이 언급돼 있으나 실제 구현에서는 번호 증가 로직이 없다. 사용자가 동일 워크플로우에서 같은 데이터셋을 여러 번 복제하면 두 번째 시도부터 409 오류가 발생한다.
- 제안: 이는 성능 문제라기보다 기능 결함이지만, 재시도 로직 추가 시 추가 SELECT 쿼리가 수반된다. 성능 관점에서는 번호 증가 재시도를 DB 에서 `COUNT` 로 먼저 조회해 이름을 확정한 뒤 INSERT 하는 방식보다, 낙관적 접근(INSERT 후 충돌 catch → 번호 증가 재시도) 이 DB 왕복을 줄인다. 어느 방식이든 현재보다 나으나, 후자(낙관적)가 일반 경우에 왕복 1회로 처리된다.

### [INFO] `list()` 에서 컬럼 선택 없이 전체 컬럼 조회 (`select *` 동등)
- 위치: `workflow-test-datasets.service.ts` — `list()` L79-88
- 상세: `createQueryBuilder` 에 `.select(...)` 를 지정하지 않아 `input`(JSONB, 대용량 가능) 포함 전체 컬럼을 조회한다. 목록 화면에서 `input` 전체 페이로드가 즉시 필요하지 않다면(예: 이름·공유 여부만 목록 표시), 불필요한 대용량 데이터가 DB → 앱 서버 → 클라이언트를 거치게 된다.
- 제안: 목록 응답 DTO 와 상세 응답 DTO 를 분리해, 목록에서는 `input` 을 제외하거나 크기를 제한한다. 프론트엔드에서 클릭 시 데이터셋을 불러오는 방식(지연 로딩)이 대량 사용 시 네트워크/메모리를 절약한다.

### [INFO] `findAccessible()` 에서 `workspaceId` 검증 후 `isOwner`·`visibility` 추가 비교 — 쿼리 조건 최적화 여지
- 위치: `workflow-test-datasets.service.ts` — `findAccessible()` L114-148
- 상세: 현재 `findOne({ where: { id, workspaceId } })` 로 행을 가져온 뒤 애플리케이션 레이어에서 `isOwner`·`visibility` 를 비교해 404/403 을 결정한다. `requireOwner=false` (clone) 경로에서 비소유+비공유 행을 가져온 뒤 애플리케이션에서 걸러내는 구조다. DB 에서 `WHERE (owner_id = :userId OR visibility = 'workspace')` 조건을 추가하면 해당 행 자체를 가져오지 않아 전송 데이터를 줄일 수 있다. 단, `requireOwner=true` 경우 403 vs 404 구분이 필요하므로 그대로 유지가 합리적이다.
- 제안: `requireOwner=false` 경로에 한해 DB WHERE 에 가시성 조건을 추가해 불필요한 행 전송을 방지하는 방안을 고려한다.

### [INFO] 프론트엔드 데이터셋 목록 — 매 드롭다운 열기마다 API 호출
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/frontend/src/lib/api/workflow-test-datasets.ts` — `list()` 함수 / 프론트엔드 컴포넌트 연동
- 상세: 프론트엔드 API 클라이언트(`workflowTestDatasetsApi.list`)는 캐싱 레이어 없이 매 호출마다 서버에 요청을 보낸다. 에디터 툴바에서 "Datasets" 드롭다운을 열 때마다 호출된다면, 짧은 시간 내 반복 열기·닫기 시 불필요한 요청이 누적된다. diff 에서 프론트엔드 컴포넌트 구현(파일 19, editor-toolbar.tsx)이 일부 생략돼 실제 호출 빈도를 정확히 확인하기 어렵다.
- 제안: 드롭다운 열기 시 첫 로드 결과를 로컬 상태에 캐싱하고, create/clone/remove 성공 후 목록을 갱신하는 방식을 권장한다(stale-while-revalidate 또는 단순 메모이제이션). 에디터가 열려 있는 동안 주기적 재조회가 불필요하면, 변경 이벤트 후에만 무효화한다.

---

## 요약

이번 변경은 `WorkflowTestDataset` 엔티티와 CRUD+clone 백엔드 모듈, 프론트엔드 API 클라이언트 및 에디터 툴바 통합을 추가한다. 성능 관점의 주요 관찰은 다음과 같다. (1) `list`·`create` 각 요청마다 workflow 존재 확인용 SELECT 쿼리가 추가 발행되어 DB 왕복이 2회 발생한다 — JOIN 통합으로 1회 감소 가능. (2) `list()` 가 JSONB `input` 열을 포함한 전체 컬럼을 페이지네이션 없이 메모리에 적재하므로 대용량 데이터셋이 많은 워크플로우에서 메모리·네트워크 부담이 생긴다. (3) `copyName()` 이 단순 "(Copy)" 접미어만 생성해 충돌 시 재시도 로직이 없으므로, 반복 clone 시 409 오류로 실패한다(기능 결함이나 성능 재시도 설계와 연동됨). 이 중 현실적 즉각 위험은 낮고, 모두 INFO 수준이다. Critical·Warning 수준의 성능 결함은 발견되지 않는다.

## 위험도

LOW
