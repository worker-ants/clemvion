### 발견사항

- **[INFO]** `execution-engine.service.ts`에서 `parentNodeExecutionId` 전달이 산재
  - 위치: `execution-engine.service.ts` — SKIPPED/RUNNING/COMPLETED/FAILED 이벤트 발행부 (6개 이상의 분산된 위치)
  - 상세: `context.parentNodeExecutionId`를 websocket 이벤트 payload에 삽입하는 패턴이 파일 전체에 걸쳐 반복됨. 이벤트 빌더 헬퍼 함수가 없어 누락 시 탐지 어려움
  - 제안: `buildNodeEventPayload(nodeExec, context, extra?)` 같은 헬퍼로 공통 필드 조립을 중앙화하면 향후 필드 추가·제거 시 한 곳만 수정하면 됨

- **[WARNING]** `parentNodeExecutionId` context 복원 로직이 두 곳에 분리
  - 위치: `execution-engine.service.ts` — `executeInline` 내 `prevParentNodeExecutionId` 저장/복원 패턴 (~line 363–579)
  - 상세: `recursionDepth`와 `parentNodeExecutionId` 둘 다 "저장 → 변경 → finally에서 복원" 패턴을 따르지만, 각각 별도 변수(`prevDepth`, `prevParentNodeExecutionId`)로 수동 관리됨. 이 패턴이 추후 세 번째 context 속성에도 필요해지면 finally 블록이 계속 늘어남
  - 제안: `withContext(context, patch, fn)` 유틸리티로 추출하면 패턴을 단일화할 수 있음:
    ```ts
    await withContext(context, { recursionDepth, parentNodeExecutionId }, () => executeNodes(...));
    ```

- **[INFO]** `TimelineRow` 컴포넌트의 leading indicator 분기가 복잡
  - 위치: `result-timeline.tsx` — `TimelineRow` 내 leading indicator 렌더링 (약 15줄의 중첩 삼항 연산자)
  - 상세: `isCardHeader` / `isMultiTurn || isLiveNode` / `isSubWorkflowNode` / 기본값으로 이어지는 4단계 삼항 연산자 체인은 한 눈에 파악하기 어려움
  - 제안: `getLeadingIndicator()` 서브 함수로 추출하거나 early-return 구조로 전환

- **[INFO]** `toggleExpand`와 `toggleCardExpand`의 분리는 의도가 불명확
  - 위치: `result-timeline.tsx` — `toggleExpand` vs `toggleCardExpand`
  - 상세: 두 함수의 차이(기본값 `false` vs `true`)는 주석으로 설명되어 있지만, `ctx` 객체 생성 시 어느 시점에 어느 함수를 쓰는지 파악하려면 `SubWorkflowCard` 호출부까지 추적해야 함. 미래에 세 번째 카드 타입이 생기면 혼란 가중
  - 제안: `toggleExpand(id, defaultExpanded = false)`로 파라미터화하여 두 함수를 통합

- **[INFO]** `RowCtx` 인터페이스와 `ctx` prop drilling
  - 위치: `result-timeline.tsx` — `RowCtx` 인터페이스 및 `TimelineRow`, `SubWorkflowCard`에 전달
  - 상세: 현재 구조는 명확하나, `expanded`, `toggleExpand`, `handleNodeClick` 등 7개 필드를 가진 컨텍스트 객체를 수동으로 스프레드(`{ ...ctx, toggleExpand: toggleCardExpand }`)하는 패턴은 실수로 필드를 오버라이드하기 쉬움
  - 제안: 현재 규모에서는 허용 가능하나, 컴포넌트가 더 깊어지면 React Context로 전환 고려

- **[INFO]** `buildTimelineTree`의 iteration 카운팅이 전체 results 기준
  - 위치: `timeline-tree.ts` — `iterTotal` 계산 (~line 30–32)
  - 상세: `iterTotal`이 전체 flat list 기준으로 계산되므로, Sub-Workflow 내부의 반복 노드도 루트 레벨 노드와 같은 카운터를 공유함. 예: 루트에서 `body` 노드가 1회, Sub-Workflow 안에서 `body` 노드가 2회 실행되면 둘 다 `totalIterations=3`으로 표시됨
  - 제안: iteration 카운팅을 같은 부모(parent scope) 내에서만 수행하도록 개선하거나, 현재 동작을 명확히 주석으로 명시

- **[INFO]** `run-results-drawer.tsx`의 드래그 상태 refs 증가
  - 위치: `run-results-drawer.tsx` — `isDraggingWidth`, `startX`, `startWidth`, `currentWidthRef` 추가
  - 상세: 수직 드래그(`isDragging`, `startY`, `startHeight`, `currentHeightRef`)와 수평 드래그(`isDraggingWidth`, `startX`, `startWidth`, `currentWidthRef`)가 동일한 패턴으로 구현되어 있으나 코드가 중복됨. `handleMouseMove`/`handleMouseUp` 내부도 두 블록으로 분리되어 있어 한 쌍씩 늘어나는 구조
  - 제안: `usePanelDrag({ direction, minSize, maxSize, storageKey })` 커스텀 훅으로 추출하면 두 드래그 로직을 단일 추상화로 처리 가능

- **[INFO]** 마이그레이션 파일의 `ON DELETE SET NULL` 선택 근거 주석 부재
  - 위치: `V012__add_parent_node_execution_id.sql` — FK 정의 라인
  - 상세: 이전 리뷰(`SUMMARY.md`)에서도 지적되었으나 미조치. `CASCADE`를 선택하지 않은 이유(자식 실행 이력 보존 목적)가 주석으로 없으면 다음 개발자가 `CASCADE`로 변경할 유인이 생김
  - 제안:
    ```sql
    -- ON DELETE SET NULL: preserve child execution records even when parent is
    -- deleted, so partial run history is retained for debugging.
    ```

---

### 요약

전반적으로 변경 의도가 명확하고 인터페이스/타입 정의, 주석 품질이 양호하다. 핵심 유지보수성 리스크는 `execution-engine.service.ts`에서 `parentNodeExecutionId`를 이벤트 payload에 삽입하는 코드가 파일 전체에 흩어져 있어 향후 필드 추가·제거 시 누락 가능성이 높다는 점과, "저장–변경–복원" context 패턴이 두 속성(`recursionDepth`, `parentNodeExecutionId`)에 걸쳐 수동으로 반복되어 세 번째 속성이 추가될 경우 복잡도가 선형으로 증가한다는 점이다. 프론트엔드의 드래그 로직 중복과 `TimelineRow` leading indicator 분기 복잡도도 개선 여지가 있지만 당장 기능 결함을 유발하지는 않는다.

### 위험도

**LOW**