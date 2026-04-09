## 성능 코드 리뷰 결과

---

### 발견사항

**[WARNING] `adjacentQuery`: prev/next 탐색을 위해 최대 100건 전체 로드**
- 위치: `[executionId]/page.tsx` — `adjacentQuery` queryFn (L115~133)
- 상세: prev/next ID 2개만 필요한데 `limit: 100`으로 전체 목록 페이로드를 받아 클라이언트에서 `findIndex` 탐색. 실행 이력이 100건 초과 시 탐색 자체가 실패(기능 버그 겸 성능 이슈). 또한 이 쿼리는 페이지 진입마다 실행 상세 쿼리와 병렬 실행되어 불필요한 네트워크 대역을 소비함.
- 제안: `GET /api/executions/:id/adjacent` 전용 엔드포인트 추가(백엔드 커서 기반) 또는 `created_at` 기준 `limit:1&before=X`, `limit:1&after=X` 쿼리 두 번으로 대체. 이미 `spec/2-navigation/6-execution-history.md §3.6`에서 인접 탐색 기능이 명시되어 있으므로 API 스펙 추가가 권장됨.

---

**[WARNING] 실행 목록 행 렌더링 시 `nodeExecutions` 3중 순회**
- 위치: `executions/page.tsx` — `executions.map()` 내부
- 상세: 각 행마다 `.filter(completed).length`, `.length`, `.filter(failed).length` 3회 순회. 페이지 20행 × 노드 수 N의 O(20N) 연산이 매 렌더링마다 발생. N=50 노드면 렌더당 3,000회 순회.
- 제안: 단일 `reduce`로 한 번에 집계:
  ```ts
  const { completed, failed, total } = (execution.nodeExecutions ?? []).reduce(
    (acc, ne) => {
      acc.total++;
      if (ne.status === "completed") acc.completed++;
      else if (ne.status === "failed") acc.failed++;
      return acc;
    },
    { completed: 0, failed: 0, total: 0 }
  );
  ```

---

**[WARNING] `JsonViewer` 컴포넌트: `React.memo` 미적용으로 매 렌더마다 `JSON.stringify` 재실행**
- 위치: `[executionId]/page.tsx` — `JsonViewer` 컴포넌트 정의부
- 상세: `JsonViewer`는 `memo` 없이 인라인 함수 컴포넌트로 정의되어 있어 부모(`NodeResultsTab`)가 리렌더될 때마다 `JSON.stringify(data, null, 2)` 가 재실행됨. 노드 output/input 데이터가 수 MB인 경우 체감 성능 저하 발생.
- 제안:
  ```ts
  const JsonViewer = React.memo(({ data }: { data: unknown }) => {
    const formatted = useMemo(
      () => (typeof data === "string" ? data : JSON.stringify(data, null, 2)),
      [data]
    );
    return <pre><code>{formatted}</code></pre>;
  });
  ```

---

**[WARNING] 페이지네이션: `Array.from({ length: totalPages })` 전체 렌더링**
- 위치: `executions/page.tsx` — Pagination 섹션
- 상세: `totalPages`가 서버 응답값이므로 비정상적으로 큰 값(예: 500)이 오면 500개 DOM 노드가 생성됨. 보안 리뷰에서도 지적된 DoS-like 문제이며, 실제 서비스 규모에서도 50~100페이지는 충분히 발생 가능.
- 제안: 슬라이딩 윈도우(현재 ±2) + 상한선 적용:
  ```ts
  const safeTotalPages = Math.min(totalPages, 100);
  const pageNumbers = Array.from({ length: Math.min(5, safeTotalPages) }, (_, i) =>
    Math.max(1, Math.min(currentPage - 2 + i, safeTotalPages))
  );
  ```

---

**[INFO] `sortedNodeExecutions` 생성 후 `completedCount`/`failedCount` 별도 순회**
- 위치: `[executionId]/page.tsx` — 메인 컴포넌트 본문
- 상세: `useMemo`로 정렬된 배열을 만든 뒤 `.filter(completed).length`, `.filter(failed).length`로 2회 추가 순회. 같은 `useMemo` 내에서 정렬과 집계를 함께 처리하면 순회 횟수를 줄일 수 있음.
- 제안:
  ```ts
  const { sorted, completedCount, failedCount } = useMemo(() => {
    if (!nodeExecutions) return { sorted: [], completedCount: 0, failedCount: 0 };
    let completed = 0, failed = 0;
    const sorted = [...nodeExecutions].sort(/* ... */);
    for (const ne of sorted) {
      if (ne.status === "completed") completed++;
      else if (ne.status === "failed") failed++;
    }
    return { sorted, completedCount: completed, failedCount: failed };
  }, [nodeExecutions]);
  ```

---

**[INFO] Carousel `itemButtons` 런타임 ID 생성: 대용량 배열에서 O(N×M) 오버헤드**
- 위치: `spec/4-nodes/6-presentation-nodes.md §1.3` — 실행 로직 3-4단계
- 상세: Dynamic 모드에서 `itemButtons`가 설정되면 모든 아이템에 `{btnId}__item_{index}` 형식의 고유 ID를 생성함. `maxItems=100`, `itemButtons=4`이면 400개 ID 생성. `buttonConfig.buttons` 배열에 글로벌 버튼 + 아이템 버튼 전체를 합산하여 WS 이벤트로 전송하므로 페이로드가 커짐.
- 제안: `buttonItemMap` 인덱스를 활용하여 WS 이벤트에는 `itemButtons` 정의만 전송하고, 클라이언트에서 아이템별 ID를 derive하도록 설계 변경 검토.

---

**[INFO] `detailTabs` 배열이 렌더마다 재생성됨**
- 위치: `[executionId]/page.tsx` — `NodeResultsTab` 컴포넌트 본문 (L307~311)
- 상세: 함수 컴포넌트 본문에 `detailTabs` 배열 리터럴이 선언되어 매 렌더마다 새 배열이 생성됨. `selectedNode?.error` 의존성이 있어 `useMemo` 적용이 적절함.
- 제안: `useMemo(() => [...tabs], [selectedNode?.error])`로 감싸기.

---

**[INFO] 테스트: `vi.clearAllMocks()` 후 QueryClient 캐시 오염 가능성**
- 위치: `execution-detail-page.test.tsx` — `Failed Execution` describe 블록 (L118~)
- 상세: `createWrapper()`를 사용하지 않고 인라인으로 `QueryClient`를 생성하여 캐시가 테스트 간 공유될 가능성이 있음. 캐시 히트로 인해 mock 응답과 다른 결과를 반환할 수 있어 테스트 신뢰도에 영향.
- 제안: `createWrapper()` 헬퍼로 통일하여 테스트마다 새 QueryClient 보장.

---

### 요약

전반적으로 React Query를 통한 데이터 페칭 캐싱과 `useMemo` 기반 정렬 최적화 등 기본적인 성능 고려가 적용되어 있다. 가장 심각한 이슈는 `adjacentQuery`에서 prev/next 탐색을 위해 최대 100건을 전체 로드하는 구조로, 이는 데이터 증가 시 페이로드 낭비와 함께 100건 초과 시 탐색 실패라는 기능적 버그를 동반한다. 실행 목록 행 렌더링 시 `nodeExecutions` 3중 filter 순회와 `JsonViewer`의 `React.memo` 미적용으로 인한 반복적 `JSON.stringify` 호출도 데이터 규모에 따라 체감 성능에 영향을 줄 수 있으며, 페이지네이션의 전체 버튼 렌더링은 보안 및 성능 양면에서 상한선 처리가 필요하다. Spec 변경사항 중 Carousel `itemButtons`의 대량 ID 생성 및 WS 페이로드 팽창은 향후 운영 단계에서 모니터링이 필요한 잠재 이슈이다.

### 위험도

**MEDIUM**