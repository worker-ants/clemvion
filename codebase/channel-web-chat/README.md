# channel-web-chat — 임베드형 웹채팅 위젯 SPA

iframe 내부에서 렌더되는 채팅 UI. **Next.js CSR 전용**(`output: 'export'`) — Node 서버 런타임 없이 정적 번들(`out/`)로
빌드해 CDN 호스팅 + iframe 임베드한다.

- Spec(SoT): [`spec/7-channel-web-chat/`](../../spec/7-channel-web-chat/) — 위젯 SPA 는 [`1-widget-app.md`](../../spec/7-channel-web-chat/1-widget-app.md).
- SDK(loader/bridge): [`codebase/packages/web-chat-sdk`](../packages/web-chat-sdk/). EIA 호출은 [`@workflow/sdk`](../packages/sdk/) 재사용.

## CSR-only 원칙

- 모든 UI 는 Client Component(`'use client'`). 채팅 shell 은 `dynamic(ssr:false)`.
- Server Component 데이터 페칭 / Server Actions / Route Handlers 미사용.
- 런타임 외부 입력은 URL 쿼리 / postMessage(`wc:*`) 로만.

## 스크립트

```
npm install
npm run dev        # 로컬 개발
npm run build      # 정적 export → out/
npm run lint
npm run typecheck
```

## 상태

구현됨: 상태기계(`src/lib/widget-state`), EIA 클라이언트(`src/lib/eia-client`), conversation 렌더 규약
(`src/lib/conversation` — `[user-input]` strip·`live`/`injected`), 세션 복원(`src/lib/session-store`),
화면(런처/패널/메시지/Form/입력/면책), host↔iframe bridge(`src/widget/host-bridge`),
rich presentation 렌더러(carousel/table/chart/template — `src/widget/components/presentations.tsx`),
DOMPurify+marked 기반 template 안전 HTML 렌더(`src/lib/safe-html.ts`),
차트 축 레이블·범례·툴팁(`CartesianChart`/`PieChart` inline SVG).
진행 추적: [`channel-web-chat-impl.md`](../../plan/in-progress/channel-web-chat-impl.md).
