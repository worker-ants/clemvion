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

## 상태 (스캐폴딩)

공개 표면(타입 `BootConfig`/`ChatInstance` + `boot`/`validateBootConfig`)만. iframe 주입·`wc:*` postMessage
bridge·명령 큐·EIA 클라이언트 연동은 후속 increment. 진행: [`plan/in-progress/channel-web-chat-impl.md`](../../../plan/in-progress/channel-web-chat-impl.md).
