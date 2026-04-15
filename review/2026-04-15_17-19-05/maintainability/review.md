### 발견사항

---

**[WARNING] execution-engine.service.ts — 이벤트 페이로드 구성 코드 반복**
- 위치: diff 내 7개 이상의 위치 (라인 ~1132, ~1512, ~1800, ~1848, ~1968, ~2017, ~2081, ~2623)
- 상세: `input: nodeExec.inputData`, `finishedAt: nodeExec.finishedAt?.toISOString?.()`, `interactionData: nodeExec.interactionData` 조합이 거의 동일한 형태로 여러 곳에 분산 추가됨. 향후 필드 추가/수정 시 누락 위험이 높고, 이미 `output` 필드도 같은 방식으로 중복되어 있음.
- 제안: `buildNodeEventPayload(node: Node, nodeExec: NodeExecution): object` 형태의 헬퍼 함수로 공통 페이로드를 추출. 기존 `output` 필드까지 포함해 일괄 정리.

---

**[WARNING] use-execution-events.ts — `interactionType` 분기 로직 중복**
- 위치: `handleWaitingForInput` (useCallback) vs `handleSnapshot` (useEffect 내부 인라인 함수)
- 상세: structured/legacy 형태 감지 → `interactionType` 추출 → `pauseForConversation/pauseForButtons/pauseForForm` 분기 로직이 두 곳에 동일하게 존재. 하나를 수정할 때 다른 쪽 누락 가능성 높음. 이미 이 로직 자체가 3단계 중첩 + 복수 분기로 복잡한 상황.
- 제안: `resolveWaitingState(waitingNode: NodeExecutionData, storeActions)` 순수 함수로 추출하여 두 핸들러에서 공유.

---

**[WARNING] use-execution-events.ts — `handleSnapshot`만 `useCallback` 패턴 미사용**
- 위치: `useEffect` 내부, 약 504번째 줄
- 상세: `handleExecutionStarted`, `handleNodeCompleted` 등 모든 다른 핸들러는 `useCallback`으로 정의되어 deps 배열에 명시적으로 포함되지만, `handleSnapshot`만 `useEffect` 내부에 인라인으로 정의됨. 코드 읽기 흐름이 끊기고, 이 함수는 deps 배열에 없어 추후 의존성 관리 실수로 이어질 수 있음.
- 제안: 다른 핸들러와 동일하게 `useCallback`으로 추출하고 deps 배열에 추가.

---

**[WARNING] websocket.service.ts — `EXECUTION_SNAPSHOT` enum 미사용**
- 위치: `websocket.service.ts:16`, `websocket.gateway.ts:emitExecutionSnapshot()`
- 상세: `ExecutionEventType.EXECUTION_SNAPSHOT = 'execution.snapshot'`이 enum에 추가됐으나, 실제 emission은 `client.emit('execution.snapshot', ...)` 문자열 리터럴로 직접 호출됨. enum 정의의 목적이 무색해지고, 이벤트 이름 변경 시 enum만 수정하면 실제 emission은 변경되지 않는 버그 위험.
- 제안: `emitExecutionSnapshot`에서 `ExecutionEventType.EXECUTION_SNAPSHOT` 상수를 사용하도록 변경.

---

**[INFO] execution-engine.service.ts — `?.toISOString?.()` 이중 optional chaining**
- 위치: 변경된 모든 `finishedAt` 추가 위치
- 상세: `nodeExec.finishedAt?.toISOString?.()` — `Date` 객체에는 `toISOString`이 항상 존재하므로 메서드 레벨 `?.()` 불필요. 타입 불일치(`Date | undefined | null`)를 런타임 방어로 우회한 것으로 보임. 타입 정의 자체를 정리하는 것이 바람직.
- 제안: `nodeExec.finishedAt?.toISOString()` 으로 단순화하거나, 엔티티 타입을 `Date | null`로 명확히 정의.

---

**[INFO] use-execution-events.ts — `finishedAt`, `interactionData` 수신 후 미저장**
- 위치: `handleNodeCompleted`, `handleNodeFailed` payload 타입 정의
- 상세: 백엔드에서 `finishedAt`, `interactionData` 필드를 추가하여 전송하고, 프론트엔드 타입에도 선언됐으나 실제로 스토어에 저장하거나 사용하는 로직이 없음. 전달은 되지만 소비되지 않는 dead data.
- 제안: 실제로 사용할 계획이 있다면 스토어에 저장, 그렇지 않다면 타입 정의에서 제거하여 혼란 방지.

---

**[INFO] websocket.gateway.ts — `forwardRef` 사용 이유 미주석**
- 위치: `@Inject(forwardRef(() => ExecutionsService))`, `websocket.module.ts`
- 상세: `ExecutionEngineService`는 순환 의존성으로 인해 `forwardRef`가 필요하다는 것이 맥락상 명확하지만, `ExecutionsService`에 `forwardRef`가 필요한 이유가 코드만으로는 불명확. 실제 순환 의존이 없다면 `forwardRef` 제거 가능.
- 제안: 순환 의존 여부 확인 후, 불필요하면 제거 / 필요하면 간단한 주석 추가.

---

### 요약

이번 변경의 핵심 방향(REST 폴링 → WebSocket 스냅샷)은 아키텍처적으로 올바르고 테스트 개선도 잘 이루어졌다. 다만 실행 엔진의 이벤트 페이로드 구성 코드가 7개 이상의 위치에 패턴 복사-붙여넣기 방식으로 추가되었고, 프론트엔드의 `interactionType` 분기 로직은 두 핸들러에 동일하게 중복되어 향후 유지보수 부담이 누적될 위험이 있다. `handleSnapshot` 함수가 기존 `useCallback` 패턴을 따르지 않는 불일치와 `EXECUTION_SNAPSHOT` enum이 실제 emission에 사용되지 않는 문제도 보완이 필요하다.

### 위험도

**MEDIUM**