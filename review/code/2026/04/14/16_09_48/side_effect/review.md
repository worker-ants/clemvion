## 리뷰 결과

### 발견사항

---

**[WARNING] `SubWorkflowCard` 헤더 클릭 시 expand/collapse가 동작하지 않음**
- 위치: `result-timeline.tsx` — `TimelineRow` `onClick` 핸들러
- 상세: `renderAsCardHeader = true`인 경우 chevron 아이콘을 렌더링하여 사용자에게 클릭 가능함을 암시하지만, 실제 onClick 핸들러는 `isMultiTurn || isLiveNode`일 때만 `ctx.toggleExpand`를 호출합니다. 워크플로우(`workflow`) 노드는 둘 다 false이므로, 카드 헤더 행 클릭 시 `handleNodeClick`만 실행되고 expand 상태가 전혀 변경되지 않습니다.
  ```tsx
  // TimelineRow onClick
  onClick={() => {
    if (isMultiTurn || isLiveNode) {  // workflow 노드는 여기 진입 불가
      ctx.toggleExpand(rowId);
    }
    ctx.handleNodeClick(rowId);  // 이것만 실행됨
  }}
  ```
  `isCardHeader`일 때 항상 `ctx.toggleExpand(rowId)`를 호출하는 분기가 누락되어 있습니다.
- 제안:
  ```tsx
  onClick={() => {
    if (isCardHeader || isMultiTurn || isLiveNode) {
      ctx.toggleExpand(rowId);
    }
    ctx.handleNodeClick(rowId);
  }}
  ```

---

**[WARNING] 기존 저장된 패널 높이 설정이 묵시적으로 초기화됨**
- 위치: `run-results-drawer.tsx` — `getStoredHeight()`, 상수 변경
- 상세: `MIN_HEIGHT`가 150 → 240으로 변경되었습니다. 150~239 사이의 값을 `localStorage`에 보관 중인 기존 사용자는 유효성 검사(`parsed >= MIN_HEIGHT`)에 실패하여 `DEFAULT_HEIGHT(420)`으로 조용히 리셋됩니다. 사용자 입장에서는 설정이 사라진 것처럼 보입니다.
- 제안: 경계값 변경 시 저장된 값도 새 범위에 맞게 clamp하거나, 마이그레이션 로직을 추가하세요.
  ```ts
  return Math.max(MIN_HEIGHT, Math.min(maxHeight, parsed));
  ```

---

**[WARNING] `context.parentNodeExecutionId` 뮤테이션이 async 실행에서 잠재적 위험**
- 위치: `execution-engine.service.ts` — `executeInline` 메서드
- 상세: `context` 객체를 직접 뮤테이션(`context.parentNodeExecutionId = ...`)한 후 `finally`에서 복원하는 패턴입니다. 현재는 순차 실행이므로 안전하지만, 향후 동일 `context`를 공유하는 병렬 노드 실행이 도입될 경우(이미 `recursionDepth`도 같은 패턴 사용) 레이스 컨디션이 발생합니다. `context`가 실행 중 뮤테이션되는 공유 상태임을 주석으로 명확히 해두어야 합니다.
- 제안: 단기적으로는 현 패턴 유지가 가능하나, 장기적으로는 불변 컨텍스트 파생(`{ ...context, parentNodeExecutionId }`)을 고려하세요.

---

**[INFO] WebSocket 이벤트 순서에 따른 실시간 트리 구조 불안정**
- 위치: `timeline-tree.ts` — `buildTimelineTree`, `use-execution-events.ts`
- 상세: `buildTimelineTree`는 `parentNodeExecutionId`가 `byKey`에 없으면 해당 노드를 root로 처리합니다. 실시간 실행 중 자식 노드 이벤트(NODE_RUNNING)가 부모 `workflow` 노드 이벤트보다 먼저 도착하면, 자식이 일시적으로 root로 렌더링된 후 결과 조회(polling reconciliation)로 재정렬됩니다. 이는 UI 깜빡임을 유발할 수 있습니다.
- 제안: 실제로 이 순서가 발생 가능한지 확인하고, 발생 가능하다면 보류(pending children) 처리 로직을 추가하세요.

---

**[INFO] `createNodeExecution` 시그니처 변경 — 하위 호환성 확인 필요**
- 위치: `execution-engine.service.ts` — `createNodeExecution` 메서드
- 상세: 4번째 매개변수 `parentNodeExecutionId?: string | null`이 추가되었습니다. optional이므로 기존 호출자에는 영향 없습니다. 다만 서비스 외부에서 이 메서드를 직접 호출하는 코드가 없는지 확인이 필요합니다(private 메서드로 보이나 명시적 접근제어자가 없음).
- 제안: `private`으로 명시하거나 현행 유지(인터페이스에 노출되지 않음).

---

**[INFO] `NodeResult.parentNodeExecutionId` 보존 로직이 비대칭**
- 위치: `use-execution-events.ts` — NODE_COMPLETED, NODE_FAILED 핸들러
- 상세: NODE_RUNNING, NODE_SKIPPED는 항상 `payload.parentNodeExecutionId`를 사용하는 반면, NODE_COMPLETED/NODE_FAILED는 `payload.parentNodeExecutionId ?? existing?.parentNodeExecutionId`로 폴백합니다. 이 비대칭은 `execution-store.ts`의 병합 로직(`result.parentNodeExecutionId ?? r.parentNodeExecutionId`)과 중복되어 혼란을 줄 수 있습니다.
- 제안: store 병합 로직에 일관되게 위임하고, 이벤트 핸들러는 `payload.parentNodeExecutionId`만 전달하도록 단순화하는 방향을 고려하세요.

---

### 요약

이번 변경의 핵심 부작용 위험은 **`SubWorkflowCard` 헤더 클릭 시 expand/collapse가 동작하지 않는 UI 버그**입니다. chevron 아이콘이 표시되어 사용자에게 클릭 가능성을 암시하지만 실제 토글은 발생하지 않습니다. 두 번째로 `MIN_HEIGHT` 값 변경으로 인해 기존 사용자의 패널 크기 설정이 묵시적으로 초기화되는 UX 부작용이 있습니다. `context.parentNodeExecutionId` 뮤테이션 패턴은 현재 순차 실행 구조에서는 안전하지만 미래 확장에 잠재적 위험을 내포합니다. 나머지 변경사항(API 타입 추가, WebSocket 페이로드 확장, DB 마이그레이션)은 하위 호환성을 유지하며 의도된 동작 범위 내에 있습니다.

### 위험도

**LOW** (단, `SubWorkflowCard` expand/collapse 버그는 기능적 결함으로 즉시 수정 권장)