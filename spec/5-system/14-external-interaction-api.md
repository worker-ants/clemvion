---
id: external-interaction-api
status: implemented
code:
  - codebase/backend/src/modules/external-interaction/**
  - codebase/backend/src/modules/hooks/hooks.service.ts
  - codebase/backend/src/modules/hooks/hooks.controller.ts
  - codebase/backend/src/modules/triggers/dto/interaction-config.dto.ts
  - codebase/channel-web-chat/src/lib/eia-client.ts
  - codebase/channel-web-chat/src/lib/eia-types.ts
---

# Spec: External Interaction API (트리거-원격 인터랙션 채널)

> 관련 문서: [Spec Webhook 트리거](./12-webhook.md) · [Spec WebSocket 프로토콜](./6-websocket-protocol.md) · [Spec 실행 엔진](./4-execution-engine.md) · [Spec API 규칙](./2-api-convention.md) · [Spec Conversation Thread](../conventions/conversation-thread.md) · [Spec Chat Channel](./15-chat-channel.md)

---

## Overview (제품 정의)

### 1. 개요

워크플로우가 외부 시스템(Webhook 트리거·외부 자동화·서드파티 봇 등)에 의해 실행될 때, 실행 도중 **사용자 인터랙션이 필요한 노드** (Form, 버튼 Presentation, AI Agent Multi Turn, Information Extractor Multi Turn) 가 등장하면, 호출자는 워크플로우가 `waiting_for_input` 상태로 멈춘 사실도 알 수 없고 turn 을 주고받을 수단도 없다. 현 WebSocket 채널은 워크스페이스 JWT 로만 인증되어 외부 호출자가 사용할 수 없기 때문이다.

본 spec 은 그 간극을 메우기 위한 **두 채널** 을 정의한다.

- **Outbound — Notification Webhook**: 서버가 외부 URL 로 이벤트(waiting_for_input / completed / failed / cancelled / ai_message) 를 HMAC 서명하여 push.
- **Inbound — Interaction REST + SSE**: 외부 클라이언트가 REST 로 인터랙션 명령(submit_form / click_button / submit_message / end_conversation / cancel) 을 제출하고, SSE 로 실행 이벤트 스트림을 수신.

두 채널은 모두 **optional**. 트리거별로 둘 다·하나만·아무것도 활성화하지 않을 수 있다. 내부 처리는 [Spec WebSocket 프로토콜 §4.1·§4.2](./6-websocket-protocol.md#4-이벤트-목록) 의 명령·이벤트 경로를 그대로 재사용하는 **facade** 로 구현하여 두 표면이 분기되지 않도록 한다.

### 2. 사용 시나리오

| 시나리오 | 사용 채널 | 설명 |
|---------|---------|------|
| 서버-to-서버 자동화에서 사람 결재가 필요한 경우 | Notification only | 외부 서버가 webhook 으로 워크플로우 시작 → Form 도달 시 notification 수신 → 자체 UI 로 안내 → REST 로 form 제출 |
| 외부 챗봇(Telegram/Slack/카카오) 위에 워크플로우 얹기 — **사용자가 직접 변환층 구현 (advanced)** | Notification + Inbound | `config.chatChannel` 미사용. 봇 메시지 → webhook 으로 워크플로우 시작 → AI Multi Turn 진입 시 notification 으로 어시스턴트 응답 받기 → 사용자 메시지마다 REST `submit_message`. 사용자가 변환층을 직접 구현해 quirky 통합·미지원 provider 도 운영 가능 |
| 외부 챗봇 — **서버사이드 어댑터 사용 (Chat Channel via Webhook)** | Notification + Inbound (어댑터가 자동화) | Webhook 트리거 `config.chatChannel` 등록만으로 텔레그램 등과 자동 통합. 어댑터가 in-process subscriber 로 EIA outbound 를 받아 채널 메시지로 변환, in-process caller 로 EIA inbound 를 호출. 사용자 코드 0. 상세는 [Spec Chat Channel](./15-chat-channel.md) |
| 외부 SaaS 가 내장 chat 위젯 호스팅 | Inbound only (SSE + REST) | webhook 응답으로 받은 토큰으로 SSE 스트림 열고 REST 명령 보냄. notification 미사용 |
| 단순 fire-and-forget 자동화 (인터랙션 없음) | 둘 다 미사용 | 기존 webhook 그대로 |

---

## 3. 요구사항

### 3.1 Outbound Notification (Notification Webhook)

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| EIA-NX-01 | Trigger 등록 페이로드의 `notification.url` 로 이벤트를 HTTP POST 한다 | 필수 |
| EIA-NX-02 | 이벤트 종류 화이트리스트 구독: `execution.waiting_for_input` / `execution.completed` / `execution.failed` / `execution.cancelled` / `execution.ai_message` | 필수 |
| EIA-NX-03 | 페이로드는 HMAC-SHA256 으로 서명하여 `X-Clemvion-Signature: t=<unix>,v1=<hex>` 헤더로 전송 (Stripe-style). 알고리즘 식별자는 [Webhook §4.2](./12-webhook.md#42-hmac-서명) 의 화이트리스트 표기 (`sha256` / `sha512`) 와 동일 값을 trigger config 에 보관하되 (`hmacAlgorithm: 'sha256'`), 외부 표면 (notification.signing.algorithm) 에서는 `hmac-sha256` / `hmac-sha512` 의 명시적 prefix 형태로 노출해 inbound webhook 검증과 outbound notification 서명의 알고리즘 출처를 분리한다 (§R12) | 필수 |
| EIA-NX-04 | 동일 이벤트는 동일 `X-Clemvion-Delivery: <uuid>` 헤더로 식별 — 재시도 시 같은 ID 유지 (at-least-once 보장) | 필수 |
| EIA-NX-05 | 이벤트 발송 전 execution 상태를 재조회해 stale notification 차단 (예: `waiting_for_input` 발송 직전에 이미 `cancelled` 라면 발송 생략) | 필수 |
| EIA-NX-06 | 2xx 응답만 성공으로 간주. 그 외 / 타임아웃 → 지수 백오프 재시도 (default 5회, 1s/4s/16s/64s/256s) | 필수 |
| EIA-NX-07 | 최종 실패 시 트리거의 `notificationHealth` 필드를 `'degraded'` 로 갱신 (트리거 자동 비활성화 금지 — 사용자 승인 필요) | 필수 |
| EIA-NX-08 | 페이로드 안에 `seq` (= execution 내 monotonic counter, WebSocket §2.2 와 동일 값) 동봉 — 클라이언트가 정렬·dedupe 가능 | 필수 |
| EIA-NX-09 | URL 은 `https://` 만 허용. 개발 환경 환경변수 `ALLOW_HTTP_HOOKS=1` 일 때만 `http://` 예외 | 필수 |
| EIA-NX-10 | SSRF 방지: 사설 IP·메타데이터 IP·loopback 차단. 워크스페이스 단위 allowlist 설정 가능 | 필수 |
| EIA-NX-11 | Trigger 당 분당 최대 60건 outbound rate-limit. 초과분은 큐에 적재, 폭주 시 가장 오래된 이벤트부터 폐기하지 않고 `notificationHealth=degraded` 표시 | 권장 |
| EIA-NX-12 | secret rotation API (`POST /api/triggers/:id/notification/rotate-secret`) 지원 — old secret 은 grace 24h 병행 검증 | 권장 |

### 3.2 Inbound Interaction (REST + SSE)

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| EIA-IN-01 | `POST /api/external/executions/:executionId/interact` 로 인터랙션 명령을 제출한다 | 필수 |
| EIA-IN-02 | 지원 명령: `submit_form`, `click_button`, `submit_message`, `end_conversation`, `cancel` — 모두 WebSocket §4.2 의 동일명 명령과 의미 동일. **`retry_last_turn` 미포함** — 내부 UI 한정. 외부 노출 시 `per_execution` 토큰 권한 매트릭스 + Notification 흐름과의 정합 + retry 횟수 제한 정책이 별도 결정 필요 | 필수 |
| EIA-IN-03 | `GET /api/external/executions/:executionId/stream` 는 Server-Sent Events 스트림. terminal 이벤트(`completed`/`failed`/`cancelled`) 발송 후 자동 종료 | 필수 |
| EIA-IN-04 | `GET /api/external/executions/:executionId` 는 현재 상태 단발 조회 (status / currentNode / context / result|error / seq / updatedAt) | 필수 |
| EIA-IN-05 | `POST /api/external/executions/:executionId/cancel` 는 명시적 취소 — `interact` 의 `command:"cancel"` 과 동치 (편의 alias) | 권장 |
| EIA-IN-06 | 모든 inbound 요청은 §4 의 interaction token 으로 인증. **단 §3.3 EIA-AU-08 + §3.3.1 Implementation Note 의 in-process trusted caller 는 제외** — HTTP 표면을 거치지 않는 in-process 호출에 한정. HTTP guard 의 ctx 합성 시 `scope` 필드 set 금지 invariant 는 §3.3.1 참조 | 필수 |
| EIA-IN-07 | SSE 스트림은 `id:` 필드에 execution 내 `seq` 를 적재. 재연결 시 `Last-Event-Id` 헤더로 누락분 5분 버퍼에서 재전송 | 필수 |
| EIA-IN-08 | SSE 는 15초마다 `: heartbeat` comment 라인 전송 — proxy idle timeout 회피 | 필수 |
| EIA-IN-09 | execution 당 동시 SSE 연결 수 제한: 기본 3 (multi-tab 허용, 무제한 fan-out 차단) | 권장 |
| EIA-IN-10 | `submit_form` 검증 실패는 execution 상태를 바꾸지 않고 `400` + `details.fieldErrors` 반환 (waiting_for_input 유지, 재제출 가능) | 필수 |
| EIA-IN-11 | `Idempotency-Key` 헤더 지원 — 동일 키 24h 캐시, 같은 키 + 다른 body 는 `409 Conflict` | 필수 |
| EIA-IN-12 | 종료된 execution 에 대한 명령은 `410 Gone` 반환 | 필수 |
| EIA-IN-13 | 현재 노드 상태와 명령이 맞지 않으면 (예: `completed` 상태에서 `submit_message`) `409 Conflict` 반환 | 필수 |

### 3.3 인증

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| EIA-AU-01 | Notification secret (`wsk_*`) 는 trigger 생성 시 1회만 평문 노출, 이후 마스킹. HMAC 서명 검증 전용 | 필수 |
| EIA-AU-02 | Interaction token 은 두 전략 중 하나: (a) `per_execution` — 단일 execution scope 의 단명 JWT (`iext_*`, 기본 1h), (b) `per_trigger` — 트리거가 만드는 모든 execution 에 적용되는 영구 토큰 (`itk_*`, revoke 가능) | 필수 |
| EIA-AU-03 | default 는 `per_execution` (좁은 scope, 단명) — 가장 안전 | 필수 |
| EIA-AU-04 | `per_execution` 토큰은 execution 종료(completed/failed/cancelled) 시 즉시 invalidate | 필수 |
| EIA-AU-05 | `per_execution` 토큰은 만료 30분 이내 + execution 이 still alive 일 때 `POST /api/external/executions/:id/refresh-token` 으로 갱신 가능 | 권장 |
| EIA-AU-06 | 토큰 무효/만료 시 `401` + 응답 헤더 `X-Refresh-Token-Url` 로 갱신 경로 안내 | 권장 |
| EIA-AU-07 | Per-trigger 토큰은 trigger 삭제 시 자동 invalidate. `POST /api/triggers/:id/interaction/revoke-token` 으로 수동 invalidate 가능 | 필수 |
| EIA-AU-08 | **In-process trusted caller 예외** — 서버 process 내부의 신뢰 caller (예: [Spec Chat Channel](./15-chat-channel.md) 어댑터) 는 토큰 발급/검증을 우회할 수 있다. 우회는 `InteractionService.interact()` ([코드 SoT](../../codebase/backend/src/modules/external-interaction/interaction.service.ts)) 의 **in-process 직접 호출** 경로에 한정되며, HTTP 표면을 거치지 않는다. 외부 HTTP 호출은 EIA-IN-06 의 `interaction token` 인증을 그대로 따른다. 구현은 `InternalInteractionRequestContext.scope: 'in_process_trusted'` (§3.3.1 의 `InteractionRequestContext` union 타입) 로 분기 | 필수 |

#### 3.3.1 Implementation Note — in-process trusted caller 오염 방지 (EIA-AU-08)

`InteractionRequestContext.scope: 'in_process_trusted'` 는 token 검증을 완전히 우회하는 강력한 플래그이므로, 외부 HTTP 입력 경로에서 이 플래그가 set 될 가능성을 **구조적으로 차단** 해야 한다. 본 절은 `InteractionGuard` / DTO / 타입 분리 차원의 의무 구현 제약을 정의한다.

**Guard / DTO 의무 제약**:

1. `InteractionGuard` (HTTP 진입점) 가 합성하는 `InteractionRequestContext` 코드 경로는 절대 `scope` 필드를 set 하지 않는다 — HTTP 요청에서 합성되는 ctx 는 `scope === undefined` 가 invariant.
2. HTTP request body / header / query / params 의 역직렬화 시 `scope` 필드는 반드시 strip — DTO 는 `class-transformer` 의 `@Exclude({ toClassOnly: true })` 또는 `excludeExtraneousValues: true` + `@Expose()` 화이트리스트로 외부 입력 차단.
3. `scope: 'in_process_trusted'` 는 서버 내부 모듈 (`ChatChannelDispatcher`, `HooksService` 의 chat-channel forwarding 등) 이 ctx 를 직접 생성해 `InteractionService.interact()` 를 호출할 때만 set 가능. 호출 위치는 `grep -r "scope: 'in_process_trusted'" codebase/backend/src/` 결과가 항상 가시화되어야 한다 (audit 가능성).

**타입 분리 권고 (v2 이후)**:

현재 `InteractionRequestContext.scope?: InteractionScope` optional 필드 단일 타입은 위 invariant 를 컴파일러로 강제하지 못한다. v2 에서는 다음 분리를 권고:

```typescript
// HTTP guard 가 생성하는 ctx (scope 필드 없음)
interface ExternalInteractionRequestContext {
  executionId: string;
  tokenFamily: 'iext' | 'itk';  // 필수
  triggerId?: string | null;
}

// 서버 내부 모듈만 생성 가능 — scope: 'in_process_trusted' 필수
interface InternalInteractionRequestContext {
  executionId: string;
  triggerId?: string | null;
  scope: 'in_process_trusted';  // 필수, literal type
  // tokenFamily 없음 — in-process 우회는 token 자체가 없음
}

type InteractionRequestContext =
  | ExternalInteractionRequestContext
  | InternalInteractionRequestContext;
```

위 union 분리 시 `InteractionGuard` 는 첫 타입만 반환하고, `InteractionService.interact()` 의 token 검증 분기는 type narrowing 으로 `scope === 'in_process_trusted'` 일 때만 skip 한다 — 컴파일러가 invariant 를 강제.

### 3.4 신뢰성·일관성

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| EIA-RL-01 | Outbound 는 at-least-once. 클라이언트는 `X-Clemvion-Delivery` 로 dedup, `seq` 로 정렬 | 필수 |
| EIA-RL-02 | Inbound `submit_*` 는 멱등. `Idempotency-Key` 동일 시 동일 응답 24h 재현 | 필수 |
| EIA-RL-03 | `submit_form` 검증 실패는 waiting_for_input 유지 (재제출 가능) — [Spec 실행 엔진 §1.3](./4-execution-engine.md#13-블로킹재개-컨트랙트-nodehandleroutput-status) 의 form 흐름과 동일 | 필수 |
| EIA-RL-04 | Notification 발송과 SSE emit 은 [Spec 실행 엔진 §1.1](./4-execution-engine.md#11-execution-상태) 의 트랜잭션 commit 이후 시점에서만 수행 | 필수 |
| EIA-RL-05 | SSE 와 notification 은 동일 `seq` 를 공유 → 한 클라이언트가 두 채널을 동시 구독해도 dedup 가능 | 권장 |

### 3.5 비기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| EIA-NF-01 | Outbound notification 발송 latency: 트랜잭션 commit ↔ HTTP POST 시도 사이 평균 200ms 이내 | 필수 |
| EIA-NF-02 | SSE stream 의 이벤트 fan-out latency: 백엔드 emit ↔ 클라이언트 수신 평균 100ms 이내 (동일 region) | 필수 |
| EIA-NF-03 | 5분 이벤트 버퍼: 재연결 시 `seq > Last-Event-Id` 인 이벤트를 손실 없이 재전송 | 필수 |
| EIA-NF-04 | Inbound 명령 처리는 비동기. REST 응답은 `202 Accepted` 즉시 반환, 실제 워크플로우 진행은 백그라운드 | 필수 |
| EIA-NF-05 | execution 당 active interact 명령 동시성: 1건 — 동일 노드에 대한 race 는 §5.3 의 lock 전략으로 직렬화 | 필수 |

---

## 4. Trigger 등록 페이로드 확장

기존 [Spec Webhook §3.2 인증·§3.4 관리](./12-webhook.md) 에 정의된 trigger CRUD 페이로드에 두 옵셔널 그룹 추가.

```jsonc
POST /api/triggers
{
  "type": "webhook",
  "workflowId": "uuid",
  "endpointPath": "uuid-or-slug",
  "authType": "bearer",

  // === 신규: outbound notification ===
  "notification": {
    "url": "https://customer.example/webhook/wf-callback",
    "events": [
      "execution.waiting_for_input",
      "execution.completed",
      "execution.failed",
      "execution.cancelled"
      // "execution.ai_message"  // optional, 노이즈 큼 — 명시 구독 시에만
    ],
    "signing": { "algorithm": "hmac-sha256" },
    "retry": { "maxAttempts": 5, "backoff": "exponential" }
  },

  // === 신규: inbound interaction ===
  "interaction": {
    "enabled": true,
    "tokenStrategy": "per_execution"   // "per_execution" (default) | "per_trigger"
  }
}
```

**응답:**

```jsonc
{
  "id": "trigger_xxx",
  "endpointPath": "...",
  "notification": {
    "url": "...",
    "events": [...],
    "signing": { "algorithm": "hmac-sha256" }
    // "signing.secret" 는 응답에서 영구 마스킹
  },
  "interaction": { "enabled": true, "tokenStrategy": "per_execution" },

  // 생성 시점에만 평문 반환. 이후 모든 조회 응답에서 마스킹.
  "secrets": {
    "notification.secret": "wsk_xxx...",
    "interaction.triggerToken": "itk_xxx..."   // tokenStrategy="per_trigger" 일 때만
  }
}
```

### 4.1 Webhook 호출 응답 확장

기존 응답:
```json
{ "executionId": "uuid", "message": "Webhook received, workflow execution started" }
```

확장:
```jsonc
{
  "executionId": "uuid",
  "status": "pending",
  "message": "Webhook received, workflow execution started",

  // interaction.enabled=true 이고 tokenStrategy="per_execution" 일 때만 동봉
  "interaction": {
    "token":     "iext_<short-lived-jwt>",
    "expiresAt": "ISO8601",
    "endpoints": {
      "stream":  "/api/external/executions/{id}/stream",
      "submit":  "/api/external/executions/{id}/interact",
      "status":  "/api/external/executions/{id}",
      "cancel":  "/api/external/executions/{id}/cancel",
      "refresh": "/api/external/executions/{id}/refresh-token"
    }
  }
}
```

> 기존 응답 shape 의 필드는 모두 유지. `status` / `interaction` 만 신규 추가 → **하위 호환** (기존 클라이언트는 unknown field 를 무시).

---

## 5. API 명세 — Inbound

### 5.1 인터랙션 명령 제출 — `POST /api/external/executions/:executionId/interact`

```
POST /api/external/executions/{executionId}/interact
Authorization: Bearer <iext_jwt | itk_token>
Content-Type: application/json
Idempotency-Key: <client-uuid>   // 권장
```

**Body (command 별):**

| command | body 추가 필드 | 적용 노드 | 매핑되는 WS 명령 (필드 매핑은 §11) |
|---------|--------------|---------|----------------|
| `submit_form` | `nodeId`, `data: { [field]: value }` | Form | `execution.submit_form` (WS 의 `formData` ↔ REST 의 `data`) |
| `click_button` | `nodeId`, `buttonId` | Carousel/Table/Chart/Template (button) | `execution.click_button` |
| `submit_message` | `nodeId`, `message` | AI Agent / Information Extractor (multi turn) | `execution.submit_message` |
| `end_conversation` | `nodeId`, `reason?` | AI Agent / Information Extractor (multi turn) | `execution.end_conversation` |
| `cancel` | `reason?` | (전체 execution) | `execution.stop` (외부에서는 `force` 옵션 미지원) |

**예시 — Form 제출:**
```json
POST /api/external/executions/550e8400-.../interact
{
  "command": "submit_form",
  "nodeId":  "f7b9c1d2-...",
  "data":    { "approver": "alice", "amount": 1000, "comment": "OK" }
}
```

**성공 응답** (`202 Accepted`):
```json
{
  "executionId": "uuid",
  "accepted":    true,
  "currentStatus": "running"
}
```
> 명령 수신 직후에 다음 노드가 즉시 또 `waiting_for_input` 으로 진입할 수도 있다. 정확한 최신 상태는 SSE 스트림 또는 `GET /api/external/executions/:id` 로 확인.

**에러 응답:**

응답 body 형식은 [Spec API 규칙 §5.3](./2-api-convention.md) 의 `{ "error": { "code", "message", "details" } }` 컨벤션을 따른다 (12-webhook §5.2 의 `statusCode/errors` shape 는 webhook 호출 진입점 전용 legacy 형식 — 본 spec 의 신규 endpoint 는 신컨벤션 채택).

```jsonc
// 예시: form validation 실패
{
  "error": {
    "code":    "VALIDATION_FAILED",
    "message": "Form validation failed",
    "details": {
      "fieldErrors": [
        { "field": "amount", "reason": "min_violated", "expected": 100, "actual": 50 }
      ]
    }
  }
}
```

| 상태 | 코드 | 조건 |
|------|------|------|
| `400 Bad Request` | `VALIDATION_FAILED` | submit_form 의 field 검증 실패. body 의 `error.details.fieldErrors[]` 참조. execution 상태 유지(재제출 가능) |
| `400 Bad Request` | `INVALID_COMMAND` | 지원하지 않는 command, 필수 필드 누락 |
| `401 Unauthorized` | `TOKEN_INVALID` / `TOKEN_EXPIRED` | 토큰 검증 실패 (응답 헤더 `X-Refresh-Token-Url` 동봉) |
| `403 Forbidden` | `SCOPE_MISMATCH` | 토큰 scope 가 해당 execution 에 일치하지 않음 |
| `404 Not Found` | `EXECUTION_NOT_FOUND` | executionId 없음 |
| `409 Conflict` | `STATE_MISMATCH` | 현재 노드/실행 상태와 명령 불일치 (예: completed 상태에서 submit_message, 또는 다른 nodeId). publisher 측 사전 검증([실행 엔진 §7.5.1](./4-execution-engine.md#751-publisher-측-사전-검증--invalid_execution_state))의 EIA 진입점 매핑 — WS 의 `INVALID_EXECUTION_STATE` 와 동일 의미를 EIA 는 `STATE_MISMATCH` 로 표기 |
| `409 Conflict` | `IDEMPOTENCY_KEY_CONFLICT` | 같은 키 + 다른 body |
| `410 Gone` | `EXECUTION_TERMINATED` | execution 이 이미 completed/failed/cancelled |
| `429 Too Many Requests` | `RATE_LIMITED` | inbound rate-limit 초과 |

### 5.2 SSE 이벤트 스트림 — `GET /api/external/executions/:executionId/stream`

```
GET /api/external/executions/{executionId}/stream
Authorization: Bearer <iext_jwt | itk_token>   # EventSource 브라우저 환경에서는 ?token=<jwt> 쿼리 파라미터 허용 (§8.3)
Accept: text/event-stream
Last-Event-Id: 42                      # 재연결 시 (옵션)
```

**스트림 포맷:**
```
event: execution.started
id: 1
data: {"executionId":"550e8400-...","workflowId":"...","mode":"production","startedAt":"..."}

event: execution.node.started
id: 2
data: {"executionId":"...","nodeId":"...","nodeType":"manual_trigger"}

event: execution.waiting_for_input
id: 3
data: { ... §6 payload ... }

: heartbeat                          # 15초마다 (이벤트 아님, comment 라인)

event: execution.resumed
id: 4
data: {"executionId":"...","nodeId":"..."}

event: execution.completed
id: 99
data: { ... §6 payload ... }
```

**이벤트 종류:**

§6 의 outbound notification 이벤트 + 디버깅용 추가 이벤트:
`execution.node.started` / `execution.node.completed` / `execution.node.failed` / `execution.node.skipped` /
`execution.ai_message` / `execution.tool_call_started` / `execution.tool_call_completed` / `execution.resumed`.

각 이벤트의 페이로드는 [Spec WebSocket 프로토콜 §4.1·§4.4](./6-websocket-protocol.md#41-실행-이벤트-server--client) 와 동일.

**규약:**
- `id` 필드 = execution 내 monotonic `seq` (= WebSocket §2.2 의 `seq` 와 같은 값)
- `Last-Event-Id` 헤더 또는 query `?lastEventId=` 로 재연결 시 누락 이벤트 재전송 (5분 버퍼)
- 버퍼 만료된 경우 `execution.replay_unavailable` 이벤트 (한 번) 발송 → 클라이언트는 `GET /api/external/executions/:id` 로 현재 상태 재조회. 이름이 내부 WS 의 `replay.unavailable` ([Spec WS §6.2](./6-websocket-protocol.md#62-놓친-이벤트-복구)) 과 다른 이유는 SSE 의 이벤트 namespace 컨벤션 (`execution.*`) 에 맞추기 위함 — 두 표면의 의미는 동일
- terminal 이벤트(`execution.completed` / `execution.failed` / `execution.cancelled`) 발송 후 서버가 SSE 연결 종료
- 연결 수 제한 초과 시 `429 Too Many Requests`

### 5.3 단발 상태 조회 — `GET /api/external/executions/:executionId`

```jsonc
GET /api/external/executions/{executionId}
Authorization: Bearer <iext_jwt | itk_token>

200 OK
{
  "id":         "uuid",
  "workflowId": "uuid",
  "status":     "waiting_for_input" | "running" | "pending"
              | "completed" | "failed" | "cancelled",
  "currentNode": {
    "id": "uuid",
    "type": "form" | "carousel" | "ai_agent" | ...,
    "interactionType": "form" | "buttons" | "ai_conversation" | null
  } | null,
  "context": {
    // 노드 종류에 따라 form/button/conversation config 중 하나만 동봉
    "formConfig":         { ... },
    "buttonConfig":       { ... },
    "conversationConfig": { ... },
    "conversationThread": { ... }   // [Spec WS §4.4.5] 와 동일. messages[].source 마커 누락 시 [Conversation Thread §4.4.6 / §5.1](../conventions/conversation-thread.md) 의 폴백 ('live' 로 간주) 적용
  } | null,
  "result":  { ... } | null,        // completed 시
  "error":   { ... } | null,        // failed 시
  "seq":     42,
  "updatedAt": "ISO8601"
}
```

### 5.4 명시적 취소 — `POST /api/external/executions/:executionId/cancel`

```jsonc
POST /api/external/executions/{executionId}/cancel
Authorization: Bearer <iext_jwt | itk_token>
{
  "reason": "user_aborted"   // optional
}

202 Accepted
{
  "executionId": "uuid",
  "status":      "cancelled" | "running"   // 동기 처리 시 cancelled, 비동기 처리 중일 때 running (SSE 로 cancelled 이벤트 후속)
}
```

> `interact` 의 `command: "cancel"` 과 의미적으로 동치. 편의 alias. 응답이 `202 Accepted` 인 이유는 §5.1 의 다른 action 명령들과 동일 — 실제 cancel 처리는 비동기일 수 있다.

### 5.5 토큰 갱신 — `POST /api/external/executions/:executionId/refresh-token`

```jsonc
POST /api/external/executions/{executionId}/refresh-token
Authorization: Bearer <expiring_iext_jwt>

200 OK
{
  "token":     "iext_<new_jwt>",
  "expiresAt": "ISO8601"
}

401 Unauthorized   // execution 종료됨, 또는 expiresAt 까지 30분 이상 남음
```

### 5.6 동시성 / Lock (EIA-NF-05)

같은 execution 의 같은 노드에 대한 두 inbound 명령이 동시에 들어오면 second-arrival 은 `409 STATE_MISMATCH` 가 된다 (첫 명령이 이미 `waiting_for_input → resumed` 전이를 일으켜 상태가 바뀐 뒤). 이는 race 가 아니라 명시적 직렬화. 클라이언트는 `Idempotency-Key` 를 항상 동봉하여 첫 명령의 응답을 재조회해도 동일 결과를 얻도록 권장한다.

---

## 6. API 명세 — Outbound Notification

### 6.1 헤더

```
POST <notification.url>
Content-Type:           application/json
X-Clemvion-Event:       execution.waiting_for_input
X-Clemvion-Execution-Id: <uuid>
X-Clemvion-Trigger-Id:   <uuid>
X-Clemvion-Workflow-Id:  <uuid>
X-Clemvion-Delivery:     <uuid>            # 재시도해도 동일
X-Clemvion-Timestamp:    <unix>
X-Clemvion-Signature:    t=<unix>,v1=<hex>
```

서명 계산 규칙:
```
signed_payload = "{timestamp}.{rawBody}"
signature      = HMAC_SHA256(secret, signed_payload)
header value   = "t={timestamp},v1={hex(signature)}"
```

검증 측 권장:
- `timestamp` 가 현재 시각 ±5분 밖이면 거부 (replay 방지)
- timing-safe 비교
- secret rotation 기간(24h grace)에는 old / new 둘 다 시도하고 한쪽이라도 일치하면 통과

### 6.2 페이로드 — `execution.waiting_for_input`

```jsonc
{
  "type":        "execution.waiting_for_input",
  "executionId": "uuid",
  "triggerId":   "uuid",
  "workflowId":  "uuid",
  "node": {
    "id":              "uuid",
    "type":            "form" | "carousel" | "table" | "chart" | "template" | "ai_agent" | "information_extractor",
    "interactionType": "form" | "buttons" | "ai_conversation"
  },
  "interaction": {
    "submitUrl":  "https://api.clemvion.ai/v1/executions/{id}/interact",
    "streamUrl":  "https://api.clemvion.ai/v1/executions/{id}/stream",
    "statusUrl":  "https://api.clemvion.ai/v1/executions/{id}",
    "cancelUrl":  "https://api.clemvion.ai/v1/executions/{id}/cancel",
    "token":      "iext_<jwt>",     // tokenStrategy=per_execution 일 때만. per_trigger 면 생략 (호출자가 이미 갖고 있음)
    "expiresAt":  "ISO8601",
    "expectedCommands": ["submit_form"]
                     | ["click_button"]
                     | ["submit_message", "end_conversation"]
  },
  "context": {
    "formConfig":         { /* form 노드일 때 — [Spec WS §4.4] formConfig 와 동일 shape */ },
    "buttonConfig":       { /* button 노드일 때 — [Spec WS §4.4] buttonConfig 와 동일 shape */ },
    "conversationConfig": { /* AI multi turn 일 때 — [Spec WS §4.4] conversationConfig 와 동일 shape */ },
    "conversationThread": { /* [Spec WS §4.4.5] 와 동일. optional. messages[].source 마커 누락 시 [Conversation Thread §4.4.6 / §5.1](../conventions/conversation-thread.md) 폴백 ('live' 로 간주) 적용 */ }
  },
  "timestamp": "ISO8601",
  "seq":       42
}
```

### 6.3 페이로드 — `execution.completed`

```jsonc
{
  "type":        "execution.completed",
  "executionId": "uuid",
  "triggerId":   "uuid",
  "workflowId":  "uuid",
  "result": {
    "outputs":     { /* workflow 의 노출 outputs (exit/end 노드 매핑). v1 은 "마지막 노드의 output" 단순 노출 */ },
    "finalNodeId": "uuid",
    "finalPort":   "out" | "completed" | "<condition.id>" | "user_ended" | "max_turns" | "error"
    // "completed" 는 Information Extractor multi-turn 의 정상 종료 포트 (Spec 4-nodes/3-ai/3-information-extractor §3.2)
  },
  "durationMs": 12345,
  "timestamp":  "ISO8601",
  "seq":        99
}
```

### 6.4 페이로드 — `execution.failed`

```jsonc
{
  "type":        "execution.failed",
  "executionId": "uuid",
  "triggerId":   "uuid",
  "workflowId":  "uuid",
  "error": {
    "code":    "EXECUTION_TIMEOUT" | "MAX_ITERATIONS_EXCEEDED" | "CYCLE_DETECTED" | ... ,  // 엔진 수준 에러코드 — 정본은 spec/5-system/3-error-handling.md §엔진 수준 에러. 노드 수준 실패는 `error.code` 에 노드 ErrorCode (예: LLM_TIMEOUT)
    //         (노드 ErrorCode 정식 목록: codebase/backend/src/nodes/core/error-codes.ts)
    "message": "사람-가독 메시지",
    "nodeId":  "uuid" | null,
    "details": { ... }    // 노드 타입별 상세
  },
  "durationMs": 12345,
  "timestamp":  "ISO8601",
  "seq":        99
}
```

### 6.5 페이로드 — `execution.cancelled` / `execution.ai_message`

`execution.cancelled` 는 §6.3 의 `result` 자리에 `cancelledBy: "user" | "system" | "timeout"` 만 채운 변형.

`execution.ai_message` 는 [Spec WS §4.4](./6-websocket-protocol.md#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input) 의 `execution.ai_message` payload 를 그대로 포함하며, 본 spec 의 표준 envelope (`triggerId` / `workflowId` / `timestamp` / `seq`) 만 추가로 wrap 한다. WS payload 의 `presentations?: PresentationPayload[]` 필드 (AI Agent `render_*` 표현 도구 호출 turn 에서만 동봉, [Spec AI Agent §7.10](../4-nodes/3-ai/1-ai-agent.md#710-presentation-payload-render_-운반)) 도 그대로 전달된다 — 외부 클라이언트 (SDK) 는 본 필드 존재 시 chat UI 에서 텍스트와 함께 inline 렌더 가능.

### 6.6 재시도

| 항목 | 값 |
|------|-----|
| 성공 기준 | HTTP `2xx` |
| 타임아웃 | 10초 |
| 재시도 횟수 | default 5회 (`notification.retry.maxAttempts`) |
| backoff | 지수: 1s · 4s · 16s · 64s · 256s (default) |
| 동일 이벤트 식별 | `X-Clemvion-Delivery` 헤더 UUID (재시도해도 같음) |
| 최종 실패 시 | Trigger.`notificationHealth = 'degraded'`. 자동 비활성화 금지 (사용자 승인 필요). 실패 이력은 trigger 상세 화면에 표시 |
| Stale 차단 | 발송 직전 execution 상태 재조회 — 이미 cancelled 면 발송 skip |

---

## 7. 데이터 모델

### 7.1 Trigger 엔티티 확장

기존 `Trigger.config` JSONB 에 다음 필드 추가. 신규 컬럼은 만들지 않는다 (마이그레이션 비용 최소화). 단 health 와 secret rotation 추적은 별도 컬럼이 필요.

```sql
ALTER TABLE trigger
  ADD COLUMN notification_health     VARCHAR(16) NOT NULL DEFAULT 'unknown',  -- 'unknown'|'healthy'|'degraded'
  ADD COLUMN notification_last_error TEXT NULL,
  ADD COLUMN notification_secret_v2  TEXT NULL,      -- rotation 기간 (24h) 동안 사용되는 신규 secret
  ADD COLUMN notification_rotated_at TIMESTAMPTZ NULL;
```

`Trigger.config` 의 확장 필드:
```jsonc
{
  // 인증은 trigger.auth_config_id (FK → AuthConfig) 단일 진입. 옛 inline auth
  // 필드 (authType / secret / bearerToken / hmacHeader / hmacAlgorithm) 는 폐지됐고
  // V066 cleanup migration 으로 제거된다 — 잔존 row 에 남아 있어도 코드는 무시한다
  // (SoT: 5-system/12-webhook.md §inline auth path 폐지).

  "notification": {
    "url":     "https://...",
    "events":  ["execution.waiting_for_input", "execution.completed", ...],
    "signing": { "algorithm": "hmac-sha256", "secretRef": "secret://triggers/{triggerId}/notification-signing" },
    "retry":   { "maxAttempts": 5, "backoff": "exponential" }
  },
  "interaction": {
    "enabled":       true,
    "tokenStrategy": "per_execution" | "per_trigger",
    "triggerToken":  "itk_xxx"                       // per_trigger 일 때만
  }
}
```

> `config.notification.signing.secretRef` 의 plaintext 는 [`SecretResolver`](../conventions/secret-store.md) 가 관리하는 `secret_store` 테이블에 backend AES-256-GCM 으로 암호화되어 보관 (DB 는 ciphertext 만) — config JSONB 에는 ref 만. `notification_secret_v2` 컬럼도 동일하게 ref 만 보관 (rotation grace 기간). `config.interaction.triggerToken` 는 현재 JSONB 평문 (향후 secret store 통합 검토).

### 7.2 Execution 엔티티 확장

신규 컬럼 없음. `seq` 는 [Spec 실행 엔진 §1.1](./4-execution-engine.md) 의 monotonic counter 를 재사용 (이미 WebSocket 이벤트가 사용 중).

### 7.3 InteractionToken (in-memory + Redis)

`per_execution` 토큰은 별도 테이블을 만들지 않고 JWT 자체에 모든 정보를 담는다 (sub=executionId, aud='interaction', exp, jti). Revoke 는 jti 의 Redis blacklist (TTL = exp 까지) 로 처리.

`per_trigger` 토큰은 `Trigger.config.interaction.triggerToken` 에 보관되며, revoke 시 새로운 값으로 rotation.

---

## 8. 보안

### 8.1 SSRF 방지 (EIA-NX-10)

`notification.url` 등록 시 다음 검증:
- 호스트 이름이 사설 IP (10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fe80::/10, fc00::/7) 또는 loopback / metadata service IP (169.254.169.254 등) 로 해석되지 않음
- DNS rebinding 방어: 등록 시 IP 와 실제 발송 시 IP 가 다르면 발송 거부 (옵션, 비용 큼)
- 워크스페이스 단위 allowlist/blocklist 설정 가능 (`workspace_settings.notification_url_allow_pattern`)

### 8.2 HMAC 검증 일반 규약

- Timing-safe 비교
- timestamp ±5분 window
- algorithm whitelist: `hmac-sha256` 만. v2 추가 시 `v2=` prefix 로 병행
- 서명 헤더 누락 / 형식 오류 / window 초과 / 검증 실패 모두 동일 401 메시지 — algorithm leak 차단

### 8.3 Token 일반 규약

- JWT HS256, secret 은 trigger 별 분리 (서로 다른 trigger 의 토큰을 cross-validate 불가)
- `iext_*` 의 jti 는 Redis blacklist 가능 — execution 종료 시 즉시 blacklist 등록
- HTTPS 강제 (개발 env 예외)
- 토큰을 query parameter 로 받는 것은 SSE 한정 (`?token=` ; EventSource 가 헤더 미지원). 그 외는 모두 `Authorization: Bearer`

### 8.4 Rate Limit

| 대상 | 한도 |
|------|------|
| Inbound 명령 (`/interact`) | execution 당 분당 60 |
| SSE 동시 연결 | execution 당 3 |
| 단발 status 조회 | execution 당 분당 120 |
| Outbound notification 발송 | trigger 당 분당 60 |

초과 시 `429 Too Many Requests` + `Retry-After` 헤더.

### 8.5 CORS

- `/api/external/executions/:id/interact`, `/stream`, `/cancel`, `/refresh-token` 은 **CORS 허용**: `Access-Control-Allow-Origin` 은 워크스페이스 설정의 `interactionAllowedOrigins` ([Spec 데이터 모델 §2.2 Workspace.settings](../1-data-model.md#22-workspace)) 기준. 미설정 시 차단 (브라우저 호출 시 사용자가 명시 설정 필요). 단 **공식 웹채팅 위젯의 hosted CDN origin 은 빌트인 상수로 항상 허용**(모든 워크스페이스 공통)하고, `interactionAllowedOrigins` 는 그 외 추가 origin (BYO-UI 고객 도메인 등) 을 병합한다 — [Spec Channel Web Chat 보안 §2](../7-channel-web-chat/4-security.md).
- Hooks 엔드포인트 (`/api/hooks/:endpointPath`) 는 기존대로 무제한 CORS.

> **Implementation Note (경로-스코프 CORS — 구현됨)**: 전역 `app.enableCors` 를 **CorsOptionsDelegate 단일 레이어**로 교체해
> 실현했다 ([`main.ts`](../../codebase/backend/src/main.ts), [`common/cors/web-chat-cors.ts`](../../codebase/backend/src/common/cors/web-chat-cors.ts),
> [`modules/web-chat-cors`](../../codebase/backend/src/modules/web-chat-cors/)) — `/api/hooks/*` 무제한, `/api/external/*` 워크스페이스
> allowlist(`WebChatCorsOriginResolver` 가 execution→workflow→workspace 로 역인덱스, 60s TTL 캐시), 그 외 경로는 기존 frontend
> allowlist + credentials 유지. 단일 delegate 라 이중 `Access-Control-Allow-Origin` 충돌이 없다. 상세는 [Spec Channel Web Chat 보안 §2](../7-channel-web-chat/4-security.md).

---

## 9. 처리 흐름

### 9.1 트리거 호출 → waiting_for_input → 사용자 응답 (per_execution)

```
1. 외부 시스템: POST /api/hooks/:endpointPath  (with payload)
2. HooksService: 인증 검증 + Trigger 조회 + Manual Trigger 파라미터 추출
3. ExecutionEngineService.execute() → executionId 생성
4. interaction.enabled=true → InteractionTokenService.issuePerExecution(executionId)
                                            → iext_jwt
5. 응답: 202 Accepted { executionId, status: "pending", interaction: { token, endpoints, ... } }
6. (백그라운드) 실행 엔진 진행 → Form 노드 도달
7. 실행 엔진: NodeExecution.status = WAITING_FOR_INPUT (단일 TX 로 Execution.status 도 갱신)
8. TX commit 후:
   a. WebsocketService.emitToExecution(execution.waiting_for_input, payload)
      → 내부 WS 채널 구독자에게 전파
      → SSE 어댑터가 Redis pub/sub 으로 받아 외부 SSE 스트림에 데이터 라인 push
   b. notification.events 에 "execution.waiting_for_input" 포함되어 있으면
      NotificationDispatcher.enqueue(triggerId, executionId, payload)
      → 발송 직전 execution 상태 재조회 (stale 차단)
      → POST notification.url + HMAC 서명
9. 외부 시스템:
   - notification 수신 → 자체 UI 로 사용자에게 form 안내
   - 또는 SSE 스트림으로 동일 이벤트 수신
10. 사용자 응답 → 외부 시스템 → POST /api/external/executions/:id/interact { command: "submit_form", ... }
11. InteractController:
    a. iext_jwt 검증 (jti blacklist 확인)
    b. Idempotency-Key 캐시 조회
    c. 검증 통과 시 ExecutionEngineService.waitForFormSubmission() 입력 큐에 push
       (= 내부 WS 의 execution.submit_form 명령과 동일 경로)
    d. 검증 실패 (field validation) → 400 + fieldErrors. execution 상태 유지
12. 실행 엔진: 사용자 입력 수신 → resumed → 다음 노드로 진행
13. 종료 시: TX commit 후 notification + SSE 둘 다 발송 → SSE 종료, 토큰 invalidate
```

### 9.2 AI Multi Turn (per_trigger)

```
1~6. 동일. tokenStrategy=per_trigger 라면 응답에 token 미동봉.
7. AI Agent multi-turn 첫 진입: status=waiting_for_input + conversationConfig
8. notification + SSE 동시 emit (events 에 ai_conversation 관련 항목이 포함된 경우)
9. 외부 시스템:
   - 매 user 메시지마다 POST /interact { command: "submit_message", message } with itk_token
   - 진행 도중 execution.ai_message 이벤트가 SSE 로 흐름 + notification 도 옵션 구독 가능
   - 사용자가 대화 종료 → POST /interact { command: "end_conversation" }
10. 종료 시: notification execution.completed (또는 user_ended 포트) + SSE 종료
```

### 9.3 트랜잭션과 발송 순서 (EIA-RL-04)

[Spec 실행 엔진 §1.1](./4-execution-engine.md#11-execution-상태) 의 원자성을 유지: `Execution` + `NodeExecution` 상태 변경의 단일 트랜잭션 commit 후에만 외부로 이벤트를 emit/dispatch 한다. 트랜잭션 rollback 시 어떠한 외부 발송도 발생하지 않는다. 이를 위해 NotificationDispatcher 는 **after-commit hook** (또는 outbox pattern 의 별도 worker — 구현 선택) 으로 트리거된다.

---

## 10. 구현 파일 구조

```
codebase/backend/src/modules/
  external-interaction/
    external-interaction.module.ts
    interaction.controller.ts          # POST /api/external/executions/:id/interact, /cancel, /refresh-token
    interaction-stream.controller.ts   # GET /api/external/executions/:id/stream  (SSE)
    # 모듈 prefix: @Controller('external/executions') — global prefix(`api`) 와 합쳐 실 경로 `/api/external/executions/...`. 기존 `/api/executions/*` 컨트롤러와 분리
    interaction.service.ts             # 토큰 검증 + 명령 dispatch (내부 WS 명령 경로로 forwarding)
    interaction-token.service.ts       # iext_*, itk_* 발급/검증/blacklist
    notification-dispatcher.service.ts # outbound webhook 발송 + 재시도
    sse-adapter.service.ts             # Redis pub/sub → SSE stream
    dto/
      interact.dto.ts
      submit-form.dto.ts
      submit-message.dto.ts
      ...
  hooks/
    hooks.controller.ts                # 기존 — 응답에 interaction 필드 추가
    hooks.service.ts                   # 기존 — InteractionTokenService 의존 추가
  triggers/
    triggers.service.ts                # 기존 — notification/interaction config 검증 추가
    dto/create-trigger.dto.ts          # 기존 — notification/interaction 필드 추가
```

내부 WS 명령 경로 ([Spec WS §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server)) 는 `ExecutionEngineService` 가 책임. 본 모듈은 그 위의 facade.

### 10.1 Swagger / API 문서

본 모듈의 컨트롤러는 워크스페이스 JWT (`access-token` scheme) 가 아니라 별도 토큰 family (`iext_*` / `itk_*`) 로 인증된다. 따라서 `spec/conventions/swagger.md §2-1` 의 `@ApiBearerAuth('access-token')` 대신:

- `main.ts` 에 신규 Bearer scheme 등록: `interaction-token` (= JWT HS256, secret 은 trigger 별 분리)
- 컨트롤러 클래스 데코레이터: `@ApiBearerAuth('interaction-token')`
- Swagger UI 의 토큰 입력란이 access-token 과 분리되어 표시되어야 한다

Hooks 진입점 (`/api/hooks/:endpointPath`) 은 기존대로 `@Public()` + `@ApiSecurity({})` 패턴 유지.

---

## 11. WebSocket 명령 ↔ 외부 명령 매핑

[Spec WebSocket 프로토콜 §4.6](./6-websocket-protocol.md#46-외부-표면-매핑-external-interaction-api) (신설) 에 1:1 매핑 표가 있다. 본 spec 의 5.1 의 표가 그 권위 표와 정합해야 한다.

| 내부 WS 명령 (Client → Server) | 외부 REST 명령 (`/interact` body.command) | 페이로드 필드 매핑 |
|------------------------------|----------------------------------------|----------------|
| `execution.submit_form` | `submit_form` | WS 의 `formData` → REST 의 `data` (의미 동일, naming 만 REST 컨벤션에 맞춤) |
| `execution.click_button` | `click_button` | 동일 |
| `execution.submit_message` | `submit_message` | 동일 |
| `execution.end_conversation` | `end_conversation` | 동일 |
| `execution.stop` | `cancel` | `force` 옵션은 외부에서 미지원 |
| (해당 없음) | — `execution.start` 는 외부 인터페이스에서 지원 안 함 (webhook 트리거로 대체) |
| (해당 없음) | — `execution.continue` / `execution.step` 는 디버깅 전용, 외부 미노출 |

| 내부 WS 이벤트 (Server → Client) | SSE event 이름 | Outbound notification `type` |
|--------------------------------|--------------|-----------------------------|
| `execution.started` | `execution.started` | — (구독 불가, 노이즈) |
| `execution.node.started` | `execution.node.started` | — |
| `execution.node.completed` | `execution.node.completed` | — |
| `execution.node.failed` | `execution.node.failed` | — |
| `execution.node.skipped` | `execution.node.skipped` | — |
| `execution.paused` | `execution.paused` | — (디버깅 전용, 외부 미발송) |
| `execution.waiting_for_input` | `execution.waiting_for_input` | `execution.waiting_for_input` |
| `execution.resumed` | `execution.resumed` | — (transient) |
| `execution.ai_message` | `execution.ai_message` | `execution.ai_message` (optional 구독) |
| `execution.tool_call_started` | `execution.tool_call_started` | — |
| `execution.tool_call_completed` | `execution.tool_call_completed` | — |
| `execution.completed` | `execution.completed` | `execution.completed` |
| `execution.failed` | `execution.failed` | `execution.failed` |
| `execution.cancelled` | `execution.cancelled` | `execution.cancelled` |
| `replay.unavailable` | `execution.replay_unavailable` | — (재연결 응답 전용) |

---

## 12. 호환성

- 기존 `POST /api/hooks/:endpointPath` 응답에 `status` / `interaction` 필드만 **추가**. 기존 클라이언트는 unknown field 를 무시 → 영향 없음.
- 기존 내부 WebSocket 채널 (`/ws`) 은 그대로 유지 — UI 는 이 경로를 계속 사용. 외부 API 추가가 WS 흐름을 변경하지 않는다.
- Trigger 엔티티: 신규 컬럼 4개 (notification_health / notification_last_error / notification_secret_v2 / notification_rotated_at) 추가. config JSONB 는 누락 키 = 미사용 으로 해석 → 기존 트리거 영향 없음.
- 새 API 는 모두 `/api/external/executions/:id/*` 경로로 신설 — 기존 `/api/executions/*` ([Spec 실행/디버깅 §10.x](../3-workflow-editor/3-execution.md), [Spec 실행 내역 §5](../2-navigation/14-execution-history.md)) 와 routing prefix·인증 family 모두 분리되어 충돌 불가. 분리 결정의 근거는 §R11.
- Re-run API (`POST /api/v1/executions/:id/re-run`, [Spec Re-run](./13-replay-rerun.md)) 는 워크스페이스 JWT 전용. 외부 interaction token (`iext_*` / `itk_*`) 으로 Re-run 호출 불가. 외부 시스템이 Re-run 을 트리거하려면 별도 webhook 트리거를 추가하고 그 트리거 호출 시 발급된 새 execution 의 interaction token 을 사용해야 한다.

---

## Rationale

### R1. 두 채널 분리 vs. 한 채널로 통합

**채택**: Outbound notification webhook + Inbound REST/SSE 두 채널을 독립적으로 제공. Trigger 등록 시 `notification` 과 `interaction` 을 각각 켜고 끄게 하며, 인터랙션 없는 자동화는 둘 다 끈 채로 기존 동작 유지. 클라이언트가 항상 SSE 를 열고 있을 수 있는 환경(브라우저 chat 위젯) 이라면 inbound 만으로도 가능하지만, 서버-to-서버 자동화에서는 SSE 를 영속 유지하기 어려우므로 둘 다 optional 로 제공해 사용자가 선택한다. (외부 WebSocket 만 제공하는 안은 §R5 의 근거로 보류.)

**핵심 근거**: 두 채널은 **방향 (outbound push vs inbound pull/post)** 과 **인프라 요구 (URL 호스트 가능 여부 vs 영속 연결 가능 여부)** 가 다르다. 한 채널만으로는 외부 환경의 다양성을 커버할 수 없다 — 예컨대 Notification 만 제공하면 인터랙션이 필요한 워크플로우에서 사용자가 응답할 채널이 사라져 AI Multi Turn / Form / Buttons 가 데드락한다.

### R2. Notification 의 응답으로 인터랙션 받지 않는 결정

**채택**: **인터랙션은 별도 inbound 채널로 분리**하고 notification 은 순수 통보로 한정한다. Outbound notification 의 HTTP 응답 body 로 인터랙션 결과를 받는 방식 (예: `waiting_for_input` notification 에 200 OK + form data 응답 → 그대로 form 제출로 처리) 은 다음 이유로 채택하지 않는다:

- HTTP 응답 1회는 양방향 대화 (AI multi-turn 의 N turn) 를 표현할 수 없다.
- "1 notification = 1 응답" 비대칭 모델이 됨 — 모든 노드를 동일 모델로 묶기 어려움.
- 재시도 시 같은 인터랙션 응답을 여러 번 보내는 ambiguity 가 생긴다 (서버는 첫 응답만 의미 있게 처리해야 하지만, 클라이언트는 "성공 = 인터랙션 반영" 으로 오해 가능).
- HMAC 서명 검증 후 곧장 비즈니스 로직 응답을 요구하는 동기 모델은 클라이언트 구현 부담이 큼.

### R3. SSE 채택 vs WebSocket 외부용 신설

**채택**: SSE (Server-Sent Events) 를 외부 inbound 이벤트 스트림의 1차 채널로.

선정 기준:
- HTTP/1.1 호환 → CDN/리버스 프록시/모바일 환경 친화
- 표준 EventSource 브라우저 API
- 자동 재연결 + `Last-Event-Id` 기반 누락 복구가 표준에 포함
- 서버리스/에지 컴퓨팅 환경에서도 구현 가능

Long-polling 은 라이브 chat·multi-turn 에서 latency 가 커 사용자 경험을 저하시키므로 배제했고, 외부 WebSocket 신설은 §R5 의 별도 결정으로 보류한다.

### R4. `per_execution` 토큰을 default 로

**채택**: `tokenStrategy: "per_execution"` 이 default. 별도 명시할 때만 `per_trigger`.

**근거**:
- 최소 권한 원칙: 토큰 leak 시 영향 범위가 1 execution 으로 한정
- 자동 invalidate: execution 종료 시점에 자동 폐기 — revoke 워크플로우 불필요
- TTL 짧음 (default 1h, 갱신 가능) — 만료된 토큰의 attack window 최소화

`per_trigger` 가 더 편한 시나리오:
- 다수 execution 을 동시에 다루는 봇 (Telegram bot 등) — execution 별 토큰 교환 비용 회피. **단, 본 시나리오는 사용자가 직접 변환층을 구현하는 advanced 케이스 한정** (§2 사용 시나리오 표 2행). 서버사이드 어댑터 ([Spec Chat Channel](./15-chat-channel.md)) 를 사용하는 경우는 EIA-AU-08 (§3.3) 의 in-process 우회로 토큰 사이클 자체가 적용되지 않는다.
- 별도 token store 가 필요한 client (모든 execution 의 token 을 따로 보관해야 함)

→ default 는 안전 쪽, 옵션으로 편의 쪽 모두 제공.

### R5. 외부 WebSocket 채널 신설 — **보류**

**결정**: v1 에서 외부 WebSocket 채널은 신설하지 않는다. SSE + REST 조합으로 충분.

**보류 사유**:
1. **두 구현 분기 위험**: 이미 내부 `/ws` 게이트웨이가 있다. 별도 외부 WS 채널을 만들면 인증 흐름·이벤트 발행 경로·재연결 정책이 두 곳에 존재하게 되어 backend 의 maintenance 부담이 두 배.
2. **양방향 이점이 작음**: 외부 WS 의 양방향 이점 (low-latency duplex) 은 inbound REST POST 로 충분히 대체된다. multi-turn AI chat 도 SSE event 수신 + REST submit 패턴으로 동작 (실측 latency 100ms 대 → 사람 인지 가능 임계 미만).
3. **인프라 제약**: WS 는 CDN/서버리스/모바일 환경에서 까다롭다. 일부 기업 방화벽이 WS 를 차단하기도 한다. SSE 는 표준 HTTP 응답이므로 우회 경로가 사실상 없음.
4. **호환성 모델 단순화**: 외부 클라이언트가 두 채널 (SSE 와 WS) 중 선택 가능해지면 SDK·문서·테스트 매트릭스가 N×2 로 늘어난다. v1 은 단일 표면 (SSE+REST) 으로 통일해 학습 곡선을 낮춤.

**미래 재논의 트리거** (이 중 하나라도 발생하면 외부 WS 도입을 재검토):
- SSE 의 동시 연결 수 한계 (브라우저당 6개 HTTP/1.1) 가 실제 병목으로 측정됨
- inbound REST 의 round-trip latency 가 사용자 경험 저해 수준으로 측정됨 (>300ms 평균)
- 클라이언트 요청 빈도가 높아 (분당 60+) per-execution REST 부하가 SSE 부하 대비 비효율적임이 입증됨
- 외부 WS 를 명시적으로 요구하는 대형 통합 파트너가 생김

재도입 시 권장 형태: 기존 `/ws` 게이트웨이를 그대로 재사용하고, 인증 단계에서 `iext_*` / `itk_*` 토큰도 받게 확장. 별도 URL 신설 금지. 명령·이벤트 형식은 [Spec WS §4.1·§4.2](./6-websocket-protocol.md) 와 100% 일치 → 두 구현 분기 차단.

### R6. Notification 실패 시 자동 비활성화 금지

**채택**: notification 5회 연속 실패 시 trigger 의 `notificationHealth` 만 `degraded` 로 표시. trigger 자체는 비활성화하지 않는다.

**근거**: notification 은 trigger 의 **부수 기능**. 자동 비활성화는 본체(워크플로우 실행) 까지 멈추게 한다. 사용자 의도와 다를 수 있음 — degraded 표시 + 알림 + UI 에서 명시 비활성화 버튼 제공이 적절. 자동 차단은 사용자 confirm 필요.

### R7. seq 동일 공유 — SSE 와 notification

**채택**: SSE 의 `id` 와 notification 페이로드의 `seq` 는 같은 monotonic counter (= [Spec WS §2.2](./6-websocket-protocol.md#22-서버--클라이언트-이벤트-래퍼) 의 `seq`).

**근거**:
- 동일 클라이언트가 SSE + notification 둘 다 구독하더라도 dedup 가능
- 디버깅 시 backend 로그·DB 의 emit 순서와 클라이언트가 본 순서를 1:1 대응할 수 있음
- 신규 counter 도입 시 두 채널 간 정합성 검증이 별도 필요해짐 → 비용 크고 이득 없음

**구현 전제**: 본 spec 의 외부 표면 (SSE / Notification) 은 seq 가 필수 전제이므로, execution 별 atomic INCR (Redis `INCR exec:seq:<id>` 또는 DB row-level lock) 로 발급되는 seq counter 를 신설한다. 같은 counter 가 WS event envelope · SSE `id:` · Notification `seq` 세 곳 모두에 동봉된다.

### R8. Idempotency-Key 와 `submit_form` 검증 실패의 관계

**채택**: `submit_form` 의 field validation 실패는 **idempotent 응답 캐시에 적재하지 않는다**. waiting_for_input 상태가 유지되어 사용자가 재제출 가능하기 때문에, 동일 key 로 새 body 를 보내는 것은 normal flow. 즉 4xx 응답 중 `400 VALIDATION_FAILED` 만 idempotency cache 에서 제외하고, 그 외 (성공 2xx / `409 Conflict` / `410 Gone`) 는 캐시한다.

**근거**: validation 실패가 캐시되면 사용자가 form 수정 후 재제출 시 같은 key 를 쓰면 stale 에러가 반환된다. 이는 [Spec 실행 엔진 §1.3](./4-execution-engine.md#13-블로킹재개-컨트랙트-nodehandleroutput-status) 의 "검증 실패 → waiting_for_input 유지 → 재제출 가능" 컨벤션과 직접 충돌하며, 사용자 UX (form 수정 → 재제출) 가 깨진다.

### R9. spec 위치 — `5-system/` 하위 신규 파일

**채택**: `spec/5-system/14-external-interaction-api.md` 로 신설. 12-webhook 의 본문에 흡수하지 않음.

**근거**:
- 12-webhook 은 "트리거 진입점" 의 책임에 집중. 본 spec 은 "실행 도중 인터랙션 채널" 로 다른 layer.
- 12-webhook 본문에 모두 흡수하면 단일 파일이 1500줄 + 두 관심사가 섞임.
- 14 번호는 13-replay-rerun 의 다음 자리. cross-link 가 많은 spec 이므로 별도 파일 유지가 navigation 에 유리.

12-webhook 은 §3.4 관리 표에 "notification / interaction 설정 필드" 행만 추가하고 본문 cross-link 로 본 spec 을 가리킨다.

### R10. WebsocketService 단일 sink 정책의 확장

**참조**: [Spec 실행 엔진 §4.4](./4-execution-engine.md) 의 "이벤트 발행 sink — `WebsocketService` 단일 sink 정책" Rationale 마지막 문장 — "향후 외부 sink (Webhook 콜백, 텔레메트리 export 등) 가 실제로 추가될 때 본 결정을 재검토한다."

본 spec 의 `NotificationDispatcher` 는 그 재검토 트리거에 해당한다. 결정:

**채택**: 실행 엔진 §4.4 의 "엔진 레벨 단일 sink" 정책은 **유지**. NotificationDispatcher 와 SSE 어댑터는 **엔진 외부의 facade 레이어**로 위치시킨다.

구체적 구조:
- 실행 엔진은 여전히 `WebsocketService.emitToExecution` 한 곳만 호출 (= 단일 sink)
- NotificationDispatcher 는 별도 outbox/after-commit hook 으로 트리거 (§9.3 참조). 엔진 내부 코드가 직접 호출하지 않음
- SSE 어댑터는 Redis pub/sub 으로 WebsocketService 가 발행한 이벤트를 구독해 외부 SSE 스트림으로 변환. 엔진과 직접 결합 없음

**근거**:
- 엔진 코드가 외부 sink 종류를 알 필요 없음 → 실행 엔진 §4.4 의 책임 분리 원칙 유지
- 새 외부 sink 추가 (텔레메트리 export 등) 시 엔진 코드 수정 없이 facade 만 추가 가능
- 트랜잭션 commit 후 emit 규약 (§9.3 EIA-RL-04) 이 단일 sink 정책의 timing 보장과 자연스럽게 정합

NotificationDispatcher 를 엔진 내부에서 직접 호출하는 대안은 채택하지 않는다 — 엔진이 외부 sink 종류·재시도·서명·SSRF 정책을 모두 알아야 해 단일 책임을 위반하고, 실행 엔진 §4.4 의 책임 격리 결정을 번복하게 된다.

**추가 facade 사례 — Chat Channel adapter**: [Spec Chat Channel](./15-chat-channel.md) 의 server-side 어댑터(`ChatChannelDispatcher`)도 NotificationDispatcher 와 **동일 facade 계층의 형제 in-process subscriber** 로 위치한다. 구체 구독 메커니즘은 단일 sink `WebsocketService.executionEvents$` (RxJS Subject) 에 `onModuleInit` 에서 **직접 subscribe** (NotificationDispatcher 의 downstream 이 아닌 형제 listener). 외부 HTTP notification 와 어댑터의 채널 emit 은 같은 단일 sink 에서 commit 후 fan-out 되어 EIA-RL-04 (TX commit 후 발송) 정합. 어댑터는 엔진 내부 코드를 호출하지 않으며, 본 R10 의 **엔진 단일 sink + 외부 facade** 원칙을 깨지 않는다 — 기각된 대안 (NotificationDispatcher 를 엔진 내부에서 직접 호출) 과의 구조적 차이는 어댑터 역시 엔진 외부에서 NotificationDispatcher 가 emit 하는 결과만 받는다는 점.

단일 sink `WebsocketService.executionEvents$` (RxJS Subject) 에는 **세 형제 listener** 가 직접 subscribe 한다 — 모두 같은 facade 계층이며, 셋 다 동일 `seq` 와 동일 TX commit timing 을 공유한다:

- (a) **`NotificationDispatcher`** — 외부 HTTP POST (notification webhook). 다중 인스턴스 환경의 외부 SSE 클라이언트 fan-out 을 위해 **Redis pub/sub** 발행도 담당.
- (b) **SSE 어댑터** — 외부 SSE 클라이언트가 임의 인스턴스에 접속 가능해야 하므로 Redis pub/sub 경유 구독.
- (c) **`ChatChannelDispatcher`** — 같은 process 내 in-process 구독으로 외부 채널 `sendMessage` 변환.

즉 Chat Channel 어댑터는 NotificationDispatcher 의 downstream 이 **아니라** 단일 sink 의 형제 consumer 다 (NotificationDispatcher 가 chat-channel 용 EventEmitter 를 별도 emit 하지 않는다).

**chat-channel-internal 추가 listener 의 R10 허용 범위**: chat-channel 어댑터가 outbound 5종 (§6.1 화이트리스트) 외에 in-process fan-out 채널의 추가 이벤트 (현재 `execution.node.completed` — [Convention §1.3 `ChatChannelInternalEvent`](../conventions/chat-channel-adapter.md#13-chatchannelinternalevent-입력)) 를 sub-filter 로 attach 하는 것은 R10 허용 범위. 단일 sink 자체는 여전히 `WebsocketService.emit*` 하나이며, 어댑터는 그 sink 의 consumer (= NotificationDispatcher 와 동일 facade 계층) 한정 — 새 sink 도입 없음. 외부 HTTP webhook (§6.1) 화이트리스트 5종은 변경 없음 (chat-channel-internal 한정, 외부 SDK 미노출). 결정 SoT: [Chat Channel §R-CC-16](./15-chat-channel.md#r-cc-16-chat-channel-outbound-의-비-blocking-presentation--ai-render_-presentations-발화).

### R11. 외부 endpoint 경로 prefix 분리 — `/api/external/executions/*`

**채택**: 외부 인터랙션 endpoint 는 모두 `/api/external/executions/:id/*` prefix 로 신설. 기존 `/api/executions/*` (워크스페이스 JWT, 에디터·UI 전용) 와 routing prefix·인증 family 둘 다 분리한다. 별도 prefix 로 컨트롤러 분리가 명확해지고, Guard·CORS·rate-limit 정책을 prefix 단위로 적용 가능하며 Swagger 에서도 별도 tag 로 표현된다.

같은 경로 `/api/executions/:id/*` 에 Guard 를 분기해 두 토큰 family 를 수용하는 안은 채택하지 않는다 — (a) 응답 shape 가 family 별로 달라지면 spec 이 모호해지고 (b) 한 Guard 가 두 토큰 family 를 매번 분기해야 하므로 코드 복잡도가 증가하며 (c) 기존 endpoint 의 응답 shape 변경 위험 (외부 토큰용 경량 view 가 기존 UI 에 영향). 같은 path 에 별도 controller 를 등록하는 안도 NestJS 라우터가 모호해져 런타임 에러 가능성이 있어 배제한다.

**근거**:
- 경로 충돌 (`GET /api/executions/:id` 의 응답 shape 차이, `POST /api/executions/:id/stop` 과 `cancel` 의 의미 중복) 이 prefix 분리로 즉시 해소
- prefix 분리는 외부 API 가 internal API 의 일부가 아니라 별도 표면임을 URL 만 봐도 알 수 있게 함 — facade 원칙 (§R5) 의 코드 수준 표현
- 미래 확장 (예: `/api/external/triggers/*`, `/api/external/workflows/:id/runs/*`) 도 동일 prefix 아래 확장 가능

### R12. HMAC 알고리즘 표기 — inbound vs outbound 분리

**채택**: Trigger 의 inbound webhook HMAC 검증 ([Spec Webhook §4.2](./12-webhook.md#42-hmac-서명)) 은 `hmacAlgorithm: 'sha256' | 'sha512'`. 본 spec 의 outbound notification 서명 표기는 `signing.algorithm: 'hmac-sha256' | 'hmac-sha512'`. inbound 는 외부 발신자(GitHub 등) 의 서명 헤더 형식 (`X-Hub-Signature-256: sha256=...`) 과 정합해야 하고, outbound 는 본 spec 의 자체 서명 헤더 (`X-Clemvion-Signature: t=...,v1=...`) 의 알고리즘 식별자 의미가 명시적이도록 `hmac-` prefix 를 부여한다.

양쪽을 모두 `sha256` 으로 통일하는 안은 outbound 표기에서 "HMAC 서명" 임이 명시적이지 않아 향후 다른 서명 방식 (예: Ed25519) 추가 시 식별자 ambiguity 가 생기고, 양쪽을 모두 `hmac-sha256` 으로 통일하는 안은 inbound 가 외부 발신자가 정한 헤더 형식 (`sha256=<hex>`) 과 정합해야 하므로 12-webhook 의 기존 표기를 바꾸면 backward incompat 이 되어 모두 채택하지 않는다.

각 경로에서 algorithm 화이트리스트는 `sha256`/`sha512` 만 (둘 다). 본 spec §3.1 EIA-NX-03 에 두 표기의 관계를 명시.
