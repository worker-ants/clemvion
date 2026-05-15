## 발견사항

### **[WARNING]** `emitExecutionSnapshot` 인가(Authorization) 누락
- **위치**: `websocket.gateway.ts` → `emitExecutionSnapshot` 메서드
- **상세**: `executionsService.findById(executionId)`를 호출할 때 요청자 userId를 전달하지 않습니다. 인증된 모든 사용자가 임의의 `execution:*` 채널을 구독하면, 자신이 소유하지 않은 실행의 전체 스냅샷(nodeExecutions, inputData 포함)을 수신할 수 있습니다. `findById`가 내부적으로 소유자 검증을 수행하지 않는다면 데이터 유출로 이어집니다.
- **제안**: `emitExecutionSnapshot(client, executionId)` 시그니처에 `userId`를 추가하고, `findById(executionId, userId)` 형태로 소유자 검증을 수행하거나, 서비스 레이어에서 접근 제어를 명시적으로 처리해야 합니다.

---

### **[WARNING]** REST 폴링 제거로 인한 폴백(Fallback) 소실
- **위치**: `use-execution-events.ts` — `pollExecutionStatus`, `POLL_INTERVAL_MS` 제거
- **상세**: 기존에는 WebSocket이 불안정하거나 스냅샷이 누락된 경우에도 REST 폴링이 상태를 보정했습니다. 변경 후에는 백엔드가 스냅샷을 emit하지 않으면(DB 오류, 구독 직후 네트워크 경쟁 등) 프론트엔드가 영구적으로 stale 상태에 머뭅니다. `onReconnect`가 재구독을 시도하지만, 연결이 끊기지 않은 채 스냅샷만 유실된 경우에는 복구 경로가 없습니다.
- **제안**: 스냅샷 수신 여부를 타임아웃으로 감지하고, 미수신 시 단발성 REST fallback을 호출하는 보완 로직을 추가하거나, 백엔드에서 스냅샷 emit 실패 시 에러를 로깅하는 안전장치가 필요합니다.

---

### **[WARNING]** 동일 채널 재구독 시 중복 스냅샷 전송
- **위치**: `websocket.gateway.ts` → `handleSubscribe`
- **상세**: `clientSubs.add(channel)`은 Set이므로 중복 추가를 방지하지만, `emitExecutionSnapshot` 호출은 그 이전에 실행됩니다. 클라이언트가 동일 채널을 두 번 구독하면(네트워크 불안정으로 인한 재시도 등) 스냅샷이 두 번 emit됩니다. `handleSnapshot`은 `addNodeResult`를 반복 호출하므로, 스냅샷 중복 처리 시 nodeResults가 중복 적재될 수 있습니다.
- **제안**: `if (!clientSubs.has(channel))` 조건을 `clientSubs.add(channel)` 이전에 체크하거나, `emitExecutionSnapshot`을 신규 구독 시에만 호출하도록 보호합니다.

---

### **[INFO]** `createNodeExecution` 시그니처 변경 — 기존 호출부 미갱신
- **위치**: `execution-engine.service.ts` — `createNodeExecution` 메서드
- **상세**: `inputData?: unknown` 파라미터가 추가되었고 diff에서 보이는 한 곳만 `nodeInput`을 전달합니다. 파일 내 다른 `createNodeExecution` 호출부(disabled 노드 SKIPPED 처리, 서브워크플로우 inline 실행 등)는 여전히 파라미터를 생략하므로 `inputData: {}`가 기본값으로 저장됩니다. 이는 의도된 동작이지만, 해당 노드들의 inputData가 항상 빈 객체로 기록되는 점은 추적성을 저하시킵니다.

---

### **[INFO]** `inputData`가 WebSocket 이벤트를 통해 외부에 노출
- **위치**: `execution-engine.service.ts` — 모든 `emitNodeEvent` 호출부
- **상세**: `nodeExec.inputData`는 이전에는 DB에만 저장되었으나, 이제 WebSocket 이벤트 페이로드에 포함되어 모든 구독 클라이언트에 전송됩니다. inputData에 API 키, 사용자 비밀번호, PII 등 민감 정보가 포함된 경우 노출 범위가 확대됩니다.

---

### **[INFO]** `finishedAt?.toISOString?.()` — 이중 옵셔널 체이닝
- **위치**: `execution-engine.service.ts` — 여러 이벤트 emit 위치
- **상세**: `finishedAt`이 `Date` 타입으로 선언되어 있다면 `.toISOString?.()` 의 메서드 옵셔널 체이닝은 불필요합니다. 타입 불일치를 숨기는 방어 코드로 오해될 수 있습니다.

---

## 요약

이번 변경은 REST 폴링을 제거하고 WebSocket 스냅샷으로 실행 상태 동기화를 전환하는 아키텍처 개선입니다. 전반적인 방향은 올바르나, 두 가지 주요 위험이 존재합니다. 첫째, `emitExecutionSnapshot`에 소유자 인가 검증이 없어 인증된 임의 사용자가 타인의 실행 데이터를 수신할 수 있습니다. 둘째, 폴링 폴백이 제거됨에 따라 스냅샷 유실 시 복구 경로가 사라졌습니다. 재구독 중복 스냅샷 문제와 inputData의 WS 노출 범위 확대도 운영 환경에서 주의가 필요합니다.

## 위험도

**MEDIUM**