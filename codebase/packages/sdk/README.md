# @workflow/sdk

Clemvion External Interaction API client SDK — webhook 트리거로 워크플로우를 시작하고, 도중에 인터랙션 노드(Form / 버튼 / AI Multi Turn)에 응답하며, terminal 이벤트를 받기 위한 외부 통합용 라이브러리.

상세 spec: `spec/5-system/14-external-interaction-api.md`.

> **v0 alpha (0.1.x)** — 외부 publish 전. SemVer 정책: 0.x 동안 minor 도 breaking change 가능. 1.0 이후부터 strict SemVer.

## 설치

```bash
npm install @workflow/sdk
```

요구사항: Node.js 20+ (global fetch 사용) 또는 `fetchImpl` 옵션으로 브라우저/polyfill 주입.

## 환경변수

- `CLEMVION_NOTIFICATION_SECRET` — outbound notification 수신 측 검증에 사용. trigger 등록 시 backend 가 반환한 평문 secret 을 그대로 저장. (SDK 가 직접 읽지 않음 — 예제에서 호출자 코드의 관례를 보여줄 뿐.)

## 사용 예

### 1. 트리거 호출 + Form 응답

```ts
import { ClemvionClient } from '@workflow/sdk';

const client = new ClemvionClient({
  baseUrl: 'https://api.clemvion.ai',
  // production 권장: allowInsecureBaseUrl: false  (https 강제 + SSRF 차단)
});

const result = await client.triggerWebhook('my-endpoint-path', {
  orderId: 'ORD-1',
});
console.log('executionId:', result.executionId);

if (result.interaction?.token) {
  // Form 노드 응답
  await client.interact(result.executionId, result.interaction.token, {
    command: 'submit_form',
    nodeId: '<form-node-uuid>',
    data: { approver: 'alice', amount: 1000 },
  });
}
```

### 2. AI Multi Turn 대화

```ts
const sub = client.subscribeToExecution(
  result.executionId,
  result.interaction!.token!,
  {
    onEvent: (e) => {
      if (e.event === 'execution.ai_message') {
        console.log('assistant:', e.data.message);
      } else if (e.event === 'execution.completed') {
        console.log('done');
      }
    },
    onError: (err) => console.error('SSE error:', err),
  },
);

// 사용자 메시지 제출
await client.interact(result.executionId, result.interaction!.token!, {
  command: 'submit_message',
  nodeId: '<ai-node-uuid>',
  message: '주문 상태 확인해줘',
});

// 대화 종료
await client.interact(result.executionId, result.interaction!.token!, {
  command: 'end_conversation',
  nodeId: '<ai-node-uuid>',
});

sub.close();
```

### 3. Outbound Notification 서명 검증

자체 서버가 Clemvion 의 outbound notification 을 수신할 때 HMAC 서명 검증:

```ts
import { verifyNotificationSignature } from '@workflow/sdk';

app.post('/my-webhook-receiver', (req, res) => {
  const result = verifyNotificationSignature(
    req.headers['x-clemvion-signature'] as string,
    req.rawBody, // express raw body
    process.env.CLEMVION_NOTIFICATION_SECRET!,
  );
  if (!result.valid) {
    return res.status(401).json({ error: result.reason });
  }
  // ... 이벤트 처리
  res.status(200).end();
});
```

### 4. 재연결 (Reconnect 패턴)

SDK v0 은 SSE 자동 재연결을 지원하지 않습니다. `onError` 안에서 `lastSeq()` 를 읽어 직접 재구독하세요:

```ts
let lastSeq = 0;
function start() {
  const sub = client.subscribeToExecution(executionId, token, {
    lastEventId: lastSeq, // 재구독 시 누락분 replay
    onEvent: (e) => {
      lastSeq = e.seq;
      handle(e);
    },
    onError: (err) => {
      console.warn('SSE 끊김 — 재연결:', err.message);
      setTimeout(start, 1000); // 지수 백오프 권장
    },
  });
  return sub;
}
start();
```

## API

### `ClemvionClient`

| 메서드 | HTTP | 설명 |
|--------|------|------|
| `triggerWebhook(endpointPath, body, init?)` | `POST /api/hooks/:endpointPath` | Webhook 트리거 호출. trigger 의 `interaction.enabled=true` 일 때 응답에 token + endpoints 동봉 |
| `interact(executionId, token, request, init?)` | `POST /api/external/executions/:id/interact` | 5 command (submit_form / click_button / submit_message / end_conversation / cancel). `init.idempotencyKey` 미명시 시 UUIDv4 자동 발급 — **재시도 시 동일 key 재사용 필수** (자동 발급은 매번 새 UUID) |
| `cancel(executionId, token, reason?, init?)` | `POST /api/external/executions/:id/cancel` | 명시적 cancel — backend 의 별도 endpoint. `interact({ command: 'cancel' })` 와 동일 효과이나 별도 URL. `init.idempotencyKey` 자동 발급 (interact 와 일관) |
| `refreshToken(executionId, token)` | `POST /api/external/executions/:id/refresh-token` | 만료 30분 이내일 때만 valid |
| `getStatus(executionId, token)` | `GET /api/external/executions/:id` | 단발 상태 조회. SSE 가 권위 — 본 endpoint 는 보정용 |
| `subscribeToExecution(executionId, token, handlers)` | `GET /api/external/executions/:id/stream` | SSE 구독. `handlers.lastEventId` 로 재연결 시 누락분 replay. terminal event 후 자동 종료 |

### `cancel()` vs `interact({ command: 'cancel' })`

두 방법 모두 동일한 backend 효과 (execution 취소). 차이:

- **`cancel()` (권장)** — 별도 endpoint, body 가 `{ reason }` 만. 멱등성 자동 보장 (Idempotency-Key 자동).
- **`interact({ command: 'cancel', reason })`** — 통합 endpoint, body 가 `{ command, reason }`. 다른 command 와 같은 흐름을 쓰고 싶을 때.

내부 API 호출 경로가 다르므로, **하나의 클라이언트에서는 한쪽만 일관 사용** 권장 (혼용 시 idempotency 충돌 없음 — 별도 endpoint 이므로 Redis cache key 도 다름).

### `verifyNotificationSignature(header, rawBody, secret, algorithm?, opts?)`

Outbound notification 의 `X-Clemvion-Signature` 헤더 검증. Stripe-style `t=<unix>,v1=<hex>`. timing-safe 비교 + ±5분 window. secret rotation 시 v1= 두 개 중 하나만 매칭되어도 valid. v1= hex 는 엄격 검증 (`[0-9a-fA-F]+`, 짝수 길이).

### `computeNotificationSignature(algorithm, secret, timestampSec, rawBody)`

발신 측 호환 헬퍼 — backend 의 서명을 mock / replay 하고 싶을 때 사용. **production code 에서 사용 자제** (backend 가 자동 서명하므로 SDK 사용자는 거의 호출하지 않음).

### `ClemvionApiError`

API 호출 실패 시 throw. `status` / `body` / `code` 노출.

> **주의**: `body` 는 backend 응답의 raw text — 민감 정보가 포함될 수 있어 외부 로깅 시 redact 권장.

### `SseEvent`

```ts
interface SseEvent {
  event: string;     // 'execution.completed' | 'execution.ai_message' | ...
  seq: number;       // monotonic counter (Last-Event-Id 와 동일)
  data: Record<string, unknown>;  // 이벤트별 페이로드
}
```

이벤트 종류와 `data` 페이로드 매핑은 `spec/5-system/6-websocket-protocol.md §4.1·§4.4` 와 `spec/5-system/14-external-interaction-api.md §6.2~§6.5` 참조.

## 보안

### SSE 토큰 query string

EventSource API 호환을 위해 SSE 호출 시 `?token=<iext_*>` 가 URL 에 포함됩니다. 서버 액세스 로그·리버스 프록시 로그에 토큰이 기록될 수 있으므로:

- 서버 로그 collector 에서 `?token=` query param redact 설정 권장
- production 에서는 단명 토큰 (default 1h) 사용으로 위험 시간을 한정

### Base URL SSRF

`baseUrl` 의 protocol scheme 은 default 로 검증 OFF (dev/test 호환). production 통합에서는 `allowInsecureBaseUrl: false` 명시로 https 강제:

```ts
new ClemvionClient({
  baseUrl: 'https://api.clemvion.ai',
  allowInsecureBaseUrl: false,  // dev 환경 외에는 권장
});
```

### Body 로깅

`ClemvionApiError.body` 는 응답의 raw text — 외부 로깅·sentry breadcrumb 등에 그대로 보내지 않도록 호출자가 redact.

## 호환성

- Node.js 20+ (global fetch). 18 이하 또는 브라우저는 `fetchImpl` 옵션으로 polyfill 주입.
- TypeScript strict mode 호환. Type definitions 포함.

## 라이선스

Apache-2.0.

## CHANGELOG

### 0.1.0 (2026-05-21)

- 첫 publish 준비 — 외부 publish 전 단계.
- ClemvionClient: triggerWebhook / interact / cancel / refreshToken / getStatus / subscribeToExecution
- HMAC 서명 검증: verifyNotificationSignature / computeNotificationSignature
- 브라우저 호환 randomUUID
- SSE: Last-Event-Id 재연결 buffer 지원 (자동 재연결은 v0 미지원 — Reconnect 패턴 참고)
