# 신규 식별자 충돌 검토 결과

## 발견사항

### 발견사항 1
- **[WARNING]** NAV-WC-04 설명 구식화 — "백엔드 미저장" 문구가 실제 결정과 상충
  - target 신규 식별자: `5-admin-console.md §R2` — 외형 서버 저장(결정 2026-06-24), `config.interaction.appearance` 영속화
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/spec/2-navigation/_product-overview.md` line 220 — `NAV-WC-04 | 외형/콘텐츠 빌더 (BootConfig 필드, 백엔드 미저장 — boot 옵션으로만 emit) | 필수 | ✅`
  - 상세: `5-admin-console.md §R2`가 "외형 per-instance 서버 저장 — 기존 미저장 결정의 부분 번복(결정 2026-06-24)"을 명시하고 `§4`·`§2` 매핑 표도 `PATCH /api/triggers/:id { interaction:{ …, appearance } }`·`WebChatAppearanceDto`로 저장을 서술하는데, `_product-overview.md`의 NAV-WC-04는 "백엔드 미저장"이라는 기존 결정을 그대로 남겨 두 문서가 동일 요구사항에 대해 상반된 내용을 기술한다. 진실 충돌이지만 최신 정책은 5-admin-console에 있으므로 CRITICAL 충돌은 아니고 문서 부정합.
  - 제안: `spec/2-navigation/_product-overview.md` NAV-WC-04 설명을 `외형/콘텐츠 빌더 (BootConfig 필드, 서버 저장 — trigger config.interaction.appearance, 결정 2026-06-24)`로 갱신한다.

### 발견사항 2
- **[INFO]** i18n 파일명 — spec은 `web-chat.ts`(kebab-case), 구현은 `webChat.ts`(camelCase)
  - target 신규 식별자: spec `5-admin-console.md §8` — `lib/i18n/dict/{ko,en}/web-chat.ts`
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/lib/i18n/dict/ko/webChat.ts`, `/…/en/webChat.ts` — 전체 dict 파일 목록이 camelCase 일관(`knowledgeBases.ts`, `llmConfigs.ts`, `agentMemory.ts` 등)
  - 상세: spec §8이 `web-chat.ts`로 명세했지만 실제 구현 파일명은 `webChat.ts`로 기존 camelCase 컨벤션을 따른다. 기능상 충돌이 없고 파일이 이미 존재하므로 런타임 오류는 없으나, spec 참조자가 파일을 찾지 못할 수 있다. spec 파일명이 잘못 명시된 경우다.
  - 제안: `spec/7-channel-web-chat/5-admin-console.md §8`의 `web-chat.ts`를 `webChat.ts`로 수정해 구현 관례와 일치시킨다.

### 발견사항 3
- **[INFO]** `getWidgetLoaderUrl` 함수명 — spec §5에 언급 없고 구현에만 존재
  - target 신규 식별자: `codebase/frontend/src/lib/web-chat/widget-base.ts`에 신설된 `getWidgetLoaderUrl()` + `getWidgetCdnBase()` 함수
  - 기존 사용처: `spec/7-channel-web-chat/5-admin-console.md §5` 표 — `<widget-cdn-base>` 출처 주석에 코드 SoT 언급 없음. `getWebhookBaseUrl`은 `codebase/frontend/src/lib/utils/webhook-url.ts`로 spec §5 표에 명시됨
  - 상세: `getWebhookBaseUrl()`은 spec §5 표에 `SoT: codebase/frontend/src/lib/utils/webhook-url.ts getWebhookBaseUrl()`로 명확히 기록되어 있으나, 동급 신설 함수 `getWidgetLoaderUrl()`과 그 소재 `lib/web-chat/widget-base.ts`는 spec에 언급이 없다. 충돌은 아니지만 일관성 공백.
  - 제안: `spec/7-channel-web-chat/5-admin-console.md §5` 표의 `<widget-cdn-base>` 행에 `SoT: codebase/frontend/src/lib/web-chat/widget-base.ts getWidgetLoaderUrl()`을 추가한다.

## 요약

신규 도입 spec ID(`web-chat-architecture`, `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-security`, `web-chat-admin-console`)는 spec/ 전체에서 중복 없이 유일하다. 환경변수 `NEXT_PUBLIC_WIDGET_CDN_BASE`(신규·선택)와 기존 `WEB_CHAT_WIDGET_ORIGINS`는 각 앱(frontend/backend) 소관이 다르고 의미도 구분되어 충돌이 없다. API 파라미터 `interactionEnabled`는 기존 frontend 컴포넌트의 로컬 상태변수 `interactionEnabled`(trigger-detail-drawer)와 이름이 같지만 두 맥락이 완전히 독립적(API 쿼리 파라미터 vs React state)이라 런타임 충돌이 없다. 실질 위험은 NAV-WC-04의 "백엔드 미저장" 문구가 최신 결정("서버 저장")과 상충하는 문서 부정합이 유일한 WARNING이며, i18n 파일명 불일치(spec kebab-case vs 구현 camelCase)와 `getWidgetLoaderUrl` SoT 미기재가 INFO 수준 보완 사항이다.

## 위험도

LOW
