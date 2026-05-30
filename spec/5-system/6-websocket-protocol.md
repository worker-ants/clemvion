---
id: websocket-protocol
status: spec-only
code: []
---

# Spec: WebSocket 프로토콜

> 관련 문서: [Spec API 규칙 §10](./2-api-convention.md#10-websocket) · [Spec 실행/디버깅 §8](../3-workflow-editor/3-execution.md#8-실행-엔진-통신) · [Spec 실행 엔진](./4-execution-engine.md) · [Spec External Interaction API](./14-external-interaction-api.md)

---

## 1. 연결

### 1.1 엔드포인트

```
wss://{base_url}/ws
```

- 프로토콜: `wss://` (TLS 필수). 개발 환경에서만 `ws://` 허용
- 서버는 WebSocket 핸드셰이크 시 HTTP 업그레이드 요청을 처리

### 1.2 인증

연결 시 JWT Access Token을 전달한다. 두 가지 방식을 지원하며, 우선순위는 (1) → (2) 순이다.

| 방식 | 형태 | 예시 |
|------|------|------|
| (1) 쿼리 파라미터 | `?token={access_token}` | `wss://api.example.com/ws?token=eyJ...` |
| (2) 서브프로토콜 헤더 | `Sec-WebSocket-Protocol: bearer, {token}` | 브라우저 WebSocket API 제한 환경용 |

**인증 실패 시:**
- 핸드셰이크 단계: HTTP `401 Unauthorized` 응답 후 연결 거부
- 연결 중 토큰 만료: 서버가 `auth.token_expired` 이벤트 전송 → 클라이언트가 재인증 필요

### 1.3 토큰 갱신 (연결 유지)

Access Token (15분) 만료 전에 연결을 유지하려면:

```json
// 클라이언트 → 서버
{
  "type": "auth.refresh",
  "payload": {
    "token": "{new_access_token}"
  }
}
```

```json
// 서버 → 클라이언트
{
  "type": "auth.refreshed",
  "payload": {
    "expiresAt": "2026-03-29T14:30:00Z"
  }
}
```

클라이언트는 Access Token 갱신 후 (REST API `/api/auth/refresh`로 갱신) 새 토큰을 WebSocket으로도 전달해야 한다.

---

## 2. 메시지 형식

### 2.1 기본 프레임

모든 메시지는 JSON 텍스트 프레임이다. 바이너리 프레임은 사용하지 않는다.

```json
{
  "type": "string",
  "id": "string (optional)",
  "payload": {}
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | String | ✓ | 이벤트/명령 유형 (네임스페이스.액션 형태) |
| `id` | String | — | 메시지 고유 ID. 요청-응답 매칭 및 재전송 감지에 사용. UUID v4 권장 |
| `payload` | Object | ✓ | 이벤트/명령별 데이터 |

### 2.2 서버 → 클라이언트 이벤트 래퍼

```json
{
  "type": "execution.node.completed",
  "id": "evt-550e8400-e29b-41d4-a716-446655440001",
  "payload": { ... },
  "timestamp": "2026-03-29T14:00:01.234Z",
  "seq": 42
}
```

| 추가 필드 | 설명 |
|-----------|------|
| `timestamp` | 서버 이벤트 발생 시각 (ISO 8601) |
| `seq` | 채널 내 순서 번호 (재연결 시 놓친 이벤트 감지용). `execution:{executionId}` 채널의 경우 = "execution 내 monotonic counter", 외부 SSE 의 `id:` / Outbound Notification 의 `seq` 와 동일 값 공유 — [Spec EIA §R7](./14-external-interaction-api.md#r7-seq-동일-공유--sse-와-notification) |

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

```json
// 구독 요청
{
  "type": "subscribe",
  "id": "req-001",
  "payload": {
    "channel": "execution:550e8400-e29b-41d4-a716-446655440000"
  }
}

// 구독 확인
{
  "type": "subscribed",
  "id": "req-001",
  "payload": {
    "channel": "execution:550e8400-e29b-41d4-a716-446655440000"
  }
}

// 구독 해제
{
  "type": "unsubscribe",
  "id": "req-002",
  "payload": {
    "channel": "execution:550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**권한 검증:** 서버는 구독 시 해당 리소스에 대한 접근 권한을 확인한다. 권한 없으면:

```json
{
  "type": "error",
  "id": "req-001",
  "payload": {
    "code": "FORBIDDEN",
    "message": "No access to this resource"
  }
}
```

### 3.4 최대 구독 수

- 연결당 최대 동시 구독: **20개**
- 초과 시 `error` 메시지 (code: `SUBSCRIPTION_LIMIT_EXCEEDED`)

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
| `execution.paused` | `{ executionId, nodeId, nodeName, reason }` | 브레이크포인트에서 일시 정지 |
| `execution.node.started` | `{ executionId, nodeId, nodeExecutionId, nodeName, nodeType }` | 노드 실행 시작. `nodeExecutionId`는 `NodeExecution` 행의 PK로, 컨테이너 body 노드의 iter별 타임라인 row를 구분하는 식별자 |
| `execution.node.completed` | `{ executionId, nodeId, nodeExecutionId, nodeName, output, duration }` | 노드 실행 완료. `output` 은 `NodeHandlerOutput` 의 `output` 필드 — `output.error` 가 set 된 경우 (예: AI Agent multi-turn 의 `port: 'error'` 종결) 도 포함 ([Spec AI Agent §7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트)). `output.error.details.retryable` / `retryAfterSec` 표준 필드는 CONVENTIONS Principle 3.2.1 정의 |
| `execution.node.failed` | `{ executionId, nodeId, nodeExecutionId, nodeName, error }` | 노드 실행 실패. `error` 는 `output.error` 전체 구조 — `{ code: string, message: string, details?: { retryable?: boolean, retryAfterSec?: number, ... 노드별 } }` ([CONVENTIONS Principle 3.2](../conventions/node-output.md#32-outputerror-표준-형태)). LLM 계열 노드는 `details.retryable` 필수 |
| `execution.node.skipped` | `{ executionId, nodeId, nodeExecutionId, nodeName, reason }` | 노드 건너뜀 |
| `execution.waiting_for_input` | `{ executionId, nodeId, nodeExecutionId, nodeType, interactionType, formConfig?, buttonConfig?, conversationConfig?, conversationThread? }` | Form 노드, 버튼 Presentation 노드, 또는 AI Agent Multi Turn 노드에서 사용자 입력 대기. 재개 후 `execution.node.completed`도 동일한 `nodeExecutionId`로 발행되어 프론트 타임라인의 동일 row가 업데이트된다. `conversationThread` 가 동봉되면 UI 가 라이브 thread 패널을 갱신할 수 있다 (선택, §4.4.5). 아래 §4.4 참조 |
| `execution.ai_message` | `{ executionId, nodeId, message, turnCount, messages, metadata?, llmCalls?, durationMs?, presentations? }` | AI Agent Multi Turn 모드에서 AI 응답 메시지 전달. `messages` 는 system 을 제외한 user / assistant / **tool** 메시지를 모두 포함하는 권위 있는 스냅샷이며, 각 항목은 `source: 'live' \| 'injected'` 마커를 동봉한다 (§4.4.6). `presentations` 는 AI Agent 의 `render_*` 표현 도구 출력 (§4.4 표 / [Spec AI Agent §7.10](../4-nodes/3-ai/1-ai-agent.md#710-presentation-payload-render_-운반)). 상세 필드 정의는 §4.4 참조 |
| `execution.tool_call_started` | `{ executionId, nodeId, turnIndex, toolCallId, name, arguments }` | AI Agent 가 provider tool(KB/MCP 등)을 실행하기 시작했음을 알림. 디버깅 타임라인이 즉시 pending 상태의 tool 항목을 표시할 수 있도록 turn 종료 전에 발송 |
| `execution.tool_call_completed` | `{ executionId, nodeId, turnIndex, toolCallId, content, status, error?, durationMs }` | provider tool 실행이 끝났음을 알림. `status` 는 `'success' \| 'error'`. provider 가 throw 한 경우 핸들러가 캐치해 `status: 'error'` 와 `error` 메시지를 채우고 LLM 에는 에러 content 를 그대로 넘겨 다음 턴에서 회복할 기회를 준다 |

### 4.2 실행 제어 명령 (Client → Server)

| 명령 type | payload | 설명 |
|-----------|---------|------|
| `execution.start` | `{ workflowId, input?, fromNodeId?, breakpoints? }` | 실행 시작 요청 |
| `execution.stop` | `{ executionId, force? }` | 실행 중단 요청 |
| `execution.continue` | `{ executionId }` | 브레이크포인트 후 계속 |
| `execution.step` | `{ executionId }` | 한 노드만 실행 후 다시 정지 |
| `execution.submit_form` | `{ executionId, nodeId, formData, toolCallId? }` | Form 노드에 사용자 입력 제출. `toolCallId` 는 AI Agent 의 `render_form` 도구 응답 시에만 동봉 — `interactionType: 'ai_form_render'` 의 `conversationConfig.pendingFormToolCall.toolCallId` 와 일치해야 한다 ([Spec AI Agent §6.2 step 2](../4-nodes/3-ai/1-ai-agent.md#62-multi-turn-모드-mode--multi_turn)). 미일치 시 reject. **외부 wire 호환**: 본 payload shape 은 internal continuation bus 의 sentinel wrap (`{type:'form_submitted', formData}`, [Presentation 공통 §10.9](../4-nodes/6-presentation/0-common.md#109-form-submission-wire-format-internal-bus-sentinel)) 과 layer 분리 — 외부 wire 는 본 표 형식 유지, internal bus 만 sentinel wrap |
| `execution.click_button` | `{ executionId, nodeId, buttonId }` | 버튼이 설정된 Presentation 노드에서 버튼 클릭. `buttonId`는 port 타입 버튼의 UUID 또는 `__continue__` (link 전용 시 Continue 액션) |
| `execution.submit_message` | `{ executionId, nodeId, message }` | AI Agent Multi Turn 모드에서 사용자 메시지 전송. **form bypass**: `interactionType: 'ai_form_render'` 활성 중 본 명령이 수신되면 backend 가 `pendingFormToolCall.toolCallId` 매칭하는 render_form 도구의 tool_result content 를 `{type:'cancelled', reason:'user_sent_message_instead'}` 로 채우고 `pendingFormToolCall` 클리어 후 정상 `ai_user` turn 진행 ([Spec AI Agent §6.2 step 2.c.bypass](../4-nodes/3-ai/1-ai-agent.md#62-multi-turn-모드-mode--multi_turn)) — LLM 의 다음 reasoning 자유 보존. UI 의 MessageInput 은 항상 활성 (form 우회 허용) |
| `execution.end_conversation` | `{ executionId, nodeId }` | AI Agent Multi Turn 대화 종료 요청 |
| `execution.retry_last_turn` | `{ executionId, nodeExecutionId }` | AI Agent Multi Turn 의 retryable error (`output.error.details.retryable === true`) 종결 후 동일 nodeId 의 새 NodeExecution row 를 spawn 해 마지막 LLM 호출 재진입. `nodeId` 대신 `nodeExecutionId` 사용 사유: 동일 nodeId 가 여러 NodeExecution row 를 가질 수 있어 row 단위 식별 필요. 워크플로우 Re-run ([§13 replay-rerun](./13-replay-rerun.md)) 과 다름 — 동일 Execution 안 노드 단위 재시도. |

**실행 시작 응답:**

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

**버튼 클릭 응답:**

```json
{
  "type": "execution.click_button.ack",
  "id": "req-uuid",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "buttonId": "uuid",
    "resumed": true,
    "queued": true
  }
}
```

`queued: boolean` 은 선택 필드 — `true` 면 continuation-queue ([Spec 실행 엔진 §7.4](./4-execution-engine.md#74-분산-실행-multi-instance)) 로 정상 enqueue 됨 (Phase 2 의 "모든 진입점 항상 BullMQ enqueue" 라우팅 원칙 상 정상 publish 는 항상 `true`). `false` 면 publish 단계 실패 (Redis 장애 등) — 재시도 권장. 본 필드는 관측·디버깅 용도이며 클라이언트 routing 결정에 사용하지 않는다.

**공통 ack success payload shape:**

4개 명령 (`click_button` / `submit_form` / `submit_message` / `end_conversation`) 의 ack success payload 는 명령별 식별자만 다르고 `resumed` / `queued` 필드는 동일하다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `executionId` | uuid | 실행 ID (공통) |
| `nodeId` | uuid | 대상 노드 ID (공통) |
| `resumed` | boolean | 재개 성공 여부 |
| `queued` | boolean | continuation-queue 정상 enqueue 여부 (`true` = 정상, `false` = Redis 장애 등 publish 실패) |
| 명령별 식별자 | — | `buttonId` (click_button) / `formData` 없음 (submit_form) / `message` 없음 (submit_message) / — (end_conversation) |

**폼 제출 응답 (`execution.submit_form.ack`):**

```json
{
  "type": "execution.submit_form.ack",
  "id": "req-uuid",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
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
    "nodeId": "uuid",
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
    "nodeId": "uuid",
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
| `RESUME_INCOMPATIBLE_STATE` | (공통) `_resumeState` schema 가 deploy 후 변경되어 deserialize 실패. Execution 은 `cancelled` 로 종결 |

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
- **Continuation Bus 경유 (worker handoff)**: WS gateway(다른 인스턴스 가능)는 multi-turn loop 를 동기 재개할 수 없다 — 재진입은 live `ExecutionContext` rehydrate + `waitForAiConversation` 재개가 필요한 **execution worker 컨텍스트**에서만 가능하다. 따라서 retry 는 검증·atomic consume·새 row spawn 후 continuation 큐(`execution-continuation`)에 **새 job type (`retry_last_turn`)** 을 publish 해 worker 로 handoff 한다. worker processor 가 그 job 을 받아 spawn 된 row 를 `_retryState`(→ `_resumeState` shape) 로 seed 한 채 multi-turn loop 에 재진입시킨다. (기존 `submit_message` 등 continuation 명령과 동일한 WS→worker 브리지를 재사용하되, 대기중 row 재개가 아닌 **새 row 재개**라는 점만 다르다.)
- **replay 중 cancel**: replay turn 진행 중 외부 cancel 신호(`execution.cancel`)가 도달하면 진행 중 turn 을 조기 종료하고 Execution 을 `cancelled` 로 마감한다 — `execution.cancelled` 이벤트가 발사되며 `execution.completed` / `execution.failed` 는 발사되지 않는다. 이는 정상 multi-turn 의 "입력 대기 중 cancel" 과 동일 의미의 대칭 보장이다 (replay 는 입력 대기 없이 즉시 turn 을 돌리므로 별도 cancel 경로 필요). `cancelled` 페이로드의 분류는 일반 사용자 취소와 동일하게 다룬다.

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
      "timeout": 300,
      "timeoutAction": "cancel",
      "nodeOutput": { "type": "carousel", "items": [...], "rendered": "..." }
    }
  }
}
```

| 필드 | 설명 |
|------|------|
| `interactionType` | `form`: Form 노드, `buttons`: 버튼이 설정된 Presentation 노드, `ai_conversation`: AI Agent Multi Turn 일반 대화, `ai_form_render`: AI Agent 가 `render_form` 도구 호출로 사용자 form 제출 대기 ([Spec AI Agent §6.1.d.ii](../4-nodes/3-ai/1-ai-agent.md#61-single-turn-모드-mode--single_turn)) |
| `formConfig` | **`interactionType = form` 한정** top-level 필드. 그래프 Form 노드의 폼 설정. `ai_form_render` 의 경우 top-level 에는 없고 `conversationConfig.pendingFormToolCall.formConfig` 위치로 nest (아래 행) — UI 가 form payload 출처를 단일 위치에서 읽도록 SoT 정리 |
| `buttonConfig` | `interactionType = buttons` 시 존재. 버튼 정의 + 타임아웃 + 노드 렌더링 출력 |
| `buttonConfig.nodeOutput` | 노드의 렌더링 결과 (클라이언트가 콘텐츠 + 버튼을 함께 표시) |
| `conversationConfig` | `interactionType ∈ {ai_conversation, ai_form_render}` 시 존재. AI Agent Multi Turn 대화 설정 |
| `conversationConfig.pendingFormToolCall` | **`interactionType = ai_form_render` 한정**. shape `{ toolCallId: string, formConfig: object }` — `toolCallId` 는 클라이언트가 `execution.submit_form` 매칭 근거, `formConfig` 는 LLM 페이로드 ∪ `presentationTools[*].defaults` overlay 결과 (form 노드 input schema shape). UI 의 `AssistantPresentationsBlock` 이 assistant turn 의 `presentations[*]` 중 `payload.toolCallId === pendingFormToolCall.toolCallId` 인 form 페이로드를 interactive `DynamicFormUI` 로 렌더 ([Spec AI Agent §6.1.d.ii](../4-nodes/3-ai/1-ai-agent.md#61-single-turn-모드-mode--single_turn) / [§7.4](../4-nodes/3-ai/1-ai-agent.md#74-multi-turn-모드--사용자-입력-대기-status-waiting_for_input)) |

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
| `durationMs` | number? | **턴 전체** 소요시간 (모든 LLM 호출 + tool 실행 합) |
| `presentations` | PresentationPayload[]? | AI Agent 가 `render_*` 표현 도구 ([Spec AI Agent §4.1](../4-nodes/3-ai/1-ai-agent.md#41-presentation-tool-family-render_)) 를 호출한 turn 에서만 동봉. `ai_assistant` ConversationTurn 의 top-level `presentations[]` snapshot. type 정의의 단일 진실은 [Spec AI Agent §7.10](../4-nodes/3-ai/1-ai-agent.md#710-presentation-payload-render_-운반). 클라이언트가 chat UI 에서 텍스트와 함께 inline 렌더 |

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
        "durationMs": 842
      }
    ],
    "durationMs": 842
  }
}
```

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

AI Agent 가 provider tool(KB·MCP 등)을 실행하기 직전에 발송한다. 디버깅 타임라인은 이 이벤트로 pending 상태의 tool 항목을 즉시 표시해 사용자에게 진행 상황을 보여준다. `arguments` 는 LLM 이 생성한 JSON 문자열 그대로 (parse 책임은 클라이언트).

```json
{
  "type": "execution.tool_call_started",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "turnIndex": 1,
    "toolCallId": "call_abc123",
    "name": "kb_workspace_main",
    "arguments": "{\"query\":\"오늘의 날씨\"}"
  }
}
```

**Tool 호출 완료 (`execution.tool_call_completed`):**

provider tool 실행이 끝나면 (성공·실패 무관) 발송한다. `status` 는 `success` 또는 `error`. 실패 시에도 핸들러는 LLM 에 에러 content 를 넘겨 회복 기회를 주므로 turn 자체는 계속 진행된다 — UI 는 이 이벤트로 항목을 success / error 상태로 전환한다.

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
    "durationMs": 1240
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
    "durationMs": 30000
  }
}
```

> **Reconciliation**: `tool_call_started` / `tool_call_completed` 가 손실되어도 turn 종료 시 도착하는 `execution.ai_message` 의 `messages` 스냅샷과 `meta.turnDebug[].toolCalls` 가 권위적이다. 클라이언트는 `toolCallId` 를 키로 dedup 한다.

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

### 4.4 알림 이벤트 (Server → Client)

채널: `notifications:{userId}`

| 이벤트 type | payload | 설명 |
|-------------|---------|------|
| `notification.new` | `{ id, type, title, message, resourceType, resourceId }` | 새 알림 |

### 4.5 시스템 이벤트

구독 불필요. 연결 전체에 자동 전송.

| 이벤트 type | payload | 설명 |
|-------------|---------|------|
| `auth.token_expired` | `{ message }` | 토큰 만료 알림 |
| `system.maintenance` | `{ message, scheduledAt }` | 예정된 유지보수 알림 |
| `error` | `{ code, message }` | 프로토콜 레벨 에러 |

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
| `execution.paused` | `execution.paused` | — (디버깅 전용) |
| `execution.waiting_for_input` | `execution.waiting_for_input` | `execution.waiting_for_input` |
| `execution.resumed` (transient) | `execution.resumed` | — (transient, notification 미발송) |
| `execution.ai_message` | `execution.ai_message` | `execution.ai_message` (옵션 구독) |
| `execution.tool_call_started` | `execution.tool_call_started` | — |
| `execution.tool_call_completed` | `execution.tool_call_completed` | — |
| `execution.completed` | `execution.completed` | `execution.completed` |
| `execution.failed` | `execution.failed` | `execution.failed` |
| `execution.cancelled` | `execution.cancelled` | `execution.cancelled` |
| `replay.unavailable` | `execution.replay_unavailable` | — |

**핵심 규약:**
- **`seq` 동일 공유**: SSE 의 `id:` 필드와 Outbound Notification 페이로드의 `seq` 는 본 spec §2.2 의 monotonic counter 와 같은 값을 사용한다 ([Spec EIA §R7](./14-external-interaction-api.md#r7-seq-동일-공유--sse-와-notification)).
- **5분 버퍼 공유**: §6.2 의 재연결 이벤트 버퍼를 SSE 어댑터도 동일하게 사용한다. 외부 클라이언트의 `Last-Event-Id` 는 본 spec 의 `lastSeq` 와 동일 의미.
- **transaction-after emit**: 본 spec §4.1 의 트랜잭션 commit 후 emit 규약은 SSE / Notification 에도 그대로 적용된다 ([Spec EIA §9.3](./14-external-interaction-api.md#93-트랜잭션과-발송-순서-eia-rl-04)).
- **단일 구현 경로**: 외부 표면은 내부 WebSocket 의 명령/이벤트 처리 경로를 facade 로 감싼 형태로만 구현해야 한다. 두 표면이 분기되면 §R5 가 경고하는 maintenance 부담이 발생.

> 외부 WebSocket 채널 신설은 v1 에서 보류. 보류 사유와 재논의 트리거는 [Spec EIA §R5](./14-external-interaction-api.md#r5-외부-websocket-채널-신설--보류) 참조.

---

## 5. Heartbeat

### 5.1 메커니즘

WebSocket 프로토콜 레벨의 Ping/Pong을 사용한다.

| 항목 | 값 |
|------|-----|
| 발신자 | 서버 |
| 간격 | 30초 |
| Pong 타임아웃 | 10초 |
| 미응답 시 | 서버가 연결 종료 (close code: 1001) |

### 5.2 애플리케이션 레벨 Ping (폴백)

일부 프록시/로드 밸런서가 WebSocket Ping/Pong을 차단하는 경우를 위한 대안:

```json
// 서버 → 클라이언트
{ "type": "ping", "payload": { "ts": 1711706400000 } }

// 클라이언트 → 서버
{ "type": "pong", "payload": { "ts": 1711706400000 } }
```

---

## 6. 재연결 전략

### 6.1 클라이언트 재연결

| 항목 | 값 |
|------|-----|
| 재연결 시도 | 자동 |
| 백오프 전략 | 지수 백오프 (1s, 2s, 4s, 8s, 16s, 최대 30s) |
| 지터(Jitter) | ±500ms 랜덤 추가 (동시 재연결 폭주 방지) |
| 최대 재시도 | 무제한 (사용자가 수동 종료할 때까지) |

### 6.2 놓친 이벤트 복구

재연결 후 놓친 이벤트를 복구하기 위해 `lastSeq`를 전달한다:

```json
// 구독 시 마지막 수신 시퀀스 전달
{
  "type": "subscribe",
  "id": "req-010",
  "payload": {
    "channel": "execution:550e8400...",
    "lastSeq": 42
  }
}
```

- 서버는 `seq > lastSeq`인 이벤트를 버퍼에서 재전송
- 이벤트 버퍼 보관 기간: **5분** (이후 만료된 이벤트는 REST API로 조회)
- 버퍼에 없는 경우: `replay.unavailable` 이벤트 전송 → 클라이언트는 REST API로 현재 상태 조회

```json
{
  "type": "replay.unavailable",
  "payload": {
    "channel": "execution:550e8400...",
    "reason": "Events expired from buffer",
    "suggestion": "Fetch current state via REST API"
  }
}
```

---

## 7. 에러 처리

### 7.1 에러 코드

| 코드 | 설명 |
|------|------|
| `INVALID_MESSAGE` | JSON 파싱 실패 또는 필수 필드 누락 |
| `UNKNOWN_TYPE` | 알 수 없는 메시지 type |
| `FORBIDDEN` | 채널 접근 권한 없음 |
| `SUBSCRIPTION_LIMIT_EXCEEDED` | 최대 구독 수 초과 |
| `RATE_LIMITED` | 명령 전송 빈도 초과 (60 msg/min) |
| `INTERNAL_ERROR` | 서버 내부 오류 |

### 7.2 에러 메시지 형식

```json
{
  "type": "error",
  "id": "req-003",
  "payload": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this execution"
  }
}
```

`id`가 있으면 해당 요청에 대한 에러. 없으면 범용 에러.

---

## 8. WebSocket Close 코드

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

1. **연결**: WebSocket 인스턴스 생성 + 토큰 전달
2. **인증 확인**: 연결 성공 후 첫 메시지 수신 대기 (또는 타임아웃 5초)
3. **구독**: 필요한 채널에 구독 요청
4. **이벤트 처리**: `type` 기반 디스패칭
5. **Heartbeat 응답**: `ping` 수신 시 즉시 `pong` 전송
6. **토큰 갱신**: Access Token 만료 1분 전에 REST API로 갱신 → `auth.refresh` 전송
7. **재연결**: `onclose` 이벤트에서 지수 백오프 재연결 + `lastSeq` 전달
8. **정리**: 페이지 이탈 시 `unsubscribe` + 정상 종료 (close code 1000)

---

## Rationale

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
