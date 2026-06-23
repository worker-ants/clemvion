# 신규 식별자 충돌 검토 결과

## 발견사항

### 1. 요구사항 ID 충돌

- **[INFO]** NAV-WC-* ID 블록 — 신규, 충돌 없음
  - target 신규 식별자: `NAV-WC-01` ~ `NAV-WC-06`
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/spec/2-navigation/_product-overview.md` — 기존 블록은 `NAV-WF-*`, `NAV-TR-*`, `NAV-SC-*`, `NAV-IN-*`, `NAV-KB-*`, `NAV-CA-*`, `NAV-CL-*`, `NAV-ST-*`. `NAV-WC` prefix 는 이전에 없었음.
  - 상세: 충돌 없음. spec 에 이미 반영 완료(line 217-222). 신규 prefix 가 기존 패턴(`NAV-<영역>`)과 일관됨.
  - 제안: 없음.

### 2. 엔티티/타입명 충돌

- **[INFO]** spec frontmatter ID `web-chat-admin-console` — 신규, 충돌 없음
  - target 신규 식별자: `id: web-chat-admin-console`
  - 기존 사용처: 같은 영역의 기존 ID — `web-chat-architecture`, `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-security` (`/spec/7-channel-web-chat/*.md`). `web-chat-admin-console` 은 이전에 없었음.
  - 상세: 충돌 없음. 명명 패턴(`web-chat-<문서명>`)과 일관됨.
  - 제안: 없음.

### 3. API endpoint 충돌

- **[INFO]** 신규 endpoint 없음 — 충돌 가능성 없음
  - target 은 기존 `POST /api/triggers` 및 `GET /api/triggers` 를 재사용하고 신규 endpoint 를 정의하지 않음.
  - 상세: 충돌 대상 없음.

### 4. 이벤트/메시지명 충돌

- **[INFO]** 신규 이벤트명 없음 — 충돌 가능성 없음
  - target 은 webhook·queue·SSE 이벤트명을 새로 정의하지 않음.

### 5. 환경변수·설정키 충돌

- **[INFO]** `NEXT_PUBLIC_WIDGET_CDN_BASE` — 신규, 충돌 없음
  - target 신규 식별자: `NEXT_PUBLIC_WIDGET_CDN_BASE` (admin 프론트엔드 전용)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/.env.example` 에는 `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WEBHOOK_BASE_URL` 만 존재. `NEXT_PUBLIC_WIDGET_CDN_BASE` 는 codebase 어디에도 아직 없음(spec 과 plan 에만 선언).
  - 상세: 충돌 없음. `NEXT_PUBLIC_WEBHOOK_BASE_URL`(webhook origin)·`NEXT_PUBLIC_API_URL`(API origin)과 의미가 구별되며, 신규 키가 이 둘과 혼동될 여지도 없음.
  - 제안: 없음.

- **[INFO]** `WEB_CHAT_WIDGET_ORIGINS` — 기존 존재, 신규가 아님 (충돌 없음)
  - target 신규 식별자로 언급되나 실제로는 기존 구현에 이미 존재.
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/backend/src/main.ts` line 182, `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/backend/.env.example` line 44, `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/backend/src/common/cors/web-chat-cors.ts` line 108. `spec/7-channel-web-chat/4-security.md` lines 72·80.
  - 상세: target 이 "신규" 로 소개하고 있으나 이미 구현된 키. spec `0-architecture.md` line 95 에도 이미 등재됨. 충돌이 아니라 기존 키를 참조하는 것으로 target 의 서술이 정확하지 않을 수 있으나, 의미는 일치하므로 실질 충돌 없음.
  - 제안: target spec draft 의 §1.3, §2.5 에서 `WEB_CHAT_WIDGET_ORIGINS` 를 "신규 env" 로 서술하는 부분을 "기존 env" 로 정정할 것.

- **[WARNING]** `NEXT_PUBLIC_WIDGET_CDN_BASE` 미설정 시 fallback 동작 불일치 — draft vs 작성된 spec
  - target 신규 식별자: `NEXT_PUBLIC_WIDGET_CDN_BASE` fallback 정책
  - 기존 사용처(draft §1.5): "미설정 시 self-origin 기본 동작으로 대체 — 동봉이 없을 때만 비활성" (co-deploy 결정 후 fallback 철회).
  - 현 spec 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/spec/7-channel-web-chat/5-admin-console.md` line 117-118 — "미설정 시 비활성 + '위젯 호스팅 미설정' 경고" (이전 draft 의 비활성 fallback 유지).
  - 상세: draft §1.5 에서 "이전 draft 의 비활성+경고 fallback 은 self-origin 기본 동작으로 대체"로 번복했으나, 현재 `5-admin-console.md` spec 은 구 fallback(비활성+경고)을 그대로 보유. 동일 env 키의 동작 의미가 draft 와 이미 작성된 spec 사이에서 갈림.
  - 제안: `5-admin-console.md` §5 의 `NEXT_PUBLIC_WIDGET_CDN_BASE` 미설정 fallback 설명을 "미설정 시 self-origin 기본값(co-deploy 동봉 경로) — 동봉 번들이 없을 때만 비활성+경고" 로 갱신하여 §1.5 co-deploy 결정과 일치시킬 것.

### 6. 파일 경로 충돌

- **[INFO]** `spec/7-channel-web-chat/5-admin-console.md` — 이미 작성됨, 경로 충돌 없음
  - target 신규 파일: `spec/7-channel-web-chat/5-admin-console.md`
  - 기존 사용처: 해당 경로에 파일이 이미 존재. 기존 파일명 패턴 `N-name.md` 과 일관.
  - 상세: 충돌 없음. `0-architecture`, `1-widget-app`, `2-sdk`, `3-auth-session`, `4-security` 다음 `5-admin-console` 은 순서상 자연스러움.
  - 제안: 없음.

- **[INFO]** `spec/2-navigation/_layout.md` Web Chat 메뉴 항목 — 이미 반영됨, 충돌 없음
  - target 신규 행: `/web-chat` 경로, 번호 5
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/spec/2-navigation/_layout.md` line 75 에 이미 반영됨.
  - 상세: 충돌 없음.

- **[INFO]** `lib/i18n/dict/{ko,en}/web-chat.ts` — 신규 파일, 충돌 없음
  - target 신규 식별자: `web-chat.ts` dict 파일(ko/en)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/lib/i18n/dict/ko/` 에 해당 파일 없음.
  - 상세: 충돌 없음.

- **[INFO]** i18n 키 `sidebar.webChat` — 신규, 충돌 없음
  - target 신규 식별자: `sidebar.webChat`
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/lib/i18n/dict/ko/sidebar.ts` 에 `webChat` 키 없음. 기존 키 — `dashboard`, `workflows`, `triggers`, `schedule`, `integration`, `knowledgeBase`, `models` 등.
  - 상세: 충돌 없음. 명명 패턴(camelCase)과 일관됨.

---

## 요약

target 이 도입하는 신규 식별자(요구사항 ID `NAV-WC-*`, spec frontmatter ID `web-chat-admin-console`, env 키 `NEXT_PUBLIC_WIDGET_CDN_BASE`, i18n 키 `sidebar.webChat`, 파일 경로 `5-admin-console.md`·`web-chat.ts`) 는 기존 사용처와 의미 충돌이 없다. 실질 우려 사항은 두 가지다: (1) `WEB_CHAT_WIDGET_ORIGINS` 를 draft 가 "신규 env"로 서술하나 이미 구현된 키임 — 서술 정정 필요(INFO 수준). (2) `NEXT_PUBLIC_WIDGET_CDN_BASE` 미설정 시 fallback 정책이 draft §1.5(self-origin 기본값)와 이미 작성된 `5-admin-console.md`(비활성+경고) 사이에서 불일치함 — 동일 식별자의 동작 명세가 두 문서 간 갈리므로 구현 혼선 가능(WARNING 수준). 나머지 모든 신규 식별자는 기존 충돌 없음.

## 위험도

LOW
