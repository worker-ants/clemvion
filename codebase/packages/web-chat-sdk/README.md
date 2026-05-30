# @clemvion/web-chat (잠정 scope) — 웹채팅 위젯 SDK

CDN 스니펫 로더 + npm 패키지. host↔iframe(`wc:*`) bridge + 공개 JS API. EIA HTTP/SSE 호출은
[`@workflow/sdk`](../sdk/) 를 재사용한다(web-chat → @workflow/sdk).

> **scope 잠정**: `@clemvion/*` 는 잠정값 — [`plan/in-progress/eia-sdk-publish.md`](../../../plan/in-progress/eia-sdk-publish.md) §결정 #3 (`@workflow/*` vs `@clemvion/*`) 확정에 종속.

- Spec(SoT): [`spec/7-channel-web-chat/2-sdk.md`](../../../spec/7-channel-web-chat/2-sdk.md).
- 위젯 SPA(iframe 내부 앱): [`codebase/channel-web-chat`](../../channel-web-chat/).

## 사용 (요약)

```ts
import { ClemvionChat } from "@clemvion/web-chat";
const chat = ClemvionChat.boot({ apiBase, triggerEndpointPath, appearance, welcome, launcher });
chat.on("message", (m) => {/* host 자체 분석 */});
chat.open();
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
