### 발견사항

---

**[WARNING]** 구독 이벤트마다 전체 Execution 쿼리 발생 (캐싱 없음)
- 위치: `websocket.gateway.ts` — `emitExecutionSnapshot` / `handleSubscribe`
- 상세: 클라이언트가 `execution:*` 채널을 구독할 때마다 `executionsService.findById(executionId)`가 무조건 실행됩니다. 이 메서드는 수백~수천 개의 NodeExecution 레코드(각각 `inputData`, `outputData` 포함)를 JOIN해서 로드할 수 있습니다. 동일한 실행에 여러 클라이언트가 구독하거나, 네트워크 불안정으로 재연결이 빈번하게 발생하면 쿼리가 중복 실행됩니다.
- 제안: 짧은 TTL(예: 5초)의 인메모리 캐시를 두어 동일 `executionId`에 대한 중복 쿼리를 방지하거나, 진행 중인 실행에 대해서만 스냅샷을 전송하고 종료된 실행은 클라이언트가 REST 캐시를 활용하도록 구분하는 방안을 고려하세요.

---

**[WARNING]** WebSocket 이벤트 페이로드에 비제한적 크기의 `inputData` 포함
- 위치: `execution-engine.service.ts` — 여러 `emitNodeEvent` 호출 (`+input: nodeExec.inputData` 추가 지점들)
- 상세: 노드 실행 시 입력 데이터가 이전 노드의 전체 출력값(대규모 테이블, HTTP 응답 본문, AI 대화 이력 등)을 포함할 수 있습니다. 이 데이터가 `NODE_STARTED`, `NODE_COMPLETED`, `NODE_FAILED` 이벤트마다 브로드캐스트되면, 구독 클라이언트 수 × 이벤트 수 × 페이로드 크기만큼 메모리와 네트워크 대역폭이 소비됩니다. Socket.io는 전송 완료 전까지 페이로드를 버퍼에 유지합니다.
- 제안: `inputData`는 스냅샷 이벤트(`execution.snapshot`)에서만 전달하고, 개별 노드 이벤트에서는 제외하거나 `inputData` 크기에 상한(예: 64KB)을 두고 초과 시 참조 ID만 전달하는 방식을 검토하세요.

---

**[INFO]** 스냅샷 핸들러 내 `localeCompare` 정렬
- 위치: `use-execution-events.ts` — `handleSnapshot` 내 `sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""))`
- 상세: ISO 8601 타임스탬프는 사전적 문자 순서와 시간 순서가 일치하므로 `localeCompare` 대신 단순 비교 연산자(`<`, `>`)로 충분합니다. `localeCompare`는 로케일 정보를 처리하는 비용이 있어 불필요하게 무겁습니다. 노드 수가 많은 실행에서 미미하지만 반복되는 오버헤드입니다.
- 제안: `(a.startedAt ?? "").localeCompare(b.startedAt ?? "")` → `(a.startedAt ?? "") < (b.startedAt ?? "") ? -1 : 1` 로 교체하세요.

---

**[INFO]** `handleSnapshot`이 `useCallback` 없이 `useEffect` 내부에 인라인 정의됨
- 위치: `use-execution-events.ts` — `useEffect` 내 `const handleSnapshot = (data: unknown) => { ... }`
- 상세: 해당 함수는 의존성 배열에 포함된 값들이 변경될 때마다 재생성됩니다. 현재는 `useEffect`가 자주 재실행되지 않아 실질적인 문제는 없지만, `useCallback`으로 추출한 다른 핸들러들과 일관성이 없으며 추후 의존성 배열 변경 시 예측하기 어려운 동작을 유발할 수 있습니다. 기능 문제는 아니나 코드 일관성 측면에서 언급합니다.
- 제안: `handleSnapshot`을 다른 핸들러들처럼 `useCallback`으로 추출하세요.

---

**[INFO]** 폴링 제거로 인한 성능 개선 (긍정적 변화)
- 위치: `use-execution-events.ts` — `pollExecutionStatus`, `startPolling` 제거
- 상세: 2초 간격 REST 폴링을 WS 스냅샷으로 대체함으로써 불필요한 반복 HTTP 요청이 제거되었습니다. 특히 `waiting_for_input` 상태에서도 동일 간격으로 폴링하던 비효율이 해소되었습니다. 이는 서버 부하와 클라이언트 네트워크 사용량 모두에서 명확한 개선입니다.

---

### 요약

이번 변경의 핵심은 REST 폴링을 WebSocket 스냅샷으로 대체한 것으로, 폴링 제거 자체는 분명한 성능 개선입니다. 그러나 두 가지 새로운 성능 위험이 도입되었습니다. 첫째, 구독 시마다 전체 Execution을 DB에서 로드하는 쿼리가 캐싱 없이 실행되어 다중 클라이언트나 재연결 시나리오에서 불필요한 DB 부하가 발생할 수 있습니다. 둘째, 개별 노드 이벤트(`NODE_STARTED`, `NODE_COMPLETED`, `NODE_FAILED`)에 `inputData` 전체를 포함시켜 페이로드가 크게 증가했는데, 이 데이터는 이미 스냅샷에 포함되어 있어 중복 전송이며 대규모 데이터 처리 워크플로우에서 메모리·네트워크 압박의 원인이 될 수 있습니다.

### 위험도
**MEDIUM**