## 발견사항

### **[WARNING]** 비활성화 노드에 대한 WebSocket SKIPPED 이벤트 제거

- **위치**: `execution-engine.service.ts` — `runExecution` 및 `executeInline` 내 포트 라우팅 skip 블록 (~45줄 삭제)
- **상세**: 기존 코드는 포트 라우팅으로 건너뛰어진 노드에 대해 `NODE_SKIPPED` WebSocket 이벤트와 `NodeExecution` DB 레코드(status=SKIPPED)를 생성했습니다. 새 구현에서 `reachable`에 포함되지 않은 노드는 `pointer++` 후 조용히 넘어가며 어떤 이벤트도 발생시키지 않습니다. 프론트엔드의 실행 시각화에서 해당 노드들의 상태가 업데이트되지 않아 UI가 "pending" 상태로 남을 수 있습니다.
- **제안**: 비활성화 노드(`node.isDisabled`)와 동일하게 unreachable 노드에도 `createNodeExecution(..., SKIPPED)` 및 `emitNodeEvent(..., NODE_SKIPPED)` 호출을 추가하거나, 프론트엔드가 미실행 노드를 정상적으로 처리하는지 확인 필요

---

### **[WARNING]** `memory/execution-engine-analysis.md` 파일 내용 미갱신

- **위치**: `memory/execution-engine-analysis.md` 전체
- **상세**: 이 문서는 기존의 `portRoutingSkipped` 방식의 문제점을 분석한 내용을 담고 있으며, 이번 변경으로 해당 문제가 해결되었음에도 문서가 구현 현황과 달라졌습니다. 향후 이 파일을 참고하면 이미 해결된 문제를 다시 접근할 수 있습니다.
- **제안**: `reachable` 기반 방식으로 내용 갱신 또는 해결됨 표시

---

### **[INFO]** 백-엣지 점프 시 `reachable` 범위 초기화 후 단일 노드만 재추가

- **위치**: `execution-engine.service.ts` — 백-엣지 처리 블록
  ```typescript
  for (let i = activated.targetIndex; i <= pointer; i++) {
    reachable.delete(sortedNodeIds[i]);
  }
  reachable.add(sortedNodeIds[activated.targetIndex]);
  ```
- **상세**: 재실행 범위 전체를 `reachable`에서 제거 후 진입 노드만 재추가합니다. 범위 내 중간 노드들은 실행 진행에 따른 `propagateReachability` 호출을 통해 재획득됩니다. 논리는 정확하지만, 범위 내 노드가 이미 범위 밖 노드에 reachability를 전파한 경우 (pointer 이후의 노드) 해당 노드들이 이전 패스의 상태를 유지합니다. 사이클 재실행 중 분기 조건이 바뀌면 이미 reachable로 표시된 후속 노드가 의도치 않게 실행될 수 있습니다.
- **제안**: 현재 테스트 케이스는 통과하지만 복잡한 사이클+분기 조합 시나리오에 대한 추가 테스트 고려

---

### **[INFO]** `reachable` 초기화 로직 중복

- **위치**: `runExecution` (라인 ~726) 및 `executeInline` (라인 ~334)
- **상세**: 두 실행 경로 모두 동일한 패턴으로 `reachable` 초기화:
  ```typescript
  for (const id of sortedNodeIds) {
    const hasIncoming = forwardEdges.some((e) => e.targetNodeId === id);
    if (!hasIncoming) reachable.add(id);
  }
  ```
  중복 자체가 버그는 아니지만, 초기화 로직 변경 시 두 곳 모두 수정해야 합니다.
- **제안**: 헬퍼 함수 `initReachable(sortedNodeIds, forwardEdges)` 추출 고려

---

### **[INFO]** `text-classifier.handler.spec.ts` — 불필요한 non-null assertion 제거

- **위치**: 라인 65: `result.errors!.length` → `result.errors.length`
- **상세**: `validate()` 메서드는 항상 `errors: string[]`를 반환하므로 `!` 제거가 타입 정확성 향상에 기여합니다. 동작 변경 없음.

---

## 요약

이번 변경의 핵심은 `portRoutingSkipped` 세트 기반의 사후적(reactive) skip 방식을 `reachable` 세트 기반의 사전적(proactive) 도달 가능성 추적으로 교체한 것입니다. 실행 로직 자체는 더 결정론적이고 올바르게 개선되었으나, 기존에 존재하던 `NODE_SKIPPED` WebSocket 이벤트와 DB 레코드 생성이 unreachable 노드에 대해 사라진 것이 가장 주의가 필요한 부작용입니다. 프론트엔드가 실행 완료 후 미실행 노드의 상태 표시에 의존한다면 UI 상의 회귀가 발생할 수 있습니다. 나머지 변경사항(text-classifier 포맷 정리, 테스트 추가)은 부작용이 없습니다.

## 위험도

**MEDIUM**