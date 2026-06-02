# Channel Web Chat — 임베드형 웹채팅 위젯 + SDK + 샘플 (제품 정의)

> 영역 진입 문서. 기술 명세는 본 영역의 `0-architecture.md`(아키텍처) · `1-widget-app.md`(위젯 SPA) ·
> `2-sdk.md`(SDK) · `3-auth-session.md`(인증/세션) · `4-security.md`(보안) 참조.
> 관련: [External Interaction API (EIA)](../5-system/14-external-interaction-api.md) ·
> [Webhook 트리거](../5-system/12-webhook.md) · [Chat Channel](../5-system/15-chat-channel.md) ·
> [Convention Conversation Thread](../conventions/conversation-thread.md).

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
- 파일 첨부 / 이모지 picker (Form file upload 연동 시).
- 음성/통화, 상담원 핸드오프, 프로액티브(봇 선발화) 메시지.
- 위젯 외형의 서버사이드 관리 콘솔 — 외형은 v1·v2 모두 **로더(boot) 옵션으로만** 주입(백엔드 미저장).
- 호스트 제공 사용자 식별키(impersonation 방지 서명 포함) — 추후. v1 은 **익명만**.
- 유저당 다중 세션 목록 노출 — 전제(식별 + 유저별 execution 목록 API) 필요, 백로그.
- React/Vue 프레임워크 wrapper — v1 은 framework-agnostic JS API + 타입만.

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

## Rationale

### 제품 영역 분리 (vs 5-system 흡수)
클라이언트 SDK·위젯은 제품 표면이 서버 기술명세(5-system)와 분명히 달라 신규 top-level 영역 `7-`로 분리한다.
5-system 에 흡수하면 client 산출물(SDK/npm/iframe)과 server 명세가 섞인다. 상세 결정 근거는 `0-architecture.md §R6`.
