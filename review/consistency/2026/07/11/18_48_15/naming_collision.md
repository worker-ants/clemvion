# 신규 식별자 충돌 검토 — spec/7-channel-web-chat/

## 검토 범위 및 방법

target: `spec/7-channel-web-chat/{0-architecture,1-widget-app,2-sdk,3-auth-session,4-security,5-admin-console}.md`
(impl-done, diff-base=origin/main). 신규 도입 식별자를 추출해 제공된 검색 코퍼스(spec/0-overview.md,
spec/1-data-model.md, spec/2-navigation, spec/data-flow, plan/in-progress/*, spec/conventions/*)와 대조하고,
필요한 항목은 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/llm-usage-doc-alignment-01d7a4`)의
실제 코드(git grep)로 재확인했다. 대상 식별자: 요구사항 ID(`NAV-WC-01..06`), 엔티티/타입명(`ChatInstance`,
`BootConfig`, `EmbedConfigDto`, `WidgetEvent`), API endpoint(`GET /api/hooks/:endpointPath/embed-config` 등),
이벤트/메시지명(`wc:boot`/`wc:command`/`wc:ready`/`wc:resize`/`wc:event`, `WidgetEvent` 값들), 환경변수
(`NEXT_PUBLIC_WIDGET_CDN_BASE`, `WEB_CHAT_WIDGET_ORIGINS`), 파일 경로(`spec/7-channel-web-chat/4-security.md`,
`spec/7-channel-web-chat/*`).

## 발견사항

없음 — CRITICAL/WARNING 급 충돌이 발견되지 않았다.

### 참고: target 이 이미 자체적으로 충돌을 회피/문서화한 지점 (정보성, 조치 불요)

- **`spec/7-channel-web-chat/4-security.md` 파일명 vs 타 영역 `4-security` 슬러그**: target 프런트매터가
  `id: web-chat-security  # basename 4-security 와 의도적으로 다름 — 타 영역의 4-security 슬러그와 충돌 방지`로
  명시. 실제로 `find spec -iname "4-security.md"` 결과 이 파일이 유일하며, `id: web-chat-*` 접두로 전역 유일성을
  확보했다. 충돌 없음(우려 없음, 이미 해소됨).
- **`interactionAllowedOrigins`(워크스페이스 설정 키)**: target(§2·§3, 4-security.md)이 이를 "기존 키 재사용"으로
  명시하며, `spec/1-data-model.md §2.2 Workspace.settings`(코퍼스 line 1703)에 정의된 동일 키와 완전히 일치하는
  의미로 사용한다. 신규 키를 만들지 않고 CORS·임베드 allowlist 를 "단일 진실 원칙"으로 통합한다고 스스로 밝힘 — 충돌 아님.
- **`NAV-WC-01..06`**: target(5-admin-console.md)이 참조하는 요구사항 ID 는 `spec/2-navigation/_product-overview.md`
  (라인 217-222)에 이미 등록된 것과 동일 — 신규 도입이 아니라 기존 요구사항의 재인용. ID 재사용 충돌 없음.
- **`@workflow/web-chat` npm scope**: 기존 `@workflow/sdk`(`codebase/packages/sdk/package.json`)와 스코프
  네임스페이스(`@workflow/*`)만 공유하고 패키지명 자체는 겹치지 않음(`codebase/packages/web-chat-sdk/package.json`
  이 `@workflow/web-chat` 로 확정). 문서(`eia-sdk-publish.md §결정 #3`)도 일관성을 의도적으로 명시. 충돌 없음.
- **`ChatInstance`/`BootConfig`/`EmbedConfigDto`/`WidgetEvent`/`GENERIC_ERROR_MESSAGE`/`UNIDENTIFIED_IP_BUCKET`
  등 신규 타입·상수명**: 코퍼스·워크트리 전체(spec/, plan/in-progress/, codebase/)에서 grep 했을 때 target 영역
  밖에서 동일 식별자가 다른 의미로 쓰이는 사례를 찾지 못했다.
- **`/web-chat` 사이드바 메뉴 경로**: `spec/2-navigation/_layout.md` 의 기존 메뉴 목록(Schedule=`/schedules` 등)과
  경로 문자열이 겹치지 않으며, 실제 라우트도 `codebase/frontend/src/app/(main)/w/[slug]/web-chat/` 로 신설되어
  기존 라우트와 충돌하지 않는다.
- **`GET /api/hooks/:endpointPath/embed-config`**: 기존 webhook 표면(`/api/hooks/:endpointPath`) 하위의 신규
  sub-path 로, `codebase/backend/src/modules/hooks/hooks.controller.ts` 의 `@Get(':endpointPath/embed-config')`
  로 실장되어 있고 다른 controller 에 동일 path 정의가 없음을 확인.

## 요약

target `spec/7-channel-web-chat/` 6개 문서가 도입하는 요구사항 ID(NAV-WC 참조), 타입/DTO 명(ChatInstance,
BootConfig, EmbedConfigDto, WidgetEvent 등), API endpoint(`/embed-config` 등), postMessage/이벤트 명(`wc:*`,
WidgetEvent 값), 환경변수(`NEXT_PUBLIC_WIDGET_CDN_BASE`, `WEB_CHAT_WIDGET_ORIGINS`), npm scope
(`@workflow/web-chat`), 파일 경로(4-security.md 포함)를 코퍼스(spec/0-overview.md, spec/1-data-model.md,
spec/2-navigation, spec/data-flow, plan/in-progress/*, spec/conventions/*)와 실제 워크트리 코드 전수 grep으로
대조한 결과, 기존 사용처와 의미가 충돌하는 항목을 발견하지 못했다. 오히려 target 문서는 잠재적 충돌 지점
(4-security.md 슬러그 재사용, interactionAllowedOrigins 키 재사용)을 사전에 인지하고 frontmatter 주석·본문에서
명시적으로 회피/근거를 남겨두었다. 신규 식별자 충돌 관점에서는 안전하다.

## 위험도

NONE
