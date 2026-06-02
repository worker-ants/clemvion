# @workflow/web-chat — 웹채팅 위젯 SDK

CDN 스니펫 로더 + npm 패키지. host↔iframe(`wc:*`) bridge + 공개 JS API. EIA HTTP/SSE 호출은
[`@workflow/sdk`](../sdk/) 를 재사용한다(web-chat → @workflow/sdk).

> **scope 확정**: `@workflow/*` — [`plan/in-progress/eia-sdk-publish.md`](../../../plan/in-progress/eia-sdk-publish.md) §결정 #3 에서 `@workflow/sdk` 와 일관되게 통일. publish 정책은 internal-only(별도 지정 전까지).

- Spec(SoT): [`spec/7-channel-web-chat/2-sdk.md`](../../../spec/7-channel-web-chat/2-sdk.md).
- 위젯 SPA(iframe 내부 앱): [`codebase/channel-web-chat`](../../channel-web-chat/).

## 사용 (요약)

```ts
import { ClemvionChat } from "@workflow/web-chat";
const chat = ClemvionChat.boot({ apiBase, triggerEndpointPath, appearance, welcome, launcher });
chat.on("message", (m) => {/* host 자체 분석 */});
chat.open();
```

### 이벤트 구독 해제

`on()` 은 구독 해제 함수(`Unsubscribe`)를 반환한다. SPA 언마운트 시 cleanup 에 사용한다:

```ts
// unsubscribe 함수로 특정 핸들러 해제
const unsubscribe = chat.on("message", handleMessage);
unsubscribe(); // 해당 핸들러만 제거

// off(event) 로 이벤트 전체 해제
chat.off("message");

// off(event, cb) 로 특정 핸들러만 해제
chat.off("unread", handleUnread);
```

## 상태

구현됨: 타입(`BootConfig`/`ChatInstance`/`wc:*` 프로토콜) + `boot`/`validateBootConfig`/`setWidgetBase` +
`WidgetBridge`(iframe 주입·양방향 origin 검증·명령 큐) + 스니펫 로더 IIFE(`dist/loader.js`, 전역 `ClemvionChat`).
EIA HTTP/SSE 호출은 위젯 SPA 내부([`channel-web-chat`](../../channel-web-chat/))에서 수행한다.
잔여(rich presentation·rate-limit 등)는 [`channel-web-chat-followups.md`](../../../plan/in-progress/channel-web-chat-followups.md).

### setWidgetBase

위젯 CDN base 는 배포 env 로 주입한다(0-architecture §4). 스니펫은 로더 스크립트 src 에서 자동 유도하며,
npm 사용 시 명시 지정 가능:

```ts
ClemvionChat.setWidgetBase("https://cdn.example.com");
```

스니펫 큐: 로더가 비동기 로드되는 동안 `ClemvionChat(...)` 호출은 `ClemvionChat.q` 에 버퍼링됐다가 로드 완료 시 순서대로 replay 된다.

## M2 BYO-UI (headless)

Hosted iframe 위젯 대신 **자체 UI 를 직접 구성**하려면 별도 web-chat 패키지가 아니라 **EIA 클라이언트
[`@workflow/sdk`](../sdk/)(`ClemvionClient`)를 직접 사용**한다(2-sdk §2 · 0-architecture §5.3). web-chat 은 그 위에
얹는 hosted 레이어이며, M2 의 headless client 표면은 `@workflow/sdk` 가 단일 진실이다(중복 패키지 미신설).

```ts
import { ClemvionClient } from "@workflow/sdk";

const client = new ClemvionClient({ baseUrl: apiBase });
const { executionId, interaction } = await client.triggerWebhook(endpointPath, { firstMessage });
const token = interaction!.token!;

const sub = client.subscribeToExecution(executionId, token, {
  onEvent: (e) => {
    if (e.event === "execution.ai_message") renderAssistant(e.data.message); // 자체 UI
  },
});
await client.interact(executionId, token, { command: "submit_message", message: "..." });
```

- 전체 예제: [`examples/byo-ui-headless.ts`](./examples/byo-ui-headless.ts) (`startHeadlessChat` 헬퍼).
- 호출 Origin = 고객 도메인 → 워크스페이스 `interactionAllowedOrigins` 등록 필요(4-security §2).
- 토큰 만료 30분 이내 자동 갱신은 `client.refreshToken(...)` 으로 직접 스케줄링(hosted 위젯은 내장, 3-auth-session §3).
