# Channel Web Chat — 임베드형 웹채팅 위젯 + SDK + 샘플 (제품 정의)

> 영역 진입 문서. 기술 명세는 본 영역의 `0-architecture.md`(아키텍처) · `1-widget-app.md`(위젯 SPA) ·
> `2-sdk.md`(SDK) · `3-auth-session.md`(인증/세션) · `4-security.md`(보안) · `5-admin-console.md`(운영 콘솔) 참조.
> 관련: [External Interaction API (EIA)](../5-system/14-external-interaction-api.md) ·
> [Webhook 트리거](../5-system/12-webhook.md) · [Chat Channel](../5-system/15-chat-channel.md) ·
> [Convention Conversation Thread](../conventions/conversation-thread.md).
>
> **구성요소 spec**: [아키텍처](./0-architecture.md) · [위젯 SPA](./1-widget-app.md) · [SDK](./2-sdk.md) · [인증·세션 흐름](./3-auth-session.md) · [보안](./4-security.md) · [운영 콘솔](./5-admin-console.md)

---

## 1. 개요 / 문제

워크플로우를 **웹훅 트리거 + EIA(External Interaction API)** 로 외부에 노출하면, 외부 시스템이 워크플로우를
실행하고 실행 도중 인터랙션(Form / Button / AI Multi-turn)을 REST + SSE 로 주고받을 수 있다. 하지만 그
**클라이언트 측 구현을 사용자가 직접 작성**해야 한다. EIA §2 사용 시나리오 4행("외부 SaaS 가 내장 chat 위젯
호스팅 — Inbound only (SSE + REST)")이 정확히 본 영역이 채우는 간극이다.

본 영역은 그 **클라이언트 레이어**를 공식 제공한다 — 외부 웹사이트에 `<script>` 한 줄(또는 npm import)로
삽입 가능한 **임베드형 웹채팅 위젯**, 그것을 구동하는 **개발자용 SDK**, 그리고 **샘플 프로젝트**.

**위치 관계**: [Chat Channel](../5-system/15-chat-channel.md)이 EIA 의 *server-side* consumer(텔레그램/슬랙 어댑터,
in-process 우회)라면, 본 위젯은 EIA 의 ***client-side* consumer** 다 — 외부 브라우저에서 순수 HTTP(웹훅 + REST +
SSE)로만 EIA 표면을 호출하며 **신규 백엔드 트리거 유형이나 in-process 우회·facade 계층을 추가하지 않는다.**

## 2. 목표 / 비목표

**목표 (v1)**
- 외부 사이트에 **iframe 격리형** 웹채팅 위젯 삽입 (호스트 CSS/JS 완전 격리, 보안 경계 확보).
- 두 배포 표면: (a) CDN `<script>` 스니펫 로더(비개발자/마케터용), (b) `@workflow/web-chat` npm(개발자용).
- 두 사용 모드([`0-architecture §5`](./0-architecture.md)): **M1 Hosted iframe 위젯(주력)** + **M2 BYO-UI**(npm SDK headless client 로
  개발자가 자체 UI 구성·자기 도메인 서빙). 두 모드 모두 동일 EIA 표면·per_execution 토큰을 쓰며 차이는 렌더링
  위치와 요청 Origin.
- 위젯 SPA 는 `codebase/channel-web-chat/`의 **Next.js (CSR 전용, SSR·서버 컴포넌트 비활성화)** 앱.
- **EIA 인터랙션 전체 렌더**: AI Multi-turn(`submit_message`)·버튼(`click_button`)·Form(`submit_form`)·`ai_form_render` +
  presentations(carousel/table/chart/template) inline.
- SDK 활용 **샘플 프로젝트**.

**비목표 (v1 → 백로그)**
- 표시-전용 presentation **노드** 표시물의 **새로고침 복원** — durable thread 에는 AI `render_*` 표시물만
  영속되므로(`turn.presentations[]` 는 `source: 'ai_assistant'` 한정) 노드 표시물은 라이브 세션 한정이다.
  확장은 [conversation-thread §1.1](../conventions/conversation-thread.md) 의 backend 5-source enum 확장을
  요구 → v2 검토. 라이브 렌더 및 AI `render_*` 표시물 복원은 v1 범위([`1-widget-app §2`](./1-widget-app.md)).
- 파일 첨부 / 이모지 picker (Form file upload 연동 시).
- 음성/통화, 상담원 핸드오프, 프로액티브(봇 선발화) 메시지.
- 위젯 외형의 **per-workspace 테마/브랜딩 관리 콘솔**(워크스페이스 단위 외형 JSON 서빙·테마 라이브러리) — 백로그.
  *단, [운영 콘솔(구성요소 D)](./5-admin-console.md)의 **per-instance 외형 저장**(트리거 `config.interaction.appearance`)은
  v1 범위다(결정 2026-06-24)* — 구분 근거·번복 전말은 [5-admin-console R2](./5-admin-console.md).
- 호스트 제공 사용자 식별키(impersonation 방지 서명 포함) — 추후. v1 은 **익명만**.
- 유저당 다중 세션 목록 노출 — 전제(식별 + 유저별 execution 목록 API) 필요, 백로그.
- React/Vue 프레임워크 wrapper — v1 은 framework-agnostic JS API + 타입만.
- **위젯 UI 다국어화 — 잔여 비목표**: (i) 운영자가 *제공한* 콘텐츠(`headerTitle`·`welcome`·`launcher.suggestions`·`disclaimer`)
  및 backend 발행 payload 의 per-locale 현지화, (ii) 위젯의 메인 앱 dict 시스템(`frontend/src/lib/i18n/dict`) 편입,
  (iii) 인-위젯 엔드유저 언어 토글 — 모두 백로그.
  - *단 **위젯 chrome 문자열(위젯 소유 UI 프레임 문자열)의 EN 다국어화는 2026-07-12 결정으로 목표로 승격***한다 —
    [webchat-i18n-scope](../../plan/complete/webchat-i18n-scope.md) 가 defer 한 활성화 경로를 실행. `BootConfig.locale` 을
    활성화(명시 → 브라우저 auto-detect → `ko` fallback)하고, chrome 문자열을 **위젯 로컬 catalog(ko/en parity)** 로 옮긴다.
    메커니즘 SoT [1-widget-app §4](./1-widget-app.md), locale 근거 [2-sdk §R6](./2-sdk.md). chrome 은
    [i18n-userguide 적용 범위](../conventions/i18n-userguide.md#적용-범위-scope) 상 위젯 로컬 parity 대상이나 **메인 앱 dict 기구
    (Principle 1·2 의 구체 형식)는 여전히 미적용**, 문체 Principle 6 은 적용. 운영자 콘텐츠·AI 생성 본문은 번역 대상 아님.

## 3. 사용 시나리오

| 시나리오 | 배포/모드 | 설명 |
|---|---|---|
| 마케터가 랜딩 페이지에 AI 상담 위젯 부착 | 스니펫 로더(M1) | `<script>` + `ClemvionChat('boot', {...})` 한 블록 |
| 개발자가 SPA 에 위젯 통합 + 사용자 식별 정보 전달 | npm(M1) | `profile` 을 webhook payload 로 전달 |
| AI FAQ 봇 | 둘 다(M1) | 런처 추천질문 → 패널 → AI Multi-turn |
| 개발자가 SDK 로 자체 UI 구성·자기 도메인 서빙 | npm headless(M2) | SDK client primitive 로 완전 커스텀 UI. 호출 Origin = 고객 도메인 → 워크스페이스 단위 CORS |
| 데모/문서용 임베드 예제 | 샘플 | 위 표면 시연 static 데모 |

## 4. 제품 구성요소

| # | 구성요소 | 산출물 | 비고 |
|---|---|---|---|
| A | **위젯 SPA** | `codebase/channel-web-chat/` (Next.js CSR 전용, **구현 시 신설**) | iframe 내부 채팅 UI. static export → CDN |
| B | **SDK** | `codebase/packages/web-chat-sdk/` → loader 스니펫 + `@workflow/web-chat` npm | host↔iframe bridge + 공개 JS API. EIA 호출은 기존 `@workflow/sdk` 재사용. SPA 와 분리 패키지 |
| C | **샘플** | SDK 패키지의 `examples/` | 스니펫·npm 두 경로 시연 |
| D | **운영 콘솔** | `codebase/frontend/src/app/(main)/w/[slug]/web-chat/**` (admin 메뉴) | 제품 내 위젯 *소비자* surface — 인스턴스 생성·외형 빌더·설치 스니펫·라이브 미리보기. 위젯을 합치지 않고 loader+iframe 으로 임베드. 상세 [5-admin-console](./5-admin-console.md) |

## Rationale

### 제품 영역 분리 (vs 5-system 흡수)
클라이언트 SDK·위젯은 제품 표면이 서버 기술명세(5-system)와 분명히 달라 신규 top-level 영역 `7-`로 분리한다.
5-system 에 흡수하면 client 산출물(SDK/npm/iframe)과 server 명세가 섞인다. 상세 결정 근거는 `0-architecture.md §R3`.

### 운영 콘솔(구성요소 D)과 외형 저장 범위의 경계
§2 비목표가 겨냥한 것은 *워크스페이스 단위 외형을 관리하는 별도 테마/브랜딩 콘솔*(per-workspace 외형 JSON 서빙·
테마 라이브러리)이다. 구성요소 D 콘솔의 **per-instance 외형 저장**(웹채팅 = 트리거 단위, `config.interaction.appearance`,
신규 엔티티 없이 기존 trigger config 재사용)은 **2026-06-24 결정으로 v1 범위**다 — 운영자가 브라우저를 바꿔도 동일
미리보기·스니펫이 재현되도록 localStorage-only 의 한계를 해소한다. per-workspace 테마 관리 콘솔은 여전히 백로그.
번복 전말·기존 미저장 결정과의 관계는 [5-admin-console R2](./5-admin-console.md).
