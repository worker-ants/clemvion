## 발견사항

### 1. **[WARNING]** `saveWorkflow` 중복 실행 방지 로직의 TOCTOU 경쟁 조건
- **위치**: `frontend/src/lib/stores/editor-store.ts` — `saveWorkflow()`
- **상세**: `isSaving` 플래그를 읽은 후 `set({ isSaving: true })`까지 사이에 간격이 존재. Zustand는 단일 스레드(JS 이벤트 루프) 기반이라 실제 동시 접근은 없지만, `handleRun`에서 `isDirty`이면 `saveWorkflow()`를 호출하고, 동시에 Ctrl+S로도 호출될 경우 두 번째 호출이 `isSaving` 체크를 통과할 수 있음.
- **제안**: Zustand의 `set`은 동기적이므로 guard를 `set` 내부에서 처리하거나, 단일 Promise를 캐싱하여 중복 호출 시 동일 Promise를 반환하도록 구현.

```ts
// 현재
const { isSaving } = get();
if (!workflowId || isSaving) return;
set({ isSaving: true });

// 개선: 저장 Promise 캐싱
let savingPromise: Promise<void> | null = null;
saveWorkflow: async () => {
  if (savingPromise) return savingPromise;
  savingPromise = (async () => { /* ... */ })().finally(() => { savingPromise = null; });
  return savingPromise;
}
```

---

### 2. **[WARNING]** `handleRun`의 save → execute 순서 보장 미흡
- **위치**: `frontend/src/components/editor/toolbar/editor-toolbar.tsx` — `handleRun()`
- **상세**: `saveWorkflow()`가 실패해도 `catch` 없이 `await`만 하고 `workflowsApi.execute()`를 계속 호출함. 저장 실패 후 실행 시 구버전 워크플로우가 실행될 수 있음.
- **제안**: 저장 실패 시 실행 중단 처리 추가.

```ts
if (isDirty) {
  await saveWorkflow();
  // saveWorkflow silently catches errors — check isDirty again
  if (useEditorStore.getState().isDirty) return; // save failed
}
```

---

### 3. **[WARNING]** `saveCanvas` 트랜잭션 내 노드 순차 저장으로 인한 성능/데드락 위험
- **위치**: `backend/src/modules/workflows/workflows.service.ts` — `saveCanvas()` 내 node upsert 루프
- **상세**: 트랜잭션 내에서 노드를 `for...of` 루프로 순차적으로 `manager.save()`를 호출. 대규모 워크플로우에서 트랜잭션 홀드 시간이 길어져 다른 요청과의 DB 락 경합이 발생할 수 있음. 특히 동일 워크플로우에 대한 동시 `saveCanvas` 요청 시 두 트랜잭션이 서로의 행 락을 기다릴 수 있음(데드락 위험).
- **제안**: `Promise.all()`로 병렬 저장하거나, 애플리케이션 레벨에서 워크플로우별 저장 요청을 직렬화(debounce/mutex).

```ts
// 개선: 병렬 upsert
const savedNodes = await Promise.all(
  dto.nodes.map((nodeDto) => {
    const existing = existingNodeMap.get(nodeDto.id);
    return existing
      ? manager.save(Node, Object.assign(existing, { ...nodeDto }))
      : manager.save(Node, manager.create(Node, { workflowId: id, ...nodeDto }));
  })
);
```

---

### 4. **[WARNING]** WebSocket 이벤트 전송과 DB 상태 갱신의 순서 불일치
- **위치**: `backend/src/modules/execution-engine/execution-engine.service.ts` — 실행 완료/실패 처리
- **상세**: `EXECUTION_COMPLETED` 이벤트는 `updateExecutionStatus()` 직후 emit되지만, 이후 `outputData` 설정 및 `executionRepository.save()`가 완료되기 전에 클라이언트가 결과를 조회하면 불완전한 데이터를 볼 수 있음. 이벤트 emit이 DB write commit보다 앞서는 구조.
- **제안**: 모든 DB 저장이 완료된 후 이벤트를 emit하도록 순서 조정.

---

### 5. **[INFO]** `execution-engine.service.ts`의 `execute()` 비동기 실행 — await 없는 호출 시 에러 손실
- **위치**: `backend/src/modules/workflows/workflows.controller.ts` — `execute()` 핸들러
- **상세**: 컨트롤러에서 `executionEngineService.execute()`를 `await`하므로 현재는 안전. 그러나 향후 백그라운드 실행으로 전환 시 `void` 처리하면 WebSocket emit 에러가 전파되지 않음.
- **제안**: 현재 구현은 문제 없으나, 비동기 백그라운드 실행으로 변경 시 에러 핸들링 전략 명시 필요.

---

### 6. **[INFO]** `lastError ?? new Error('All retry attempts exhausted')` — 기존 `throw lastError` 수정
- **위치**: `execution-engine.service.ts` — retry exhausted 처리
- **상세**: `lastError`가 `undefined`일 수 없는 경로이지만, null 안전성 개선으로 긍정적 변경. 동시성 이슈 없음.

---

## 요약

전체적으로 동시성 구조는 Node.js 단일 스레드 이벤트 루프를 올바르게 활용하고 있으며 심각한 결함은 없다. 주요 위험은 DB 트랜잭션 레벨에 있다: `saveCanvas`의 순차적 노드 저장은 동일 워크플로우에 대한 동시 저장 요청이 들어올 경우 행 락 경합 및 데드락 가능성을 내포한다. 프론트엔드에서는 `saveWorkflow`의 중복 호출 방지 로직이 JS의 마이크로태스크 큐 특성상 이론적으로 통과될 수 있으며, save 실패 시에도 execute가 진행되는 로직 결함이 있다. WebSocket 이벤트와 DB 커밋 순서 불일치는 클라이언트에 일시적으로 stale 상태를 노출할 수 있다.

## 위험도

**MEDIUM**