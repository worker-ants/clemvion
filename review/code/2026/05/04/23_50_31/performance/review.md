### 발견사항

- **[INFO]** 클라이언트 측 중복 슬라이스
  - 위치: `frontend/src/app/(main)/dashboard/page.tsx` — `recentExecutionsQuery.data.slice(0, 10)`
  - 상세: 백엔드 쿼리가 이미 `.limit(10)`으로 결과를 제한하므로, 프론트엔드의 `slice(0, 10)` 은 불필요한 배열 순회다. 데이터 크기가 작아 영향은 미미하지만 의도와 실제 동작이 불일치한다.
  - 제안: `slice` 제거 또는 백엔드 limit 변경 시 동기화 실패를 방지하는 주석 추가.

- **[INFO]** `Array.from(new Set(...))` 중간 배열 할당
  - 위치: `load-parent-workflow-names.ts` 14-21행
  - 상세: `.map()` → `.filter()` → `new Set()` → `Array.from()` 파이프라인이 세 개의 중간 배열·Set 객체를 생성한다. 페이지 크기(10~20건)에서는 무시할 수 있는 수준이지만, 호출 빈도가 높아지면 GC 압력이 누적된다.
  - 제안: 현 규모에서 변경 필요 없음. 향후 페이지 크기가 수백 건 이상으로 늘면 단일 `for` 루프로 Set 직접 구성하는 방식을 검토.

- **[WARNING]** `loadParentWorkflowNames` 무조건 호출
  - 위치: `dashboard.service.ts` 155-158행
  - 상세: `getRecentExecutions`는 executions 목록을 받은 뒤 `parentExecutionId`를 가진 행이 하나도 없어도 `loadParentWorkflowNames`를 무조건 `await`한다. 함수 내부의 `if (parentIds.length === 0) return map;` 가드 덕분에 DB 쿼리는 발생하지 않지만, `async` 함수 호출·Promise 할당·tick 소비는 매 요청마다 발생한다. 대시보드는 인증된 모든 사용자가 페이지 진입 시 호출하는 핫 패스다.
  - 제안:
    ```ts
    const hasSubworkflow = executions.some((e) => e.parentExecutionId != null);
    const parentNameMap = hasSubworkflow
      ? await loadParentWorkflowNames(this.executionRepository, executions)
      : new Map<string, string | null>();
    ```
    `executions.service.ts`의 `findByWorkflow`에도 동일하게 적용 가능.

- **[INFO]** `findById`에서 단일 요소 배열로 유틸 함수 호출
  - 위치: `executions.service.ts` 63-67행
  - 상세: 단일 실행의 부모 이름을 조회하기 위해 `[execution]` 배열을 생성해 범용 유틸을 호출한다. 배열 래핑 비용 자체는 무시할 수준이나, 서브워크플로우가 아닌 일반 실행에도 매번 async 호출이 발생한다.
  - 제안: 인라인 조건으로 단락 평가:
    ```ts
    const parentName = execution.parentExecutionId
      ? (await loadParentWorkflowNames(this.executionRepository, [execution]))
          .get(execution.parentExecutionId) ?? null
      : null;
    ```
    이 패턴은 현재 코드와 동일하므로 변경 불필요. 다만 `loadParentWorkflowNames` 내부에서 early-return이 보장되어 있어 실질적 영향 없음.

- **[INFO]** 모듈 레벨 상수 (`trigger-cell.tsx`)
  - 위치: `trigger-cell.tsx` 12-26행
  - 상세: `TRIGGER_ICON`과 `TRIGGER_LABEL_KEY`가 컴포넌트 외부 모듈 스코프에 정의되어 렌더링마다 재생성되지 않는다. 올바른 패턴이며 성능상 문제 없음.

---

### 요약

이번 변경의 핵심인 `loadParentWorkflowNames` 유틸 추출은 N+1 쿼리를 단일 IN 쿼리로 일괄 처리하고, SELECT 컬럼을 최소화(id, name)하여 over-fetch도 방지하는 올바른 설계다. 프론트엔드의 `TriggerCell` 컴포넌트 분리도 모듈 레벨 상수 배치 등 렌더링 최적화 관점에서 적절하다. 주요 개선 여지는 **대시보드 핫 패스에서 `loadParentWorkflowNames`를 무조건 호출**하는 부분으로, 서브워크플로우 실행이 없는 일반 대시보드 요청에서도 async 오버헤드가 발생한다. `hasSubworkflow` 조건을 추가하면 이를 제거할 수 있다. 나머지 항목은 현 트래픽 규모에서 무시 가능한 수준이다.

### 위험도

**LOW**