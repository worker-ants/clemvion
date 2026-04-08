## 성능 코드 리뷰 결과

---

### 발견사항

**[WARNING] adjacentQuery: 인접 실행 탐색을 위해 최대 100건 전체 로드**
- 위치: `page.tsx` (ExecutionDetailPage) — `adjacentQuery` queryFn
- 상세: prev/next ID만 필요한데 `limit: 100`으로 전체 목록을 로드 후 클라이언트에서 `findIndex` 탐색. 실행 이력이 많아질수록 불필요한 페이로드가 커짐. 100건을 초과하는 경우 탐색 자체가 실패함.
- 제안: 백엔드에서 `/executions/:id/adjacent` 엔드포인트를 제공하거나, 현재 실행의 `created_at` 기준으로 `limit:1, before=X` / `limit:1, after=X` 쿼리 두 번으로 대체. 그게 어렵다면 최소한 cursor-based 방식으로 교체.

---

**[WARNING] 행 렌더링 시 nodeExecutions 3중 filter 순회**
- 위치: `page.tsx` (ExecutionListPage) — `executions.map()` 내부
- 상세: 각 `execution` row 렌더링마다 `nodeExecutions`를 `completed` filter, `length`, `failed` filter로 3회 순회. 페이지당 20행 × 노드 수만큼 O(n×m) 연산이 발생.
- 제안: 단일 `reduce`로 한 번에 집계하거나, `ExecutionData` 타입에 집계 필드(`completedCount`, `failedCount`)를 포함해 서버에서 내려받도록 개선.

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

---

**[WARNING] JsonViewer에서 매 렌더마다 JSON.stringify 호출**
- 위치: `[executionId]/page.tsx` — `JsonViewer` 컴포넌트
- 상세: `JsonViewer`는 `memo` 없이 정의되어 있어, 부모(NodeResultsTab)가 리렌더될 때마다 `JSON.stringify(data, null, 2)` 가 재실행됨. 노드 output/input 데이터가 큰 경우 성능 저하.
- 제안: `React.memo`로 감싸거나, `useMemo`로 `formatted` 값을 캐싱.

```ts
const formatted = useMemo(
  () => typeof data === "string" ? data : JSON.stringify(data, null, 2),
  [data]
);
```

---

**[INFO] sortedNodeExecutions의 completedCount/failedCount 재순회**
- 위치: `[executionId]/page.tsx` — 메인 컴포넌트 본문
- 상세: `sortedNodeExecutions` 생성 후 `.filter(...).length`를 두 번 추가 순회. useMemo 내에서 함께 집계하면 순회 횟수를 줄일 수 있음.
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

**[INFO] QueryClient가 테스트마다 새로 생성되지 않음 (일부 테스트)**
- 위치: `execution-detail-page.test.tsx` — `Failed Execution` describe 블록
- 상세: 해당 블록에서 `createWrapper()` 헬퍼를 사용하지 않고 인라인으로 QueryClient를 생성. 구조적 불일치로 인해 캐시 오염 가능성이 있어 테스트 신뢰도에 영향.
- 제안: `createWrapper()` 헬퍼로 통일.

---

**[INFO] 페이지네이션 버튼 Array.from 렌더링**
- 위치: `page.tsx` (ExecutionListPage) — Pagination 섹션
- 상세: `Array.from({ length: totalPages })` 로 전체 페이지 버튼을 렌더링. `totalPages`가 크면 DOM 노드가 많아짐.
- 제안: 실제 서비스 규모에서 totalPages가 수십~수백이 될 수 있다면 sliding window 방식(현재 페이지 ±2)으로 제한.

---

### 요약

전반적으로 React Query를 활용한 데이터 페칭과 `useMemo`로 정렬 캐싱을 적용하는 등 기본적인 성능 고려가 이루어져 있습니다. 가장 주목할 문제는 `adjacentQuery`에서 prev/next 탐색을 위해 최대 100건을 전체 로드하는 방식으로, 데이터 증가 시 불필요한 페이로드와 100건 초과 시 탐색 실패라는 기능적 버그를 동반합니다. 행 렌더링 시 `nodeExecutions`의 3중 filter 순회와 `JsonViewer`의 반복적인 `JSON.stringify` 호출도 데이터 규모에 따라 체감 성능에 영향을 줄 수 있으므로 개선이 권장됩니다.

### 위험도

**MEDIUM**