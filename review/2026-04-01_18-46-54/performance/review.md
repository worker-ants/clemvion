## 성능 코드 리뷰

### 발견사항

---

**[WARNING] 폴링 중 `waiting_for_input` 상태에서 무한 폴링 지속**
- 위치: `use-execution-events.ts` — `pollExecutionStatus()` 내 `waiting_for_input` 분기
- 상세: `return false`로 polling을 계속 유지하지만, 해당 상태는 사용자 입력 대기 상태입니다. 사용자가 폼을 제출하기 전까지 매 2초마다 API 호출이 반복되어 불필요한 서버 부하가 발생합니다.
- 제안: `waiting_for_input` 상태 감지 시 폴링 간격을 더 길게 설정하거나(예: 10초), WS 이벤트로 재개 신호를 수신할 때까지 폴링을 일시 중단하세요.

```typescript
} else if (execution.status === "waiting_for_input") {
  // ... pauseForForm 처리
  return false; // ← 폴링 계속 — 불필요한 2초 주기 API 호출
}
```

---

**[WARNING] `pendingContinuations` Map — 서버 재시작 시 메모리 누수 및 고아 Promise**
- 위치: `execution-engine.service.ts` — `pendingContinuations` Map
- 상세: `runExecution`이 `finally` 블록에서 Map에서 항목을 제거하지만, 서버 재시작 없이 장시간 실행 대기 중인 Promise는 타임아웃 없이 영구적으로 메모리에 유지됩니다. 사용자가 탭을 닫거나 연결이 끊기면 해당 Promise는 resolve/reject 될 수 없어 메모리가 누수됩니다.
- 제안: 최대 대기 시간(예: 30분) 타임아웃을 `waitForFormSubmission`에 추가하여 대기 중인 실행을 자동 취소하세요.

```typescript
const formData = await Promise.race([
  new Promise<unknown>((resolve, reject) => { ... }),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new ExecutionCancelledError()), FORM_TIMEOUT_MS)
  ),
]);
```

---

**[WARNING] `executeNode` 내 실행 경로 업데이트 시 불필요한 DB 재조회**
- 위치: `execution-engine.service.ts` — `executeNode()` 내부
- 상세: 이미 메모리에 `savedExecution` 객체가 있음에도, 실행 경로 업데이트를 위해 `this.executionRepository.findOneBy({ id: executionId })`를 매 노드마다 재조회합니다. N개의 노드에 대해 N번의 SELECT 쿼리가 발생합니다.
- 제안: `savedExecution` 객체를 `executeNode`에 직접 전달하거나, 실행 경로를 메모리에서 누적 후 완료 시점에 한 번만 DB에 저장하세요.

```typescript
// 현재: 노드마다 SELECT + UPDATE
const execution = await this.executionRepository.findOneBy({ id: executionId });
if (execution) {
  execution.executionPath = [...execution.executionPath, node.id];
  await this.executionRepository.save(execution);
}
```

---

**[WARNING] `waitForFormSubmission` — 불필요한 `findOne` 쿼리**
- 위치: `execution-engine.service.ts` — `waitForFormSubmission()`
- 상세: `executeNode` 실행 직후 `waitForFormSubmission`이 호출되는데, 방금 생성된 `NodeExecution`을 다시 `findOne`으로 조회합니다. 이미 생성된 엔티티를 참조로 전달하면 불필요한 DB 조회를 제거할 수 있습니다.
- 제안: `executeNode`의 반환값으로 `NodeExecution` 엔티티를 반환하거나, `waitForFormSubmission`에 해당 엔티티를 인자로 전달하세요.

---

**[INFO] `addNodeResult` — 선형 탐색 중복 체크**
- 위치: `execution-store.ts` — `addNodeResult()`
- 상세: `nodeResults.some(r => r.nodeId === result.nodeId)` + 이후 `map()`은 최악의 경우 O(n) × 2 순회입니다. 노드 수가 수십~수백 개를 넘지 않는 워크플로우 특성상 즉각적인 문제는 아니지만, Map 기반으로 저장하면 O(1) 조회가 가능합니다.
- 제안: `nodeResults`를 `Map<string, NodeResult>`로 관리하거나 현 구조를 유지해도 실용적 문제는 없음.

---

**[INFO] `use-execution-events.ts` — 폴링과 WS 이벤트에서 `addNodeResult` 중복 호출 가능성**
- 위치: `use-execution-events.ts` — `handleNodeCompleted` 콜백 + `pollExecutionStatus`
- 상세: WS 이벤트로 `addNodeResult`가 이미 호출된 후, 폴링에서도 동일 노드에 대해 `addNodeResult`가 재호출될 수 있습니다. `execution-store.ts`의 중복 방어 로직이 이를 처리하지만 불필요한 Map 복사 연산이 발생합니다.
- 제안: 폴링 로직에서 이미 store에 존재하는 nodeId에 대해 `addNodeResult`를 건너뛰는 사전 체크를 추가하거나, 현 구조 유지 시 문제없음.

---

**[INFO] `ChartContent` / `TemplateContent` — `dangerouslySetInnerHTML` 렌더링 성능**
- 위치: `run-results-drawer.tsx` — `ChartContent`, `TemplateContent`
- 상세: HTML 문자열을 매 렌더링마다 DOM에 파싱합니다. 컴포넌트 재렌더링이 잦다면 성능 저하 가능성이 있습니다. `useMemo`로 content를 메모이제이션하면 불필요한 재파싱을 방지할 수 있습니다.
- 제안: 데이터 크기가 작은 경우 현재 구조로 충분합니다.

---

### 요약

전반적으로 구현은 기능적으로 잘 설계되어 있으나, 성능 측면에서 두 가지 주요 문제가 있습니다. 첫째, `waiting_for_input` 상태에서도 폴링이 2초 간격으로 계속되어 사용자가 오래 대기할수록 불필요한 서버 부하가 누적됩니다. 둘째, `pendingContinuations`에 타임아웃이 없어 미응답 폼이 서버 메모리에 무제한 잔류할 수 있습니다. 또한 매 노드 실행마다 발생하는 `executionPath` 업데이트용 불필요한 DB SELECT는 N+1 패턴에 가까운 문제로, 전달된 엔티티 참조 활용으로 즉시 제거 가능합니다.

### 위험도

**MEDIUM**