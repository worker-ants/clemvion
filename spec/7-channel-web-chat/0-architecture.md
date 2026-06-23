---
id: web-chat-architecture
status: partial
code:
  - codebase/channel-web-chat/**
  - codebase/packages/web-chat-sdk/**
pending_plans:
  - plan/in-progress/channel-web-chat-impl.md
  - plan/in-progress/channel-web-chat-followups.md
  - plan/in-progress/fix-webchat-sse-field-map.md
  - plan/in-progress/webchat-eager-start.md
  - plan/in-progress/web-chat-console.md
---

# Spec: Channel Web Chat — 아키텍처

> 영역 개요: [_product-overview](./_product-overview.md). 관련: [EIA](../5-system/14-external-interaction-api.md) ·
> [Webhook](../5-system/12-webhook.md) · [Convention Conversation Thread](../conventions/conversation-thread.md) ·
> [interaction-type-registry](../conventions/interaction-type-registry.md).

---

## 1. 레이어 분리

```
호스트 사이트 (고객 웹페이지)
  <script src="https://<widget-cdn-base>/web-chat/v1/loader.js">
  ClemvionChat('boot', { triggerEndpointPath, profile, ... })
       │ (1) loader 가 iframe 주입 (클라이언트) — 런처는 iframe SPA 내부 렌더
       ▼
  ┌──── iframe (origin: 위젯 CDN) ── 정적 cross-origin CDN 문서 ────┐
  │  위젯 SPA = codebase/channel-web-chat (Next.js CSR-only)        │
  │  postMessage 로 host ↔ iframe 통신 (resize/open/events)         │
  └─────────────────────────────────────────────────────────────────┘
       │ HTTP (webhook + REST + SSE)
       ▼
  Clemvion API (<api-base>) — EIA (기존 구현 재사용)
```

| 레이어 | 책임 | 격리 경계 |
|---|---|---|
| Host page | 고객 사이트. SDK boot 호출만 | 호스트 origin |
| SDK loader/API | iframe 주입(런처는 iframe 내부 렌더), iframe lifecycle, host↔iframe bridge, 공개 JS API | 호스트 DOM 최소 발자국 |
| Widget SPA (iframe) | 채팅 UI, EIA 클라이언트(webhook/SSE/REST), conversation 상태기계 | 위젯 CDN origin — CSS/JS/storage 격리 |
| Clemvion API | EIA 표면 (기존) | api origin |

## 2. iframe 격리

- 호스트 전역 CSS/JS 와 **완전 격리**(스타일·전역변수 오염 없음). interaction token·대화 내용을 호스트 스크립트로부터 격리(보안 경계).
- `iframe sandbox` + CSP 로 권한 제한. 트레이드오프·Shadow DOM 기각은 §R1.

### 2.1 iframe 문서는 정적 CDN 자산 — 서버 per-client 렌더링 없음
- loader 가 iframe 을 만들지만 `src` 는 **정적·불변 CDN 파일**(`output:'export'` 산출). CDN 캐시 히트로 클라이언트 수가
  늘어도 서버 per-request 부담 없음(동적 렌더링 아님).
- ⚠️ `srcdoc`/`about:blank` 자가 생성은 **기각** — 그 iframe 은 호스트 origin 을 상속해 cross-origin 격리가 깨진다.
  격리를 위해 iframe 은 **반드시 다른 origin 의 실제 `src`** 여야 한다(§R8). *예외*: admin 콘솔 **내부 미리보기**는 cross-origin
격리가 목적이 아니므로 same-origin 동봉 위젯을 실제 `src` iframe 으로 로드한다(§4.1·§R8 carve-out) — `srcdoc` 자가 생성은 여기서도 금지.
- 워크스페이스/트리거/외형은 문서를 워크스페이스별로 렌더링하지 않고 query param / postMessage / 캐시 가능한 per-workspace JSON 으로 주입.

## 3. EIA 매핑 (위젯이 사용하는 EIA 표면)

위젯은 **facade 계층을 추가하지 않는 순수 external HTTP consumer** 다 (EIA §R10 의 단일 sink 정책에 영향 없음).

| 위젯 동작 | EIA 표면 | 참조 |
|---|---|---|
| 대화 시작 | `POST /api/hooks/:endpointPath` → `202 { data: { executionId, status, interaction: { token, expiresAt, endpoints } } }` (성공 응답은 전역 `TransformInterceptor` 가 `{ data }` 로 래핑 — webhook §3.1. 위젯은 `res.data` 언랩) | EIA §4.1 |
| 실시간 이벤트 | `GET /api/external/executions/:id/stream` (SSE, `?token=`) | EIA §5.2 |
| AI 메시지 | SSE `execution.ai_message` (+ `presentations[]`) | EIA §6.5 |
| 입력 대기 진입 | SSE `execution.waiting_for_input` — **EIA 외부 `interactionType` ∈ `form`/`buttons`/`ai_conversation`** (EIA §6.2, 3값). render_form blocking 은 EIA 표면에서 **`ai_conversation` 으로 통합 노출** | EIA §6.2 |
| AI 폼 렌더 (render_form blocking) | `ai_conversation` 페이로드의 `conversationConfig.pendingFormToolCall.formConfig` 렌더 → `submit_form`. 위젯은 `ai_conversation` 과 동일 경로 처리(별도 분기 아님). 내부 `WaitingInteractionType=ai_form_render` 와의 매핑은 [interaction-type-registry §1.2](../conventions/interaction-type-registry.md) | [AI Agent §12.5](../4-nodes/3-ai/1-ai-agent.md) |
| 사용자 메시지 | `POST .../interact { command: "submit_message" }` | EIA §5.1 |
| 버튼 탭 | `... { command: "click_button" }` | EIA §5.1 |
| Form 제출 | `... { command: "submit_form" }` | EIA §5.1 |
| 대화 종료 | `... { command: "end_conversation" }` | EIA §5.1 |
| 재연결 복구 | SSE `Last-Event-Id`(5분 버퍼) / `GET .../:id` | EIA §5.2·§5.3 |
| 토큰 갱신 | `POST .../refresh-token` (per_execution) | EIA §5.5 |

- 위젯은 EIA inbound(REST+SSE)만 사용, outbound notification webhook 미사용(항상 SSE open).
- **`retry_last_turn` 미지원** — EIA 외부 표면 미노출 내부 UI 한정 명령(EIA-IN-02). 위젯 v1 AI turn 재시도 버튼은 비목표.
- **SSE wire 필드명 (notification §6.2 추상 표기와 다름)**: SSE 스트림은 내부 fanout envelope 를 그대로 전송한다(프론트엔드 WS store 와 동일 SoT). 따라서 `waiting_for_input` 은 `node.id`/`context.*` 가 아니라 **`waitingNodeId`**(= `submit_message` 의 `nodeId` 로 그대로 사용)·top-level **`interactionType`**·**`nodeOutput.conversationConfig`**(ai_conversation)/**`buttonConfig`**(buttons)/**`nodeOutput`**(form)·top-level **`conversationThread`** 로 도착하고, `ai_message` 의 어시스턴트 텍스트 필드는 **`message`**(not `text`) 다. 위젯 파서 SoT: [`codebase/channel-web-chat/src/lib/eia-events.ts`](../../codebase/channel-web-chat/src/lib/eia-events.ts). (EIA §6.2 / WS §4.4 는 `nodeId`/`node.id` 로 표기돼 wire 와 drift — 별도 backlog.)

## 4. 배포 / 도메인 설정 (환경별 — 플레이스홀더)

Clemvion 은 SaaS + 셀프호스팅 병행이므로 본 spec 의 도메인은 **고정값이 아니라 배포 환경 설정**이다.
`<widget-cdn-base>`·`<api-base>` 는 **플레이스홀더**이며 실제 값은 배포(env/config)로 주입한다(보류 중 — 확정 시 반영):

| 플레이스홀더 | 의미 | 주입 방식 |
|---|---|---|
| `<api-base>` | EIA 가 서빙되는 API origin | SDK `boot.apiBase` 로 **런타임 주입**(클라이언트가 빌드 없이 지정) |
| `<widget-cdn-base>` | 위젯 SPA·`loader.js` 호스팅 origin (스니펫 `<script src>` + iframe `src` 의 base) | **기본값 = 배포 자신의 origin**(위젯을 제품과 동봉 서빙, §4.1) — 셀프호스트는 추가 인프라 없이 same-origin. SaaS·별도 엣지 CDN 운영 시에만 `NEXT_PUBLIC_WIDGET_CDN_BASE` 로 override(그래도 같은 릴리스 버전 번들) |

`<widget-cdn-base>` 를 받는 구체 env 키 (동일 위젯 origin 을 각 앱이 주입 — **두 값은 일치해야 함**):

| env 키 | 앱 | 신규/기존 | 용도 |
|---|---|---|---|
| `NEXT_PUBLIC_WIDGET_CDN_BASE` | admin 프론트엔드 (`codebase/frontend`) | 신규 (선택) | 운영 콘솔이 설치 스니펫의 `loader.js src` + 라이브 미리보기 iframe base 로 사용. **미설정 시 self-origin 기본**([5-admin-console §5·§6](./5-admin-console.md)) |
| `WEB_CHAT_WIDGET_ORIGINS` | 백엔드 (`codebase/backend`) | 기존 (`main.ts`·`web-chat-cors.ts`) | `/api/external/*` CORS allowlist — 위젯 iframe origin 의 EIA 호출 허용 ([4-security §2](./4-security.md)) |

### 4.1 위젯 동봉(co-deploy) + 버전 잠금
- **버전 전략**: `loader.js`·위젯 SPA 는 `/web-chat/v1/` major 버전 path 고정(불변 자산). 마이너/패치는 floating "latest" 가
  아니라 **제품과 같은 릴리스로 동봉(co-deploy)** 되어 배포 단위로 잠긴다 → 셀프호스트의 위젯 버전이 그 배포의 백엔드/EIA 버전과 항상 일치.
- **동봉 방식**: 위젯(`channel-web-chat`)을 frontend workspace 의존으로 묶고 `NEXT_PUBLIC_BASE_PATH=/_widget/web-chat/v1/app`
  로 빌드해 `codebase/frontend/public/_widget/web-chat/v1/` 로 동봉(빌드 파이프라인 복사) → 배포 origin 에서 same-origin 서빙.
- 이로써 `<widget-cdn-base>` 가 기본 self-origin 이 되어 **외부 위젯 CDN 호스팅은 선행조건이 아니다**(SaaS 엣지 CDN 은 선택 최적화).
- admin 콘솔 라이브 미리보기는 이 동봉 위젯을 same-origin iframe 으로 로드 — 버전 일치·외부 의존 0 (격리 carve-out 은 §R8).
- **npm scope**: `@workflow/web-chat` 로 확정 — [eia-sdk-publish.md §결정 #3](../../plan/in-progress/eia-sdk-publish.md) (`@workflow/sdk` 와 일관, [2-sdk](./2-sdk.md)).
- CORS allowlist 의 "위젯 CDN 빌트인 허용"([4-security §2](./4-security.md))도 이 `<widget-cdn-base>` 를 가리킨다 — 배포 설정값.
  빌트인 origin 상수는 **빌드타임 env 주입**(loader/SPA 빌드) + 백엔드는 **런타임 config**(워크스페이스 무관 고정값)로 관리한다.
  - 백엔드 런타임 allowlist(env 키·파싱·`.env.example` 샘플 등 구현 세부)의 SoT 는 [4-security §2·§2.1](./4-security.md).

## 5. 사용 모드 (M1 Hosted iframe / M2 BYO-UI)

같은 SDK 라도 **EIA 호출 코드가 어디서 도는가**(= 요청 `Origin`)가 두 모드로 갈리며, CORS 설계([4-security §2](./4-security.md))가 달라진다.

| 모드 | 설명 | API 호출 Origin | 격리 책임 |
|---|---|---|---|
| **M1 Hosted iframe** (주력) | `boot()` 가 우리 CDN 위젯 SPA 를 iframe 으로 로드. EIA 호출은 **iframe 내부**(위젯 CDN origin) | 위젯 CDN 도메인 (워크스페이스 무관 고정) | 우리 (iframe 격리, §R1) |
| **M2 BYO-UI / headless** | 개발자가 npm SDK 의 client primitive 로 **자체 UI 구성**해 **자기 도메인에서 서빙** | 고객 도메인 (워크스페이스마다 다름) | 개발자 |

두 모드 모두 **동일 EIA 표면·per_execution 토큰**([3-auth-session](./3-auth-session.md))을 쓰며, 차이는 **렌더링 위치와 요청 Origin** 뿐이다.

### 5.1 M1 — Hosted iframe
`boot()` 가 iframe 하나만 host body 에 주입하고 위젯 SPA(정적 CDN 문서, §2.1)를 iframe 에 로드 — 런처(collapsed)와 패널은 모두 iframe 내부 SPA 가 렌더(§R7 단일 iframe 크기 토글). EIA webhook/SSE/REST 호출은
iframe 내부(위젯 CDN origin)에서 발생 → 호출 Origin 은 워크스페이스 무관 단일 고정값. v1 주력 산출.

### 5.2 origin 함의 → CORS
M1 은 위젯 CDN 단일 origin(빌트인 허용), M2 는 고객 도메인이라 **워크스페이스 단위 allowlist**(`interactionAllowedOrigins`)
가 필요하다. 상세 [4-security §2](./4-security.md).

### 5.3 M2 — BYO-UI / headless client
개발자가 hosted 위젯 대신 **npm SDK 의 client primitive(= 기존 [`@workflow/sdk`](./2-sdk.md) EIA 클라이언트)** 로 완전
커스텀 채팅 UI 를 구성하고 자기 도메인에서 서빙한다. 호출 Origin = 고객 도메인이므로 워크스페이스 단위 동적 CORS 가
필요하다(§5.2). UI·격리 책임은 개발자에게 있으며, 인증·토큰(per_execution)·EIA 표면은 M1 과 동일하다. v1 주력은 M1 이고,
M2 는 SDK headless client 노출로 가능해진다([2-sdk](./2-sdk.md)).

## Rationale

### R1. iframe 격리 채택 (vs Shadow DOM 인라인 마운트)
iframe 은 CSS·JS·전역변수·storage·쿠키를 완전 분리하고 token/대화를 호스트 스크립트로부터 격리한다. Shadow DOM 은
스타일만 격리하고 JS 전역·서드파티 스크립트 보호가 약하며, Next.js 정적 SPA 의 host DOM 직접 마운트는 스타일·polyfill·
React 버전 충돌 위험이 크다. 트레이드오프(postMessage 브리지, 초기 로드)는 좁은 프로토콜로 흡수. 주류 임베드형 위젯도 iframe 채택.

### R5. 클라이언트 consumer 로 한정 — EIA·신규 트리거 유형·facade 미신설
위젯은 외부 브라우저에서 순수 HTTP 로만 EIA 를 호출하는 client 케이스(EIA §2 표 4행). Chat Channel(server-side
어댑터, in-process 우회)과 대칭. 백엔드 변경은 [4-security §CORS](./4-security.md)·남용 방어로 억제, EIA 핵심 표면(webhook/
REST/SSE/토큰) 변경 없음. EIA §R10 의 단일 sink·facade 계층에 새 listener 를 추가하지 않는다.

### R6. 신규 spec 영역 `7-` (vs 5-system 흡수)
클라이언트 SDK·위젯은 제품 표면이 서버 기술명세와 달라 신규 top-level 영역으로 분리. 번호 7 은 기존 2~5 다음 자리.

### R7. 런처/패널 iframe 구조 — v1 단일 iframe
**(A) 단일 iframe(크기 토글)**: 문서·브리지·상태가 하나라 구현·동기화 단순, 호스트 발자국 최소. 단 SPA 가 페이지 로드 시
항상 로드(패널 내부 lazy 로 완화), collapsed 시 정확히 런처 크기로 줄여야 호스트 클릭 가로채기 회피.
**(B) 이중 iframe(런처 별도)**: 런처만 가벼워 패널 SPA 를 첫 open 때 lazy → 초기 로드 최적, pointer-event 경계 깔끔. 단
런처↔패널 상태 동기화 필요, 복잡도↑.
→ v1 은 구현 단순성 우선 **(A)**. 초기 로드 무게가 측정상 병목이면 (B)로 전환(브리지 §2-sdk 는 양쪽 호환 설계).

### R8. iframe 문서 — 정적 cross-origin CDN 자산 + soft 임베드 검증
"클라이언트가 많아지면 워크스페이스별 문서를 서버에서 제공하는 부담이 크다"는 우려는 타당 → 동적 문서 렌더링은 채택
안 함. 위젯 SPA 는 `output:'export'` 정적 산출이라 CDN 정적 파일로 제공되며 per-request 서버 렌더링이 없다. 단
`srcdoc`/`about:blank` 자가 생성은 iframe 이 호스트 origin 을 상속해 §R1 격리가 무너지므로 기각 — "loader 가 iframe
생성(클라이언트) + 문서는 정적 cross-origin CDN 자산"으로 동적 서버 회피와 격리를 동시에 만족한다. 임베드 제어는 문서
CSP 가 아니라 부팅 시 host origin soft 검증으로 이동([4-security](./4-security.md)). CORS 도 워크스페이스 동적 처리가
필요 없는 경계로 둔다([4-security §CORS](./4-security.md)): M1 은 위젯 CDN 단일 origin, M2 만 워크스페이스 allowlist.

**carve-out — admin 콘솔 내부 미리보기(same-origin 동봉 iframe)**: 위 기각은 *고객 사이트* 임베드(외부 origin 에서 우리
위젯을 호스트와 격리)에 대한 것이다. admin 운영 콘솔의 라이브 미리보기는 맥락이 다르다 — **우리 앱이 우리 위젯을** 미리보는
것이라 cross-origin 격리가 목적이 아니고, 셀프호스팅·버전 다양성 하에서 **버전 일치·외부 의존 제거**가 목적이다. 따라서
미리보기는 §4.1 의 동봉(co-deploy) 위젯을 **same-origin 실제 `src` iframe**(srcdoc 자가 생성 아님)으로 로드한다 — 위젯
CSS/JS 격리(§R1)는 iframe 으로 유지하되 외부 CDN fetch 0, 그 배포의 버전과 100% 일치. 고객 임베드 경로(loader + cross-origin
iframe)는 불변. 상세는 [5-admin-console §6·§R6](./5-admin-console.md).
