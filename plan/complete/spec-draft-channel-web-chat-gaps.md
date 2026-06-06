---
worktree: feat-web-chat-demo
started: 2026-06-03
owner: project-planner
spec_impact:
  - spec/7-channel-web-chat
  - spec/conventions/spec-impl-evidence.md
---

# Spec draft — Channel Web Chat 갭 보강(W1~W5) + show/hide/updateProfile 설계

> 본 draft 는 consistency-check(2026-06-03, review/consistency/2026/06/03/08_56_55) 보고서의 **W1~W5 항목**과
> followups §4 / consistency I9 의 `show`/`hide`/`updateProfile` 위젯 핸들러 설계만 다룬다(자립 문서 아님 —
> §2/§4 번호는 그 보고서 항목 그룹을 가리킨다).

## 영향 spec / 동반 codebase
- spec(project-planner): `1-widget-app.md`, `3-auth-session.md`, `4-security.md`, `0-architecture.md`,
  `spec/conventions/spec-impl-evidence.md`.
- 동반 codebase(developer, 같은 PR 후속 단계): `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`
  (가드 helper 의 `INCLUDE_PREFIXES` 배열 — spec 문서와 1:1 동기), `codebase/backend/.env.example`.

## 병합 순서 주의 (Plan Coherence W4/W5)
- `spec/conventions/spec-impl-evidence.md` 는 spec-sync-audit worktree 가 §2.1 이후를 동시 수정 중 — 본 draft 는
  **§1 목록에 1줄 추가**(비겹침)이나 병합 시 순서 직렬화/리베이스 확인.
- `codebase/backend/.env.example` 는 system-status-recent-failed-86831b worktree 가 파일 말미에 env 추가 중 —
  append 충돌 가능, 병합 순서 직렬화 확인.

## 섹션 2 — W1~W5

### W1 — `1-widget-app.md §3.1` SSE 재연결 시나리오 명시
§3.1 표 아래 절차 문단 추가:
> **SSE 재연결(iframe suspend·일시 네트워크 단절 시):** SSE 가 끊겨도 위젯은 마지막 수신 이벤트의 `Last-Event-Id`
> 로 재연결한다 — EIA 가 **5분 이벤트 버퍼**(EIA §5.2·**EIA-NF-03**)로 `seq > Last-Event-Id` 누락분을 손실 없이
> 재전송하므로 닫힌 사이 도착한 `ai_message` 도 복구돼 unread·타임라인에 반영된다. **버퍼(5분) 만료** 후 재연결이면
> `GET /api/external/executions/:id` snapshot(현재 `conversationThread`, EIA §5.3)으로 폴백해 재동기화한다.
> 만료 신호 이벤트는 EIA 측 계획·미구현이라 위젯은 버퍼 만료를 시간 기준(>5분)으로 판단한다.

### W2 — `3-auth-session.md §3` 재로드 복원 시퀀스 + storage 정리 + 401 구분
§3 시퀀스 아래 `### 3.1 재로드 복원 시퀀스(per_execution)` 신설:
> 1. iframe-origin storage 에서 `{executionId, token, expiresAt, endpoints}` 조회 — 없으면 신규(collapsed).
> 2. `GET /api/external/executions/:id` 상태 확인:
>    - `200` 진행 중 → SSE 재연결(`Last-Event-Id` 절차 = [1-widget-app §3.1](../../spec/7-channel-web-chat/1-widget-app.md)) → 복원.
>    - `410 Gone`(종료/만료) → storage 정리 후 `[ended]`.
>    - `401` → 만료 vs blacklist 구분: per_execution 토큰은 execution 종료 시 즉시 **jti blacklist**
>      (EIA §8.3, EIA-AU-04)되므로 재로드 `401` 은 (a) 단순 만료(refresh 가능) 또는 (b) 종료 후 blacklist
>      (복구 불가) 둘 다 가능. 위젯은 **낙관적으로 `POST .../refresh-token` 1회** 시도 → 성공 시 W1 의 SSE
>      재연결로 복원, 재차 `401`/`410` 이면 종료로 간주 + storage 정리 + `[ended]`.
> 3. **storage 정리 책임:** 종료(`completed`/`failed`/`cancelled`) 수신 시, 그리고 위 복원에서 `410`/복구불가
>    `401` 확인 시 위젯이 즉시 storage 항목 제거(stale 토큰 잔존 금지).

### W3 — `spec-impl-evidence.md §1` INCLUDE_PREFIXES 에 spec/7 추가
§1 적용 대상(inclusive) 목록에 `- spec/7-channel-web-chat/**.md` 추가. 전제: 적용 대상 **5개 spec 파일**
(`0~4-*.md`)이 frontmatter id/status + partial 시 code/pending_plans 적격 — 검증 완료. `_product-overview.md` 는
underscore prefix 로 §1 제외(spec/6 단순 overview 제외 기준과 동일 계열).
**동반(developer):** `spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES` **배열(helper, §4 공식 가드 파일 아님)**에
`"spec/7-channel-web-chat/"` 추가 → frontend `npm test -- spec-frontmatter` 통과 확인.

### W4 — `4-security.md` `## Rationale` 추가
문서 끝에 표준 제목 `## Rationale` 신설 — (a) CORS 두 표면 분리(`/api/hooks/*` 무제한 vs `/api/external/*`
allowlist) 근거, (b) 임베드 검증 soft 기본/hard frame-ancestors opt-in 근거(공개 봇=soft 경계, 동적 문서 비용
회피), (c) rate-limit fixed-window + fail-open 근거(인증 대체 아닌 best-effort, 정당 webhook 보호 우선).
**본문 §4 정책 설명·blockquote 는 유지**하고 Rationale 에는 "왜"만 추가(이동이 아닌 분리).

### W5 — `0-architecture.md §4` + backend `.env.example` 에 `WEB_CHAT_WIDGET_ORIGINS` 명시
§4 에 빌트인 CDN origin 의 backend env 키가 `WEB_CHAT_WIDGET_ORIGINS`(콤마 구분, `main.ts`→`parseWidgetOrigins`)
임을 명시 + "allowlist 정책 SoT: [4-security §2/§2.1](../../spec/7-channel-web-chat/4-security.md)" cross-ref 병기.
**동반(developer):** `codebase/backend/.env.example` 에 `WEB_CHAT_WIDGET_ORIGINS=`(주석 포함) 추가.

## 섹션 4 — show/hide/updateProfile 위젯 핸들러 설계

2-sdk §3(`wc:command`)·§5(`ChatInstance`)가 host 공개 계약 SoT — gap 은 **위젯 SPA 상태기계 + 핸들러 의미**.

### 4-a. `1-widget-app §2/§3` 런처 가시성 축(show/hide) — open/close 와 직교
- **두 직교 축**: ① 위젯 가시성 `visible`/`hidden`(런처 자체 표시, host `show`/`hide`), ② 패널 전개
  `collapsed`/`open`(host `open`/`close`). 공개 계약 타입 SoT 는 **2-sdk §5 ChatInstance**.
- **전이**: `hide`→`hidden`(대화·SSE 유지, 화면만 제거), `show`→`visible`(직전 open/close 보존).
  **`hidden` 에서 `open` 무효**(먼저 `show`, 2-sdk §1/R4 와 일치).
- **`blocked` 와 구분**: `blocked`(임베드 불허, 4-security §3-①)는 두 축과 무관한 **정책 거부(복구 불가)**, `hidden`
  은 host 제어(복구 가능). `1-widget-app §2` 상태 다이어그램에 `blocked` enum 을 명기하고 4-security §3-① 와 1:1
  임을 inline 표기. 2-sdk §R4 에 "blocked 는 두 축과 무관한 정책 거부 상태(복구 불가)" 1줄 추가.

### 4-b. `1-widget-app §3` updateProfile 세션중 갱신 의미
- `updateProfile(profile)` 은 boot `profile` 에 **shallow merge** 되어 **다음 시작(첫 메시지/새 대화) webhook
  payload `profile` 에 반영**. 진행 중 execution 의 기전송 profile 은 **소급 변경 안 함**(webhook payload 는 시작
  1회, EIA 재전송 표면 없음). 빈 세션(시작 전) 갱신은 그대로 첫 시작 반영. `2-sdk §5 updateProfile` 항목에
  "→ 다음 대화 시작에만 반영, 진행 중 execution 소급 불가" cross-ref 추가.

## Rationale
- W1·W2 는 기존 본문이 1줄로 언급(§3.1 표·§3)한 절차를 EIA SoT(§5.2·§5.3·§8.3·EIA-NF-03·EIA-AU-04)에 cross-ref 해
  구현 가능 수준으로 정밀화 — 새 동작 도입 아님.
- W2 의 reload `401` → refresh 1회 후 종료: 재로드 시점에 `401` 의 원인(단순 만료 vs 종료 blacklist)을 클라이언트가
  사전 판별할 수 없으므로 **낙관적 1회 refresh 시도**(만료면 복구) 후 재차 실패면 종료로 확정 — EIA-AU-04(종료 시
  invalidate) invariant 안에서 안전.
- show/hide 를 open/close 와 직교 2축으로 둔 건 **2-sdk §R4(이미 합의)**의 위젯측 반영 — 신규 결정 아님.
- updateProfile "다음 시작 적용/소급 불가"는 webhook payload 가 시작 1회라는 EIA 표면 제약을 따른 것. 대안(진행 중
  execution profile 패치 API 신설)은 EIA 표면 확장이라 본 영역 밖으로 배제.
- W3 INCLUDE_PREFIXES 확장은 spec/7 5개 파일 frontmatter 적격 확인 후라 가드 파손 없음(`_product-overview.md`·spec/6
  은 underscore/overview 제외 기준 동일).
