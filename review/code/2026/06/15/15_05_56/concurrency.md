# 동시성(Concurrency) 리뷰 — execution §1.3 single-node execution

## 발견사항

### **[WARNING]** `handleRunThisNode` 에서 `useExecutionStore.getState()` 를 사용한 실행 상태 스냅샷 읽기 후 API 호출 사이의 TOCTOU

- 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` — `handleRunThisNode` 콜백 (~line 193~215)
- 상세: `execState.status === "running"` 가드를 체크한 직후 `if (isDirty) { await saveWorkflow(); }` 가 실행된다. `saveWorkflow()` 는 비동기이며, await 동안 다른 이벤트(예: 다른 탭의 실행 시작, WS 이벤트)로 실행 상태가 변경될 수 있다. 또한 `execState.executionId` 는 스냅샷 시점에 읽힌 값이며, `saveWorkflow()` 완료 후 `startExecution` 호출 전 사이에 새 실행이 시작되어 `executionId` 가 바뀌는 경우 stale 한 `previousExecutionId` 가 전달된다. 그러나 이 값은 seed 출처 참조(입력 주입)일 뿐이며 체인 관계가 아니므로 실제 데이터 손상 위험은 낮다. 단, `status === "running"` 가드 자체가 경쟁 조건에 노출된다는 점에서 중복 실행 요청 방지가 완벽하지 않다. `saveWorkflow()` await 이후에도 동일 가드를 재확인(re-check)하지 않으므로, 두 번의 연속 클릭이 빠르게 발생하면 두 번 모두 가드를 통과할 수 있다.
- 제안: `useCallback` 내에 `isSubmitting` ref 또는 Zustand 내 로컬 플래그를 두어 첫 await 시작 시 설정하고 완료/실패 시 해제하는 낙관적 락(optimistic lock) 패턴을 적용한다. 혹은 `saveWorkflow()` await 후 `useExecutionStore.getState().status` 를 재조회해 여전히 "running" 이 아닌지 확인한다. 참고로 이 문제는 단일 스레드 JS 이벤트 루프에서 발생하는 논리적 경쟁이므로 실제 메모리 손상은 없으나, UX 관점에서 중복 실행이 트리거될 수 있다.

---

### **[INFO]** `seedSingleNodePredecessorOutputs` 내 두 캐시(nodeOutputCache / structuredOutputCache) 동시 업데이트는 원자적이지 않음

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `seedSingleNodePredecessorOutputs` 메서드 (~line 410~417)
- 상세: `setStructuredOutput` 과 `setNodeOutput` 은 순차적으로 호출되며, JS 단일 스레드 특성상 두 호출 사이에 다른 코드가 끼어들 수 없다(비동기 갭이 없음). 따라서 실질적인 원자성 위반은 없다. 그러나 `contextService` 의 두 메서드가 내부적으로 어떤 비동기 I/O 를 수행한다면 (코드 diff 에서 확인할 수 없는 구현 세부사항) 정합성이 깨질 수 있다. 동 메서드 내 `for` 루프의 각 predecessor 처리 역시 순차적이며 중간 비동기 await 이 없어 루프 레벨에서도 안전하다.
- 제안: `contextService.setStructuredOutput` / `setNodeOutput` 이 동기 메서드임을 명시하는 주석을 추가하거나, 두 호출을 헬퍼로 묶어 단일 "set both caches" 경계를 명확히 한다. 현재는 INFO 수준.

---

### **[INFO]** `getLatestPredecessorOutputs` 의 DB 조회 후 결과 처리: 시간적 선후 보장 없음

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `getLatestPredecessorOutputs` (~line 433~446)
- 상세: `finishedAt DESC` 정렬로 최신 row 를 선택하는 패턴은 올바르다. 단, 한 노드가 동일 `executionId` 내에서 동시에 여러 완료 행을 가질 수 있는 시나리오(컨테이너 반복)에서 `finishedAt` 가 밀리초 단위 동점인 경우 정렬 결정성이 DB 에 위임된다. PostgreSQL 은 `ORDER BY` 에서 동점 행의 순서를 보장하지 않으므로, 이론적으로 원하지 않는 row 가 선택될 수 있다. 그러나 단일 노드 실행 입력 seed 는 디버그 도구 v1 용도이고, 밀리초 충돌은 매우 드문 케이스이므로 실용적 위험은 낮다.
- 제안: 정렬 키를 `{ finishedAt: 'DESC', id: 'DESC' }` 로 확장해 동점 시 row id 로 tie-break 를 보장한다.

---

### **[INFO]** `runExecution` 내 `singleNodeId` 분기의 `break` 이후 outputData 기록: 단일 스레드 안에서 안전

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `runExecution` while 루프 내 break (~line 3748~3755) + resultNodeId 처리 (~line 3912~3920)
- 상세: BullMQ worker 는 단일 큐 Job 을 단일 async 함수 체인으로 처리하며, `runExecution` 자체는 병렬 분기(parallel branch)를 가지는 워크플로우에서는 내부 `Promise.all` 이 있을 수 있다. 그러나 `singleNodeId` 분기는 `break` 로 주 루프를 조기 종료하므로 parallel branch 코드에 진입하지 않는다는 설명이 주석에 명시되어 있다(diff line 3748). 이 의도가 실제로 코드 흐름에 적용되는지는 전체 `while` 루프 문맥에 달려 있으나, diff 에서 확인 가능한 범위 내에서는 `break` 위치가 parallel branch 디스패치(`dispatchKind` 처리) 이전에 있어 올바르다.
- 제안: 해당 없음. 현재 INFO 수준 확인 사항.

---

## 요약

이번 변경은 단일 Node.js 이벤트 루프(BullMQ worker)에서 동기적으로 실행되는 단일 노드 실행 경로를 추가한 것으로, 스레드 간 공유 메모리·뮤텍스·진정한 병렬 실행 문제는 해당 없다. 주요 동시성 관련 위험은 프론트엔드 `handleRunThisNode` 콜백의 TOCTOU 패턴으로, `saveWorkflow()` await 기간 동안 실행 상태 가드가 무효화될 수 있어 중복 실행 요청이 발생할 수 있다(WARNING 1건). 백엔드 경로는 predecessor 출력 pre-seed(`seedSingleNodePredecessorOutputs`)와 캐시 이중 업데이트가 모두 동기 코드 블록 내에서 순차 처리되어 실질적인 경쟁 조건이 없다. `getLatestPredecessorOutputs` 의 `finishedAt` 정렬 동점 케이스는 tie-break 를 추가하면 더 견고해지나 실용적 위험은 낮다(INFO). 전반적으로 동시성 설계는 기존 `dry_run`/`re_run_of` 패턴을 일관되게 따르고 있으며, BullMQ 큐를 통한 단일 실행 직렬화가 백엔드 경쟁 조건을 구조적으로 방지하고 있다.

### 위험도
LOW
