## 성능 코드 리뷰 결과

---

### 발견사항

**[WARNING] saveCanvas - N+1 쿼리 패턴 (노드 upsert)**
- 위치: `workflows.service.ts` - `saveCanvas()` 내 노드 upsert 루프
- 상세: `for (const nodeDto of dto.nodes)` 루프에서 각 노드마다 `manager.save(Node, ...)` 개별 호출. 노드가 N개면 N번의 DB 쿼리 발생.
- 제안: `manager.save(Node, savedNodes)` 배열로 한 번에 저장하거나 `manager.upsert()`를 활용한 단일 쿼리로 처리.

```typescript
// 현재: N번 쿼리
for (const nodeDto of dto.nodes) {
  savedNodes.push(await manager.save(Node, existing));
}

// 개선: 1번 쿼리
const nodesToSave = dto.nodes.map((nodeDto) => { /* 매핑 */ });
const savedNodes = await manager.save(Node, nodesToSave);
```

---

**[WARNING] saveCanvas - Edge 삭제 후 재생성 시 N+1 쿼리**
- 위치: `workflows.service.ts` - `saveCanvas()` 내 edge 저장 루프
- 상세: 엣지도 루프에서 `manager.save(Edge, newEdge)` 개별 호출. 또한 delete-all/recreate 전략은 edge가 많을 때 FK 제약으로 인한 오버헤드 발생 가능.
- 제안: 엣지 생성 배열 구성 후 `manager.save(Edge, newEdges)` 단일 호출.

---

**[WARNING] WebSocket 이벤트 emit - fire-and-forget 방식의 잠재적 백프레셔 없음**
- 위치: `execution-engine.service.ts` - 전반적인 `emitExecutionEvent` / `emitNodeEvent` 호출
- 상세: 노드 실행마다 동기적으로 WebSocket emit을 반복 호출. WebSocket 서버 부하 시 이벤트 큐가 쌓일 수 있으며, emit 에러 시 실행 흐름에 영향 없지만 silent fail.
- 제안: emit은 현재 fire-and-forget으로 적절하나, try-catch 없이 발생하는 에러가 실행 컨텍스트를 오염시키지 않도록 내부에서 에러를 흡수하는지 `WebsocketService` 구현 확인 필요.

---

**[INFO] useExecutionStore 구독 - 노드 렌더링마다 Map lookup**
- 위치: `custom-node.tsx` - `useExecutionStore((s) => s.nodeStatuses.get(id))`
- 상세: ReactFlow 캔버스에 노드가 많을 경우 매 렌더 사이클마다 각 노드가 store를 구독하고 `Map.get()` 호출. 단, `Map.get()`은 O(1)이고 `memo()`로 감싸져 있어 실질적 영향은 낮음.
- 제안: 현재 수준에서는 허용 가능. 노드 수가 수백 개를 초과할 경우 selector 메모이제이션 검토.

---

**[INFO] saveCanvas - 트랜잭션 외부에서 workflow 조회 후 트랜잭션 내부에서 재저장**
- 위치: `workflows.service.ts` - `saveCanvas()` 시작부
- 상세: `findById()`로 트랜잭션 밖에서 workflow를 읽은 후 트랜잭션 내에서 저장. 동시 요청 시 TOCTOU(time-of-check-time-of-use) 경쟁 조건으로 currentVersion 증분이 누락될 수 있음.
- 제안: `manager.findOne(Workflow, ...)` + `pessimistic_write` lock을 트랜잭션 내부에서 사용하거나, `currentVersion`을 DB 수준 atomic increment로 처리.

---

**[INFO] workflow 생성 시 trigger 노드 - 트랜잭션 미적용**
- 위치: `workflows.service.ts` - `create()` 메서드
- 상세: workflow 저장과 trigger 노드 저장이 별도 쿼리로 실행됨. 두 번째 저장 실패 시 workflow만 생성되고 trigger 노드 없는 불완전 상태 발생.
- 제안: `dataSource.transaction()`으로 묶어 원자성 보장.

---

**[INFO] editor-store.ts - saveWorkflow 중복 호출 방지 로직은 충분하나 debounce 없음**
- 위치: `editor-store.ts` - `saveWorkflow()`
- 상세: `isSaving` 플래그로 중복 방지는 되나, 자동저장 트리거(노드 이동 등)에서 rapid-fire 호출 시 이전 저장 완료 직후 즉시 재저장이 반복될 수 있음. 스펙(0-canvas.md)에 2초 debounce 명시되어 있으나 현재 미구현.
- 제안: 호출부에서 `debounce(saveWorkflow, 2000)` 적용 또는 store 내부에 debounce 타이머 내장.

---

### 요약

전반적으로 구조는 적절하나, `saveCanvas`의 노드/엣지 저장 루프에서 N+1 쿼리 패턴이 가장 명확한 성능 병목이다. 노드/엣지 수가 적은 현재는 체감 성능에 큰 영향이 없으나, 수십~수백 개 노드를 가진 워크플로우에서는 저장 지연이 선형적으로 증가한다. 배열 단위 `save()` 혹은 `upsert()` 적용으로 쉽게 해소 가능하다. WebSocket emit과 프론트엔드 구독 로직은 현재 규모에서 무리가 없으며, `memo()`와 Map 기반 상태 접근으로 렌더링 최적화도 적절히 처리되어 있다.

### 위험도

**MEDIUM** — N+1 쿼리가 운영 환경에서 실질적 성능 저하로 이어질 수 있으며, workflow 생성의 비원자성은 데이터 정합성 문제로 이어질 수 있음.