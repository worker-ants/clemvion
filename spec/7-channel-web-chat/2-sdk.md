---
id: web-chat-sdk
status: spec-only
code: []
pending_plans:
  - plan/in-progress/channel-web-chat-impl.md
---

# Spec: Channel Web Chat — SDK (스니펫 로더 + npm)

> 관련: [아키텍처](./0-architecture.md) · [위젯 SPA](./1-widget-app.md) · [인증/세션](./3-auth-session.md) ·
> npm publish 정책: [plan eia-sdk-publish](../../plan/in-progress/eia-sdk-publish.md).

> **npm scope 잠정**: 본 문서의 `@clemvion/web-chat` 표기는 **잠정**이며 `eia-sdk-publish.md §결정 #3`
> (`@workflow/*` 내부 일관성 vs `@clemvion/*` 외부 브랜드) 결정에 종속한다. 구현 착수 전 확정한다.

---

## 1. 스니펫 로더 (비개발자용)

```html
<script>
  (function(d,s){var j=d.createElement(s);j.async=1;
   j.src="https://cdn.clemvion.ai/web-chat/v1/loader.js";
   d.head.appendChild(j);})(document,"script");
</script>
<script>
  ClemvionChat('boot', {
    apiBase: 'https://api.clemvion.ai',
    triggerEndpointPath: 'a1b2c3-...',     // 공개 webhook path (비밀 아님)
    locale: 'ko',
    appearance: { primaryColor: '#5B4FE9', position: 'bottom-right', zIndex: 2147483000 },
    headerTitle: 'AI 어시스턴트',
    welcome: { text: '안녕하세요! 무엇을 도와드릴까요?', suggestions: ['제품 소개를 받아볼 수 있나요?', '설치는 어떻게 하나요?'] },
    launcher: { suggestions: ['제품 소개를 받아볼 수 있나요?', '설치는 어떻게 하나요?'] },
    disclaimer: 'AI는 한정된 데이터로 동작하며 …',
    profile: { /* optional, host 가 아는 사용자 식별 정보 */ }
  });
</script>
```
- 전역 함수 `ClemvionChat(method, payload)` — 단일 전역 진입점 + 명령 큐 패턴. 메서드: `boot`/`shutdown`/`show`/`hide`/
  `open`/`close`/`sendMessage`/`updateProfile`/`on(event, cb)`. (전역명 충돌 방지 패턴은 구현 단계 검토.)
- `loader.js` 책임: launcher 주입, iframe 생성·resize, host↔iframe bridge, 명령 큐(boot 전 호출 버퍼링).

## 2. npm 패키지 `@clemvion/web-chat` (잠정, 개발자용)

```ts
import { ClemvionChat } from '@clemvion/web-chat';
const chat = ClemvionChat.boot({ apiBase, triggerEndpointPath, profile, appearance, launcher });
chat.on('message', (m) => analytics.track('chat_message', m));   // 호스트 자체 분석(호스트 책임)
chat.on('unread', (n) => badge.set(n));
chat.open();
chat.updateProfile({ plan: 'pro' });
chat.shutdown();
```
- 동일 코어를 모듈로 노출 + 타입 정의. ESM + UMD. loader.js = npm 코어의 IIFE thin wrapper(중복 구현 금지).
- **EIA HTTP/SSE 호출은 기존 `@workflow/sdk`(EIA 클라이언트, PR #230) 재사용** — web-chat 은 그 위의 위젯(loader+
  iframe bridge+UI) 레이어. 의존 방향: `web-chat → @workflow/sdk`. **M2 BYO-UI headless client = `@workflow/sdk` 직접 사용**
  ([0-architecture §5.3](./0-architecture.md)).

## 3. host ↔ iframe postMessage 프로토콜

| 방향 | 메시지 | 페이로드 |
|---|---|---|
| host → iframe | `boot` | 전체 boot config |
| host → iframe | `command` | `open`/`close`/`sendMessage(text)`/`updateProfile`/`shutdown` |
| iframe → host | `ready` | 위젯 로드 완료 |
| iframe → host | `resize` | `{ width, height, state: 'collapsed'|'expanded' }` |
| iframe → host | `event` | `open`/`close`/`message`/`unread`/`conversationStarted`/`conversationEnded` |
- **origin 검증 필수**(양방향 `event.origin` 화이트리스트). 토큰·대화 내용은 iframe 내부 유지, host 로 비노출.

## 4. Boot config 스키마

```ts
interface BootConfig {
  apiBase: string;
  triggerEndpointPath: string;      // 공개 webhook path. 인증 토큰은 boot 에 넣지 않음 — webhook 202 가 발급(per_execution)
  locale?: 'ko' | 'en';
  appearance?: { primaryColor?: string; position?: 'bottom-right' | 'bottom-left'; zIndex?: number };  // 색·위치만(현 phase)
  headerTitle?: string;             // 봇 표시명(콘텐츠)
  welcome?: { text?: string; suggestions?: string[] };
  launcher?: { suggestions?: string[] };
  disclaimer?: string;
  profile?: Record<string, unknown>;
}
```

## Rationale

### R2. 스니펫 로더 + npm 둘 다 (vs 택일)
CDN 스니펫과 npm 을 모두 제공하되 **단일 코어 공유**(loader.js = npm 코어 IIFE wrapper). 비개발자는 빌드 없이 스니펫,
개발자는 npm 으로 타입·프로그래matic 제어·유저 식별 통합. npm-only 는 비개발자 배제, 스니펫-only 는 SPA 통합/타입/이벤트
DX 약화 → 둘 다 제공이 커버리지 최적. npm scope 는 `eia-sdk-publish.md` 결정에 종속(잠정 표기 유지).
