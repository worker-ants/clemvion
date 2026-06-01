---
id: web-chat-sdk
status: partial
code:
  - codebase/packages/web-chat-sdk/**
pending_plans:
  - plan/in-progress/channel-web-chat-impl.md
  - plan/in-progress/channel-web-chat-followups.md
---

# Spec: Channel Web Chat — SDK (스니펫 로더 + npm)

> 관련: [아키텍처](./0-architecture.md) · [위젯 SPA](./1-widget-app.md) · [인증/세션](./3-auth-session.md) ·
> npm publish 정책: [plan eia-sdk-publish](../../plan/in-progress/eia-sdk-publish.md).

> **npm scope 확정**: 패키지명은 `@workflow/web-chat` — `eia-sdk-publish.md §결정 #3` 에서 `@workflow/sdk`
> 와 일관되게 `@workflow/*` 로 통일(2026-06-02). publish 정책은 internal-only(별도 지정 전까지).

---

## 1. 스니펫 로더 (비개발자용)

```html
<script>
  (function(d,s){var j=d.createElement(s);j.async=1;
   j.src="https://<widget-cdn-base>/web-chat/v1/loader.js";  // 도메인은 배포 환경 설정(플레이스홀더, 0-architecture §4)
   d.head.appendChild(j);})(document,"script");
</script>
<script>
  ClemvionChat('boot', {
    apiBase: 'https://<api-base>',         // 배포 환경의 API origin(런타임 주입, 0-architecture §4)
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
  `open`/`close`/`sendMessage`/`updateProfile`/`on(event, cb)`/`off(event, cb?)`.
  - **`show`/`hide` vs `open`/`close`**: `show`/`hide` 는 **런처(위젯 진입점) 가시성** 토글(hide=위젯 자체를 페이지에서 숨김),
    `open`/`close` 는 **대화 패널 전개/접힘**(런처는 유지). 즉 `hide` 후엔 `open` 해도 보이지 않는다(먼저 `show`). 상태기계는
    [1-widget-app](./1-widget-app.md) 참조.
- **전역명 충돌 방지**: 기본 전역은 `window.ClemvionChat`. 호스트 페이지에 이미 동명 식별자가 있거나 복수 위젯을
  올릴 때를 위해 **loader `<script>` 의 `data-global` 속성으로 전역명 재지정**을 지원한다
  (예: `<script ... data-global="SupportChat">` → `window.SupportChat`). loader 는 부팅 시 지정 전역이 **이미
  비-큐 객체로 점유**돼 있으면 콘솔 경고 후 부팅을 중단(호스트 전역 silent overwrite 금지). 미지정 시 `ClemvionChat`.
- **이벤트 구독 해제**: `on(event, cb)` 은 **구독 해제 함수**를 반환한다(`const un = chat.on('message', f); un();`).
  대등하게 `off(event, cb)`(특정 핸들러 해제) / `off(event)`(해당 이벤트 전체 해제) 도 제공 — SPA 언마운트 시
  핸들러 누수 방지(React `useEffect` cleanup 등). 스니펫 전역 큐 형태 `ClemvionChat('off', { event, cb })` 도 동일.
- `loader.js` 책임: launcher 주입, iframe 생성·resize 적용, host↔iframe bridge, 명령 큐(boot 전 호출 버퍼링).

## 2. npm 패키지 `@workflow/web-chat` (개발자용)

```ts
import { ClemvionChat } from '@workflow/web-chat';
const chat = ClemvionChat.boot({ apiBase, triggerEndpointPath, profile, appearance, launcher });
const unsubscribe = chat.on('message', (m) => analytics.track('chat_message', m)); // on() → 해제 함수 반환
chat.on('unread', (n) => badge.set(n));
chat.open();
chat.updateProfile({ plan: 'pro' });
// SPA 언마운트 시 핸들러 누수 방지:
unsubscribe();            // on() 반환 함수, 또는
chat.off('unread');       // 이벤트 단위 일괄 해제
chat.shutdown();
```
- 동일 코어를 모듈로 노출 + 타입 정의. ESM + UMD. loader.js = npm 코어의 IIFE thin wrapper(중복 구현 금지).
- **EIA HTTP/SSE 호출은 기존 `@workflow/sdk`(EIA 클라이언트, PR #230) 재사용** — web-chat 은 그 위의 위젯(loader+
  iframe bridge+UI) 레이어. 의존 방향: `web-chat → @workflow/sdk`. **M2 BYO-UI headless client = `@workflow/sdk` 직접 사용**
  ([0-architecture §5.3](./0-architecture.md)).

## 3. host ↔ iframe postMessage 프로토콜

메시지 `type` 은 **`wc:` namespace prefix** 를 둔다(타 채널·OAuth popup 메시지와 혼용 방지).

| 방향 | 메시지 type | 페이로드 |
|---|---|---|
| host → iframe | `wc:boot` | 전체 boot config |
| host → iframe | `wc:command` | `open`/`close`/`show`/`hide`/`sendMessage(text)`/`updateProfile`/`shutdown` |
| iframe → host | `wc:ready` | 위젯 로드 완료 |
| iframe → host | `wc:resize` | `{ width, height, state: 'collapsed' \| 'expanded' }` |
| iframe → host | `wc:event` | `open`/`close`/`message`/`unread`/`conversationStarted`/`conversationEnded` |
- **origin 검증 필수**(양방향 `event.origin` 화이트리스트). 토큰·대화 내용은 iframe 내부 유지, host 로 비노출.
- **`wc:resize` host 처리(필수)**: host(loader/WidgetBridge)는 `wc:resize` 수신 시 iframe 엘리먼트의 크기를
  payload(`width`/`height`/`state`)에 맞춰 적용한다 — `collapsed`(런처만) ↔ `expanded`(패널 전개) 전환 시
  iframe 박스가 따라 변하지 않으면 클릭 영역·스크롤이 깨진다. position/zIndex 는 `appearance` 를 따른다.

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

## 5. 공개 인스턴스 타입 계약

`boot()` 가 반환하는 제어 인스턴스(스니펫 전역 함수도 동일 메서드를 dispatch). 산문 설명의 SoT 타입:

```ts
type Unsubscribe = () => void;
type WidgetEvent =
  | 'open' | 'close' | 'message' | 'unread'
  | 'conversationStarted' | 'conversationEnded';

interface ChatInstance {
  open(): void;                                  // 대화 패널 전개
  close(): void;                                 // 대화 패널 접힘(런처 유지)
  show(): void;                                  // 위젯(런처) 표시
  hide(): void;                                  // 위젯(런처) 숨김
  sendMessage(text: string): void;
  updateProfile(profile: Record<string, unknown>): void;
  on(event: WidgetEvent, cb: (payload: unknown) => void): Unsubscribe;  // 반환: 구독 해제 함수
  off(event: WidgetEvent, cb?: (payload: unknown) => void): void;       // cb 생략 시 이벤트 전체 해제
  shutdown(): void;                              // iframe·리스너 정리(인스턴스 폐기)
}
```

## Rationale

### R2. 스니펫 로더 + npm 둘 다 (vs 택일)
CDN 스니펫과 npm 을 모두 제공하되 **단일 코어 공유**(loader.js = npm 코어 IIFE wrapper). 비개발자는 빌드 없이 스니펫,
개발자는 npm 으로 타입·프로그래matic 제어·유저 식별 통합. npm-only 는 비개발자 배제, 스니펫-only 는 SPA 통합/타입/이벤트
DX 약화 → 둘 다 제공이 커버리지 최적. npm scope 는 `@workflow/web-chat` 로 확정(`eia-sdk-publish.md §결정 #3`,
`@workflow/sdk` 와 일관).

### R3. 구독 해제·전역명 충돌 방지 (SPA 안전 통합)
`on()` 만 있고 해제 수단이 없으면 SPA(특히 React `useEffect`) 재마운트마다 핸들러가 누적돼 메모리 누수·중복 호출이
난다. `on()` 의 **해제 함수 반환** + `off()` 둘 다 제공하는 건 표준 DX(EventEmitter/addEventListener 양식)와 일치하고
호스트가 cleanup 패턴 중 편한 쪽을 고를 수 있게 한다. 전역명은 단일 `ClemvionChat` 고정 대신 **`data-global` opt-in
재지정**으로 — 호스트 전역 오염·동명 충돌·복수 위젯 동시 탑재를 비파괴적으로 허용하되, 기본값은 단순성을 위해
`ClemvionChat` 유지하고 점유 충돌 시 silent overwrite 대신 경고+중단으로 안전측에 둔다.
