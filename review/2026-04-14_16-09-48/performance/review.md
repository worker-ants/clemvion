### 발견사항

- **[WARNING]** 드래그 중 `setState` 고빈도 호출로 인한 리렌더링 폭발
  - 위치: `run-results-drawer.tsx` — `handleMouseMove` 핸들러
  - 상세: `mousemove` 이벤트에서 `setTimelineWidth(newWidth)` / `setPanelHeight(newHeight)`를 매 이벤트마다 직접 호출합니다. 60fps 디스플레이 기준 드래그 1초당 최대 60회 `setState` → 60회 React 리렌더링이 발생합니다. 이미 height 리사이즈에서도 동일한 패턴이 있으나, 이번 변경에서 width 리사이즈가 추가되면서 동일한 문제가 복제되었습니다.
  - 제안: `requestAnimationFrame`으로 상태 업데이트를 throttle하거나, 드래그 중에는 `ref`만 업데이트하고 `mouseup` 시점에 한 번만 `setState`를 호출하는 방식으로 변경하세요.
    ```ts
    const rafId = useRef<number>(0);
    // mousemove 핸들러 내부:
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => setTimelineWidth(newWidth));
    ```

- **[INFO]** `countDescendants` / `sumDescendantDurations` 매 렌더마다 재계산
  - 위치: `result-timeline.tsx` — `SubWorkflowCard` 컴포넌트, `renderTreeNode` 클로저
  - 상세: `SubWorkflowCard`가 렌더될 때마다 `countDescendants(tnode)`, `sumDescendantDurations(tnode)`를 호출합니다. `renderTreeNode`는 `useCallback` 없이 컴포넌트 함수 본문에 인라인 선언되어 있어 매 렌더마다 재생성됩니다. 재귀 깊이가 최대 10으로 제한되어 있어 현실적인 입력 크기에서는 문제가 작지만, 타임라인이 수십 개의 Sub-Workflow를 포함할 경우 불필요한 연산이 반복됩니다.
  - 제안: `SubWorkflowCard`에 `React.memo`를 적용하거나, `TimelineTreeNode`에 `childCount`, `childDurationSum`을 `buildTimelineTree` 시점에 미리 계산해 저장하는 방식이 더 효율적입니다.

- **[INFO]** `buildTimelineTree` 결과물에 파생 값을 사전 계산하지 않음
  - 위치: `timeline-tree.ts` — `buildTimelineTree`
  - 상세: `countDescendants`와 `sumDescendantDurations`는 `buildTimelineTree` 이후 트리 순회를 다시 수행합니다. `buildTimelineTree`가 트리를 구성하는 단계에서 bottom-up으로 한 번에 계산해 `TimelineTreeNode`에 포함시키면 렌더 시점의 반복 순회를 제거할 수 있습니다.
  - 제안:
    ```ts
    interface TimelineTreeNode {
      // ...기존 필드
      cachedDescendantCount: number;
      cachedDescendantDurationSum: number;
    }
    ```
    트리 구성 후 루트에서 자식 순서로 한 번만 집계합니다.

- **[INFO]** `iterTotal` 계산 첫 번째 패스가 트리 구조를 고려하지 않음
  - 위치: `timeline-tree.ts` — `buildTimelineTree` 첫 번째 `for` 루프
  - 상세: `iterTotal`은 전체 `results` 배열에서 `nodeId` 기준으로 카운트합니다. 서로 다른 Sub-Workflow 카드 안에 있는 동일한 `nodeId`도 합산됩니다. 현재 동작은 의도적(글로벌 iteration 카운트)으로 보이나, 중첩 깊이가 깊어지면 "(iter N)" 레이블이 사용자를 혼동시킬 수 있습니다. 성능보다 정확성 이슈에 가깝지만, 분리된 Map 자료구조 2개를 단일 패스로 합칠 수 있습니다.
  - 제안: 두 번의 `for` 루프를 단일 패스로 병합하면 상수 수준의 개선이 가능합니다(코드 가독성 우선 판단).

- **[INFO]** DB 마이그레이션 — 전체 인덱스 대신 부분 인덱스 미사용
  - 위치: `V012__add_parent_node_execution_id.sql` — `CREATE INDEX idx_node_execution_parent`
  - 상세: `parent_node_execution_id`는 루트 워크플로우 노드에서는 항상 NULL입니다. 전체 인덱스는 NULL 값을 대량 포함하게 되어 인덱스 크기와 쓰기 오버헤드가 불필요하게 증가합니다.
  - 제안:
    ```sql
    CREATE INDEX idx_node_execution_parent
      ON node_execution(parent_node_execution_id)
      WHERE parent_node_execution_id IS NOT NULL;
    ```

- **[INFO]** DB 마이그레이션 — `CREATE INDEX CONCURRENTLY` 미사용
  - 위치: `V012__add_parent_node_execution_id.sql` — `CREATE INDEX` 라인
  - 상세: 일반 `CREATE INDEX`는 `SHARE LOCK`을 보유하며 인덱스 빌드 완료 시까지 테이블 쓰기를 블로킹합니다. 기존 `node_execution` 데이터가 많은 운영 환경에서는 서비스 중단에 준하는 영향이 발생할 수 있습니다.
  - 제안: Flyway `mixed=true` 설정 후 `CREATE INDEX CONCURRENTLY` 사용. 트랜잭션 블록 밖에서 실행해야 하므로 마이그레이션 파일 상단에 `-- flyway:executeInTransaction=false` 주석 확인이 필요합니다.

- **[INFO]** `@ManyToOne parentNodeExecution` 관계 로드 시 N+1 잠재 위험
  - 위치: `node-execution.entity.ts` — `@ManyToOne(() => NodeExecution, ...)`
  - 상세: `parentNodeExecution` 관계가 선언되었으나 현재 코드에서는 명시적으로 JOIN/eager 로드하는 위치가 보이지 않습니다. 만약 향후 `nodeExecution.parentNodeExecution`에 접근하는 코드가 루프 내에서 추가된다면 LazyLoading으로 인한 N+1 쿼리가 발생합니다.
  - 제안: 이 관계는 타임라인 UI를 위한 `parentNodeExecutionId` (문자열)만 필요하므로, `@ManyToOne` 관계 선언 자체를 제거하고 컬럼만 유지하는 것이 더 안전합니다. 필요 시에만 명시적 JOIN을 사용하세요.

---

### 요약

이번 변경의 성능 리스크는 전반적으로 낮습니다. 핵심 이슈는 **드래그 중 고빈도 `setState` 호출**로, 새로 추가된 width 리사이즈가 기존 height 리사이즈와 동일한 패턴으로 구현되어 60fps 기준 초당 60회 리렌더링이 발생할 수 있습니다. `buildTimelineTree`는 O(n) 알고리즘으로 효율적이며 `useMemo`로 감싸져 있고, 트리 렌더링도 DOM 노드 수가 재귀 깊이(최대 10)로 제한되어 현실적인 입력 크기에서는 문제가 없습니다. DB 마이그레이션의 전체 인덱스(partial index 미사용)와 `CREATE INDEX CONCURRENTLY` 미적용은 운영 환경 배포 시 고려해야 할 사항입니다.

### 위험도

**LOW**