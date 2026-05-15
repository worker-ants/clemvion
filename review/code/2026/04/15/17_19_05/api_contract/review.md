### 발견사항

- **[WARNING]** WebSocket 이벤트 페이로드 스키마 확장 — 하위 호환성 확인 필요
  - 위치: `execution-engine.service.ts` — 모든 `emitNodeEvent` 호출
  - 상세: `NODE_STARTED` 이벤트에 `input`, `startedAt` 필드가 추가되고, `NODE_COMPLETED`/`NODE_FAILED` 이벤트에 `input`, `finishedAt`, `interactionData`가 추가되었습니다. 기존 클라이언트는 새 필드를 무시하므로 additive 변경은 일반적으로 안전하지만, `finishedAt`과 `startedAt`이 `toISOString()`이 없는 객체에 호출될 경우 런타임 오류로 `undefined`가 페이로드에 포함될 수 있습니다. (`?.` optional chaining으로 처리되어 있으나 타입 안전성 불완전)
  - 제안: 페이로드 타입을 별도 interface로 정의하고, `finishedAt`/`startedAt` 필드를 `string | undefined`로 명시적으로 선언하세요.

- **[WARNING]** `execution.snapshot` 이벤트 — 신규 WS 계약이나 공식 스키마 없음
  - 위치: `websocket.gateway.ts:emitExecutionSnapshot`, `websocket.service.ts:EXECUTION_SNAPSHOT`
  - 상세: 새로 도입된 `execution.snapshot` 이벤트는 REST `GET /executions/:id` 응답과 동일한 형태(`ExecutionData`)를 그대로 재사용합니다. 그러나 REST 응답과 WS 페이로드 형태가 묵시적으로 결합되어, REST API 응답 형태가 바뀌면 WS 계약도 자동으로 변경되는 불안정한 의존 구조가 생깁니다. 또한 스냅샷 페이로드에 대한 공식 DTO 또는 타입 정의가 없습니다.
  - 제안: WS 스냅샷 전용 DTO(`ExecutionSnapshotPayload`)를 정의하고, REST DTO와 명시적으로 분리하세요. 이를 통해 양 계약을 독립적으로 버전 관리할 수 있습니다.

- **[WARNING]** 스냅샷 전송 시 인가(Authorization) 검증 부재
  - 위치: `websocket.gateway.ts:emitExecutionSnapshot` (line ~145)
  - 상세: 구독 요청 시 `client.id` 기반으로 인증된 소켓임을 확인하지만, `findById(executionId)` 호출 시 현재 사용자가 해당 execution에 접근 권한이 있는지 확인하지 않습니다. `ExecutionsService.findById`가 내부적으로 소유권 검사를 수행하지 않는다면, 유효한 JWT를 가진 임의 사용자가 타인의 execution 스냅샷을 구독할 수 있습니다.
  - 제안: `emitExecutionSnapshot` 내에서 `client.userId`를 추출하여 `findById(executionId, userId)` 형태로 소유권 검증을 수행하거나, `ExecutionsService.findById`에 userId 파라미터를 추가하여 접근 제어를 강제하세요.

- **[INFO]** REST 폴링 제거 → WS 스냅샷 전환 — 클라이언트 계약 변경
  - 위치: `use-execution-events.ts` — `pollExecutionStatus` 완전 제거
  - 상세: 기존에는 REST `GET /executions/:id`를 2초마다 폴링하여 상태를 보정했으나, 이번 변경으로 WS `execution.snapshot` 이벤트가 유일한 초기 상태 소스가 되었습니다. WS 연결 실패 시 실행 상태를 복구할 fallback 메커니즘이 없어집니다. 단, 주석에 "reconnect handler will retry" 설명이 있어 의도적인 결정임은 명확합니다.
  - 제안: 명세서(spec) 또는 API 문서에 "WS 연결 없이는 실행 상태 조회 불가"임을 명시하고, 필요 시 REST fallback 경로를 선택적으로 유지하는 것을 검토하세요.

- **[INFO]** `createNodeExecution` 시그니처 변경 — 내부 API
  - 위치: `execution-engine.service.ts:2719` — `inputData?: unknown` 파라미터 추가
  - 상세: 서비스 내부 메서드이므로 외부 계약에는 영향 없으나, `inputData`의 타입이 `unknown`으로 넓게 선언되어 있고 `as Record<string, unknown>`으로 강제 캐스팅됩니다. 향후 타입 불일치 시 런타임 오류를 감지하기 어렵습니다.
  - 제안: `inputData` 타입을 `Record<string, unknown> | null | undefined`로 좁히거나, 저장 전 유효성 검사를 추가하세요.

---

### 요약

이번 변경의 핵심은 REST 폴링 기반 실행 상태 동기화를 WebSocket `execution.snapshot` 이벤트 기반으로 전환한 것입니다. 기존 REST API 엔드포인트와 클라이언트에 대한 breaking change는 없으며, WS 이벤트 페이로드는 additive 확장이므로 기존 구독자와의 하위 호환성은 유지됩니다. 다만 스냅샷 이벤트에 대한 공식 스키마 정의 부재, 스냅샷 전송 시 execution 소유권 인가 검증 누락, REST/WS 계약의 묵시적 결합이 중기적으로 계약 불안정성을 유발할 수 있는 위험 요소입니다.

### 위험도

**MEDIUM**