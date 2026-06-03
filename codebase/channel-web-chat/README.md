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
npm run dev        # 로컬 개발 — 포트 3013(.env 의 PORT 로 override 가능)
npm run build      # 정적 export → out/
npm run lint
npm run typecheck
```

포트는 backend(:3011)·frontend(:3012)와 겹치지 않도록 기본 **:3013** 이다(`${PORT:-3013}`). `.env`
(미추적, `.env.example` 참고)에 `PORT=` 로 바꿀 수 있다.

## 로컬 데모 (`/demo`, dev 전용)

위젯 SPA(`/`)는 그 자체가 **iframe 안에서 도는 임베드 본체**라, `npm run dev` 로 `/` 를 직접 열면
호스트로부터 boot 설정(`wc:boot`)을 받기 전이라 우측 하단 런처 버튼을 눌러도 패널이 열리지 않는다
(설정 미주입 = 정상 동작 불가). 로컬에서 정상 테스트하려면 호스트 역할을 하는 데모 페이지를 쓴다:

```
npm run dev
# http://localhost:3013/demo 접속
```

`/demo` 는 운영에서 SDK(`@workflow/web-chat`)가 하는 호스트 역할을 흉내내는 dev 하니스다:

- 좌측 폼에 **API Host(apiBase)** 와 **공개 webhook trigger path** 를 입력(나머지 외형·추천질문은 선택).
- **부팅** 클릭 → 우측 iframe 위젯에 `wc:boot` 를 postMessage 로 주입. 이때부터 런처/패널이 동작한다.
- `open`/`close`/`sendMessage` 명령 버튼 + 위젯이 보내는 `wc:event` 이벤트 로그 제공.

실제 대화까지 보려면 **backend(:3011)** 가 떠 있고, 그 안에 만든 **공개 webhook 트리거의 endpoint
path(UUID)** 를 trigger 칸에 붙여넣어야 한다(backend 트리거 화면에서 복사). backend 없이도 위젯 UI
부팅·패널 전개는 확인된다.

> **apiBase 는 origin (`/api` 제외)**: EIA 클라이언트가 `/api/hooks/...` 를 직접 덧붙이므로 apiBase 는
> `http://localhost:3011` 형태여야 한다(`…/api` 를 넣으면 `/api/api/hooks` 가 됨). 데모는 후행 `/api` 를
> 자동 제거하지만 origin 으로 입력하는 것을 권장.
>
> **스트림 응답(SSE) CORS — 중요**: 첫 메시지(`POST /api/hooks/*`)는 무제한 CORS 라 통과하지만, **AI 응답
> 스트림(`/api/external/*`)은 워크스페이스 allowlist CORS** 를 탄다([4-security §2](../../spec/7-channel-web-chat/4-security.md)).
> 데모 origin(`http://localhost:3013`)이 backend 허용 목록에 없으면 **메시지는 전송되나 응답이 오지 않는다**.
> 로컬 해결: backend `.env` 에 `WEB_CHAT_WIDGET_ORIGINS=http://localhost:3013` 추가(또는 워크스페이스
> `interactionAllowedOrigins` 에 등록) 후 backend 재시작. (SSE 차단 시 위젯이 console 에 경고를 남긴다.)

`/demo` 는 `next dev`(개발)에서만 노출되고 `next build`(production static export)에서는 제외된다
(게이팅: `src/app/demo/demo-config.ts` `isDemoEnabled`; prod 미리보기는 `NEXT_PUBLIC_ENABLE_DEMO=1`).

## 상태

구현됨: 상태기계(`src/lib/widget-state`), EIA 클라이언트(`src/lib/eia-client`), conversation 렌더 규약
(`src/lib/conversation` — `[user-input]` strip·`live`/`injected`), 세션 복원(`src/lib/session-store`),
화면(런처/패널/메시지/Form/입력/면책), host↔iframe bridge(`src/widget/host-bridge`),
rich presentation 렌더러(carousel/table/chart/template — `src/widget/components/presentations.tsx`),
DOMPurify+marked 기반 template 안전 HTML 렌더(`src/lib/safe-html.ts`),
차트 축 레이블·범례·툴팁(`CartesianChart`/`PieChart` inline SVG).
진행 추적: [`channel-web-chat-impl.md`](../../plan/in-progress/channel-web-chat-impl.md).
