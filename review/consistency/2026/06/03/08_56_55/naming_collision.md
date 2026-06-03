# 신규 식별자 충돌 검토 결과

검토 대상: `spec/7-channel-web-chat` (구현 착수 전 --impl-prep)
검토 일시: 2026-06-03

---

## 발견사항

### 요구사항 ID 충돌

해당 없음. `spec/7-channel-web-chat` 의 각 문서 frontmatter `id` 값 (`web-chat-architecture`, `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-security`) 은 기존 spec 전체에서 유일하다. 기존 ID 목록 (`dashboard`, `integration`, `ai-agent`, `execution-engine`, `chat-channel` 등)과 겹치는 항목 없음.

### 엔티티/타입명 충돌

- **[INFO]** `conversationEnded` — 로컬 변수와 공개 이벤트 명이 동일
  - target 신규 식별자: `WidgetEvent` 유니언의 `"conversationEnded"` (공개 SDK 이벤트 이름, `spec/7-channel-web-chat/2-sdk.md §5`)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `let conversationEnded = false` (메서드 내 로컬 루프 플래그 변수)
  - 상세: 두 사용처는 범위(scope)가 다르다. 하나는 브라우저 SDK 의 공개 이벤트 이름(문자열 리터럴), 다른 하나는 백엔드 서비스 메서드의 로컬 boolean 변수다. 런타임 충돌은 없고 실제 혼선 가능성도 낮다. 단, 코드베이스 전체 검색("conversationEnded" 검색)에서 두 맥락이 섞여 나타나 초기 독자에게 약간 혼동을 줄 수 있다.
  - 제안: 현행 유지 가능. 필요 시 백엔드 로컬 변수를 `aiConversationLoop` 또는 `loopEnded` 같은 맥락을 명확히 하는 이름으로 정리하는 것을 followup 으로 고려.

- **[INFO]** `BootConfig` · `ChatInstance` · `WidgetEvent` · `Unsubscribe` — 신규 타입명
  - target 신규 식별자: 위 4개 TypeScript 타입명 (`spec/7-channel-web-chat/2-sdk.md §4, §5`)
  - 기존 사용처: `codebase/packages/web-chat-sdk/src/types.ts` — 이미 동일 이름으로 구현되어 있음
  - 상세: spec 과 코드가 정합하고 있으므로 충돌 없음. 오히려 spec→코드 일치 확인.
  - 제안: 해당 없음.

### API endpoint 충돌

- **[INFO]** `GET /api/hooks/:endpointPath/embed-config` — 신규 엔드포인트 (4-security §3-①)
  - target 신규 식별자: `embed-config` endpoint (`spec/7-channel-web-chat/4-security.md §3-①`)
  - 기존 사용처: `codebase/backend/src/modules/hooks/hooks.controller.ts` — `EmbedConfigService` / `EmbedConfigDto` 로 이미 구현됨. `plan/in-progress/channel-web-chat-followups.md §3` 에 "완료(D#3)" 로 기록.
  - 상세: spec 이 기술하는 엔드포인트가 코드에 이미 구현·테스트된 상태이므로 충돌이 아니라 정합. 새로운 이름으로 기존 엔드포인트를 덮어쓰는 문제 없음.
  - 제안: 해당 없음. spec 의 `status: partial` 표시가 아직 코드 사실을 반영 중이며, followup plan 이 tracking 중.

- 위젯이 사용하는 EIA 표면(`POST /api/hooks/:endpointPath`, `GET /api/external/executions/:id/stream`, `POST .../interact`, 등)은 기존 EIA spec(`spec/5-system/14-external-interaction-api.md`) 에 이미 정의된 엔드포인트를 재사용한다. 신규 endpoint 정의 없으므로 충돌 없음.

### 이벤트/메시지명 충돌

- **[INFO]** `wc:` namespace prefix postMessage 메시지 타입
  - target 신규 식별자: `wc:boot`, `wc:command`, `wc:ready`, `wc:resize`, `wc:event` (`spec/7-channel-web-chat/2-sdk.md §3`)
  - 기존 사용처: `codebase/channel-web-chat/src/widget/host-bridge.ts` 및 `codebase/packages/web-chat-sdk/src/types.ts` — 이미 구현됨. `WC_MESSAGE_PREFIX = "wc:"` 상수로 정의.
  - 상세: spec 과 코드가 정합. 기존 타 시스템(WebSocket 게이트웨이, Chat Channel) 에서 `wc:` prefix 를 사용하는 곳은 발견되지 않았다.
  - 제안: 해당 없음.

- **[INFO]** `WidgetEvent` 유니언(`open`, `close`, `message`, `unread`, `conversationStarted`, `conversationEnded`)
  - target 신규 식별자: 위 6개 이벤트 문자열 (SDK 공개 이벤트 이름, `spec/7-channel-web-chat/2-sdk.md §5`)
  - 기존 사용처: 기존 WebSocket 게이트웨이(`websocket.gateway.ts`)의 소켓 이벤트, Chat Channel 어댑터 이벤트, SSE 이벤트(`execution.ai_message`, `execution.waiting_for_input` 등)와 이름 충돌 없음. 단, `message` 는 일반적 단어이나 postMessage / SDK 맥락이라 혼동 범위가 좁음.
  - 제안: 해당 없음.

### 환경변수·설정키 충돌

- **[WARNING]** `WEB_CHAT_WIDGET_ORIGINS` — spec 에 문서화 없이 코드에만 존재
  - target 신규 식별자: spec `7-channel-web-chat/0-architecture.md §4` 의 `<widget-cdn-base>` 플레이스홀더가 런타임 env 로 주입된다고 기술
  - 기존 사용처: `codebase/backend/src/common/cors/web-chat-cors.ts` 에 `WEB_CHAT_WIDGET_ORIGINS` (콤마 구분) 를 파싱하는 `parseWidgetOrigins()` 와 `main.ts` 에서 `process.env.WEB_CHAT_WIDGET_ORIGINS` 를 참조하고 있음. 그러나 `codebase/backend/.env.example` 에 해당 환경변수 항목이 없으며, `spec/7-channel-web-chat` 어느 문서에도 `WEB_CHAT_WIDGET_ORIGINS` 라는 환경변수명이 명시되지 않음.
  - 상세: `spec/7-channel-web-chat/0-architecture.md §4` 는 `<widget-cdn-base>` 를 "빌드타임 env 주입 또는 런타임 조회" 로 설명하지만 실제 env 키 이름을 spec 이 확정하지 않는다. 코드는 `WEB_CHAT_WIDGET_ORIGINS` 를 이미 사용하고 있는데, 구현자가 이 이름을 독자적으로 결정한 상태다. `.env.example` 누락이라 운영 세팅 시 혼선 가능.
  - 제안: `spec/7-channel-web-chat/0-architecture.md §4` 에 실제 env 키 이름 `WEB_CHAT_WIDGET_ORIGINS` 를 명시하고, `codebase/backend/.env.example` 에 예시를 추가하는 것을 followup으로 권장. spec 과 코드 간 이름은 일치하고 있으므로 충돌은 아니지만 문서화 갭.

- **[INFO]** 기존 `CORS_ORIGINS`, `FRONTEND_URL` 환경변수와의 관계
  - target 신규 식별자: `WEB_CHAT_WIDGET_ORIGINS` (위 참조)
  - 기존 사용처: `CORS_ORIGINS`, `FRONTEND_URL` 은 `cors-origins.ts` 에서 전역 CORS allowlist 로 사용됨
  - 상세: 세 변수는 역할이 명확히 다르다. `CORS_ORIGINS`/`FRONTEND_URL` = frontend/internal, `WEB_CHAT_WIDGET_ORIGINS` = 위젯 CDN 빌트인 origin. 기존 `web-chat-cors.ts` 가 별도 delegate 로 분리되어 있어 충돌 없음.
  - 제안: 해당 없음.

- `interactionAllowedOrigins` (Workspace.settings 키)
  - target 신규 식별자: `spec/7-channel-web-chat/4-security.md §2·§3` 에서 이 키를 CORS 와 임베드 allowlist 의 통합 단일 키로 사용
  - 기존 사용처: `spec/1-data-model.md §2.2 Workspace.settings` 에 이미 `interactionAllowedOrigins: string[]?` 로 정의되어 있으며 코드(`web-chat-cors-origin.resolver.ts`, `embed-config.service.ts`)에도 구현됨
  - 상세: 기존 정의와 target 의 사용이 일치함. 단일 진실 원칙 준수. 충돌 없음.

### 파일 경로 충돌

- **[INFO]** `spec/7-channel-web-chat/` 영역 폴더 — 번호 7
  - target 신규 식별자: `spec/7-channel-web-chat/` 폴더 (`spec/0-overview.md §R6`)
  - 기존 사용처: 기존 `spec/` 루트 번호 사용: `0-overview.md`(0), `1-data-model.md`(1), `2-navigation/`(2), `3-workflow-editor/`(3), `4-nodes/`(4), `5-system/`(5), `6-brand.md`(6). 7번은 기존에 없음.
  - 상세: 번호 7 은 사용 가능하며 충돌 없음. spec/0-architecture.md §R6 의 "번호 7 은 기존 2~5 다음 자리" 설명은 부정확하나(6-brand 도 존재), 7 이 미사용이라는 사실은 맞다. 파일 자체도 실제 존재하고 구현됨.
  - 제안: 해당 없음.

- `codebase/channel-web-chat/` 및 `codebase/packages/web-chat-sdk/` 경로
  - 기존 `codebase/packages/sdk/`(`@workflow/sdk`) 와 `codebase/packages/web-chat-sdk/`(`@workflow/web-chat`) 가 공존. 이름이 유사하지만 npm 패키지 이름은 다르고(`@workflow/sdk` vs `@workflow/web-chat`) 코드 역할도 다름(EIA 클라이언트 vs 위젯 loader+SDK).
  - 충돌 없음.

- `codebase/backend/src/common/cors/web-chat-cors.ts` 파일
  - 기존: `codebase/backend/src/common/utils/cors-origins.ts`
  - 두 파일 모두 존재하며 역할이 다름(전역 CORS vs 위젯 전용 CORS delegate). 충돌 없음.

---

## 요약

`spec/7-channel-web-chat` 가 도입하는 주요 식별자(문서 ID 5개, TypeScript 타입명, postMessage namespace `wc:`, SDK 이벤트명, npm 패키지명 `@workflow/web-chat`, Workspace.settings 키 `interactionAllowedOrigins`)는 기존 사용처와 충돌하지 않는다. 구현이 이미 상당 부분 진행되어 있어 spec 과 코드가 전반적으로 정합하고 있으며, 이름 중복 문제는 발견되지 않았다. 단 하나의 주목할 갭은 백엔드에서 실제 사용 중인 환경변수명 `WEB_CHAT_WIDGET_ORIGINS` 가 spec 본문과 `.env.example` 에 명시되어 있지 않다는 점이며, 이는 운영 문서화 누락으로 WARNING 수준이다.

## 위험도

LOW
