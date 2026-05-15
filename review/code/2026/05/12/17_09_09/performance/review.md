## 성능 리뷰 결과

### 발견사항

---

- **[MEDIUM]** `ownership` 필터 적용 시 매 요청마다 추가 DB 조회 발생
  - **위치**: `workflows.service.ts:85–97`
  - **상세**: `ownership === 'mine' || ownership === 'shared'` 조건에서 `this.workspacesService.findById(workspaceId)`를 호출하여, 이미 진행 중인 workflow 목록 쿼리 외에 workspace 테이블에 추가 DB 라운드트립이 순차적으로 발생한다. `ownership=mine`/`shared` 요청마다 쿼리가 2회(workspace SELECT → workflow SELECT+COUNT) 발생하는 구조.
  - **제안**: 워크스페이스 타입은 이미 JWT나 요청 컨텍스트(X-Workspace-Id 미들웨어)에서 확보 가능한 정보이므로, 컨트롤러에서 workspace type을 함께 전달하거나 `findAll` 내부에서 `qb.innerJoin('workspace', 'ws', 'ws.id = w.workspace_id AND ws.type = :type', {type: 'team'})` 형태로 단일 쿼리로 합치는 방안을 고려. 또는 WorkspacesService에 request-scoped 인메모리 캐시를 두어 동일 요청 내 중복 조회를 제거.

  ```typescript
  // 현재: 순차 2 DB 호출
  const workspace = await this.workspacesService.findById(workspaceId); // 추가 SELECT
  if (workspace?.type === 'team') { ... }

  // 개선안 1: 컨트롤러에서 workspace type을 파라미터로 전달
  async findAll(workspaceId: string, query: QueryWorkflowDto, userId: string, workspaceType: string)

  // 개선안 2: qb에 subquery로 합치기 (단일 쿼리)
  if (ownership === 'mine' || ownership === 'shared') {
    qb.innerJoin('workspace', 'ws', 'ws.id = w.workspace_id')
      .andWhere('ws.type = :wsType', { wsType: 'team' });
    ...
  }
  ```

---

- **[INFO]** `created_by != :userId` 조건의 NULL 처리 — 성능·정확도 이중 주의
  - **위치**: `workflows.service.ts:94`
  - **상세**: SQL `!=` (또는 `<>`)는 NULL과 비교 시 `UNKNOWN`을 반환하여 `created_by IS NULL`인 row를 `shared` 목록에서 누락시킨다. 현재 entity 스키마에서 `created_by`가 NOT NULL이라면 문제없지만, nullable인 경우 silent data loss가 발생한다. 또한 `created_by`에 인덱스가 없으면 workspace 내 row가 많을 때 full scan이 발생할 수 있다.
  - **제안**: `created_by` 컬럼의 NOT NULL 제약을 마이그레이션에서 확인하고, 인덱스(`idx_workflows_workspace_created_by`)가 없다면 추가를 검토. nullable이라면 `qb.andWhere('(w.created_by != :userId OR w.created_by IS NULL)', { userId })`로 보완.

---

- **[INFO]** `filterButtons`·`ownershipButtons` 배열이 매 렌더마다 재생성
  - **위치**: `page.tsx:257–273`
  - **상세**: 두 배열은 컴포넌트 내부에 inline으로 선언되어 있어 매 렌더마다 새로운 배열 객체가 생성된다. 현재 크기(3개 항목)에서는 GC 부담이 무시할 수준이지만, `.map()` 호출 결과가 React reconciler에서 항상 새 children으로 인식된다.
  - **제안**: 컴포넌트 외부 상수로 추출하거나 `useMemo`로 감쌀 것. `filterButtons`도 동일 패턴.

  ```typescript
  // 컴포넌트 밖에 상수 선언
  const OWNERSHIP_BUTTONS: { labelKey: TranslationKey; value: Ownership }[] = [
    { labelKey: "workflows.ownership.all", value: "all" },
    ...
  ];
  ```

---

- **[INFO]** `getCount()` + `getMany()` 이중 쿼리 — 기존 패턴 유지 확인
  - **위치**: `workflows.service.ts:99–103`
  - **상세**: 이번 변경과 직접 관련은 없으나, ownership 필터가 추가되면서 `getCount()`와 `getMany()` 두 쿼리에 모두 ownership 조건이 적용되는지 확인 필요. TypeORM QueryBuilder는 `getCount()` 호출 시 내부적으로 쿼리를 클론하므로 조건은 동일하게 적용되나, `workspacesService.findById`는 `getCount()` 전에 1회만 호출되어 조건 추가 후 두 쿼리에 공유됨 — 이 부분은 정상.

---

### 요약

이번 변경의 핵심 성능 이슈는 `ownership=mine`/`shared` 요청마다 **`workspacesService.findById`로 인한 추가 DB 라운드트립**이다. `ownership=all`(미지정)에서는 조회가 없는 테스트 케이스(`all-noop` 테스트)가 이 우려를 인식하고 있음을 보여주지만, 실제 필터 사용 시의 추가 쿼리는 그대로 남아 있다. 팀 워크스페이스에서 소유 필터를 자주 사용하는 사용자일수록 누적 레이턴시가 증가한다. 나머지 항목(NULL 처리, 배열 재생성)은 현재 규모에서 실질적 영향은 낮다. frontend 캐시 전략(`queryKey` 구성)은 올바르며, debounce·pagination 처리도 이상 없다.

### 위험도

**LOW** (기능 정확도에는 문제 없음, 고빈도 팀 사용 환경에서 latency 증가 가능)