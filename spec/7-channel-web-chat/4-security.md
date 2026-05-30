---
id: web-chat-security
status: partial
code:
  - codebase/backend/src/common/cors/web-chat-cors.ts
  - codebase/backend/src/modules/web-chat-cors/**
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
| 임베드 allowlist | **워크스페이스 단위** `interactionAllowedOrigins`(CORS 와 동일 키). v1 = 부팅 시 host origin **soft 검증**, hard `frame-ancestors` 는 opt-in. §3 |
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

### 2.1 현황·구현 제약 (코드 SoT)
backend 는 [`main.ts` 전역 단일 `app.enableCors({ origin: corsOriginCallback })`](../../codebase/backend/src/main.ts)
하나로 **모든 라우트**에 동일 allowlist(`CORS_ORIGINS`→`FRONTEND_URL`, 현재 **frontend origin 만**) 적용
([`common/utils/cors-origins.ts`](../../codebase/backend/src/common/utils/cors-origins.ts)). 위젯 CDN/고객 도메인은
frontend 와 다른 도메인이라 **현 상태로는 브라우저 요청이 차단**된다(서버-to-서버 webhook 은 `Origin` 미동봉이라 통과).

**구현 제약**:
- `/api/external/*`(+ browser `/api/hooks/*` 무제한)에 **경로-스코프 CORS** 를 분리 도입하고, 전역 `enableCors`(frontend
  전용)는 그 경로를 제외(또는 경로별 미들웨어 우선)하여 **이중 `Access-Control-Allow-Origin` 헤더 충돌** 방지. 내부
  endpoint(`/api/*`, 워크스페이스 JWT)에 위젯/BYO origin 노출 금지.
- 워크스페이스 해석은 path 로 가능: `/api/external/executions/:id/*` 는 `:id` 로 워크스페이스 역인덱스 →
  **preflight(OPTIONS) 단계에서도** path param 으로 allowlist 조회해 `Origin` echo(token 없이 동적 CORS 가능).
- `interactionAllowedOrigins` 는 [`spec/1-data-model.md §2.2 Workspace.settings`](../1-data-model.md#22-workspace) 알려진 키.

## 3. 임베드 allowlist (무단 임베드 차단)

"이 워크스페이스의 봇 위젯은 특정 호스트 도메인에서만 임베드 가능"을 워크스페이스 단위로 제어. **봇이 공개이므로 hard
보안 경계가 아니라 캐주얼 오남용 차단용 soft 컨트롤**이다. 문서를 워크스페이스별로 동적 렌더링하지 않으므로([0-architecture
§2.1·§R8](./0-architecture.md)) CSP `frame-ancestors` 동적 주입은 v1 기본이 아니다:
- **① 클라이언트 soft 검증(v1 기본)**: 부팅 시 실제 host origin(`window.location.ancestorOrigins[0]`, 미지원 시
  `document.referrer` 폴백)을 읽어 캐시 가능한 워크스페이스 allowlist 와 대조 → 불일치 시 렌더 거부 + 시작 차단.
- **② API soft 필터(선택)**: webhook 시작 요청의 host origin 을 서버가 allowlist 와 대조해 거부.
- **③ hard frame-ancestors(opt-in)**: 강제 차단이 꼭 필요한 워크스페이스만 동적 문서 제공을 감수하고 사용. v1 기본 아님.

워크스페이스 설정은 CORS(§2)와 **동일한 `interactionAllowedOrigins` 단일 키로 통합**(별도 키 미신설 — 단일 진실 원칙).
M2 에서는 "서빙 origin = 호출 origin"이라 CORS·임베드가 같은 도메인을 가리키고, M1 에서만 서빙(위젯 CDN)≠호스트(고객)가 갈린다.

## 4. 공개(인증 없음) webhook 남용 방어

공개 AI 챗봇의 실질 리스크는 **인프라 부하**와 **LLM 토큰 비용**이다. 인증 대신 다층 방어:

**v1 기본 적용**
- IP 단위 대화 시작 rate-limit(예: 분당 10/IP).
- 익명 세션 + IP 조합 동시/누적 대화 상한(예: 동시 ≤3, 시간당 신규 ≤20).
- 메시지/페이로드 크기 제한(예: 메시지 4KB, body 32KB).
- 기존 EIA §8.4 유지(interact 분당 60/execution, SSE 동시 3/execution).
- **워크플로우 측 비용 가드(핵심)**: AI 노드 대화당 최대 turn + 워크스페이스 일일 토큰/비용 예산 → 초과 시 우아한 종료.

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
