# @workflow/sdk

Clemvion External Interaction API client SDK — webhook 트리거로 워크플로우를 시작하고, 도중에 인터랙션 노드(Form / 버튼 / AI Multi Turn)에 응답하며, terminal 이벤트를 받기 위한 외부 통합용 라이브러리.

상세 spec: `spec/5-system/14-external-interaction-api.md`.

## 설치

```bash
npm install @workflow/sdk
```

요구사항: Node.js 20+ (global fetch 사용) 또는 `fetchImpl` 옵션으로 브라우저/polyfill 주입.

## 사용 예

### 1. 트리거 호출 + Form 응답

```ts
import { ClemvionClient } from '@workflow/sdk';

const client = new ClemvionClient({
  baseUrl: 'https://api.clemvion.ai',
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

## API

### `ClemvionClient`

- `triggerWebhook(endpointPath, body, init?)` — `POST /api/hooks/:endpointPath`
- `interact(executionId, token, request, init?)` — `POST /api/external/executions/:id/interact`. `init.idempotencyKey` 미명시 시 UUIDv4 자동 발급.
- `cancel(executionId, token, reason?)` — `POST /:id/cancel` (편의 alias)
- `refreshToken(executionId, token)` — `POST /:id/refresh-token`. 만료 30분 이내일 때만 valid.
- `getStatus(executionId, token)` — `GET /:id` 단발 상태 조회 (SSE 가 권위 — 본 endpoint 는 보정용).
- `subscribeToExecution(executionId, token, handlers)` — SSE 구독. handlers.lastEventId 로 재연결.

### `verifyNotificationSignature(header, rawBody, secret, algorithm?, opts?)`

Outbound notification 의 `X-Clemvion-Signature` 헤더 검증. Stripe-style `t=<unix>,v1=<hex>`. timing-safe 비교 + ±5분 window. secret rotation 시 v1= 두 개 중 하나만 매칭되어도 valid.

## 호환성

- Node.js 20+ (global fetch). 18 이하 또는 브라우저는 `fetchImpl` 옵션으로 polyfill 주입.
- TypeScript strict mode 호환. Type definitions 포함.

## 라이선스

Apache-2.0.
