# Cross-Spec 일관성 검토 결과

> 검토 모드: 구현 착수 전 검토 (`--impl-prep`, scope=`frontend/src/lib/websocket`)
> 검토 대상: `frontend/src/lib/websocket` 디렉토리의 기존 구현 파일 6종

---

## 발견사항

### [INFO] Socket.IO 기반 구현 vs. 순수 WebSocket 프로토콜 spec의 메시지 프레임 불일치

- **target 위치**: `ws-client.ts` 전체 (특히 `subscribe`/`emit`/`on` 구현)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §2.1`, §3.3
- **상세**: spec §2.1은 모든 메시지를 `{ type, id?, payload }` 형태의 JSON 텍스트 프레임으로 정의하고, §3.3에서 구독 요청을 `{ "type": "subscribe", "id": "req-001", "payload": { "channel": "..." } }` 형태로 명시한다. 구현은 Socket.IO(`socket.io-client`)를 사용하며, `socket.emit("subscribe", { channel })` 로 Socket.IO 이벤트 이름 기반 전송을 한다. Socket.IO는 자체 프레임 포맷을 갖고 있어 spec의 단일 `type` 필드 기반 프레임 개념과 다르다. 그러나 backend도 동일한 Socket.IO 서버를 쓰고 있을 가능성이 높아 (코드 코멘트와 이벤트 이름 패턴이 spec과 일치) 실제 동작에는 문제가 없는 것으로 보인다. spec이 transport 레이어보다 논리적 프로토콜을 기술하는 것으로 볼 경우 허용 가능.
- **제안**: spec §1 또는 §9에 "구현은 Socket.IO wrapper를 사용하며, JSON 프레임은 Socket.IO 이벤트 페이로드로 매핑된다"는 구현 메모를 추가하면 미래의 혼선을 방지할 수 있다.

---

### [INFO] 인증 방식 구현이 spec §1.2와 다른 경로 사용

- **target 위치**: `ws-client.ts:32-38` (`io()` 호출의 `auth: { token }`)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §1.2`
- **상세**: spec §1.2는 두 가지 인증 방식 — (1) 쿼리 파라미터 `?token={access_token}`, (2) `Sec-WebSocket-Protocol: bearer, {token}` 서브프로토콜 헤더 — 을 명시한다. 구현은 Socket.IO의 `auth` 옵션(`{ auth: { token } }`)을 사용해 연결 핸드셰이크 중에 토큰을 전달한다. 이는 spec에 명시된 두 방식과 다른 세 번째 방법이다. Socket.IO의 `auth` 필드는 서버 쪽 `socket.handshake.auth` 에서 접근하는 방식으로, 쿼리 파라미터 방식과 유사하지만 동일하지 않다.
- **제안**: spec §1.2에 "Socket.IO 연결 시 `auth.token` 필드 사용 (우선순위 0)" 항목을 추가해 구현 현실을 반영하거나, 구현 쪽에서 `?token=` 쿼리 파라미터를 사용하도록 변경한다.

---

### [INFO] `execution.snapshot` 이벤트가 spec에 문서화되지 않음

- **target 위치**: `use-execution-events.ts:704` (`client.on("execution.snapshot", handleSnapshot)`)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.1`
- **상세**: `use-execution-events.ts`는 `execution.snapshot` 이벤트를 구독하고 이를 핵심적인 실시간 상태 복원 메커니즘으로 사용한다 (코드 주석: "backend 가 subscribe 즉시 발송하는 snapshot"). 이 이벤트는 `spec/5-system/6-websocket-protocol.md §4.1`의 실행 이벤트 목록에 포함되어 있지 않다. §6.2에서 재연결 후 `replay.unavailable` 이벤트와 REST fallback을 언급하지만, subscribe 즉시 전송되는 snapshot 메커니즘은 명시되어 있지 않다.
- **제안**: spec §4.1에 `execution.snapshot` 이벤트 (`{ execution: ExecutionData }`) 를 추가하고, subscribe 즉시 backend가 이를 전송하는 메커니즘을 §3.3 또는 §4.1에 문서화한다.

---

### [INFO] `execution.resumed` 이벤트가 spec에 문서화되지 않음

- **target 위치**: `use-execution-events.ts:663` (`client.on("execution.resumed", handleExecutionResumed)`)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.1`
- **상세**: 구현은 `execution.resumed` 이벤트를 구독해 form/buttons/ai_conversation 대기 상태에서의 재개를 처리한다. 이 이벤트는 spec §4.1 실행 이벤트 목록에 없다. spec §4.1에는 `execution.started`, `execution.completed`, `execution.failed`, `execution.cancelled`, `execution.paused` 등은 있으나 `execution.resumed`는 누락.
- **제안**: spec §4.1에 `execution.resumed` 이벤트를 추가하거나, backend가 재개 시 `execution.started`를 재발송하는 backward-compat 동작 (코드 주석 "Backward compat guard: older backends may emit execution.started instead of execution.resumed")을 spec에 명시한다.

---

### [INFO] `execution.click_button` 명령 payload에 `nodeId` 누락

- **target 위치**: `use-execution-interaction-commands.ts:92-98` (`clickButton` 함수)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.2`
- **상세**: spec §4.2는 `execution.click_button` 명령의 payload를 `{ executionId, nodeId, buttonId }`로 정의한다. 구현의 `clickButton`은 `{ executionId, buttonId }`만 전송하며 `nodeId`를 포함하지 않는다. 현재 waiting 중인 nodeId는 store에 있으므로 기술적으로 포함 가능하지만, 현재 구현에서는 생략되어 있다.
- **제안**: `clickButton` 함수에 `nodeId` 파라미터 또는 store에서의 `waitingNodeId` 조회를 추가해 spec의 payload 계약을 완전히 준수하도록 수정한다. 또는 spec §4.2에서 `nodeId`를 optional로 완화한다.

---

### [INFO] `execution.submit_form` ack 이벤트명이 spec에 없음

- **target 위치**: `use-execution-interaction-commands.ts:76-84` (`ackEvent: "execution.form_submitted"`)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.2`
- **상세**: spec §4.2는 `execution.start` 명령의 ack (`execution.start.ack`)와 `execution.click_button` 명령의 ack (`execution.click_button.ack`)를 정의하지만, `execution.submit_form`의 ack 이벤트명은 문서화하지 않는다. 구현은 `execution.form_submitted`라는 ack를 기다리며, `sendMessage`의 ack는 `execution.submit_message.ack`, `endConversation`의 ack는 `execution.end_conversation.ack`를 사용한다. 명명 규칙도 불일치(`_submitted` vs `.ack` suffix).
- **제안**: spec §4.2에 `execution.submit_form`의 ack 이벤트를 명시적으로 추가하거나 (예: `execution.form_submitted` 또는 `execution.submit_form.ack`), 구현의 ack 이름을 `execution.submit_form.ack`로 통일하고 spec에 문서화한다.

---

### [INFO] `waitingNodeId` 없이 `execution.click_button` 전송 (clickContinue 포함)

- **target 위치**: `use-execution-interaction-commands.ts:101-109` (`clickContinue`)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.2`
- **상세**: `clickContinue`는 `{ executionId, buttonId: "__continue__" }`만 전송한다. spec은 `{ executionId, nodeId, buttonId }` 세 필드를 요구한다. `clickButton`과 동일한 이슈.
- **제안**: clickButton/clickContinue 모두 store에서 `waitingNodeId`를 조회해 `nodeId`를 포함시킨다.

---

### [WARNING] `execution.waiting_for_input` payload 필드명이 spec과 다름

- **target 위치**: `use-execution-events.ts:141-154` (handleWaitingForInput의 payload 타입 정의)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.4`
- **상세**: spec §4.4는 `execution.waiting_for_input` payload를 `{ executionId, nodeId, nodeExecutionId, nodeType, interactionType, formConfig?, buttonConfig?, conversationConfig? }`로 정의한다. 구현의 payload 타입은 `{ waitingNodeId, waitingNodeType, waitingNodeLabel, nodeExecutionId, interactionType, nodeOutput, buttonConfig, startedAt }`을 사용한다 — `nodeId` 대신 `waitingNodeId`, `nodeType` 대신 `waitingNodeType` 등 필드명이 다르다. 코드 내에 legacy/fallback 처리가 있어 실제 backend 전송 필드명이 spec과 다른 것으로 보인다.
- **제안**: backend가 실제로 전송하는 필드명(waitingNodeId, waitingNodeType 등)을 spec §4.4에 정확하게 반영하거나, backend를 spec의 `nodeId`/`nodeType`으로 수정하고 frontend를 동기화한다. 두 정의 중 하나가 source of truth가 되어야 한다.

---

### [INFO] `execution.ai_message` payload `nodeExecutionId` 필드가 spec에 누락

- **target 위치**: `use-execution-events.ts:303-312` (handleAiMessage payload 타입)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.4` (ai_message payload 표)
- **상세**: 구현은 `nodeExecutionId`를 `execution.ai_message` payload에서 선택적으로 받아 Sub-Workflow 중첩 시 같은 `nodeId`의 AI Agent 다중 row를 구분하는 데 사용한다. 이 필드는 spec §4.4의 `execution.ai_message` payload 필드 표에 없다.
- **제안**: spec §4.4의 `execution.ai_message` payload 표에 `nodeExecutionId?: uuid` 항목을 추가한다.

---

### [INFO] 재연결 시 토큰 갱신 방식이 spec §1.3과 상이

- **target 위치**: `ws-client.ts:59-73` (connect_error 핸들러)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §1.3`
- **상세**: spec §1.3은 Access Token 만료 전 재갱신 흐름으로 "REST API `/api/auth/refresh`로 갱신 후 `auth.refresh` WebSocket 메시지 전송"을 정의한다. 구현은 connect_error 시 `refreshAccessToken()`을 호출하고 `socket.auth.token`을 교체한 뒤 `socket.connect()`로 재연결하는 방식을 사용한다. 연결 유지 중 토큰을 갱신하는 `auth.refresh` 메시지는 현재 구현에서 사용되지 않는다.
- **제안**: spec §1.3에 "연결이 끊어진 경우의 재연결 토큰 갱신은 auth.refresh 메시지 대신 연결 재시작으로 처리 가능"이라는 설명을 추가하거나, connect_error 기반 토큰 갱신 패턴을 spec에 반영한다.

---

## 요약

`frontend/src/lib/websocket` 구현은 `spec/5-system/6-websocket-protocol.md`의 논리적 프로토콜을 대부분 올바르게 구현하고 있다. CRITICAL 또는 작동 불가 수준의 충돌은 발견되지 않았다. 주요 발견사항은 두 가지 패턴으로 분류된다: (1) spec에 문서화되지 않은 이벤트/필드(`execution.snapshot`, `execution.resumed`, `nodeExecutionId` 등)가 구현에 존재하는 spec 누락 — 이는 구현이 spec보다 앞서 진화한 결과이며 spec 갱신이 필요하다. (2) payload 필드명 불일치(`nodeId` vs `waitingNodeId` 등) — 이는 frontend와 backend 사이 비공식 계약이 spec과 달라진 것으로, spec 또는 코드 중 하나를 source of truth로 정렬해야 한다. 재연결 후 socket.io `auth` 기반 토큰 전달 방식도 spec의 쿼리 파라미터 방식과 다르나 동작에 지장은 없다.

---

## 위험도

LOW
