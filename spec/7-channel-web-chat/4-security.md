---
id: web-chat-security  # basename `4-security` 와 의도적으로 다름 — 타 영역의 `4-security` 슬러그와 충돌 방지 (영역 prefix `web-chat-` 로 전역 유일)
status: implemented
code:
  - codebase/backend/src/common/cors/web-chat-cors.ts
  - codebase/backend/src/modules/web-chat-cors/**
  - codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts
  - codebase/backend/src/modules/hooks/public-webhook-quota.service.ts
  - codebase/backend/src/modules/hooks/embed-config.service.ts
  - codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts
  - codebase/channel-web-chat/src/widget/host-bridge.ts
  - codebase/channel-web-chat/src/lib/safe-html.ts
  - codebase/frontend/src/components/editor/assistant-panel/markdown-renderer.tsx
---

# Spec: Channel Web Chat — 보안 (CORS · 임베드 · 남용 방어 · 프라이버시)

> 관련: [EIA §8](../5-system/14-external-interaction-api.md) · [아키텍처 §2·§R5](./0-architecture.md) ·
> [인증/세션](./3-auth-session.md) · [1-data-model §2.2 Workspace.settings](../1-data-model.md#22-workspace).

---

## Overview

본 문서는 채널 웹챗 위젯(임베드형 공개 챗봇)의 **보안 표면**을 단일 진실로 정의한다 — CORS 두 공개 표면(`/api/hooks/*` 무제한 vs `/api/external/*` 워크스페이스 allowlist, §2), 무단 임베드 차단(soft allowlist, §3), 공개·무인증 webhook 남용 방어(rate-limit·크기 제한·비용 가드, §4), 프라이버시·데이터 처리 책임 경계(§5), 입력 sanitize(XSS 방지, §1.1)다. 봇이 공개(`auth_config_id IS NULL`)라 임베드·CORS 통제는 hard 보안 경계가 아닌 **캐주얼 오남용 차단 soft 컨트롤**이며, 실질 리스크인 인프라 부하·LLM 토큰 비용을 다층 best-effort defense-in-depth 로 방어한다. 영역 제품 정의는 [_product-overview](./_product-overview.md).

## 1. 보안 정책 요약

| 항목 | 정책 |
|---|---|
| webhook 호출 | 트리거 `auth_config_id IS NULL`(인증 없음/공개, 12-webhook §3.2 WH-SC-01) |
| CORS — `/api/hooks/*` | **무제한 유지**(`Access-Control-Allow-Origin: *`, EIA §8.5). 위젯은 credential 없이 POST 하므로 `*` 로 충분 |
| CORS — `/api/external/*` | **워크스페이스 단위 동적 allowlist**(`interactionAllowedOrigins`). M1=위젯 CDN(빌트인 허용), M2=고객 도메인(워크스페이스 설정). §2 |
| 임베드 allowlist | **워크스페이스 단위** `interactionAllowedOrigins`(CORS 와 동일 키). v1 = 부팅 시 host origin **soft 검증**(불일치 시 위젯 `blocked`), hard `frame-ancestors` 는 opt-in. §3 |
| iframe sandbox | `sandbox="allow-scripts allow-forms allow-same-origin"`(필요 최소). `allow-same-origin` 은 same-origin 동봉 위젯의 쿠키·스토리지 접근 및 위젯 자체의 `postMessage` origin 핀을 유지하기 위해 필수다. 트레이드오프: `allow-same-origin` 이 있으면 동일 origin 악성 스크립트가 sandbox 를 탈출할 수 있으나, 동봉 위젯은 제품과 동일 릴리스로 배포되어 공급망 무결성이 보장되므로 허용한다. 외부 CDN override 환경(`NEXT_PUBLIC_WIDGET_CDN_BASE` 설정)에서는 cross-origin 이므로 `allow-same-origin` 없이도 동작하며 sandbox 탈출 위협이 없다. |
| postMessage | 양방향 `event.origin` 화이트리스트 검증. 토큰/대화 내용 host 로 비노출 |
| 토큰 노출 | per_execution 단일 → 클라이언트에 장기 비밀 없음. 단명 토큰은 **sessionStorage** 저장 → 탭 종료 시 자동 소거(defense-in-depth, [3-auth-session §R6](./3-auth-session.md)) |
| 에러 메시지 노출 | 임베드 위젯은 타 사이트에서 동작하므로 **서버/예외 원문을 UI 에 비노출** — 일반화 문구(`GENERIC_ERROR_MESSAGE`)만 표시하고 진단 원문은 `console.warn` 으로만(내부 구현·인프라 정보 노출 축소). 에러 → [ended] + "새 대화 시작" 동작([1-widget-app §3.1](./1-widget-app.md))은 유지하고 표시 문구만 일반화한다. 코드 SoT: `use-widget.ts errMessage` |
| `apiBase` 입력 검증 | 정상 임베드 경로의 `apiBase` 는 host postMessage(boot)로 주입되지만, **host 없는 직접 로드/샘플 경로**는 `?apiBase=` 쿼리(외부 통제 입력)로 폴백한다. 이 폴백 값은 **http(s) 스킴만 허용**(`safeApiBaseFromQuery`)해 `javascript:`/`data:`/상대경로를 fetch base 로 쓰지 않도록 거른다(부적합 시 무시 + `console.warn`). 코드 SoT: `use-widget.ts configFromQuery`/`safeApiBaseFromQuery` |
| rate-limit / abuse | EIA §8.4 + 공개 webhook 남용 방어(§4) |
| 입력 sanitize | AI 메시지/presentation 렌더 시 XSS 방지 — 위젯 책임. **deny-by-default 화이트리스트** + 링크 `rel=noopener`. 임베드 위젯은 XSS 가 호스트 사이트로 전파되므로 블랙리스트가 아닌 deny-by-default 가 합당(refactor 04 M-1). 구현 세부(`ALLOWED_TAGS`/`ALLOWED_ATTR`/`ALLOWED_URI_REGEXP`)·렌더러별 정책 매트릭스 §1.1 |
| 프라이버시·데이터 처리 | **배포자(워크스페이스 운영자) 책임** — 동의 고지·보존기간 spec 미규정. 위젯은 `disclaimer` 고지 문구만 제공 |
| 텔레메트리 | SDK 는 Clemvion 으로 사용 지표 미전송. 호스트 자체 분석은 이벤트 구독으로만 |

### 1.1 마크다운/HTML sanitize 정책 매트릭스

AI 메시지·presentation 을 마크다운/HTML 로 렌더하는 표면은 **위젯**과 **메인 앱** 두 곳이며, 번들 환경이 달라(경량 임베드 CSR vs React 트리) 렌더러가 이원화돼 있다. 두 렌더러는 구현이 다르나 **동일 위협 — 스크립트 주입 · 이벤트 핸들러 속성(`onerror` 등) · `javascript:`/`data:` 링크 — 에 대해 보안 동등성**을 보장한다.

| 렌더 표면 | 라이브러리 | sanitize 메커니즘 | 링크 정책 | 코드 SoT |
|---|---|---|---|---|
| 위젯(channel-web-chat) presentation·메시지 | `marked`(GFM) + `DOMPurify` | **deny-by-default allowlist** (`ALLOWED_TAGS`/`ALLOWED_ATTR`) + URL scheme 을 http(s)·mailto·relative/anchor 로 제한(`ALLOWED_URI_REGEXP`). 미지 태그(svg/math 등 mXSS 벡터) 기본 차단 | `afterSanitizeAttributes` 훅 → `target=_blank` + `rel="noopener noreferrer nofollow"` | `codebase/channel-web-chat/src/lib/safe-html.ts` |
| 메인 앱 assistant 패널 메시지 | `react-markdown` + `remark-gfm` | **`rehype-raw` 미사용** → LLM 응답의 raw HTML 은 파싱하지 않고 텍스트로 escape. react-markdown 기본 `urlTransform` 이 `javascript:`/`data:` 등 위험 scheme 차단 | `a` 컴포넌트 override → `target=_blank` + `rel="noreferrer noopener"` | `codebase/frontend/src/components/editor/assistant-panel/markdown-renderer.tsx` |

**검증 동등성**: 양쪽 모두 동일 XSS 페이로드 셋(raw `<script>` · `<img onerror>` 이벤트 핸들러 · `javascript:` 링크 · 정상 링크의 noopener)으로 unit 검증한다 — 위젯 `safe-html.test.ts`, 메인 앱 `markdown-renderer.test.tsx`.

## 2. CORS — 두 공개 표면 분리

위젯이 보내는 `Origin` 은 모드에 따라 다르다([0-architecture §5.3](./0-architecture.md)) — M1(hosted)은 위젯 CDN
도메인(고정), M2(BYO-UI)는 고객 도메인(워크스페이스마다 다름).

- **`/api/hooks/*`**: EIA §8.5 의 무제한 CORS(`*`) 유지. EIA §8.5 본문 변경 불요.
- **`/api/external/*`**: 워크스페이스 `interactionAllowedOrigins` 기반 동적 allowlist. **M1 의 위젯 CDN origin 은 모든
  워크스페이스 공통이므로 빌트인 상수로 항상 허용**, 유저 설정은 M2(자기 도메인)·임베드 제어용. (EIA §8.5 의 "미설정 시
  차단" invariant 와의 경계: 빌트인 CDN 은 always-allow, `interactionAllowedOrigins` 는 추가 origin 병합.)

### 2.1 구현 (코드 SoT)
backend 는 **단일 CORS 레이어**(`main.ts` 의 `app.enableCors(webChatCorsDelegate)`)로 경로-스코프 분기를 적용한다 —
이중 `Access-Control-Allow-Origin` 헤더 충돌 없이 라우트별로 다른 정책을 돌려준다
([`common/cors/web-chat-cors.ts`](../../codebase/backend/src/common/cors/web-chat-cors.ts) `createWebChatCorsDelegate`,
[`main.ts`](../../codebase/backend/src/main.ts) 의 `app.enableCors` 호출).

**구현된 분기**:
- `/api/hooks/*`(`HOOKS_PATH_RE`): **무제한**(`origin: true`, `credentials: false`) — 위젯/BYO 는 credential 없이 POST.
- `/api/external/executions/:id/*`(`EXTERNAL_EXEC_PATH_RE`): `:id` 로 execution → workflow → 워크스페이스 역인덱스
  ([`web-chat-cors-origin.resolver.ts`](../../codebase/backend/src/modules/web-chat-cors/web-chat-cors-origin.resolver.ts),
  60s TTL 캐시) → **빌트인 위젯 CDN origin(`WEB_CHAT_WIDGET_ORIGINS` env) ∪ 워크스페이스 `interactionAllowedOrigins`** 합집합과
  대조해 `Origin` echo. 일치 시 허용, 불일치/해석 실패 시 차단. **preflight(OPTIONS) 단계에서도** path param 으로 동작하므로
  token 없이 동적 CORS 가 가능하다(`credentials: false`).
- 그 외 모든 라우트(내부 `/api/*`, 워크스페이스 JWT): 기존 동작(frontend allowlist `CORS_ORIGINS`→`FRONTEND_URL` +
  `credentials: true`, [`common/utils/cors-origins.ts`](../../codebase/backend/src/common/utils/cors-origins.ts)). 위젯/BYO
  origin 은 이 분기에 노출되지 않는다.
- `interactionAllowedOrigins` 는 [`spec/1-data-model.md §2.2 Workspace.settings`](../1-data-model.md#22-workspace) 알려진 키.
  **편집 표면**: 워크스페이스 설정 화면 개요 탭(Admin+) → `PATCH /api/workspaces/:id/settings`([9-user-profile §4.3·§6.1](../2-navigation/9-user-profile.md)).
- **빌트인 위젯 CDN origin 의 backend env 키 = `WEB_CHAT_WIDGET_ORIGINS`**(콤마 구분, `main.ts` →
  `parseWidgetOrigins`, [`common/cors/web-chat-cors.ts`](../../codebase/backend/src/common/cors/web-chat-cors.ts)).
  워크스페이스 무관 고정 always-allow 목록의 SoT 이며 [0-architecture §4](./0-architecture.md) 가 이 키를 참조한다.
  샘플 항목은 [`codebase/backend/.env.example`](../../codebase/backend/.env.example).
- **⚠️ 프론트/API origin 분리 배포 주의**: 프론트(위젯 동봉 origin)와 API 를 **별도 도메인**(예: `app.example.com`
  vs `api.example.com`, 운영 `workflow.getit.co.kr` vs `workflow-api.getit.co.kr`)으로 분리 배포하면, 위젯이
  same-origin 동봉이어도 위젯(프론트 origin)→`/api/external/*`(API origin) 호출이 **cross-origin** 이 된다. 이때
  **프론트 origin 을 `WEB_CHAT_WIDGET_ORIGINS` 에 반드시 포함**해야 SSE·토큰 갱신이 CORS 를 통과한다. 누락 시
  `/api/external/*` 응답에 `Access-Control-Allow-Origin` 이 없어 차단되고(`/api/hooks/*` 는 무제한이라 대화 start 만
  통과), 위젯은 환영 메시지만 뜬 채 SSE 이벤트를 못 받아 대화·라이브 미리보기가 막힌다. (same-origin 단일 배포라면
  불필요 — 이 키는 분리 배포·엣지 CDN override 시점에만 채운다.)

## 3. 임베드 allowlist (무단 임베드 차단)

"이 워크스페이스의 봇 위젯은 특정 호스트 도메인에서만 임베드 가능"을 워크스페이스 단위로 제어. **봇이 공개이므로 hard
보안 경계가 아니라 캐주얼 오남용 차단용 soft 컨트롤**이다. 문서를 워크스페이스별로 동적 렌더링하지 않으므로([0-architecture
§2.1·§R5](./0-architecture.md)) CSP `frame-ancestors` 동적 주입은 v1 기본이 아니다:
- **① 클라이언트 soft 검증(v1 기본)**: 부팅 시 위젯이 **`GET /api/hooks/:endpointPath/embed-config`** 로 워크스페이스
  allowlist 를 조회(`EmbedConfigDto { allowlist, enforce }`, `EmbedConfigService`)한 뒤, 실제 host origin
  (`window.location.ancestorOrigins[0]`, 미지원 시 `document.referrer` 폴백)을 읽어 대조 → 불일치 시 렌더 거부 + 시작 차단
  (위젯 상태 `blocked` — host `show` 로도 해제되지 않는 정책 거부. **상태 정의 SoT = [1-widget-app §3.2](./1-widget-app.md)**;
  본 §3-① 은 그 상태를 발동하는 정책 trigger). 부팅 시퀀스상 위치는 [3-auth-session §3 step 0](./3-auth-session.md). `enforce=false`
  또는 allowlist 빈 경우 fail-open(통과). **host origin 미탐지**(iframe sandbox·프라이버시 설정으로 `ancestorOrigins`·
  `referrer` 모두 불가) 시에도 **통과(fail-open)** — soft 컨트롤이므로 환경적 미탐지로 정당 사용자를 막지 않는다.
  - **`/embed-config` 엔드포인트 동작(공개·무인증)**: 비존재 endpointPath·DB 오류·인증 webhook(`authConfigId` NOT NULL)
    모두 `{ allowlist: [], enforce: false }`(HTTP 200)로 동일 응답 → **존재 여부 누설(enumeration)·allowlist 노출 없음**.
    응답은 `Cache-Control: public, max-age=300`(워크스페이스 설정 변경 후 최대 5분 반영, CDN/브라우저 캐시 의존). SoT: `EmbedConfigService`.
- **② API soft 필터(선택)**: webhook 시작 요청의 host origin 을 서버가 allowlist 와 대조해 거부.
- **③ hard frame-ancestors(opt-in)**: 강제 차단이 꼭 필요한 워크스페이스만 동적 문서 제공을 감수하고 사용. v1 기본 아님.

워크스페이스 설정은 CORS(§2)와 **동일한 `interactionAllowedOrigins` 단일 키로 통합**(별도 키 미신설 — 단일 진실 원칙).
M2 에서는 "서빙 origin = 호출 origin"이라 CORS·임베드가 같은 도메인을 가리키고, M1 에서만 서빙(위젯 CDN)≠호스트(고객)가 갈린다.
설정 편집은 워크스페이스 설정 개요 탭(Admin+, [9-user-profile §4.3](../2-navigation/9-user-profile.md)).

> **빈 목록 의미(레이어별)**: `interactionAllowedOrigins` 가 비면 — (a) **임베드 soft 검증(§3-①)**: allowlist 0 →
> `enforce=false` → allow-all(soft, 캐주얼 오남용만 방지); (b) **`/api/external/*` CORS(§2)**: 추가 origin 0 →
> **built-in 위젯 CDN origin 만 허용**(secure-by-default 유지, EIA §8.5 "미설정 시 차단"과 정합). 두 레이어가 다르게
> 동작하므로 "빈 목록 = 전체 개방" 이 아니다.

## 4. 공개(인증 없음) webhook 남용 방어

공개 AI 챗봇의 실질 리스크는 **인프라 부하**와 **LLM 토큰 비용**이다. 인증 대신 다층 방어:

**v1 기본 적용**
- IP 단위 대화 시작 rate-limit(예: 분당 10/IP). **[구현됨 v1]** `PublicWebhookThrottleGuard` + `PublicWebhookQuotaService`.
- 익명 세션 + IP 조합 동시/누적 대화 상한(예: 동시 ≤3, 시간당 신규 ≤20).
  - **누적 신규(시간당 ≤20/IP): 구현됨 v1.** **동시 ≤3 캡: 현 시점 비목표** — 대화 종료 신호(`conversationEnded`) 의
    backend 연동(widget↔backend 신호 흐름)이 선행돼야 하나 미구현이며, 누적 신규 상한으로 best-effort 방어가 충분해 의도적
    비목표로 둔다. 필요해지면 별도 plan 으로 착수.
- 메시지/페이로드 크기 제한(예: 메시지 4KB, body 32KB).
  - **body 32KB: webhook gate(`PublicWebhookThrottleGuard`)에서 구현됨 v1.** **메시지 4KB**: 대화 중 메시지는 EIA interact
    레이어 책임 — 현재 별도 body 검증 미적용, 네트워크/proxy 계층 한도에 의존(별도 강화는 EIA §8.4 연계 followup).
- 기존 EIA §8.4 유지 — **SSE 동시 3/execution 은 구현됨**(초과 시 `429 TOO_MANY_CONNECTIONS`), **interact 분당 60/execution 은 Planned(미구현)**. 두 제한의 구현 상태가 다르므로 분리 기재한다([EIA §8.4](../5-system/14-external-interaction-api.md)).
- **워크플로우 측 비용 가드**: AI 노드 대화당 최대 turn + 워크스페이스 일일 토큰/비용 예산 → 초과 시 우아한 종료.
  LLM 비용은 공개 챗봇의 핵심 리스크이나, 그 가드는 execution-engine/AI 노드 spec 연계(본 영역 밖)라 별도 설계가 선행돼야
  하므로 **현 시점 비목표** — 필요해지면 해당 영역 plan 으로 착수.

> **rate-limit 구현 특성(v1)**: Redis **fixed-window** 카운터를 쓴다 — 윈도우 경계에서 최대 2배 버스팅이 허용되는 특성이
> 있다. 본 rate-limit 은 인증 대체가 아닌 **best-effort defense-in-depth** 이며, Redis 미가용 시 — 그리고 **Guard 의 trigger DB 조회 실패 시에도** — **fail-open**(정당한
> webhook 보호)이다. 단 trigger 조회 실패 fail-open 은 공개 webhook 보호를 일시 무력화하므로 `error` 레벨로 로깅해
> 장기 DB 장애로 인한 보호 우회 지속을 모니터링이 조기 탐지하게 한다 (SoT: [12-webhook §6](../5-system/12-webhook.md#6-구현-파일-구조)).
> 더 강한 보장이 필요하면 sliding-window 전환이 followup 후보. 공개 trigger(`auth_config_id IS NULL`)
> 에만 적용되고 인증 webhook(서버-to-서버)은 무제한 통과한다. 단 이는 **rate-limit·공개 32KB body 한도**에 한하며, 인증 webhook 의 **본문 크기는** `/api/hooks/*` 라우트 스코프 1MB body-parser 가 별도 게이트한다 (SoT: [Spec Webhook WH-NF-02](../5-system/12-webhook.md#비기능-요구사항)).

**opt-in (워크스페이스 선택)**
- 첫 대화 시작 전 invisible challenge(예: Turnstile/hCaptcha).
- 임베드 origin 소프트 필터(§3-②).

> 수치는 운영 데이터로 튜닝.

## 5. 프라이버시 / 데이터 처리

공개 위젯이 수집하는 엔드유저 대화는 execution 으로 저장된다. **동의 고지·보존기간·PII 처리 정책은 배포자(워크스페이스
운영자)의 책임**이며 본 spec 은 규정하지 않는다(서빙 주체마다 환경/관할 상이). 위젯은 `disclaimer`(boot) 고지 문구만
제공한다. SDK 는 Clemvion 으로 사용 지표를 전송하지 않으며, 호스트의 자체 분석은 이벤트 구독(`on('message')` 등)으로만 가능하다.

## 6. 접근성 / 브라우저 지원

WCAG AA 지향(키보드 내비·ARIA·스크린리더) + 모던 에버그린 브라우저(SSE 지원 전제).

## Rationale

(본 절은 §1~§5 정책의 "왜"만 다룬다 — 정책 본문은 위 섹션이 SoT.)

### R1. CORS 두 공개 표면 분리 (`/api/hooks/*` 무제한 vs `/api/external/*` allowlist)
공개 위젯은 `/api/hooks/*` 에 **credential 없이** POST 하므로 `Access-Control-Allow-Origin: *` 로 충분하고(브라우저가
credentialed `*` 를 막는 문제와 무관), 토큰을 쓰는 `/api/external/*`(interact/stream/refresh)만 워크스페이스 동적
allowlist 로 좁힌다. 두 표면을 한 정책으로 합치면 둘 중 하나가 과·소 허용된다 — hooks 를 allowlist 로 묶으면 정당한
공개 호출이 깨지고, external 을 `*` 로 열면 토큰 표면이 과노출된다. 따라서 경로-스코프 분리가 최소권한과 호환성을
동시에 만족한다(§2·§2.1).

### R2. 임베드 검증 soft 기본 / hard `frame-ancestors` opt-in
봇이 공개(`auth_config_id IS NULL`)라 임베드 allowlist 는 **hard 보안 경계가 아니라 캐주얼 오남용 차단**이다. hard
`frame-ancestors` 강제는 워크스페이스별 **동적 문서 렌더링**을 요구하는데, 위젯은 정적 CDN 단일 자산으로 배포해 캐시·
호스팅 이점을 얻는 구조([0-architecture §2.1·§R5](./0-architecture.md))라 동적 CSP 주입은 그 이점을 깨뜨린다. 그래서
v1 기본은 클라이언트 soft 검증(불일치 시 `blocked`)으로 두고, 강제 차단이 꼭 필요한 워크스페이스만 동적 문서 비용을
감수하는 opt-in(§3-③)으로 분리했다.

**인증 webhook 의 embed-config 제외(I3)**: 임베드 제어는 공개 봇(`auth_config_id IS NULL`) 전용이다. 인증 webhook
(`authConfigId` NOT NULL)은 브라우저 임베드가 아닌 **서버-to-서버 채널**이므로 임베드 통제 대상이 아니며, `/embed-config`
는 이들에 대해 `{ allowlist: [], enforce: false }` 로 응답한다(§3-①, WH-SC-01 공개 트리거 전제와 정합) — 존재 여부도
누설하지 않는다.

**빈 목록의 레이어별 비대칭은 의도된 설계(I4)**: `interactionAllowedOrigins` 가 비었을 때 CORS 레이어는
**built-in 위젯 CDN origin 만 허용**(secure-by-default, §2)하는 반면 임베드 soft 검증 레이어는 **allow-all**(`enforce=false`
fail-open, §3-①)로 동작한다. 두 레이어의 목적이 다르기 때문이다 — CORS 는 토큰 표면(`/api/external/*`)을 지키는 hard
경계라 미설정 시 닫고, 임베드 검증은 캐주얼 오남용만 막는 soft 컨트롤이라 미설정 시 정당 사용자를 막지 않도록 연다.
"빈 목록 = 전체 개방"이 아니라는 §3 말미 blockquote 의 근거다.

### R3. 남용 방어 rate-limit — fixed-window + fail-open
공개 챗봇의 실질 리스크는 인프라 부하·LLM 비용이고 인증이 없으므로, rate-limit 은 **인증 대체가 아닌 best-effort
defense-in-depth** 다. Redis **fixed-window**(윈도우 경계 최대 2배 버스팅 허용)를 택한 건 sliding-window 대비 구현·
비용이 단순하고 best-effort 목적에 충분하기 때문이며, Redis 미가용 시 **fail-open**(차단이 아닌 통과)으로 둔 건 방어
인프라 장애가 정당한 webhook(서버-to-서버 포함)까지 깨는 것을 막기 위함이다. **Redis 미가용뿐 아니라 Guard 의 trigger
DB 조회 실패도 같은 이유로 fail-open 이며, 단 보호 일시 무력화 구간이라 `error` 레벨 로깅으로 모니터링 가시성을 확보한다
(SoT: [12-webhook §6](../5-system/12-webhook.md#6-구현-파일-구조)).** 더 강한 보장이 필요하면 sliding-window
전환이 followup 후보(§4 blockquote).

### R4. 마크다운 sanitize — deny-by-default allowlist (blacklist 기각)

위젯(§1.1)의 DOMPurify sanitize 는 **허용 목록(ALLOWED_TAGS/ALLOWED_ATTR/ALLOWED_URI_REGEXP)** 기반이다 — 알려진 위험만 차단하는 blacklist(FORBID) 방식은 기각했다. 임베드 위젯은 타 사이트(공개)에서 동작해 XSS 성공 시 피해가 **호스트 사이트로 전파**되므로, 채팅 렌더에 실제 필요한 태그/속성만 허용하고 미지·신규 벡터(svg/math 기반 mXSS 등)를 기본 차단하는 deny-by-default 가 안전 마진이 크다. 메인 앱은 `react-markdown` + `rehype-raw` 미사용으로 raw HTML 자체를 파싱하지 않아(escape) 동등한 보장을 다른 메커니즘으로 달성한다.

**빈/경계 입력**: 빈 문자열·공백만 있는 입력은 throw 없이 안전한 빈/정상 string 을 반환한다 (SSR/static export 단계에서는 `null` 폴백). 양쪽 렌더러 모두 빈입력 경계값을 unit 으로 검증한다.

### R5. iframe sandbox `allow-same-origin` — 완전 격리 원칙의 한정 적용

[0-architecture §R1](./0-architecture.md) 은 iframe 으로 쿠키·스토리지를 **완전 분리**한다고 선언하는데, §1 sandbox 표의
`allow-same-origin` 은 이와 표면적으로 긴장한다 — 이 항을 공식 Rationale 로 명문화한다.

- **(a) §R1 의 "완전 분리"는 cross-origin CDN 배포를 기준 모델로 한다.** 위젯 SPA 가 위젯 CDN origin(호스트와 다른
  origin)에서 서빙되면 same-origin policy 만으로 호스트의 쿠키·스토리지·전역과 격리되며, 이 경로에서는 `allow-same-origin`
  이 있어도 sandbox 탈출 위협이 없다(위젯 자신의 origin 에 대한 same-origin 일 뿐 호스트와는 무관).
- **(b) `allow-same-origin` 필요성.** 동봉(co-deploy, [0-architecture §4.1](./0-architecture.md)) 기본 경로에서는 위젯이
  배포 자신의 origin 에서 same-origin 으로 서빙된다. 이때 `allow-same-origin` 이 없으면 iframe 문서가 *opaque origin* 으로
  강등돼 자기 `localStorage`/`sessionStorage` 접근과 `postMessage` origin 핀(양방향 `event.origin` 화이트리스트, §1)이
  깨진다. 위젯의 세션·토큰 보관과 origin 검증을 유지하려면 이 속성이 필수다.
- **(c) 트레이드오프와 공급망 무결성 전제.** same-origin 동봉 경로에서는 `allow-same-origin` 으로 인해 **같은 origin 의 악성
  스크립트가 sandbox 를 탈출**할 수 있다. 그러나 동봉 위젯은 제품과 **동일 릴리스로 배포**되어([§4.1 버전 잠금](./0-architecture.md))
  iframe 문서의 출처가 제품 자신이라는 **공급망 무결성**이 전제되므로, 이 잔여 위험은 수용 가능하다. 외부 CDN override
  (`NEXT_PUBLIC_WIDGET_CDN_BASE`) 환경은 (a) 의 cross-origin 모델로 돌아가 위협이 소거된다.
- **(d) §R5 carve-out 과의 관계.** admin 콘솔 내부 미리보기의 same-origin 동봉 iframe([0-architecture §R5 carve-out](./0-architecture.md))
  도 같은 전제(우리 앱이 우리 위젯을, 버전 일치·외부 의존 0)에 선다 — 본 항의 same-origin 수용 논리와 동일 근거다.
