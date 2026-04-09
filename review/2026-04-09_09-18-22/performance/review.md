### 발견사항

---

**[WARNING] `adjacentQuery`: prev/next 탐색을 위해 최대 100건 전체 로드**
- 위치: `[executionId]/page.tsx` — `adjacentQuery` queryFn (L115~133)
- 상세: prev/next ID 2개만 필요한데 `limit: 100`으로 전체 목록을 로드 후 클라이언트에서 `findIndex` 탐색. 실행 이력 증가 시 페이로드가 선형 증가하며, 100건 초과 시 탐색 자체가 실패(기능 버그). 또한 `currentIndex === -1`인 경우 `items[0]`을 반환하는 인덱스 오류도 동반.
- 제안: 백엔드에 `/executions/:id/adjacent` 또는 `created_at` 커서 기반 `limit:1, before/after` 쿼리 두 번으로 대체. 최소한 `currentIndex === -1` 엣지 케이스 방어 코드 추가:
  ```ts
  if (currentIndex === -1) return { prev: null, next: null };
  ```

---

**[WARNING] `ExecutionListPage` 행 렌더링 시 `nodeExecutions` 3중 filter 순회**
- 위치: `executions/page.tsx` — `executions.map()` 내부
- 상세: 각 행 렌더링마다 `nodeExecutions`를 `completed` filter, `length`, `failed` filter로 3회 순회. 페이지당 20행 × 노드 수만큼 O(n×m) 연산. 서버 사이드 집계 없이 클라이언트에서 매 렌더마다 반복.
- 제안: 단일 `reduce`로 한 번에 집계:
  ```ts
  const { completed, failed, total } = (execution.nodeExecutions ?? []).reduce(
    (acc, ne) => {
      acc.total++;
      if (ne.status === "completed") acc.completed++;
      else if (ne.status === "failed") acc.failed++;
      return acc;
    },
    { completed: 0, failed: 0, total: 0 },
  );
  ```
  또는 `ExecutionData` 타입에 `completedCount`, `failedCount` 집계 필드를 서버에서 포함해 내려받도록 API 개선.

---

**[WARNING] `JsonViewer`에서 매 렌더마다 `JSON.stringify` 재실행**
- 위치: `[executionId]/page.tsx` — `JsonViewer` 컴포넌트
- 상세: `JsonViewer`가 `React.memo` 없이 정의되어 부모(`NodeResultsTab`)가 리렌더될 때마다 `JSON.stringify(data, null, 2)` 재실행. 노드 output/input 데이터가 클 경우 (AI Agent 다중 턴 결과, Table 데이터 등) 체감 지연 유발.
- 제안:
  ```ts
  const formatted = useMemo(
    () => typeof data === "string" ? data : JSON.stringify(data, null, 2),
    [data]
  );
  ```
  또는 `React.memo(JsonViewer, (prev, next) => prev.data === next.data)`

---

**[WARNING] `totalPages` 무한 버튼 렌더링 — 서버 응답값 상한 없음**
- 위치: `executions/page.tsx` — Pagination 섹션
- 상세: `Array.from({ length: totalPages }).map(...)` 로 전체 페이지 버튼을 DOM에 생성. `totalPages`가 서버 응답값이므로 비정상적으로 큰 값(예: 10000)이 오면 수천 개의 DOM 노드가 생성되어 브라우저 렌더링 블로킹 발생 (DoS-like).
- 제안: 상한 적용 + 슬라이딩 윈도우:
  ```ts
  const safeTotalPages = Math.min(totalPages ?? 0, 100);
  // 현재 페이지 ±2 범위 + 첫/마지막 페이지만 렌더링
  ```

---

**[INFO] `sortedNodeExecutions` 집계를 위한 별도 filter 순회 2회 추가**
- 위치: `[executionId]/page.tsx` — 메인 컴포넌트 본문
- 상세: `sortedNodeExecutions` useMemo 이후 `.filter(ne => ne.status === "completed").length` / `.filter(ne => ne.status === "failed").length` 로 2회 추가 순회. 정렬과 집계를 한 번에 처리하면 순회 횟수를 1/3로 줄일 수 있음.
- 제안:
  ```ts
  const { sorted, completedCount, failedCount } = useMemo(() => {
    if (!nodeExecutions) return { sorted: [], completedCount: 0, failedCount: 0 };
    let completed = 0, failed = 0;
    const sorted = [...nodeExecutions].sort(...);
    for (const ne of sorted) {
      if (ne.status === "completed") completed++;
      else if (ne.status === "failed") failed++;
    }
    return { sorted, completedCount: completed, failedCount: failed };
  }, [nodeExecutions]);
  ```

---

**[INFO] `detailTabs` 배열 매 렌더마다 재생성**
- 위치: `[executionId]/page.tsx` — `NodeResultsTab` 함수 본문 (L307~311)
- 상세: `detailTabs` 배열 리터럴이 컴포넌트 함수 본문에 선언되어 매 렌더마다 새 배열이 생성됨. `selectedNode?.error` 의존성이 있어 자주 변하지 않지만 useMemo 없이 불필요한 참조 변경이 하위 컴포넌트 리렌더를 유발할 수 있음.
- 제안: `useMemo(() => [...], [selectedNode?.error])`로 감싸거나, 조건 처리 로직을 분리하여 상수 배열로 관리.

---

**[INFO] Carousel `itemButtons` 런타임 ID 생성 — 대량 아이템 시 string 연산 비용**
- 위치: `spec/4-nodes/6-presentation-nodes.md` — Dynamic 모드 itemButtons 처리
- 상세: 스펙에 따르면 동적 모드에서 각 아이템마다 `{btnId}__item_{index}` 형태의 고유 ID를 생성. 아이템 수가 많을 경우 (maxItems: 100) 버튼 수 × 아이템 수만큼 string concatenation 및 `buttonConfig.buttons` 배열 크기 증가. `buttonItemMap` 빌드를 위한 추가 O(n×m) 연산 발생.
- 제안: `buttonItemMap`을 Map 자료구조로 관리하여 O(1) 룩업 보장. ID 생성은 런타임 1회만 수행하고 결과를 캐싱.

---

### 요약

성능 관점에서 가장 심각한 이슈는 세 가지다. 첫째, `adjacentQuery`가 prev/next 2개 ID를 위해 최대 100건을 전체 로드하는 구조로, 기능적 버그(100건 초과 시 탐색 실패)와 불필요한 네트워크 페이로드를 동시에 야기한다. 둘째, `ExecutionListPage`에서 행마다 `nodeExecutions`를 3회 순회하는 O(n×m) 연산은 단일 `reduce`로 O(n×m/3)으로 즉시 개선 가능하다. 셋째, `JsonViewer`의 `JSON.stringify`가 `React.memo` 없이 매 렌더마다 실행되어 대용량 노드 데이터 시 체감 지연을 유발한다. 페이지네이션 버튼의 상한 없는 DOM 생성은 서버 응답 조작 시 브라우저 크래시로 이어질 수 있는 보안·성능 복합 이슈다. 전반적으로 기본적인 React 렌더링 최적화(`memo`, `useMemo`)와 서버 사이드 집계 개선이 우선 적용되어야 한다.

### 위험도

**MEDIUM**