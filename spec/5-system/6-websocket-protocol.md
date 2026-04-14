# Spec: WebSocket 프로토콜

> 관련 문서: [Spec API 규칙 §10](./2-api-convention.md#10-websocket) · [Spec 실행/디버깅 §8](../3-workflow-editor/3-execution.md#8-실행-엔진-통신) · [Spec 실행 엔진](./4-execution-engine.md)

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
| `seq` | 채널 내 순서 번호 (재연결 시 놓친 이벤트 감지용) |

---

## 3. 채널 구독

### 3.1 채널 개념

클라이언트는 관심 있는 리소스에 대해 **채널을 구독**해야 이벤트를 수신한다. 구독하지 않은 리소스의 이벤트는 전송되지 않는다.

### 3.2 채널 패턴

| 채널 | 패턴 | 설명 |
|------|------|------|
| 워크플로우 실행 | `execution:{executionId}` | 특정 실행의 모든 이벤트 |
| 워크플로우 편집 | `workflow:{workflowId}` | 에디터에서 실행 시작/완료 알림 |
| 임베딩 상태 | `embedding:{knowledgeBaseId}` | Knowledge Base 임베딩 진행 상태 |
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
| `execution.node.completed` | `{ executionId, nodeId, nodeExecutionId, nodeName, output, duration }` | 노드 실행 완료 |
| `execution.node.failed` | `{ executionId, nodeId, nodeExecutionId, nodeName, error }` | 노드 실행 실패 |
| `execution.node.skipped` | `{ executionId, nodeId, nodeExecutionId, nodeName, reason }` | 노드 건너뜀 |
| `execution.waiting_for_input` | `{ executionId, nodeId, nodeExecutionId, nodeType, interactionType, formConfig?, buttonConfig?, conversationConfig? }` | Form 노드, 버튼 Presentation 노드, 또는 AI Agent Multi Turn 노드에서 사용자 입력 대기. 재개 후 `execution.node.completed`도 동일한 `nodeExecutionId`로 발행되어 프론트 타임라인의 동일 row가 업데이트된다. 아래 §4.4 참조 |
| `execution.ai_message` | `{ executionId, nodeId, message, turnCount, messages }` | AI Agent Multi Turn 모드에서 AI 응답 메시지 전달 |

### 4.2 실행 제어 명령 (Client → Server)

| 명령 type | payload | 설명 |
|-----------|---------|------|
| `execution.start` | `{ workflowId, input?, fromNodeId?, breakpoints? }` | 실행 시작 요청 |
| `execution.stop` | `{ executionId, force? }` | 실행 중단 요청 |
| `execution.continue` | `{ executionId }` | 브레이크포인트 후 계속 |
| `execution.step` | `{ executionId }` | 한 노드만 실행 후 다시 정지 |
| `execution.submit_form` | `{ executionId, nodeId, formData }` | Form 노드에 사용자 입력 제출 |
| `execution.click_button` | `{ executionId, nodeId, buttonId }` | 버튼이 설정된 Presentation 노드에서 버튼 클릭. `buttonId`는 port 타입 버튼의 UUID 또는 `__continue__` (link 전용 시 Continue 액션) |
| `execution.submit_message` | `{ executionId, nodeId, message }` | AI Agent Multi Turn 모드에서 사용자 메시지 전송 |
| `execution.end_conversation` | `{ executionId, nodeId }` | AI Agent Multi Turn 대화 종료 요청 |

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
    "resumed": true
  }
}
```

**버튼 클릭 에러 코드:**

| 코드 | 설명 |
|------|------|
| `INVALID_BUTTON_ID` | 존재하지 않는 버튼 ID |
| `INVALID_EXECUTION_STATE` | 실행이 `waiting_for_input` 상태가 아님 |
| `INTERACTION_TIMEOUT` | 이미 타임아웃이 발생한 상태 |

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
| `interactionType` | `form`: Form 노드, `buttons`: 버튼이 설정된 Presentation 노드, `ai_conversation`: AI Agent Multi Turn 대화 |
| `formConfig` | `interactionType = form` 시 존재. Form 노드의 폼 설정 |
| `buttonConfig` | `interactionType = buttons` 시 존재. 버튼 정의 + 타임아웃 + 노드 렌더링 출력 |
| `buttonConfig.nodeOutput` | 노드의 렌더링 결과 (클라이언트가 콘텐츠 + 버튼을 함께 표시) |
| `conversationConfig` | `interactionType = ai_conversation` 시 존재. AI Agent Multi Turn 대화 설정 |

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
        { "role": "system", "content": "..." },
        { "role": "user", "content": "첫 번째 사용자 메시지" },
        { "role": "assistant", "content": "안녕하세요! 무엇을 도와드릴까요?" }
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

서버가 LLM 응답을 처리한 후 클라이언트에 전달하는 이벤트. 종료 조건 미충족 시 `execution.waiting_for_input`이 다시 발송된다.

```json
{
  "type": "execution.ai_message",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "message": "주문번호 ORD-12345는 현재 배송 중입니다.",
    "turnCount": 2,
    "messages": [ ... ]
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

---

### 4.3 임베딩 이벤트 (Server → Client)

채널: `embedding:{knowledgeBaseId}`

| 이벤트 type | payload | 설명 |
|-------------|---------|------|
| `embedding.started` | `{ documentId, documentName }` | 임베딩 시작 |
| `embedding.progress` | `{ documentId, progress, totalChunks, completedChunks }` | 진행률 |
| `embedding.completed` | `{ documentId, chunkCount }` | 임베딩 완료 |
| `embedding.failed` | `{ documentId, error }` | 임베딩 실패 |

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
