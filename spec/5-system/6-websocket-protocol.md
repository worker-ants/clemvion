---
id: websocket-protocol
status: partial
pending_plans:
  - plan/in-progress/spec-sync-websocket-protocol-gaps.md
code:
  - codebase/backend/src/modules/websocket/websocket.gateway.ts
  - codebase/backend/src/modules/websocket/websocket.service.ts
  - codebase/backend/src/modules/websocket/execution-seq-allocator.service.ts
  - codebase/backend/src/modules/websocket/ws-error-codes.ts
  - codebase/backend/src/modules/external-interaction/sse-adapter.service.ts
  - codebase/frontend/src/lib/websocket/ws-client.ts
  - codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts
---

# Spec: WebSocket 프로토콜

> 관련 문서: [Spec API 규칙 §10](./2-api-convention.md#10-websocket) · [Spec 실행/디버깅 §8](../3-workflow-editor/3-execution.md#8-실행-엔진-통신) · [Spec 실행 엔진](./4-execution-engine.md) · [Spec External Interaction API](./14-external-interaction-api.md)

---

## 1. 연결

> **전송 계층 (구현 현실)**: 본 채널은 **Socket.IO** 로 구현되어 있다 (`@WebSocketGateway({ namespace: '/ws' })`, 클라이언트 `socket.io-client`). 따라서 메시지는 Socket.IO 의 이벤트/ack 모델을 따른다 — 클라이언트는 `socket.emit('<event>', data)` 로 보내고, 명령 ack 는 `{ event, data }` 형태의 callback payload 로 돌려받는다 (아래 §3.3 / §4.2 의 ack 예시 참조). 본 문서의 `{ type, id, payload }` JSON 프레임 표기는 **논리적 메시지 형태를 보이기 위한 추상화** 이며, 실제 wire 는 Socket.IO 가 감싼다 (raw WebSocket 프레임 / `Sec-WebSocket-Protocol` 서브프로토콜 / raw close code 를 직접 다루지 않는다). 본 §1~§9 중 raw-WS 전제 항목(서브프로토콜 인증·서버발신 app ping·close 코드 등)은 **미구현 (Planned)** 으로 표기한다 — `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 참조.

### 1.1 엔드포인트

```
wss://{base_url}/ws        # Socket.IO namespace '/ws'
```

- 프로토콜: `wss://` (TLS 필수). 개발 환경에서만 `ws://` 허용
- 서버는 Socket.IO 게이트웨이로 핸드셰이크를 처리한다 (transport: `websocket` → `polling` fallback). 클라이언트 기본 transport 는 `['websocket', 'polling']`

### 1.2 인증

연결 시 JWT Access Token을 전달한다. 구현은 다음 두 핸드셰이크 위치를 지원하며, 우선순위는 (1) → (2) 순이다 (`handleConnection` 의 `handshake.query.token || handshake.auth.token`).

| 방식 | 형태 | 예시 |
|------|------|------|
| (1) 쿼리 파라미터 | `?token={access_token}` | Socket.IO `io(url, { query: { token } })` 또는 URL 쿼리 |
| (2) Socket.IO auth payload | `handshake.auth.token` | 클라이언트 `io(url, { auth: { token } })` (프론트 기본 경로) |

> **미구현 (Planned)**: raw WebSocket `Sec-WebSocket-Protocol: bearer, {token}` 서브프로토콜 인증 경로는 구현에 없다. Socket.IO 전송에서는 위 두 위치만 인식한다.

**인증 실패 시:**
- 핸드셰이크 단계: 토큰 부재/무효이면 서버가 `error` 이벤트(`{ message }`)를 emit 한 직후 `disconnect()` 로 연결을 끊는다 (raw HTTP `401` 이 아니라 Socket.IO connection error 경로).
- 연결 중 토큰 만료: 클라이언트는 `connect_error` 를 받으면 REST `/auth/refresh` 로 토큰을 새로 받아 Socket.IO `auth` payload 를 교체한 뒤 재연결한다 (`ws-client.ts`). **서버발신 `auth.token_expired` 이벤트는 미구현 (Planned)** — §4.5 참조.

### 1.3 토큰 갱신 (연결 유지)

**구현 현실**: 별도의 in-band WS 갱신 메시지(`auth.refresh`/`auth.refreshed`)는 **미구현 (Planned)** 이다. 현재 클라이언트는 토큰 만료/`connect_error` 시 REST `/auth/refresh` 로 새 Access Token 을 받아 Socket.IO `auth.token` 을 교체하고 **재연결** 하는 방식으로 세션을 유지한다 (`ws-client.ts` 의 `connect_error` 핸들러). 끊김 없는 in-band 갱신은 향후 항목이다.

> **미구현 (Planned)** — 아래 in-band 갱신 프로토콜:
>
> ```json
> // 클라이언트 → 서버
> { "type": "auth.refresh", "payload": { "token": "{new_access_token}" } }
> // 서버 → 클라이언트
> { "type": "auth.refreshed", "payload": { "expiresAt": "2026-03-29T14:30:00Z" } }
> ```
>
> 현재는 위 메시지 핸들러/emit 이 backend 에 없다. 클라이언트는 Access Token 갱신 후 (REST `/auth/refresh`) 재연결로 새 토큰을 전달한다.

---

## 2. 메시지 형식

> **Socket.IO 매핑 (구현 현실)**: 메시지의 `type` 은 별도 `type` JSON 필드가 아니라 **Socket.IO 이벤트 이름** 으로 전달된다 — 서버는 `socket.emit(eventType, envelope)`, 클라이언트는 `socket.on(eventType, handler)`. 따라서 아래 `{ type, id, payload }` 표기는 **논리 구조**이며, 실제 wire 는 "이벤트 이름 = `type`" + "payload = envelope" 형태다. 명령 요청-응답 매칭도 `id` 필드가 아니라 Socket.IO ack callback 으로 이뤄진다 (§3.3·§4.2).

### 2.1 기본 프레임 (논리 구조)

```json
{
  "type": "string",      // 실제 wire 에서는 Socket.IO 이벤트 이름
  "id": "string (optional)",
  "payload": {}
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | String | ✓ | 이벤트/명령 유형 (네임스페이스.액션 형태). **wire 상으로는 Socket.IO 이벤트 이름** |
| `id` | String | — | _(계획·일부 미구현)_ 메시지 고유 ID. 구현된 명령 ack 는 `id` echo 대신 Socket.IO ack callback 으로 짝지어진다 |
| `payload` | Object | ✓ | 이벤트/명령별 데이터 |

### 2.2 서버 → 클라이언트 이벤트 래퍼

**구현 현실** — 서버발신 execution/node 이벤트의 wire envelope 는 `type`/`payload` 를 nest 하지 않고, `executionId`(+node 이벤트는 `nodeId`) + payload 필드 + `seq` + `timestamp` 를 **평면 병합** 한 객체다 (`emitExecutionEvent` / `emitNodeEvent`). 이벤트 이름은 Socket.IO 이벤트 이름으로 분리된다.

```js
// Socket.IO event name: "execution.node.completed"
{
  "executionId": "550e8400-...",
  "nodeId": "...",
  /* ...payload 필드 평면 병합... */
  "seq": 42,
  "timestamp": "2026-03-29T14:00:01.234Z"
}
```

| 추가 필드 | 설명 |
|-----------|------|
| `executionId` | 채널 execution ID (envelope top-level 자동 첨부) |
| `timestamp` | 서버 이벤트 발생 시각 (ISO 8601) |
| `seq` | 채널 내 순서 번호 (재연결 시 놓친 이벤트 감지용). `execution:{executionId}` 채널의 경우 = "execution 내 monotonic counter" (`ExecutionSeqAllocator`, Redis `INCR exec:seq:<executionId>` — 키 정의는 [실행 엔진 §9.2](./4-execution-engine.md#92-용도별-키-정의-및-ttl), sliding-window TTL env `EXECUTION_SEQ_TTL_SECONDS` 기본 86400), 외부 SSE 의 `id:` / Outbound Notification 의 `seq` 와 동일 값 공유 — [Spec EIA §R7](./14-external-interaction-api.md#r7-seq-동일-공유--sse-와-notification). **저장소 정책은 Redis-only (2026-06-02 결정, DB fallback 미사용)**: Redis 미가용 시 in-memory per-instance counter 로 degrade 해 emit 을 멈추지 않는다 — degraded 구간의 분산(cross-instance) monotonic 은 미보장 (수용된 trade-off, `logger.warn` 기록. 정상 경로에서도 자기 인스턴스 발급분을 mirror 해 장애 전환 시 high-water mark 를 이어받는다) |

---

## 3. 채널 구독

### 3.1 채널 개념

클라이언트는 관심 있는 리소스에 대해 **채널을 구독**해야 이벤트를 수신한다. 구독하지 않은 리소스의 이벤트는 전송되지 않는다.

### 3.2 채널 패턴

| 채널 | 패턴 | 설명 |
|------|------|------|
| 워크플로우 실행 | `execution:{executionId}` | 특정 실행의 모든 이벤트 |
| 워크플로우 편집 | `workflow:{workflowId}` | 에디터에서 실행 시작/완료 알림 |
| KB 문서 상태 | `kb:{documentId}` | Knowledge Base 문서별 임베딩·그래프 추출 상태 |
| 알림 | `notifications:{userId}` | 사용자 알림 실시간 수신 |

### 3.3 구독/구독 해제

구독/해제는 Socket.IO 이벤트 `subscribe` / `unsubscribe` 로 보내며, 서버는 ack callback 으로 `{ event, data }` 를 반환한다.

```js
// 구독 요청 (클라이언트)
socket.emit("subscribe", { channel: "execution:550e8400-e29b-41d4-a716-446655440000" });

// 구독 확인 (ack callback payload)
{ "event": "subscribed", "data": { "success": true, "channel": "execution:550e8400-e29b-41d4-a716-446655440000" } }

// 구독 해제
socket.emit("unsubscribe", { channel: "execution:550e8400-e29b-41d4-a716-446655440000" });
// ack: { "event": "unsubscribed", "data": { "success": true, "channel": "..." } }
```

> 본 ack 는 `{ type, id, payload }` 가 아니라 Socket.IO ack callback 의 `{ event, data }` shape 다 (`handleSubscribe` 반환). `id` 기반 요청-응답 매칭 대신 Socket.IO ack callback 으로 응답이 짝지어진다.

**권한 검증:** 서버는 구독 시 해당 리소스에 대한 접근 권한을 확인한다 (`execution:` / `kb:` / `background:run:` 채널은 workspace 소유 검증 — IDOR 차단). 권한 없으면 **별도 `error` 메시지가 아니라 동일한 `subscribed` ack 에 `success: false` 와 평문 `error` 문자열** 로 응답한다 (전용 에러 코드 필드 없음):

```json
{ "event": "subscribed", "data": { "success": false, "error": "Not authorized for this execution" } }
```

> **미구현 (Planned)**: §7.2 의 `{ type: 'error', payload: { code: 'FORBIDDEN', message } }` 코드 기반 거부 메시지는 구독 거부 경로에서 발행되지 않는다. 거부는 위 평문 `error` 문자열로만 표면화된다.

### 3.4 최대 구독 수

- 연결당 최대 동시 구독: **20개** (`MAX_SUBSCRIPTIONS_PER_CONNECTION`)
- 초과 시 구독 ack 에 `{ success: false, error: "Maximum subscriptions (20) reached" }` 평문 문자열 반환. **전용 `SUBSCRIPTION_LIMIT_EXCEEDED` 코드는 미구현 (Planned)** — §7.1 참조.

---

## 4. 이벤트 목록

### 4.1 실행 이벤트 (Server → Client)

채널: `execution:{executionId}`

| 이벤트 type | payload | 설명 |
|-------------|---------|------|
| `execution.started` | `{ executionId, workflowId, mode, startedAt }` | 실행 시작 |
| `execution.completed` | `{ executionId, status, duration, nodeCount }` | 실행 완료 |
| `execution.failed` | `{ executionId, error, failedNodeId, duration }` | 실행 실패 |
| `execution.cancelled` | `{ executionId, cancelledBy, duration }` | 실행 취소 |
| `execution.snapshot` | `{ executionId, execution, timestamp }` | 재구독 시 1회성 현재 상태 스냅샷 (놓친 이벤트 복구). `execution` 은 `ExecutionsService.findById` 의 **Execution 전체 객체** (그 안에 `status` 와 `nodeExecutions[]` 등이 nest) — top-level 에 `status`/`nodeExecutions` 가 평면으로 있는 게 아니라 `payload.execution.*` 로 nest 된다. `ExecutionEventType.EXECUTION_SNAPSHOT`, §6.2 참조 |
| `execution.paused` _(계획·미구현)_ | `{ executionId, nodeId, nodeName, reason }` | 브레이크포인트에서 일시 정지. 브레이크포인트 기능은 미구현 ([Spec 실행 §6 로드맵](../3-workflow-editor/3-execution.md#6-브레이크포인트-향후-로드맵--미구현)) |
| `execution.node.started` | `{ executionId, nodeId, nodeExecutionId, nodeName, nodeType }` | 노드 실행 시작. `nodeExecutionId`는 `NodeExecution` 행의 PK로, 컨테이너 body 노드의 iter별 타임라인 row를 구분하는 식별자 |
| `execution.node.completed` | `{ executionId, nodeId, nodeExecutionId, nodeName, output, duration }` | 노드 실행 완료. `output` 은 `NodeHandlerOutput` 의 `output` 필드 — `output.error` 가 set 된 경우 (예: AI Agent multi-turn 의 `port: 'error'` 종결) 도 포함 ([Spec AI Agent §7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트)). `output.error.details.retryable` / `retryAfterSec` 표준 필드는 CONVENTIONS Principle 3.2.1 정의 |
| `execution.node.failed` | `{ executionId, nodeId, nodeExecutionId, nodeName, error }` | 노드 실행 실패. `error` 는 `output.error` 전체 구조 — `{ code: string, message: string, details?: { retryable?: boolean, retryAfterSec?: number, ... 노드별 } }` ([CONVENTIONS Principle 3.2](../conventions/node-output.md#32-outputerror-표준-형태)). LLM 계열 노드는 `details.retryable` 필수 |
| `execution.node.skipped` | `{ executionId, nodeId, nodeExecutionId, nodeName, reason }` | 노드 건너뜀 |
| `execution.node.cancelled` | `{ executionId, nodeId, nodeExecutionId, nodeLabel, error }` | 노드 실행이 외부 `abortSignal` 로 중단됨 (`error.name === 'AbortError'`). `NodeExecution.status = cancelled` ([실행 엔진 §1.2](./4-execution-engine.md#12-nodeexecution-상태) / [node-cancellation §5.1](../conventions/node-cancellation.md#5-aborterror-분류)). `error` 는 `output.error` 구조(`{ code: 'AbortError', message }`). `failed` 와 별도 이벤트 — 타임라인이 취소를 실패와 구분 표시하고 `running` 에 잔류하지 않게 한다. 생산자: Parallel `cancel-others-on-fail` / 사용자 cancel |
> **Note (spec drift)**: 위 표의 `node.started` / `node.completed` / `node.failed` / `node.skipped` 행은 spec 에 `nodeName` 으로 표기되어 있으나 엔진 및 프론트엔드는 모두 `nodeLabel` 을 사용하고 있다 (기존 drift, 본 PR scope 밖 — 별도 정합 필요). `node.cancelled` 는 신설 이벤트이므로 올바른 `nodeLabel` 로 즉시 정정한다.
| `execution.waiting_for_input` | `{ executionId, nodeId, nodeExecutionId, nodeType, interactionType, formConfig?, buttonConfig?, conversationConfig?, conversationThread? }` | Form 노드, 버튼 Presentation 노드, 또는 AI Agent Multi Turn 노드에서 사용자 입력 대기. 재개 후 `execution.node.completed`도 동일한 `nodeExecutionId`로 발행되어 프론트 타임라인의 동일 row가 업데이트된다. `conversationThread` 가 동봉되면 UI 가 라이브 thread 패널을 갱신할 수 있다 (선택, §4.4.5). 아래 §4.4 참조 |
| `execution.ai_message` | `{ executionId, nodeId, message, turnCount, messages, metadata?, llmCalls?, durationMs?, presentations? }` | AI Agent Multi Turn 모드에서 AI 응답 메시지 전달. `messages` 는 system 을 제외한 user / assistant / **tool** 메시지를 모두 포함하는 권위 있는 스냅샷이며, 각 항목은 `source: 'live' \| 'injected'` 마커를 동봉한다 (§4.4.6). `presentations` 는 AI Agent 의 `render_*` 표현 도구 출력 (§4.4 표 / [Spec AI Agent §7.10](../4-nodes/3-ai/1-ai-agent.md#710-presentation-payload-render_-운반)). 상세 필드 정의는 §4.4 참조 |
| `execution.tool_call_started` | `{ executionId, nodeId, turnIndex, toolCallId, name, arguments }` | AI Agent 가 provider tool(KB/MCP 등)을 실행하기 시작했음을 알림. 디버깅 타임라인이 즉시 pending 상태의 tool 항목을 표시할 수 있도록 turn 종료 전에 발송 |
| `execution.tool_call_completed` | `{ executionId, nodeId, turnIndex, toolCallId, content, status, error?, durationMs }` | provider tool 실행이 끝났음을 알림. `status` 는 `'success' \| 'error'`. provider 가 throw 한 경우 핸들러가 캐치해 `status: 'error'` 와 `error` 메시지를 채우고 LLM 에는 에러 content 를 그대로 넘겨 다음 턴에서 회복할 기회를 준다 |
| `execution.user_message` | `{ executionId, nodeId, nodeExecutionId, message, receivedAt }` | AI Agent Multi Turn 모드에서 **사용자 발화(q)를 수신 즉시(다음 턴 LLM 호출 전) 라이브로 노출**하기 위한 진행 신호. `tool_call_started` 와 동형의 **비권위 라이브 신호** — turn 종료 `execution.ai_message.messages` 스냅샷이 권위 출처이며 동일 user 메시지를 포함한다. 클라이언트는 이 이벤트로 optimistic `ai_user` bubble 을 즉시 띄우고 후속 `ai_message` 로 reconcile (§4.4 `user_message` 상세 / §4.4.6 소비 규약 / §4.4 Reconciliation 노트). `submit_message`(일반 채팅) 및 채널 텍스트 인바운드(텔레그램 등) → `message_received` 경로에서만 발화하며, form 제출(`submit_form` → `presentation_user`)에는 발화하지 않는다 |

### 4.2 실행 제어 명령 (Client → Server)

> **구현 현실 — 실행 시작/중단은 REST**: `execution.start` / `execution.stop` WS 명령은 **미구현 (Planned)** 이다. 현재 실행 시작은 REST `POST /workflows/:id/execute`, 중단은 REST `POST /executions/:id/stop` 로 수행하며, 진행 상황은 `execution:{executionId}` 채널 구독으로 받는다. WS gateway 의 `@SubscribeMessage` 핸들러는 `subscribe`/`unsubscribe`/`ping`/`execution.submit_form`/`execution.click_button`/`execution.submit_message`/`execution.end_conversation`/`execution.retry_last_turn` 8개뿐이다 (start/stop/continue/step 핸들러 없음).

| 명령 type | payload | 설명 |
|-----------|---------|------|
| `execution.start` _(계획·미구현 WS 경로)_ | `{ workflowId, input?, fromNodeId?, breakpoints? }` | 실행 시작 요청. **현재는 REST `POST /workflows/:id/execute`** 사용. `breakpoints?` 는 브레이크포인트 기능(미구현)용 _(계획)_ 필드 |
| `execution.stop` _(계획·미구현 WS 경로)_ | `{ executionId, force? }` | 실행 중단 요청. **현재는 REST `POST /executions/:id/stop`** 사용 |
| `execution.continue` _(계획·미구현)_ | `{ executionId }` | 브레이크포인트 후 계속 ([Spec 실행 §6 로드맵](../3-workflow-editor/3-execution.md#6-브레이크포인트-향후-로드맵--미구현)) |
| `execution.step` _(계획·미구현)_ | `{ executionId }` | 한 노드만 실행 후 다시 정지 ([Spec 실행 §6 로드맵](../3-workflow-editor/3-execution.md#6-브레이크포인트-향후-로드맵--미구현)) |
| `execution.submit_form` | `{ executionId, formData }` | Form 노드에 사용자 입력 제출. `nodeId`/`toolCallId` 는 **클라이언트 전달 필드가 아니다** — 대기 노드 식별은 server lookup(§[실행 엔진 §7.5.1](./4-execution-engine.md#751-publisher-측-사전-검증--invalid_execution_state)), AI Agent `render_form` 응답의 toolCallId 매칭은 서버가 보관한 `pendingFormToolCall` resume state 로 처리한다 ([Spec AI Agent §6.2 step 2](../4-nodes/3-ai/1-ai-agent.md#62-multi-turn-모드-mode--multi_turn)). **외부 wire 호환**: 본 payload shape 은 internal continuation bus 의 sentinel wrap (`{type:'form_submitted', formData}`, [Presentation 공통 §10.9](../4-nodes/6-presentation/0-common.md#109-form-submission-wire-format-internal-bus-sentinel)) 과 layer 분리 — 외부 wire 는 본 표 형식 유지, internal bus 만 sentinel wrap |
| `execution.click_button` | `{ executionId, buttonId }` | 버튼이 설정된 Presentation 노드에서 버튼 클릭. `buttonId`는 port 타입 버튼의 UUID 또는 `__continue__` (link 전용 시 Continue 액션). `nodeId` 는 선택 수신되나 서버가 사용하지 않는다 (대기 노드 식별은 server lookup) |
| `execution.submit_message` | `{ executionId, nodeId, message }` | AI Agent Multi Turn 모드에서 사용자 메시지 전송. **form bypass**: `interactionType: 'ai_form_render'` 활성 중 본 명령이 수신되면 backend 가 `pendingFormToolCall.toolCallId` 매칭하는 render_form 도구의 tool_result content 를 `{type:'cancelled', reason:'user_sent_message_instead'}` 로 채우고 `pendingFormToolCall` 클리어 후 정상 `ai_user` turn 진행 ([Spec AI Agent §6.2 step 2.c.bypass](../4-nodes/3-ai/1-ai-agent.md#62-multi-turn-모드-mode--multi_turn)) — LLM 의 다음 reasoning 자유 보존. UI 의 MessageInput 은 항상 활성 (form 우회 허용) |
| `execution.end_conversation` | `{ executionId, nodeId }` | AI Agent Multi Turn 대화 종료 요청 |
| `execution.retry_last_turn` | `{ executionId, nodeExecutionId }` | AI Agent Multi Turn 의 retryable error (`output.error.details.retryable === true`) 종결 후 동일 nodeId 의 새 NodeExecution row 를 spawn 해 마지막 LLM 호출 재진입. `nodeId` 대신 `nodeExecutionId` 사용 사유: 동일 nodeId 가 여러 NodeExecution row 를 가질 수 있어 row 단위 식별 필요. 워크플로우 Re-run ([§13 replay-rerun](./13-replay-rerun.md)) 과 다름 — 동일 Execution 안 노드 단위 재시도. |

**실행 시작 응답 (_계획·미구현 WS 경로_):**

> `execution.start.ack` WS 응답은 미구현이다 (실행 시작은 REST `POST /workflows/:id/execute` — 그 REST 응답이 `executionId` 를 반환한다). 아래는 향후 WS 시작 경로 도입 시의 ack 형태 _(계획)_.

```json
{
  "type": "execution.start.ack",
  "id": "req-003",
  "payload": {
    "executionId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending"
  }
}
```

**버튼 클릭 응답** (Socket.IO ack callback — `{ event, data }`):

```json
{
  "event": "execution.click_button.ack",
  "data": {
    "success": true,
    "executionId": "uuid",
    "buttonId": "uuid",
    "resumed": true,
    "queued": true
  }
}
```

> 위 wire shape 은 Socket.IO ack callback 의 `{ event, data }` 다 (`handleClickButton` 반환). 아래 §4.2 의 다른 ack 예시들이 보이는 `{ type, id, payload }` 표기는 논리적 형태이며, 실제 4개 continuation 명령 + retry 의 ack 는 모두 `{ event, data: { success, ... } }` 로 반환된다 (success/error 필드는 §4.2 의 "공통 ack" / "성공·실패 ack" 노트 참조).

`queued: boolean` 은 선택 필드 — `true` 면 continuation-queue ([Spec 실행 엔진 §7.4](./4-execution-engine.md#74-분산-실행-multi-instance)) 로 정상 enqueue 됨 (Phase 2 의 "모든 진입점 항상 BullMQ enqueue" 라우팅 원칙 상 정상 publish 는 항상 `true`). `false` 면 publish 단계 실패 (Redis 장애 등) — 재시도 권장. 본 필드는 관측·디버깅 용도이며 클라이언트 routing 결정에 사용하지 않는다.

**공통 ack success payload shape:**

4개 명령 (`click_button` / `submit_form` / `submit_message` / `end_conversation`) 의 ack success payload 는 명령별 식별자만 다르고 `resumed` / `queued` 필드는 동일하다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `executionId` | uuid | 실행 ID (공통) |
| `resumed` | boolean | 재개 성공 여부 |
| `queued` | boolean | continuation-queue 정상 enqueue 여부 (`true` = 정상, `false` = Redis 장애 등 publish 실패) |
| 명령별 식별자 | — | `buttonId` (click_button) / `formData` 없음 (submit_form) / `message` 없음 (submit_message) / — (end_conversation) |

> ack data 에 `nodeId` 는 포함되지 않는다 — 대기 노드는 서버가 lookup 하며 클라이언트는 `executionId` 만으로 ack 를 매칭한다.

**폼 제출 응답 (ack 이벤트명 `execution.form_submitted`):**

> 폼 제출의 ack 이벤트명만 `<명령>.ack` 패턴이 아닌 `execution.form_submitted` 다 (historical artifact — §Rationale 참조).

```json
{
  "type": "execution.form_submitted",
  "id": "req-uuid",
  "payload": {
    "executionId": "uuid",
    "resumed": true,
    "queued": true
  }
}
```

**메시지 전송 응답 (`execution.submit_message.ack`):**

```json
{
  "type": "execution.submit_message.ack",
  "id": "req-uuid",
  "payload": {
    "executionId": "uuid",
    "resumed": true,
    "queued": true
  }
}
```

**대화 종료 응답 (`execution.end_conversation.ack`):**

```json
{
  "type": "execution.end_conversation.ack",
  "id": "req-uuid",
  "payload": {
    "executionId": "uuid",
    "resumed": true,
    "queued": true
  }
}
```

**버튼 클릭 에러 코드:**

| 코드 | 설명 |
|------|------|
| `INVALID_BUTTON_ID` | 존재하지 않는 버튼 ID |
| `INVALID_EXECUTION_STATE` | 실행이 기대 상태가 아님 (`submit_form` / `click_button` / `submit_message` / `end_conversation` 의 `waiting_for_input` 기대 또는 `retry_last_turn` 의 `failed` 기대). WS 전용 코드 — REST 진입점은 422 `INVALID_STATE` ([Spec 에러 처리 §3-error-handling.md](./3-error-handling.md)) 로 표기 (의도적 분리, [실행 엔진 §7.5.1](./4-execution-engine.md#751-publisher-측-사전-검증--invalid_execution_state) 참조) |
| `INTERACTION_TIMEOUT` | 이미 타임아웃이 발생한 상태 |
| `RESUME_CHECKPOINT_MISSING` | (공통) rehydration 시 `NodeExecution.outputData` 가 부재 또는 손상. Execution 은 `cancelled` 로 종결 ([§7.5](./4-execution-engine.md#75-resume-after-restart-rehydration)) |
| `RESUME_FAILED` | (공통) continuation-queue `RESUME_BULLMQ_ATTEMPTS` 소진. Execution 은 `cancelled` 로 종결 |
| `RESUME_INCOMPATIBLE_STATE` | (공통) Multi-turn AI 의 `_resumeCheckpoint` 가 부재(기능 배포 이전 waiting row)·손상(schema drift 로 재구성 실패)·미래 버전(`schemaVersion` 이 현재 코드 지원 버전 초과 — 롤링 배포 중 구 인스턴스가 신 포맷 pickup, [실행 엔진 §1.3/§7.5](./4-execution-engine.md#75-resume-after-restart-rehydration)). Execution 은 `cancelled` 로 종결 — 채널은 graceful "세션 만료" 안내. 정상 경로(checkpoint 존재 + 버전 호환)는 재구성 재개되어 미발생 |

> 위 표의 마지막 3개 코드 (`RESUME_*`) 는 `execution.submit_form` / `execution.click_button` / `execution.submit_message` / `execution.end_conversation` 의 ack 에 공통 적용된다. **`execution.retry_last_turn` 은 적용 대상 아님** — retry_last_turn 은 동일 nodeId 의 새 NodeExecution row spawn 경로이며 rehydration 경로를 타지 않는다 (전용 코드는 `RETRY_STATE_NOT_FOUND` / `NODE_NOT_RETRYABLE` / `RETRY_TOO_EARLY` 참조).

> **실패 ack 형태**: `execution.submit_form` / `click_button` / `submit_message` / `end_conversation` 의 실패 ack payload 는 `{ success: false, error: string, errorCode?: string }` 다. `errorCode` 는 위 표의 코드(`INVALID_EXECUTION_STATE` 등)를 담는 **평면 필드** — 기존 `error`(사람용 메시지 문자열)와 하위 호환되도록 형제 필드로 추가됐다. `execution.retry_last_turn` 의 nested `error: { code, message }` 와 계층이 다른 것은 의도된 분리다: 4개 continuation 명령은 도입 시점부터 평면 `{ success, error }` 를 써 왔고 `errorCode` 는 그 위의 additive 확장이다 (publisher 측 동기 검증 — [실행 엔진 §7.5.1](./4-execution-engine.md#751-publisher-측-사전-검증--invalid_execution_state)).

**`execution.retry_last_turn` ack:**

기존 `execution.click_button.ack` 의 `resumed` flag 패턴 + 실패 시 `error` 객체 추가.

```json
{
  "type": "execution.retry_last_turn.ack",
  "id": "req-uuid",
  "payload": {
    "executionId": "uuid",
    "nodeExecutionId": "uuid",
    "resumed": true
  }
}
```

실패 응답:

```json
{
  "type": "execution.retry_last_turn.ack",
  "id": "req-uuid",
  "payload": {
    "executionId": "uuid",
    "nodeExecutionId": "uuid",
    "resumed": false,
    "error": { "code": "RETRY_STATE_NOT_FOUND", "message": "..." }
  }
}
```

> `nodeId` 가 ack 에 포함되지 않는 이유: 클라이언트가 송신 시 `nodeExecutionId` 만 보내며 ack 도 동일 식별자만 echo 한다. `nodeId` 는 `nodeExecutionId` 로 backend lookup 가능하므로 redundant.

> **`success` 필드**: socket.io ack-callback 으로 반환되는 실제 payload 는 4개 continuation 명령(`submit_form`/`click_button`/`submit_message`/`end_conversation`)과 동일하게 `success: boolean` 형제 필드를 포함한다 — 성공 `{ success: true, executionId, nodeExecutionId, resumed: true }`, 실패 `{ success: false, executionId, nodeExecutionId, resumed: false, error: { code, message } }`. 위 envelope 예시는 의미 구조를 보인 것이고, `success` 는 continuation-ack 공통 convention (§307 의 평면 `{ success, error }` 패턴)을 따른다. retry 는 실패 시 평면 `errorCode` 대신 nested `error: { code, message }` 를 쓰는 것만 다르다.

**`execution.retry_last_turn` 에러 코드:**

| 코드 | 설명 |
|------|------|
| `RETRY_STATE_NOT_FOUND` | `NodeExecution.outputData._retryState` 가 DB 에 없거나 만료됨 (`expiresAt` TTL 초과, 또는 이미 다른 retry 가 소비). 이 코드는 `_retryState` DB row 의 만료/부재를 의미하며 별도 token 필드는 payload 에 존재하지 않는다 |
| `NODE_NOT_RETRYABLE` | 해당 노드의 `output.error.details.retryable === false` 또는 노드가 retryable error 로 종결되지 않음 (예: 정상 종결, condition 종결) |
| `RETRY_TOO_EARLY` | `output.error.details.retryAfterSec` 카운트다운 종료 전 호출 — 서버측 enforcement. 클라이언트가 disabled 처리하면 정상적으로는 발생 안 함 |
| `INVALID_EXECUTION_STATE` | 대상 `NodeExecution` 이 `FAILED` 상태가 아니거나 Execution 이 retry 진입 가능 상태가 아님 (사전 검증 실패). 기존 continuation 명령의 동일 코드와 의미 공유 (기대 상태만 다름 — retry 는 `FAILED` 기대) |

**`_retryState` 소비 원자성·TTL (구현 계약):**

- **단일 소비 (atomic consume)**: retry 처리는 `nodeExecutionId` 로 `_retryState` 를 조회하고, **동일 트랜잭션 안에서** `NodeExecution.outputData` 에서 `_retryState` 키를 제거(JSONB `-` 연산, null-set) 하면서 새 `NodeExecution` row 를 spawn 한다. 키 제거가 affected=1 인 쪽만 진행 — 동시 retry 의 중복 spawn 을 차단한다. 한 번 소비되면 후속 retry 는 `RETRY_STATE_NOT_FOUND`.
- **TTL**: `_retryState.expiresAt` (ISO 8601). 기본 60분, 환경변수 `AI_RETRY_STATE_TTL_MINUTES` 로 override. `now > expiresAt` 이면 `RETRY_STATE_NOT_FOUND`. 만료된 미소비 `_retryState` 는 row 의 `outputData` 안에 남아있다가 (별도 cleanup job 없음 — row 수명에 종속) 다음 retry 시도 시 만료 판정으로 거부된다.
- **Continuation Bus 경유 (worker handoff)**: WS gateway(다른 인스턴스 가능)는 turn 을 동기 재개할 수 없다 — 재진입은 live `ExecutionContext` rehydrate + `processAiResumeTurn`(단발 turn 처리기) 재개가 필요한 **execution worker 컨텍스트**에서만 가능하다. 따라서 retry 는 검증·atomic consume·새 row spawn 후 continuation 큐(`execution-continuation`)에 **새 job type (`retry_last_turn`)** 을 publish 해 worker 로 handoff 한다. worker processor 가 그 job 을 받아 spawn 된 row 를 `_retryState`(→ `_resumeState` shape) 로 seed 한 채 `processAiResumeTurn`(retryReentry)으로 재진입시킨다. (기존 `submit_message` 등 continuation 명령과 동일한 WS→worker 브리지를 재사용하되, 대기중 row 재개가 아닌 **새 row 재개**라는 점만 다르다.)
- **replay 중 cancel**: replay turn 진행 중 외부 cancel 신호(`execution.cancel`)가 도달하면 진행 중 turn 을 조기 종료하고 Execution 을 `cancelled` 로 마감한다 — `execution.cancelled` 이벤트가 발사되며 `execution.completed` / `execution.failed` 는 발사되지 않는다. 이는 정상 multi-turn 의 "입력 대기 중 cancel" 과 동일 의미의 대칭 보장이다 (replay 는 입력 대기 없이 즉시 turn 을 돌리므로 별도 cancel 경로 필요). `cancelled` 페이로드의 분류는 일반 사용자 취소와 동일하게 다룬다.
- **재진입 종결 후 graph 진행**: 재진입한 turn 이 성공 종결되면 spawn 된 NodeExecution 은 일반 노드 `COMPLETED` 와 동일하게 출력 포트의 downstream 노드로 그래프 진행이 이어진다 — [실행 엔진 §1.1 Execution 상태](./4-execution-engine.md#11-execution-상태) 의 종결 규칙 + [§2.1 토폴로지 traversal](./4-execution-engine.md#21-토폴로지-정렬-기반-실행-순환-참조-지원). 재진입이 실패하면 일반 노드 `FAILED` 와 동일하게 종결 (Execution 도 `FAILED` 마감). 워크플로 Re-run ([§13 replay-rerun](./13-replay-rerun.md)) 과 구분되는 점은 "동일 Execution 안 노드 단위 재진입" 이며 "downstream traversal 차단" 이 아니다. AI Agent 본문은 [§7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트) + [§12.8](../4-nodes/3-ai/1-ai-agent.md#128-retry_last_turn-성공-후-downstream-graph-진행) 참조.

### 4.4 사용자 입력 대기 이벤트 상세 (`execution.waiting_for_input`)

`interactionType` 필드로 Form 노드와 버튼 Presentation 노드를 구분한다.

**Form 노드 (`interactionType: "form"`):**

```json
{
  "type": "execution.waiting_for_input",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "nodeType": "form",
    "interactionType": "form",
    "formConfig": {
      "title": "Approval Request",
      "description": "Please review...",
      "fields": [ ... ],
      "submitLabel": "Submit",
      "timeout": 300
    }
  }
}
```

**버튼 Presentation 노드 (`interactionType: "buttons"`):**

```json
{
  "type": "execution.waiting_for_input",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "nodeType": "carousel",
    "interactionType": "buttons",
    "buttonConfig": {
      "buttons": [
        { "id": "uuid-1", "label": "승인", "type": "port", "style": "primary" },
        { "id": "uuid-2", "label": "상세보기", "type": "link", "url": "https://...", "style": "outline" }
      ],
      "nodeOutput": {
        "config": { "items": [ "..." ], "buttonConfig": { "...": "..." } },
        "output": { "items": [ "..." ] },
        "status": "waiting_for_input"
      }
    }
  }
}
```

| 필드 | 설명 |
|------|------|
| `interactionType` | `form`: Form 노드, `buttons`: 버튼이 설정된 Presentation 노드, `ai_conversation`: AI Agent Multi Turn 일반 대화, `ai_form_render`: AI Agent 가 `render_form` 도구 호출로 사용자 form 제출 대기 ([Spec AI Agent §6.1.d.ii](../4-nodes/3-ai/1-ai-agent.md#61-single-turn-모드-mode--single_turn)) |
| `formConfig` | **`interactionType = form` 한정** top-level 필드. 그래프 Form 노드의 폼 설정. `ai_form_render` 의 경우 top-level 에는 없고 `conversationConfig.pendingFormToolCall.formConfig` 위치로 nest (아래 행) — UI 가 form payload 출처를 단일 위치에서 읽도록 SoT 정리 |
| `buttonConfig` | `interactionType = buttons` 시 존재. 버튼 정의 + 노드 렌더링 출력 (`{ buttons, nodeOutput }`). 버튼 클릭까지 무제한 대기 — 타임아웃 필드 없음 ([Presentation 공통 §3·§6.1](../4-nodes/6-presentation/0-common.md)) |
| `buttonConfig.nodeOutput` | 노드의 구조화 출력 (`NodeHandlerOutput`: `{ config, output, meta?, port?, status }`). 클라이언트가 콘텐츠 + 버튼을 함께 표시. 노드 종류는 상위 `payload.nodeType` 로 식별 — `nodeOutput` 에 `type` 판별자 래퍼는 두지 않는다 ([node-output.md Principle 1.1.4](../conventions/node-output.md)) |
| `conversationConfig` | `interactionType ∈ {ai_conversation, ai_form_render}` 시 존재. AI Agent Multi Turn 대화 설정 |
| `conversationConfig.pendingFormToolCall` | **`interactionType = ai_form_render` 한정**. shape `{ toolCallId: string, formConfig: object }` — `toolCallId` 는 UI 가 렌더할 form 페이로드를 식별하는 매칭 키 (submit 시 클라이언트가 되돌려 보내는 필드는 아니다 — §4.2 `submit_form` payload 는 `{ executionId, formData }` 뿐, 서버가 보관한 `pendingFormToolCall` 로 매칭), `formConfig` 는 LLM 페이로드 ∪ `presentationTools[*].defaults` overlay 결과 (form 노드 input schema shape). UI 의 `AssistantPresentationsBlock` 이 assistant turn 의 `presentations[*]` 중 `payload.toolCallId === pendingFormToolCall.toolCallId` 인 form 페이로드를 interactive `DynamicFormUI` 로 렌더 ([Spec AI Agent §6.1.d.ii](../4-nodes/3-ai/1-ai-agent.md#61-single-turn-모드-mode--single_turn) / [§7.4](../4-nodes/3-ai/1-ai-agent.md#74-multi-turn-모드--사용자-입력-대기-status-waiting_for_input)) |

**AI Agent Multi Turn 노드 (`interactionType: "ai_conversation"`):**

```json
{
  "type": "execution.waiting_for_input",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "nodeType": "ai_agent",
    "interactionType": "ai_conversation",
    "conversationConfig": {
      "message": "안녕하세요! 무엇을 도와드릴까요?",
      "messages": [
        { "role": "user", "content": "[from Template] clicked: 시작",
          "source": "injected" },
        { "role": "user", "content": "첫 번째 사용자 메시지",
          "source": "live" },
        { "role": "assistant", "content": "안녕하세요! 무엇을 도와드릴까요?",
          "source": "live" }
      ],
      "turnCount": 1,
      "maxTurns": 20
    }
  }
}
```

**사용자 메시지 전송 (`execution.submit_message`):**

```json
{
  "type": "execution.submit_message",
  "id": "req-uuid",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "message": "주문 상태를 확인해주세요"
  }
}
```

**AI 응답 이벤트 (`execution.ai_message`):**

서버가 LLM 응답을 처리한 후 클라이언트에 전달하는 이벤트. 종료 조건 미충족 시 `execution.waiting_for_input`이 다시 발송된다. `waiting_for_input` 으로 이어지는 진행 중 emit 과 대화 종료 후 final emit 두 분기 모두 동일 shape 으로 직렬화한다.

**페이로드 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `executionId` | uuid | 실행 ID |
| `nodeId` | uuid | 응답을 발생시킨 AI 노드 ID |
| `message` | string | 어시스턴트 응답의 사용자 표시용 텍스트 |
| `turnCount` | number | 현재까지의 user→assistant 사이클 수 |
| `messages` | object[] | system 을 제외한 user / assistant / tool 메시지 권위 스냅샷 |
| `messages[].source` | `'live' \| 'injected'` | 각 메시지 origin 식별 — `live` 는 이번 emit 을 일으킨 AI 노드가 직접 처리/생성한 메시지, `injected` 는 ConversationThread 자동 주입으로 prepend 된 컨텍스트 메시지. 디버깅 타임라인의 turn 매칭이 backend `turnCount` 와 정합을 유지하기 위한 필수 정보. 자세한 정의는 §4.4.6 |
| `metadata.model` | string? | 마지막 호출에 사용된 모델 식별자 |
| `metadata.inputTokens` | number? | **대화 전체 누적** 입력 토큰 (해당 턴 단독 아님) |
| `metadata.outputTokens` | number? | **대화 전체 누적** 출력 토큰 |
| `llmCalls` | object[]? | 해당 턴에서 발생한 모든 LLM 호출(tool loop 포함). 디버깅 타임라인의 Response/Request/LLM Usage 탭이 어시스턴트 메시지 단위로 매칭하기 위해 사용 |
| `llmCalls[].requestPayload` | unknown? | LLM provider 에 보낸 raw 요청 (messages, tools, params 포함) |
| `llmCalls[].responsePayload` | unknown? | LLM provider 가 반환한 raw 응답 (content, model, usage, stopReason 등) |
| `llmCalls[].durationMs` | number? | **단일 LLM 요청** 소요시간 |
| `llmCalls[].startedAt` | ISO8601 string? | 해당 LLM 호출을 **발신한 절대 시각**. 디버깅 타임라인이 어시스턴트 메시지(= tool-call 만 있는 응답 포함)의 발생 시각을 표시하는 1차 출처. `durationMs` 와 함께 `finishedAt = startedAt + durationMs` 관계를 만족한다 (engine 이 둘 다 직접 측정해 ms 단위 미세 차이 가능) |
| `llmCalls[].finishedAt` | ISO8601 string? | 해당 LLM 호출 응답을 **수신한 절대 시각** |
| `durationMs` | number? | **턴 전체** 소요시간 (모든 LLM 호출 + tool 실행 합) |
| `presentations` | PresentationPayload[]? | AI Agent 가 `render_*` 표현 도구 ([Spec AI Agent §4.1](../4-nodes/3-ai/1-ai-agent.md#41-presentation-tool-family-render_)) 를 호출한 turn 에서만 동봉. `ai_assistant` ConversationTurn 의 top-level `presentations[]` snapshot. type 정의의 단일 진실은 [Spec AI Agent §7.10](../4-nodes/3-ai/1-ai-agent.md#710-presentation-payload-render_-운반). 클라이언트가 chat UI 에서 텍스트와 함께 inline 렌더 |

> **`llmCalls[].requestPayload` / `responsePayload` 는 raw 디버그 payload** 다 — LLM provider 와의 원본 요청/응답(시스템 프롬프트·대화 이력·tool 정의·사용자 입력 등 민감 데이터 포함 가능)을 운반하며, 에디터의 디버깅 타임라인(Response/Request/LLM Usage 탭) 같은 **개발자·에디터 surface** 전용이다. 따라서 `llmCalls` 는 **워크스페이스 인증·ownership 으로 게이트된 내부 WebSocket 채널(`execution:{executionId}`)에만 전달**되고, **모든 외부 fanout 수신자 — external-interaction SSE 스트림(`iext_*`/`itk_*` 토큰으로 인증), notification webhook, chat-channel 아웃바운드(텔레그램·web-chat 등) — 에서는 strip 된다.** 즉 채널 end-user 클라이언트는 최종 assistant 텍스트/`presentations` 만 받고 raw debug payload 는 받지 않는다. (strip 대상은 본 WS 이벤트 필드뿐이며, DB 영속 경로 `NodeExecution.output_data.meta.turnDebug[i].llmCalls` 및 그를 출처로 하는 실행 이력 디버그 패널은 영향 없다.) 설계 근거는 본 문서 ## Rationale 의 "`ai_message.llmCalls[]` 외부 수신자 strip" 항목 참조.

```json
{
  "type": "execution.ai_message",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "message": "주문번호 ORD-12345는 현재 배송 중입니다.",
    "turnCount": 2,
    "messages": [
      { "role": "user", "content": "[from Template] clicked: 시작",
        "source": "injected" },
      { "role": "user", "content": "주문 ORD-12345 확인해줘",
        "source": "live" },
      { "role": "assistant", "content": "주문번호 ORD-12345는 현재 배송 중입니다.",
        "source": "live" }
    ],
    "metadata": {
      "model": "claude-sonnet-4-6",
      "inputTokens": 512,
      "outputTokens": 128
    },
    "llmCalls": [
      {
        "requestPayload": { "messages": [ ... ], "tools": [ ... ] },
        "responsePayload": { "content": "...", "model": "...", "usage": { ... } },
        "durationMs": 842,
        "startedAt": "2026-05-10T06:42:01.500Z",
        "finishedAt": "2026-05-10T06:42:02.342Z"
      }
    ],
    "durationMs": 842
  }
}
```

**사용자 발화 조기 노출 이벤트 (`execution.user_message`):**

엔진이 사용자 메시지를 수신해 multi-turn 노드를 재개하는 시점(= [Spec AI Agent §7.5](../4-nodes/3-ai/1-ai-agent.md#75-multi-turn-모드--사용자-메시지-수신-status-resumed-transient) 의 `message_received` resume tick, **다음 턴 LLM 호출 전**)에 1회 emit. 목적은 **사용자 발화(q)가 AI 응답(a) 생성 전에 라이브 대화 surface 에 즉시 노출**되도록 하는 것 — WS `submit_message` 와 채널 텍스트 인바운드(텔레그램 등)의 공통 재개 chokepoint 에서 발화하므로 채널 출처 메시지도 자동 커버한다.

**페이로드 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `executionId` | uuid | 실행 ID |
| `nodeId` | uuid | 메시지를 수신한 AI 노드 ID |
| `nodeExecutionId` | uuid | **이 시점에 `waiting_for_input` 상태였던 NodeExecution row 의 PK**. dedup / reconcile 시 turn row 식별자. (`waiting_for_input` row lookup 은 [Spec 실행 엔진 §7.5 / §1.3](./4-execution-engine.md) 의 `execution_id + node_id + status='waiting_for_input'` 단일 매칭과 동일 row) |
| `message` | string | 사용자가 보낸 발화 본문. **[Spec Presentation 공통](../4-nodes/6-presentation/0-common.md) 의 `ButtonDef.userMessage`(버튼 클릭 발화 텍스트)와 무관** |
| `receivedAt` | ISO8601 string | 엔진이 메시지를 수신한 시각. [Spec AI Agent §7.5](../4-nodes/3-ai/1-ai-agent.md) `output.interaction.receivedAt` 과 **같은 수신 tick** (engine 과 handler 가 각각 생성해 ms 단위 차이 가능 — dedup 은 본 필드 단독, reconcile 은 `ai_message` content 기준이라 정확한 일치에 의존하지 않음) |

```json
{
  "type": "execution.user_message",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "nodeExecutionId": "uuid",
    "message": "주문 ORD-12345 확인해줘",
    "receivedAt": "2026-05-10T06:42:01.123Z"
  }
}
```

> **위치/시맨틱 구분**: 본 WS 페이로드는 [Spec AI Agent §7.5](../4-nodes/3-ai/1-ai-agent.md) 의 `NodeHandlerOutput.interaction.data`(`message_received` shape, [node-output Principle 4.5](../conventions/node-output.md#45-interactiondata-payload-규격))와 **별개의 표면**이다 — 후자는 observability/run-history 기록용 핸들러 출력 스냅샷, 전자는 라이브 대화 UI 용 경량 신호. 동일 수신 이벤트의 두 전송이며 `receivedAt` 값을 공유한다.
>
> **dedup 단일 진실**: 클라이언트는 `receivedAt` 을 1차 dedup 키로 사용해 optimistic `ai_user` bubble 의 중복 노출을 막는다. 후속 `ai_message.messages` 권위 스냅샷의 마지막 `source:'live'` user 메시지와의 매칭은 fallback 경로다 ([Spec Conversation Thread §9.7](../conventions/conversation-thread.md#97-ws-이벤트--store-변환-계약)).

**대화 종료 요청 (`execution.end_conversation`):**

```json
{
  "type": "execution.end_conversation",
  "id": "req-uuid",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid"
  }
}
```

**Tool 호출 시작 (`execution.tool_call_started`):**

AI Agent 가 provider tool(KB·MCP 등)을 실행하기 직전에 발송한다. 디버깅 타임라인은 이 이벤트로 pending 상태의 tool 항목을 즉시 표시해 사용자에게 진행 상황을 보여준다. `arguments` 는 LLM 이 생성한 JSON 문자열 그대로 (parse 책임은 클라이언트). `startedAt` 은 tool 실행을 **시작한 절대 시각**(ISO8601) 으로, 타임라인이 라이브뿐 아니라 turn 종료 후 영속(`meta.turnDebug[].toolCalls[].startedAt`) 으로도 동일 시각을 복원하도록 동봉된다.

```json
{
  "type": "execution.tool_call_started",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "turnIndex": 1,
    "toolCallId": "call_abc123",
    "name": "kb_workspace_main",
    "arguments": "{\"query\":\"오늘의 날씨\"}",
    "startedAt": "2026-05-10T06:42:03.100Z"
  }
}
```

**Tool 호출 완료 (`execution.tool_call_completed`):**

provider tool 실행이 끝나면 (성공·실패 무관) 발송한다. `status` 는 `success` 또는 `error`. 실패 시에도 핸들러는 LLM 에 에러 content 를 넘겨 회복 기회를 주므로 turn 자체는 계속 진행된다 — UI 는 이 이벤트로 항목을 success / error 상태로 전환한다. `startedAt`(= 대응 `tool_call_started.startedAt`) / `finishedAt` 은 tool 실행의 시작·종료 절대 시각(ISO8601) 으로, `meta.turnDebug[].toolCalls[]` 에도 동일하게 영속되어 실행 내역 화면이 라이브와 같은 시각을 표시한다.

```json
{
  "type": "execution.tool_call_completed",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "turnIndex": 1,
    "toolCallId": "call_abc123",
    "content": "{\"results\":[...]}",
    "status": "success",
    "durationMs": 1240,
    "startedAt": "2026-05-10T06:42:03.100Z",
    "finishedAt": "2026-05-10T06:42:04.340Z"
  }
}
```

실패 예시:

```json
{
  "type": "execution.tool_call_completed",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "turnIndex": 2,
    "toolCallId": "call_def456",
    "content": "{\"error\":\"MCP server timeout\"}",
    "status": "error",
    "error": "MCP server timeout",
    "durationMs": 30000,
    "startedAt": "2026-05-10T06:42:05.000Z",
    "finishedAt": "2026-05-10T06:42:35.000Z"
  }
}
```

> **Reconciliation**: `tool_call_started` / `tool_call_completed` / `user_message` 가 손실되어도 turn 종료 시 도착하는 `execution.ai_message` 의 `messages` 스냅샷과 `meta.turnDebug[].toolCalls` 가 권위적이다. 클라이언트는 tool 항목은 `toolCallId`, optimistic user bubble 은 `receivedAt` 을 키로 dedup 한다. 단, 클라이언트가 직접 발화해 송신 즉시 표시한 동일 발화 bubble 이 이미 있으면 `user_message` 는 새 bubble 을 append 하지 않고 기존 bubble 에 `receivedAt` 을 stamp 해 reconcile 한다 (`receivedAt` 은 이후 재emit 의 dedup 키로 계속 동작). 즉 `user_message` 는 q 의 조기 노출(라이브 UX)만 담당하고, 영속/이력 정합은 `ai_message` 스냅샷이 보장한다.
>
> **요소별 발생 시각·소요시간 영속**: `llmCalls[].startedAt`/`finishedAt` 와 `toolCalls[].startedAt`/`finishedAt` 는 라이브 WS 이벤트뿐 아니라 `meta.turnDebug[]` JSON(= `NodeExecution.output_data`) 에도 동봉 영속된다. 따라서 실행 내역 화면(라이브 이벤트 없이 영속 스냅샷에서 재구성)도 어시스턴트 응답·tool 실행의 절대 발생 시각을 라이브와 동일하게 표시한다. user 발화 시각은 `receivedAt`, presentation/system turn 은 `ConversationThread.turns[].timestamp` 가 1차 출처다. 모두 하위호환 optional 이라 미보유 과거 데이터는 시각을 생략(`—`)한다.

#### 4.4.5 Conversation Thread snapshot (`conversationThread`)

`conversationThread` 는 모든 `interactionType` (form / buttons / ai_conversation) 의 payload 에 선택적으로 동봉된다. UI 의 라이브 conversation 패널이 워크플로우 실행 도중 누적되는 thread 를 표시할 때 사용한다.

```json
{
  "type": "execution.waiting_for_input",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "interactionType": "ai_conversation",
    "conversationConfig": { },
    "conversationThread": {
      "id": "default",
      "nextSeq": 4,
      "turns": [
        { "seq": 0, "nodeId": "...", "nodeType": "form", "source": "presentation_user", "text": "name=Alice", "timestamp": "..." },
        { "seq": 1, "nodeId": "...", "nodeType": "ai_agent", "source": "ai_user", "text": "주문 상태 확인해줘", "timestamp": "..." },
        { "seq": 2, "nodeId": "...", "nodeType": "ai_agent", "source": "ai_assistant", "text": "어떤 주문 번호인가요?", "timestamp": "..." },
        { "seq": 3, "nodeId": "...", "nodeType": "ai_agent", "source": "ai_user", "text": "ORD-12345", "timestamp": "..." }
      ],
      "totalChars": 142
    }
  }
}
```

| 필드 | 설명 |
|------|------|
| `conversationThread.id` | v1 은 항상 `"default"` |
| `conversationThread.nextSeq` | `turns.length` 와 동일 |
| `conversationThread.turns[i]` | [Spec Conversation Thread §1.2](../conventions/conversation-thread.md#12-conversationturn) 의 ConversationTurn |
| `conversationThread.totalChars` | 누적 char 길이 (cap 빠른 경로 — 클라이언트 표시 시 무시 가능) |

> Background 본문은 격리된 thread 를 갖는다 — main 흐름의 `EXECUTION_WAITING_FOR_INPUT` payload 에는 background turn 이 포함되지 않는다 ([Spec Conversation Thread §3.2](../conventions/conversation-thread.md#32-background-격리-근거)).

#### 4.4.6 `messages[].source` 마커

`waiting_for_input.conversationConfig.messages` 와 `ai_message.messages` 의 각 항목은 다음 두 값 중 하나의 `source` 마커를 갖는다.

> **명확화**: 이 마커는 WebSocket 페이로드 전용 2값 표식이며, 백엔드 내부의 `ConversationTurnSource` (5값 enum, [Conversation Thread §1.1](../conventions/conversation-thread.md#11-conversationturnsource)) 와는 별개의 개념이다. 내부 5값은 emit 단계에서 아래 매핑으로 2값으로 축약된다.

| 값 | 의미 |
|---|---|
| `live` | 이번 emit 을 일으킨 AI 노드가 현재 실행 turn 에서 실제로 처리/생성한 메시지. `processMultiTurnMessageInner` 가 push 한 user / assistant / tool 메시지, single-turn 의 userPrompt → 최종 assistant 등이 모두 여기에 해당. |
| `injected` | `ConversationThread` 자동 주입 (`contextScope: 'thread' \| 'lastN'`) 또는 명시 `$thread` 사용으로 messages 배열 앞에 prepend 된 컨텍스트 메시지. 업스트림 노드의 turn 이 [Conversation Thread §5.1](../conventions/conversation-thread.md#51-messages-모드-매핑) 매핑으로 변환된 결과. |

**ConversationTurnSource → `source` 매핑:**

| ConversationTurnSource (내부 5값) | emit 시 `source` | 비고 |
|---|---|---|
| `presentation_user` | `injected` | 업스트림 Form/Carousel/Template 등의 turn. `[from <nodeLabel>] ` prefix 가 붙은 `role: 'user'` 메시지. |
| `ai_user` (업스트림 다른 AI Agent) | `injected` | injection 경로로 prepend 된 다른 AI Agent 의 사용자 turn. |
| `ai_user` (자기 노드의 처리 결과) | `live` | `processMultiTurnMessageInner` 가 push 한 현재 사용자 메시지. |
| `ai_assistant` (업스트림 다른 AI Agent) | `injected` | injection 경로로 prepend 된 다른 AI Agent 의 어시스턴트 turn. |
| `ai_assistant` (자기 노드의 turn 결과) | `live` | 현재 노드가 LLM 호출로 생성한 어시스턴트 응답. |
| `ai_tool` (업스트림) | `injected` | injection 으로 prepend 된 tool 결과 (`includeToolTurns: true` 한정). |
| `ai_tool` (자기 노드의 tool loop) | `live` | 현재 turn 의 tool 호출 결과. |
| `system` | (해당 없음) | system 메시지는 `buildConversationConfigFromOutput` 에서 필터링되어 emit 페이로드에 포함되지 않는다. |

> 핵심 분기 기준: **emit 페이로드 생성 시점에 해당 메시지가 "이번 emit 을 일으킨 AI Agent 노드 자기가 직접 처리/생성한 것" 이면 `live`, 그 외 (다른 노드 origin 의 thread injection 결과) 는 `injected`**. 같은 ConversationTurnSource (`ai_user`/`ai_assistant`/`ai_tool`) 라도 origin 노드가 자기인지에 따라 마커가 갈린다.

**소비 측 권장 동작:**

- 디버깅 타임라인의 turn 카운팅(`llmCalls[]` 와 어시스턴트 메시지 매칭) 은 `source === 'live'` 인 user 메시지만 세야 backend `turnCount` 와 일치한다.
- 대화 UI (conversation Preview 탭, conversation timeline) 는 emit messages 가 아닌 `waiting_for_input.conversationThread.turns` snapshot (§4.4.5) 을 1차 소스로 사용한다. source 별 시각 매핑은 [Spec Conversation Thread §9](../conventions/conversation-thread.md#9-미리보기-ui-렌더-규칙) 의 강제 규약을 따른다 — `injected` chip 표시는 "권장" 이 아니라 §9.2 의 3중 신호(아이콘 + 컨테이너 형식 + chip) 동시 적용이 **필수** 다. LLM debug 패널 (Request / Response / LLM Usage) 만 emit messages 의 raw payload 를 사용하며, 이때도 "Raw payload" 토글로 명시한다 (§9.3·§9.4).
- `source` 필드가 누락된 경우 (옛 backend / 옛 DB 영속 페이로드 호환) `'live'` 로 간주한다 — 이력 재구성 경로 (`parseHistoryMessages`) 도 동일.
- **라이브 조기 노출**: live 대화 timeline 은 `execution.user_message` (위 §4.4) 수신 즉시 optimistic `ai_user` bubble 을 append 해 사용자 발화(q)를 AI 응답(a) 생성 전에 보여주고, 후속 `execution.ai_message.messages` 권위 스냅샷으로 reconcile 한다. 이 조기 노출은 **라이브 전용 UX 속성**이다 — history 뷰(`parseHistoryMessages(outputData)`)는 turn 완결 후 q+a 가 삽입 순서대로 함께 존재하므로(이미 정상) 별도 조기 노출이 없으며, turn 생성 도중 새로고침 시 노드는 `running` 으로 표시되고 optimistic q 는 복원되지 않는다(스냅샷/`tool_call_started` 진행 신호가 live-only 인 것과 동형).

---

### 4.3 KB 문서 이벤트 (Server → Client)

채널: `kb:{documentId}` (KB ID 가 아니라 **문서 ID** 가 채널 키). payload 에는 `documentId`, `timestamp` (ISO 8601) 가 자동 첨부된다. backend 권위 정의는 `WebsocketService.emitKbEvent` 의 `KbEventType` union (12개).

**임베딩 이벤트 (6개):**

| 이벤트 type | payload | 설명 |
|-------------|---------|------|
| `document:embedding_started` | `{ documentId, knowledgeBaseId }` | processing 시작 |
| `document:embedding_progress` | `{ documentId, progress: number }` | 청크 배치 완료마다 (0~100) |
| `document:embedding_completed` | `{ documentId, chunkCount }` | 완료 |
| `document:embedding_error` | `{ documentId, error: string }` | in-flight 일시 오류 — `_retry` 또는 `_failed` 가 곧 따라온다. 영구 실패 신호로 사용하지 말 것 |
| `document:embedding_retry` | `{ documentId, attempt: number, maxAttempts: number, error: string }` | 일시 오류 후 재시도 큐잉 직전 |
| `document:embedding_failed` | `{ documentId, error: string }` | 재시도 모두 소진 또는 비재시도성 오류로 최종 실패 |

**그래프 추출 이벤트 (6개):** `rag_mode = 'graph'` KB 문서에 대해 동일 채널로 추가 emit.

| 이벤트 type | 설명 |
|-------------|------|
| `document:graph_started` / `_progress` / `_completed` / `_error` / `_retry` / `_failed` | 임베딩 이벤트와 1:1 대응. payload 상세는 [`spec/5-system/10-graph-rag.md §6`](./10-graph-rag.md) 참조 |

상태 전이 및 의미는 [`spec/5-system/8-embedding-pipeline.md §9.2`](./8-embedding-pipeline.md#92-상태-전이) 와 직접 대응된다.

### 4.4 알림 이벤트 (Server → Client) — _계획·미구현_

채널: `notifications:{userId}`

> **미구현 (Planned)**: `notifications:` 채널 prefix 는 gateway 의 `VALID_CHANNEL_PREFIXES` 에 등록되어 구독은 가능하지만, **`notification.new` 를 emit 하는 backend 코드가 없다** (검색 결과 emit 경로 부재). 따라서 현재 이 채널로 전송되는 이벤트는 없다 — 알림 실시간 push 는 향후 항목.

| 이벤트 type | payload | 설명 |
|-------------|---------|------|
| `notification.new` _(계획·미구현)_ | `{ id, type, title, message, resourceType, resourceId }` | 새 알림 (emit 미구현) |

### 4.5 시스템 이벤트

구독 불필요. 연결 전체에 자동 전송.

| 이벤트 type | payload | 설명 |
|-------------|---------|------|
| `auth.token_expired` _(계획·미구현)_ | `{ message }` | 토큰 만료 알림. **backend emit 없음** — 현재 만료는 클라이언트가 `connect_error` 로 감지해 REST refresh + 재연결 (§1.2). `TOKEN_EXPIRED` 는 REST/JWT 검증 에러 코드일 뿐 WS 이벤트로 발행되지 않는다 |
| `system.maintenance` _(계획·미구현)_ | `{ message, scheduledAt }` | 예정된 유지보수 알림. **backend emit 없음** |
| `error` | `{ message }` | 핸드셰이크/연결 레벨 에러. 인증 실패 시 `handleConnection` 이 `{ message }` 를 emit 하고 disconnect 한다 (`{ code, message }` 형태 아님 — `message` 단일 필드) |

### 4.6 외부 표면 매핑 (External Interaction API)

[Spec External Interaction API](./14-external-interaction-api.md) 는 외부 호출자가 WebSocket 대신 REST + SSE + Outbound Notification 으로 동일한 명령·이벤트를 주고받을 수 있게 한다. 두 표면의 의미가 분기되지 않도록 본 §4.6 의 매핑 표가 권위적이며, 외부 spec 의 §11 표는 이 표와 정합해야 한다.

**Client → Server 명령 매핑:**

| 내부 WS 명령 (Client → Server) | 외부 REST 명령 (`POST /api/executions/:id/interact` 의 `body.command`) | 비고 |
|---|---|---|
| `execution.submit_form` | `submit_form` | body 의 `formData` 가 외부에선 `data` |
| `execution.click_button` | `click_button` | 동일 페이로드 |
| `execution.submit_message` | `submit_message` | 동일 페이로드 |
| `execution.end_conversation` | `end_conversation` | 동일 페이로드 |
| `execution.retry_last_turn` | (외부 미노출 — 향후 노출 예정) | 내부 UI 한정. 외부 노출 시 토큰 권한·Notification 정합·retry 횟수 제한 별도 결정 필요 (상세: §4.2 참조). |
| `execution.stop` | `cancel` (또는 `POST /api/executions/:id/cancel` alias) | force 옵션은 외부에서 미지원 |
| `execution.start` | (외부 미지원) | 외부는 webhook 트리거로 실행 시작 |
| `execution.continue` / `execution.step` | (외부 미지원) | 디버깅 전용, UI/내부 한정 |
| `auth.refresh` | (해당 없음) | 외부는 단명 `iext_*` 갱신 전용 엔드포인트 (`/refresh-token`) 사용 |
| `subscribe` / `unsubscribe` | (해당 없음) | 외부는 execution 토큰 자체가 implicit 구독 |

**Server → Client 이벤트 매핑:**

| 내부 WS 이벤트 (Server → Client) | SSE event 이름 (`/api/executions/:id/stream`) | Outbound Notification `type` |
|---|---|---|
| `execution.started` | `execution.started` | — (외부 구독 불가, 노이즈) |
| `execution.node.started` | `execution.node.started` | — |
| `execution.node.completed` | `execution.node.completed` | — |
| `execution.node.failed` | `execution.node.failed` | — |
| `execution.node.skipped` | `execution.node.skipped` | — |
| `execution.node.cancelled` | `execution.node.cancelled` | — |
| `execution.paused` _(계획·미구현)_ | `execution.paused` | — (디버깅 전용) |
| `execution.waiting_for_input` | `execution.waiting_for_input` | `execution.waiting_for_input` |
| `execution.resumed` (transient) | `execution.resumed` | — (transient, notification 미발송) |
| `execution.user_message` | `execution.user_message` | — (라이브 조기 노출 신호, `tool_call_*` 동형 — notification 미발송) |
| `execution.ai_message` | `execution.ai_message` | `execution.ai_message` (옵션 구독) |
| `execution.tool_call_started` | `execution.tool_call_started` | — |
| `execution.tool_call_completed` | `execution.tool_call_completed` | — |
| `execution.completed` | `execution.completed` | `execution.completed` |
| `execution.failed` | `execution.failed` | `execution.failed` |
| `execution.cancelled` | `execution.cancelled` | `execution.cancelled` |
| `replay.unavailable` _(계획·미구현)_ | `execution.replay_unavailable` _(계획·미구현)_ | — |

**핵심 규약:**
- **`seq` 동일 공유**: SSE 의 `id:` 필드와 Outbound Notification 페이로드의 `seq` 는 본 spec §2.2 의 monotonic counter 와 같은 값을 사용한다 ([Spec EIA §R7](./14-external-interaction-api.md#r7-seq-동일-공유--sse-와-notification)).
- **5분 버퍼는 SSE 어댑터 소유**: seq 기반 5분 재전송 버퍼는 SSE 어댑터(`external-interaction/sse-adapter.service.ts`)가 자체 보유한다. 외부 클라이언트의 `Last-Event-Id` 가 그 버퍼에서 `seq > Last-Event-Id` 인 이벤트를 재전송한다. native WS 는 별도 버퍼 없이 §6.2 의 `execution.snapshot` 으로 갈음한다 (두 전송이 같은 `seq` 공간을 공유할 뿐, 버퍼 자체는 공유하지 않는다).
- **transaction-after emit**: 본 spec §4.1 의 트랜잭션 commit 후 emit 규약은 SSE / Notification 에도 그대로 적용된다 ([Spec EIA §9.3](./14-external-interaction-api.md#93-트랜잭션과-발송-순서-eia-rl-04)).
- **단일 구현 경로**: 외부 표면은 내부 WebSocket 의 명령/이벤트 처리 경로를 facade 로 감싼 형태로만 구현해야 한다. 두 표면이 분기되면 §R5 가 경고하는 maintenance 부담이 발생.

> 외부 WebSocket 채널 신설은 v1 에서 보류. 보류 사유와 재논의 트리거는 [Spec EIA §R5](./14-external-interaction-api.md#r5-외부-websocket-채널-신설--보류) 참조.

---

## 5. Heartbeat

### 5.1 메커니즘 (Socket.IO 내장 — 구현 현실)

전송 계층 heartbeat 는 **Socket.IO/Engine.IO 내장 ping/pong** 으로 처리된다 (서버가 Engine.IO ping 을 보내고 클라이언트가 pong; 기본 `pingInterval` 25s / `pingTimeout` 20s, gateway 에서 별도 override 없음). 본 spec 초안의 "서버 30s 간격 / 10s pong 타임아웃 / 미응답 시 close 1001" 수치는 raw-WS 전제였고 구현과 다르다.

> **미구현 (Planned)**: raw WebSocket 프로토콜 레벨 Ping/Pong 을 30s/10s 로 직접 운용하고 미응답 시 close code 1001 로 끊는 동작은 구현에 없다 (Socket.IO 가 자체 transport ping 으로 갈음).

### 5.2 애플리케이션 레벨 Ping

구현에는 **클라이언트 → 서버 방향** app-level `ping` 핸들러가 있다 (`@SubscribeMessage('ping')`). 서버는 `pong` ack 를 돌려준다. spec 초안의 "서버 → 클라이언트 ping" 방향과 반대다.

```js
// 클라이언트 → 서버
socket.emit("ping");
// 서버 ack (callback payload)
{ "event": "pong", "data": { "timestamp": 1711706400000 } }
```

> **방향 정정**: 구현은 server-발신 app ping 이 아니라 **client-발신 ping → server pong** 이다 (`handlePing`). 서버가 주기적으로 app `ping` 을 push 하는 경로는 미구현 (Planned).

---

## 6. 재연결 전략

### 6.1 클라이언트 재연결 (Socket.IO 내장)

재연결은 **Socket.IO 클라이언트 내장 reconnection** 으로 처리한다 (`ws-client.ts`: `reconnection: true`, `reconnectionDelay: 1000`, `reconnectionDelayMax: 30000`, `reconnectionAttempts: Infinity`).

| 항목 | 값 (구현) |
|------|-----|
| 재연결 시도 | 자동 (Socket.IO Manager) |
| 백오프 전략 | Socket.IO 내장 지수 백오프 (`reconnectionDelay` 1s → `reconnectionDelayMax` 30s) |
| 지터(Jitter) | Socket.IO 내장 randomizationFactor (기본 0.5) 적용 — spec 초안의 "±500ms" 수치는 Socket.IO 의 비율 기반 지터로 대체 |
| 최대 재시도 | 무제한 (`reconnectionAttempts: Infinity`) |

> 추가로 클라이언트는 첫 `connect_error` 시 1회 REST `/auth/refresh` → `auth.token` 교체 → 명시적 재연결을 시도해 stale token auth race 를 차단한다 (`ws-client.ts`). 구체 backoff sequence (1/2/4/8/16s) 는 spec 초안 값이며 실제는 Socket.IO Manager 의 내장 알고리즘을 따른다.

### 6.2 놓친 이벤트 복구

**native WebSocket 복구 모델 — `execution.snapshot`.** 재연결 후 채널을 다시 구독하면 서버는 해당 execution 의 **현재 전체 상태**를 1회성 `execution.snapshot` 이벤트로 발행한다 (`ExecutionEventType.EXECUTION_SNAPSHOT`, `websocket.gateway.ts`). 클라이언트는 이 스냅샷으로 노드별 최종 상태·terminal 상태를 재동기화한다 — 끊긴 동안의 모든 중간 이벤트를 순서대로 재생하는 대신, 재구독 시점의 권위 있는 현재 상태를 한 번에 받는 방식이다.

```js
// 재구독 — 누락 복구 트리거 (payload 는 channel 만 필요)
socket.emit("subscribe", { channel: "execution:550e8400..." });

// 서버 응답 (1회성 현재 상태 스냅샷 — Socket.IO 이벤트)
// event: "execution.snapshot"
{ "executionId": "550e8400...", "execution": { "status": "running", "nodeExecutions": [ /* ... */ ] }, "timestamp": "2026-..." }
```

> 스냅샷 payload 는 `{ executionId, execution, timestamp }` 다 — `status` / `nodeExecutions[]` 는 `execution` 객체(`ExecutionsService.findById` 반환) 안에 nest 된다 (`emitExecutionSnapshot`). 재구독 시 첫 구독에서만 1회 발행한다 (재구독 중복 emit 방지 — `isNewSubscription` 가드).

**seq 기반 정밀 재전송은 SSE 전송 표면의 메커니즘이다.** 끊긴 구간의 개별 이벤트를 `seq > lastSeq` 단위로 손실 없이 재생하는 경로(5분 버퍼)는 native WS subscribe 명령이 아니라 **SSE 어댑터**가 `Last-Event-Id` 헤더로 제공한다 (§4.6, [Spec EIA §5.2 SSE 이벤트 스트림](./14-external-interaction-api.md)). 즉 5분 버퍼는 SSE 어댑터(`external-interaction/sse-adapter.service.ts`)가 자체 보유하며, native WS 는 위 snapshot 으로 갈음한다.

> **`replay.unavailable` / `execution.replay_unavailable` — 계획(미구현).** 버퍼 만료 시 명시적 만료 신호를 보내는 이벤트는 아직 emit 되지 않는다. 현재는 만료/누락분이 silent drop 되고 클라이언트가 위 `execution.snapshot`(WS) 또는 REST `GET /executions/:id`(폴백)로 현재 상태를 재조회한다. 만료 신호 emit 은 향후 하드닝 항목이다 (EIA §SSE 와 동일).

---

## 7. 에러 처리

### 7.1 에러 코드

**구현 현실** — transport/auth/ownership 실패용 코드는 `ws-error-codes.ts` 의 `WsErrorCode` enum 4개뿐이며, 이들은 주로 `execution.retry_last_turn.ack` 의 nested `error.code` 로 surface 된다. 구독/한도 거부는 코드가 아니라 평문 `error` 문자열로 응답한다 (§3.3·§3.4).

| 코드 | 구현 | 설명 |
|------|------|------|
| `UNAUTHENTICATED` | ✅ | socket 에 userId 없음 |
| `FORBIDDEN` | ✅ (정의) | 권한 없음 (일반). IDOR 차단 핸들러는 존재 추론 방지로 의도적으로 `NOT_FOUND` 사용 |
| `NOT_FOUND` | ✅ | 리소스 부재 또는 소유 검증 실패 (verifyOwnership 통일) |
| `INTERNAL_ERROR` | ✅ | 서버/transport 내부 실패 (enqueue 실패 등) |
| `INVALID_EXECUTION_STATE` | ✅ | continuation 명령의 평면 `errorCode` (§4.2). publisher 사전 검증 실패 |
| `RETRY_*` / `RESUME_*` | ✅ | retry/continuation 도메인 코드 (§4.2). `nodes/core/error-codes.ts` 의 `ErrorCode` enum |
| `INVALID_MESSAGE` _(계획·미구현)_ | 🚧 | JSON 파싱 실패/필수 필드 누락 시 전용 코드 응답 — 미구현 |
| `UNKNOWN_TYPE` _(계획·미구현)_ | 🚧 | 알 수 없는 메시지 type 전용 코드 — 미구현 (Socket.IO 가 미등록 이벤트를 silent drop) |
| `SUBSCRIPTION_LIMIT_EXCEEDED` _(계획·미구현)_ | 🚧 | 한도 초과는 평문 문자열로만 응답 (§3.4) — 전용 코드 미구현 |
| `RATE_LIMITED` _(계획·미구현)_ | 🚧 | WS 명령 빈도 제한 (60 msg/min) 자체가 미구현 |

### 7.2 에러 메시지 형식

명령 ack 의 실패 형태는 Socket.IO ack callback 의 `{ event, data }` 다. continuation 명령(4종)은 평면 `{ success: false, error, errorCode? }`, `retry_last_turn` 은 nested `{ success: false, ..., error: { code, message } }` 를 쓴다 (§4.2). 구독 거부는 `{ event: 'subscribed', data: { success: false, error } }` (§3.3).

```json
// retry_last_turn 실패 ack (nested error.code)
{ "event": "execution.retry_last_turn.ack", "data": { "success": false, "executionId": "...", "nodeExecutionId": "...", "resumed": false, "error": { "code": "NOT_FOUND", "message": "Execution not found" } } }
```

> **미구현 (Planned)**: spec 초안의 독립 `{ type: 'error', id, payload: { code, message } }` 범용 프로토콜 에러 프레임은 발행되지 않는다. 연결 레벨 에러는 §4.5 의 `error` 이벤트(`{ message }`)로만, 명령 에러는 위 ack 형태로만 표면화된다.

---

## 8. WebSocket Close 코드 — _계획·미구현_

> **미구현 (Planned)**: Socket.IO 전송은 raw WebSocket close code (1000/1001/1008/4000/4001 등) 를 애플리케이션 레벨에서 직접 노출하지 않는다. 구현은 인증 실패/오류 시 `error` 이벤트 emit 후 `socket.disconnect()` 를 호출하며, 별도 close-code 매핑 로직이 없다. 클라이언트는 close code 가 아니라 Socket.IO 의 `disconnect` / `connect_error` 이벤트로 재연결을 판단한다 (§6.1). 아래 표는 raw-WS 전제의 향후 설계 _(계획)_ 이며 현 구현과 무관하다.

| 코드 | 설명 | 재연결 |
|------|------|--------|
| 1000 | 정상 종료 | 안 함 |
| 1001 | 서버 종료/유지보수 | 함 |
| 1008 | 인증 실패/토큰 만료 | 토큰 갱신 후 함 |
| 1011 | 서버 내부 오류 | 함 |
| 4000 | Rate Limit 초과 | 30초 후 함 |
| 4001 | 비정상 메시지 반복 | 안 함 |

---

## 9. 클라이언트 구현 가이드

### 9.1 연결 생명주기

```
[초기화] → [연결 시도] → [인증] → [구독] → [이벤트 수신] → [연결 끊김] → [재연결]
                                       ↑                              |
                                       └──────────────────────────────┘
```

### 9.2 권장 구현 패턴

> 아래는 Socket.IO 클라이언트 기준 권장 패턴이다 (프론트 `ws-client.ts`).

1. **연결**: `io(url + '/ws', { auth: { token } })` — Socket.IO 인스턴스 생성 + 토큰 전달
2. **인증 확인**: `connect` 이벤트 수신으로 확인. 실패는 `connect_error` 로 통지된다
3. **구독**: `socket.emit('subscribe', { channel })` → ack callback 의 `data.success` 확인
4. **이벤트 처리**: `socket.on('<event>', handler)` 로 이벤트별 디스패칭 (이벤트명 = §4 의 `type`)
5. **Heartbeat**: Socket.IO 내장 transport ping/pong 이 자동 처리 (§5). app-level `ping` 은 클라이언트가 보내고 서버 `pong` ack 를 받는 선택적 경로
6. **토큰 갱신**: `connect_error` 시 REST `/auth/refresh` 로 새 토큰 → `socket.auth.token` 교체 후 재연결 (§1.3). in-band `auth.refresh` 메시지는 미구현 (Planned)
7. **재연결**: Socket.IO 내장 reconnection 에 위임 (`reconnection: true`) → 재구독 시 1회 수신되는 `execution.snapshot`(현재 상태)으로 재동기화 (§6.2). raw `onclose` 핸들링 불필요
8. **정리**: 페이지 이탈 시 `unsubscribe` + `socket.disconnect()` (raw close code 1000 미사용)

---

## Rationale

### §4.4 `buttonConfig` 예시 정정 — 타임아웃 제거 + `nodeOutput` 판별자 폐지 (2026-06-03 spec-drift 결정 C2·C3)

초기 §4.4 `buttonConfig` 예시는 `timeout: 300` / `timeoutAction: "cancel"` 과 `nodeOutput: { "type": "carousel", ... }` 를 포함했으나, 둘 다 다른 SoT 와 모순되는 **stale 예시** 였다.

- **C2 — 타임아웃 제거**: [Presentation 공통 §3·§6.1](../4-nodes/6-presentation/0-common.md) 은 버튼 클릭까지 "외부 cancel/종료 외에는 무제한 대기" 를 규정하고, 엔진 구현(`waitForButtonInteraction`)도 timeout 타이머 없이 무한 await 한다 (`timeoutAction` 은 코드에 부재). 예시의 `timeout`/`timeoutAction` 만 stale 이었으므로 제거. (대안: 공통 규약에 타임아웃 정책을 정식 도입 — 현 구현·다른 spec 이 모두 무제한 대기라 기각.)
- **C3 — `nodeOutput` 판별자 폐지**: [Presentation 공통 §4](../4-nodes/6-presentation/0-common.md) 의 Principle 1.1.4 (`type` 판별자 래퍼 금지) 에 따라, 엔진은 `buttonConfig.nodeOutput` 으로 노드의 `NodeHandlerOutput`(`{ config, output, meta?, port?, status }`)을 그대로 실어 보낸다 (`nodeOutputForEvent = structured ?? flatNodeOutput`). 노드 종류는 상위 `payload.nodeType` 로 이미 식별되므로 `nodeOutput` 안의 `type` 판별자는 불필요·중복. 예시를 실제 5필드 구조로 교체. (대안: `nodeOutput` 전용 별도 스키마 명시 — Principle 1.1.4 와 충돌해 기각.)
### 전송 계층 정정 — raw WebSocket 프레이밍 → Socket.IO + status partial 강등 (2026-06-03 spec-vs-code audit)

본 spec 초안은 "native/raw WebSocket 프로토콜" 을 전제로 `{ type, id, payload }` 프레임·`Sec-WebSocket-Protocol` 서브프로토콜 인증·`auth.refresh`/`auth.refreshed` in-band 갱신·`execution.start`/`execution.stop` WS 명령·서버발신 30s/10s app ping·raw close code(1000/1001/1008/4000/4001)·`{type:'error',code}` 프레임을 약속했다. 그러나 구현(`websocket.gateway.ts` / `websocket.service.ts` / 프론트 `ws-client.ts`)은 **Socket.IO** (namespace `/ws`) 기반이고, 위 raw-WS 표면 중 다수가 부재하거나 형태가 다르다.

- **정정한 사실 (구현 일치)**: 전송 = Socket.IO; 인증 = `handshake.query.token || handshake.auth.token` (서브프로토콜 경로 없음); 구독 ack = `{ event:'subscribed', data:{ success, channel?, error? } }`; 권한/한도 거부 = 평문 `error` 문자열 (코드 필드 없음); snapshot payload = `{ executionId, execution, timestamp }` (status/nodeExecutions 는 `execution` nest); app ping = client→server (`handlePing`); heartbeat = Socket.IO 내장; 재연결 = Socket.IO 내장 backoff; 토큰 갱신 = REST refresh + 재연결; 서버발신 이벤트 wire = `{ executionId, ...payload, seq, timestamp }` 평면 + 이벤트 이름 분리.
- **미구현 (Planned) 으로 분리한 약속**: 서브프로토콜 인증·`auth.refresh`/`auth.refreshed`·`auth.token_expired` emit·`execution.start`/`stop`/`start.ack` WS 경로·서버발신 app ping·raw close code·`notification.new` emit·`system.maintenance` emit·`INVALID_MESSAGE`/`UNKNOWN_TYPE`/`SUBSCRIPTION_LIMIT_EXCEEDED`/`RATE_LIMITED` 전용 에러 코드·60 msg/min WS rate-limit. 이들은 삭제하지 않고 본문에서 _(계획·미구현)_ 로 표기 분리했다.
- **status 강등**: 본문이 약속한 다수 surface(WS start/stop 명령·auth.refresh·notification.new emit·rate-limit 등)가 코드에 실재 부재하므로 `implemented` → `partial` 로 강등하고 `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 로 추적한다. `code:` 글로브에 백엔드 SoT(`ws-error-codes.ts`)와 프론트 SoT(`ws-client.ts`)를 추가했다.
- **drift 아닌 positive**: §4.2 의 continuation/retry 코드(`INVALID_EXECUTION_STATE`/`RESUME_*`/`RETRY_*`)는 코드와 정합 — 변경 없음.

### 재연결 복구 — native WS 는 snapshot, seq 버퍼-replay 는 SSE 전송 (§6.2)

초기 §6.2 초안은 native WS `subscribe.lastSeq` → 5분 버퍼에서 `seq > lastSeq` 재전송 + 만료 시 `replay.unavailable` 을 약속했으나, 구현은 native WS 에 버퍼를 두지 않고 재구독 시 `execution.snapshot`(현재 전체 상태) 1회 발행으로 수렴했다. 본 spec 을 구현에 맞춰 정정한다.

- **결정**: native WS 복구는 snapshot 모델. seq 단위 정밀 재전송(5분 버퍼)은 SSE 전송 표면(`Last-Event-Id`, `sse-adapter.service.ts`)이 담당한다. 두 전송은 같은 `seq` 공간만 공유하고 버퍼 인스턴스는 공유하지 않는다.
- **근거**: WS 채널의 실사용은 에디터/실행 모니터링 UI 다. snapshot 은 노드별 최종·terminal 상태를 권위 있게 재동기화하므로 재연결 후 화면 복구에 충분하다. 잃는 것은 끊긴 짧은 창의 중간 이벤트(`node.started`·progress·tool 진행) 입자뿐이고, 이는 다음 이벤트/스냅샷으로 곧 수렴한다. native WS 버퍼-replay 를 별도 배선하는 비용(WS room 단위 seq 버퍼 신설 + 분산 다중 인스턴스 fan-out 미해결, SSE 어댑터도 동일 한계)은 그 한계이득에 비해 크다.
- **폐기된 대안**: native WS lastSeq 버퍼-replay 전면 구현 → 분산 환경 미해결·저 ROI 로 보류. 외부 클라이언트용 손실 없는 재전송 요구(EIA-NF-03)는 SSE 버퍼-replay 로 이미 충족된다.
- **잔여(계획)**: 버퍼 만료 신호 `replay.unavailable`/`execution.replay_unavailable` emit 은 미구현 — 현재 만료/누락분은 silent drop 후 snapshot·REST 폴백. 향후 하드닝 시 양 전송에 동시 도입.

### 메시지 origin 마커 도입 — `messages[].source`

`ConversationThread.contextScope` 가 활성화된 AI Agent 는 매 turn `processMultiTurnMessageInner` 직전에 `[system, ...injectedThread, ...selfHistory]` 형태로 messages 배열을 재빌드한다. injected 부분은 업스트림 Presentation 노드 / 다른 AI Agent 의 turn 을 `role: 'user' | 'assistant' | 'tool'` 로 변환한 결과로, payload 의 `messages` 스냅샷에 그대로 포함된다.

이때 frontend 가 messages 를 순회하며 user 개수로 turn 인덱스를 도출하면 backend 의 권위 `turnCount` (= 핸들러가 실제로 처리한 user→assistant 사이클 수) 와 어긋난다. 결과적으로 `llmCalls[]` 와 어시스턴트 메시지를 매칭할 수 없어 Response / Request / LLM Usage 탭이 빈 상태로 표시되는 회귀 발생.

해소책으로 메시지에 `source: 'live' | 'injected'` 마커를 부여하고 소비 측이 `live` 만으로 turn 을 센다. 후속 origin (예: 미래의 system_text 자동 push, multi-thread 머지) 추가 시 enum 값 확장만 하면 되어 확장성이 좋다. (`injectedContextLength: number` 만 동봉하는 안은 messages 배열의 prefix 가 연속된 injection 이라는 가정이 필요해 inline 주입이나 [Conversation Thread §7 v2 로드맵 "Multi-thread"](../conventions/conversation-thread.md#7-v2-로드맵) 의 thread 머지 시나리오에서 깨지고, 어시스턴트 메시지에 `turnIndex` 를 직접 동봉하는 안은 user 메시지 turn 매핑을 해소하지 못한다.)

**영속 정책 (미정)**: 본 spec 은 transport 레이어 (WebSocket emit) 의 `source` 마커 정의에 한정. `NodeExecution.outputData.messages` 의 DB 영속 형태에 `source` 가 동봉될지는 별도 결정 사항이며, 구현 phase 의 backend 작업에서 결정한다. 미동봉으로 진행하더라도 §4.4.6 의 "필드 누락 시 `'live'` 로 간주" 폴백 규약으로 이력 재구성이 안전하게 작동한다. 단, 이력 화면의 디버깅 타임라인이 현재 emit 과 동일 정확도를 가지려면 영속 형태에도 마커가 들어가는 것이 바람직 — 향후 DB 컬럼 신설 ([Conversation Thread §7 v2 로드맵](../conventions/conversation-thread.md#7-v2-로드맵)) 시점에 함께 결정한다.

### KB 채널 단위 전환 — `embedding:{knowledgeBaseId}` → `kb:{documentId}`

KB 임베딩 진행 상태는 **문서 단위 채널** 로 broadcast 한다 (`WebsocketService.emitKbEvent` 의 `KbEventType` union, `kb:${documentId}` 채널). frontend `useKbEvents` 도 동일하게 문서별 구독한다.

문서 단위 채널의 근거:
- 문서별 독립 진행 상태 추적이 가능해 progress UI 가 문서마다 갱신.
- 권한 검증을 문서 소유 KB 단위로 분기하기 쉬움.
- frontend 가 보유한 documentIds 만큼 구독하므로 무관한 KB 이벤트로 인한 노이즈 차단.

이벤트 표기는 콜론+언더스코어(`document:embedding_started`) 를 사용 — backend type union 의 형식과 일치한다. KB 단위 통계 이벤트(`kb:graph_stats_updated` 등) 는 도입하지 않는다.

### `ai_form_render` 의 `formConfig` 위치 단일화 — `pendingFormToolCall` 안으로 nest

§4.4 의 `formConfig` 필드는 그래프 Form 노드 (`interactionType: 'form'`) 의 폼 설정 운반용 top-level 필드다. AI Agent multi-turn 의 `render_form` blocking flow ([Spec AI Agent §6.1.d.ii](../4-nodes/3-ai/1-ai-agent.md#61-single-turn-모드-mode--single_turn)) 에서는 `interactionType: 'ai_form_render'` 의 form payload 를 `conversationConfig.pendingFormToolCall.formConfig` 위치로 nest 한다 (`execution-engine.service.ts:2147-2210` emit, frontend 도 동일 위치에서 read). UI 가 단일 위치에서 form 출처를 읽도록 SoT 를 단일화 — Conversation Thread §9.7 표의 `waiting_for_input (interactionType=ai_form_render)` 행과 정합한다.

`pendingFormToolCall.formConfig` nest 는 `toolCallId` 와 묶여 단일 원자 운반체로 의미가 명확하다.

**근거**: [Spec AI Agent §12.5](../4-nodes/3-ai/1-ai-agent.md#125-render_form-활성-form-의-timeline-인라인-표현-통합).

### `user_message` optimistic bubble 의 stamp-reconcile 분기

`user_message` 는 `receivedAt` 을 dedup 단일 키로 쓴다(§4.4 Reconciliation 노트). 그러나 클라이언트가 **직접** 발화하는 경로에서는 송신 즉시 로컬 optimistic `ai_user` bubble 을 먼저 표시하는데, 이 로컬 bubble 의 타임스탬프는 *클라이언트* 시각이고 후속 `user_message` echo 의 dedup 키는 *서버* `receivedAt` 이라 둘이 불일치한다. 따라서 `receivedAt` 단일 dedup 만으로는 이 로컬 bubble 케이스를 잡지 못해 동일 발화가 두 bubble 로 중복 표시되는 회귀가 났다.

- **결정**: echo 가 동일 발화의 기존 optimistic bubble 을 발견하면 새 항목을 append 하지 않고 기존 bubble 에 `receivedAt` 을 **stamp** 해 reconcile 한다(append 대신). 로컬 bubble 이 없는 경로(채널 텍스트 인바운드 등)에서만 append 한다.
- **근거**: 발신자의 즉시 피드백(로컬 optimistic)과 WS echo 유실 내성을 보존하면서 중복만 제거한다. stamp 이후 `receivedAt` 은 재emit/재구독 dedup 키로 계속 동작하고, 최종 정합은 turn 종료 `ai_message` 스냅샷 REPLACE 가 보장한다(stamp 는 그 보조 선행 단계). frontend 구현 식별자는 [Conversation Thread §9.7.1](../conventions/conversation-thread.md#971-store-reset-정책-실행-lifecycle-별) 방침에 따라 본문에 노출하지 않는다.

### `ai_message.llmCalls[]` 외부 수신자 strip (strip-only 결정)

본 항목은 직전의 "raw payload 운반 (v1, 마스킹 없음)" open item 을 사용자 결정(채널 실사용 + strip-only)으로 확정·대체한다.

디버깅 타임라인이 어시스턴트 메시지 단위로 Request/Response/Usage 를 보여주려면 LLM provider 와의 원본 payload 가 필요하다. 그러나 이 raw payload 는 시스템 프롬프트·대화 이력·tool 정의 등 민감 정보를 담는다.

`execution.ai_message` 는 (1) 워크스페이스 ownership 으로 게이트된 내부 WebSocket 채널과 (2) external-interaction SSE / notification webhook / chat-channel 아웃바운드로 분기되는 fanout 양쪽으로 전달된다. SSE 는 `iext_*`/`itk_*` interaction 토큰만으로 접근 가능하고(워크스페이스 체크 없음) 채널 end-user 클라이언트에 전달되므로, raw payload 를 그대로 흘리면 채널 사용자에게 노출된다.

- **결정 (strip-only)**: `llmCalls` (및 그 안의 `requestPayload`/`responsePayload`) 는 **인증된 내부 WS 채널에만** 포함하고, **fanout(외부) 경로에서는 strip** 한다. 채널 end-user 는 최종 assistant 텍스트/`presentations` 만 받는다. strip 대상은 WS 이벤트 필드뿐이며 DB 영속(`meta.turnDebug[i].llmCalls`)·실행 이력 디버그 패널은 불변.
- **근거**: debug raw payload 는 본질적으로 에디터 전용 관심사다. 외부/채널 수신자는 이를 필요로 하지 않으므로, 단일 fanout seam 에서 제거하면 최소 변경으로 노출을 닫으면서 에디터 디버그 패널은 그대로 유지된다.
- **기각된 대안**: 값-레벨 마스킹은 에디터 디버깅 가치를 훼손하고 부분적이며, 워크스페이스 내 viewer/editor 역할 게이트는 별도 RBAC 확장이 필요해 본 결정 범위를 넘는다. 향후 멀티테넌트 viewer 요구가 명확해지면 재검토한다.

### `execution.retry_last_turn` 의 graph 진행 의미 — Re-run 과의 경계

retry 는 "노드 단위 재시도" 라는 표현 때문에 일부 독자가 "downstream 도 의도적으로 차단" 으로 오독할 여지가 있었으나, spec 의 의도는 워크플로 Re-run ([§13](./13-replay-rerun.md)) 과의 단위 구분 (Execution 단위 vs 노드 단위) 이지 downstream traversal 차단이 아니다. 재진입한 turn 의 성공 후 graph 진행은 일반 노드 `COMPLETED` 와 동일한 워크플로 엔진의 기본 invariant 적용이며, AI Agent [§7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트) + [§12.8](../4-nodes/3-ai/1-ai-agent.md#128-retry_last_turn-성공-후-downstream-graph-진행) 이 동일 결정 근거를 공유한다.

### 요소별 절대 발생 시각·소요시간 노출 — `startedAt`/`finishedAt` 동봉 (2026-06-03)

디버깅 타임라인·실행 내역은 그간 노드/턴 단위 `durationMs` 만 노출했고, 멀티턴 AI 노드 내부 요소(유저 발화·LLM 응답·tool 실행)의 **절대 발생 시각**은 표시하지 못했다. user 발화는 `receivedAt`, presentation/system turn 은 `ConversationThread.turns[].timestamp` 로 이미 시각 데이터가 있었으나, **어시스턴트 LLM 응답과 tool 실행에는 시각 데이터 자체가 없어**(`llmCalls[]`·`toolCalls[]` 가 `durationMs` 만 보유) 프론트 표시 계층만으로는 불가능했다.

- **결정**: `llmCalls[]` 와 `toolCalls[]`(= `tool_call_*` 이벤트) 에 `startedAt`/`finishedAt`(ISO8601) 을 추가한다. 엔진은 이미 `Date.now()` 기반 duration 측정을 위해 시작 시각을 캡처하므로, 그 값을 ISO 로 동봉만 하면 된다. 라이브 WS 이벤트와 `meta.turnDebug[]` JSON 영속 양쪽에 동일하게 싣는다.
- **근거**: (1) DB 마이그레이션 불필요 — `meta.turnDebug` 는 `NodeExecution.output_data` JSONB 내부다. (2) 전부 하위호환 optional — 과거 데이터는 시각을 `—` 로 생략. (3) 라이브/영속 동일 출처라 에디터 디버깅 UI 와 실행 내역 페이지가 같은 절대 시각을 보인다. (4) `durationMs` 와 중복처럼 보이나, duration 만으로는 "언제" 를 복원할 수 없고(턴 사이 대기·공백 미반영) 절대 시각은 파생 추정이 부정확하므로 명시 동봉이 정공법이다.
- **기각된 대안**: node.startedAt + 누적 duration 오프셋으로 시각을 **파생 추정**하는 안은 백엔드 무변경이지만 tool/대기 공백을 반영 못 해 부정확하고, 절대 시각으로 표기 시 오해를 부른다. 라이브 전용 client `new Date()` stamp 안은 영속 실행 내역 페이지에서 시각이 사라져 두 surface 가 불일치한다.

### §4.2 submit_form/click_button payload·ack 정정 — 구현 현실 채택 (2026-06-10 spec-sync audit)

- **정정 내용**: (1) `execution.submit_form` payload 를 `{ executionId, formData }` 로, `execution.click_button` 을 `{ executionId, buttonId }` 로 정정 — 양단 구현(frontend `use-execution-interaction-commands.ts`, backend `websocket.gateway.ts` handler 시그니처) 모두 `nodeId` 를 보내지도 받지도 않는다. 대기 노드 식별은 publisher 측 server lookup (§7.5.1 경로) 이 수행하므로 클라이언트 전달이 불필요하다. (2) 옛 표기의 `toolCallId?` 클라이언트 필드도 제거 — `render_form` 도구 응답 매칭은 클라이언트 전달값이 아니라 서버 보관 `pendingFormToolCall` resume state 로 처리된다. (3) 공통 ack payload 표에서 `nodeId` 행 제거 — 4개 continuation 명령의 ack data 어디에도 `nodeId` 가 없다.
- **폼 제출 ack 이벤트명 `execution.form_submitted`**: `<명령>.ack` 패턴(`execution.click_button.ack` 등)과 달리 폼 제출만 `execution.form_submitted` 를 ack 이벤트명으로 쓴다. 이는 도입 초기 명명이 그대로 양단(backend 반환·frontend listen)에 굳은 **historical artifact** 다. 외부 wire 양단이 이미 합의된 동작 계약이라 rename 은 호환성 파손 대비 이득이 없어, spec 이 구현 현실을 채택해 기록한다 (향후 v2 프로토콜 정리 시 일괄 재검토 대상).
