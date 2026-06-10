---
id: web-chat-security
status: partial
code:
  - codebase/backend/src/common/cors/web-chat-cors.ts
  - codebase/backend/src/modules/web-chat-cors/**
  - codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts
  - codebase/backend/src/modules/hooks/public-webhook-quota.service.ts
  - codebase/backend/src/modules/hooks/embed-config.service.ts
  - codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts
  - codebase/channel-web-chat/src/widget/host-bridge.ts
pending_plans:
  - plan/in-progress/channel-web-chat-impl.md
  - plan/in-progress/channel-web-chat-followups.md
---

# Spec: Channel Web Chat — 보안 (CORS · 임베드 · 남용 방어 · 프라이버시)

> 관련: [EIA §8](../5-system/14-external-interaction-api.md) · [아키텍처 §2·§R8](./0-architecture.md) ·
> [인증/세션](./3-auth-session.md) · [1-data-model §2.2 Workspace.settings](../1-data-model.md#22-workspace).

---

## 1. 보안 정책 요약

| 항목 | 정책 |
|---|---|
| webhook 호출 | 트리거 `auth_config_id IS NULL`(인증 없음/공개, 12-webhook §3.2 WH-SC-01) |
| CORS — `/api/hooks/*` | **무제한 유지**(`Access-Control-Allow-Origin: *`, EIA §8.5). 위젯은 credential 없이 POST 하므로 `*` 로 충분 |
| CORS — `/api/external/*` | **워크스페이스 단위 동적 allowlist**(`interactionAllowedOrigins`). M1=위젯 CDN(빌트인 허용), M2=고객 도메인(워크스페이스 설정). §2 |
| 임베드 allowlist | **워크스페이스 단위** `interactionAllowedOrigins`(CORS 와 동일 키). v1 = 부팅 시 host origin **soft 검증**(불일치 시 위젯 `blocked`), hard `frame-ancestors` 는 opt-in. §3 |
| iframe sandbox | `sandbox="allow-scripts allow-forms allow-same-origin"`(필요 최소) |
| postMessage | 양방향 `event.origin` 화이트리스트 검증. 토큰/대화 내용 host 로 비노출 |
| 토큰 노출 | per_execution 단일 → 클라이언트에 장기 비밀 없음 |
| rate-limit / abuse | EIA §8.4 + 공개 webhook 남용 방어(§4) |
| 입력 sanitize | AI 메시지/presentation 렌더 시 XSS 방지(마크다운 sanitize, 링크 rel=noopener) — 위젯 책임 |
| 프라이버시·데이터 처리 | **배포자(워크스페이스 운영자) 책임** — 동의 고지·보존기간 spec 미규정. 위젯은 `disclaimer` 고지 문구만 제공 |
| 텔레메트리 | SDK 는 Clemvion 으로 사용 지표 미전송. 호스트 자체 분석은 이벤트 구독으로만 |

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

## 3. 임베드 allowlist (무단 임베드 차단)

"이 워크스페이스의 봇 위젯은 특정 호스트 도메인에서만 임베드 가능"을 워크스페이스 단위로 제어. **봇이 공개이므로 hard
보안 경계가 아니라 캐주얼 오남용 차단용 soft 컨트롤**이다. 문서를 워크스페이스별로 동적 렌더링하지 않으므로([0-architecture
§2.1·§R8](./0-architecture.md)) CSP `frame-ancestors` 동적 주입은 v1 기본이 아니다:
- **① 클라이언트 soft 검증(v1 기본)**: 부팅 시 실제 host origin(`window.location.ancestorOrigins[0]`, 미지원 시
  `document.referrer` 폴백)을 읽어 캐시 가능한 워크스페이스 allowlist 와 대조 → 불일치 시 렌더 거부 + 시작 차단
  (위젯 상태 `blocked` — host `show` 로도 해제되지 않는 정책 거부. **상태 정의 SoT = [1-widget-app §3.2](./1-widget-app.md)**;
  본 §3-① 은 그 상태를 발동하는 정책 trigger).
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
  - **누적 신규(시간당 ≤20/IP): 구현됨 v1.** **동시 ≤3 캡: v1.1 이연** — 대화 종료 신호(`conversationEnded`) 의 backend 연동이
    필요하나 현재 widget↔backend 신호 흐름 미구현. [followups #1 동시캡 잔여](../../plan/in-progress/channel-web-chat-followups.md).
- 메시지/페이로드 크기 제한(예: 메시지 4KB, body 32KB).
  - **body 32KB: webhook gate(`PublicWebhookThrottleGuard`)에서 구현됨 v1.** **메시지 4KB**: 대화 중 메시지는 EIA interact
    레이어 책임 — 현재 별도 body 검증 미적용, 네트워크/proxy 계층 한도에 의존(별도 강화는 EIA §8.4 연계 followup).
- 기존 EIA §8.4 유지(interact 분당 60/execution, SSE 동시 3/execution).
- **워크플로우 측 비용 가드(핵심)**: AI 노드 대화당 최대 turn + 워크스페이스 일일 토큰/비용 예산 → 초과 시 우아한 종료.
  **별도 설계 필요(execution-engine/AI 노드 spec 연계, 본 영역 밖)** — [followups #2](../../plan/in-progress/channel-web-chat-followups.md).

> **rate-limit 구현 특성(v1)**: Redis **fixed-window** 카운터를 쓴다 — 윈도우 경계에서 최대 2배 버스팅이 허용되는 특성이
> 있다. 본 rate-limit 은 인증 대체가 아닌 **best-effort defense-in-depth** 이며, Redis 미가용 시 **fail-open**(정당한
> webhook 보호)이다. 더 강한 보장이 필요하면 sliding-window 전환이 followup 후보. 공개 trigger(`auth_config_id IS NULL`)
> 에만 적용되고 인증 webhook(서버-to-서버)은 무제한 통과한다.

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
호스팅 이점을 얻는 구조([0-architecture §2.1·§R8](./0-architecture.md))라 동적 CSP 주입은 그 이점을 깨뜨린다. 그래서
v1 기본은 클라이언트 soft 검증(불일치 시 `blocked`)으로 두고, 강제 차단이 꼭 필요한 워크스페이스만 동적 문서 비용을
감수하는 opt-in(§3-③)으로 분리했다.

### R3. 남용 방어 rate-limit — fixed-window + fail-open
공개 챗봇의 실질 리스크는 인프라 부하·LLM 비용이고 인증이 없으므로, rate-limit 은 **인증 대체가 아닌 best-effort
defense-in-depth** 다. Redis **fixed-window**(윈도우 경계 최대 2배 버스팅 허용)를 택한 건 sliding-window 대비 구현·
비용이 단순하고 best-effort 목적에 충분하기 때문이며, Redis 미가용 시 **fail-open**(차단이 아닌 통과)으로 둔 건 방어
인프라 장애가 정당한 webhook(서버-to-서버 포함)까지 깨는 것을 막기 위함이다. 더 강한 보장이 필요하면 sliding-window
전환이 followup 후보(§4 blockquote).
