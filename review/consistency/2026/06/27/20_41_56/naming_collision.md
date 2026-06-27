# 신규 식별자 충돌 검토 결과

검토 대상: `spec/7-channel-web-chat/4-security.md`

---

## 발견사항

충돌 또는 혼동을 일으키는 식별자는 발견되지 않았다. 항목별 확인 결과는 아래와 같다.

### [INFO] spec ID `web-chat-security` — 고유, 충돌 없음
- target 신규 식별자: `id: web-chat-security` (frontmatter)
- 기존 사용처: `spec/7-channel-web-chat/` 내 다른 파일의 ID 목록 (`web-chat-architecture`, `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-admin-console`) 과 중복되지 않음
- 상세: `4-security.md` 파일 자체 외에 이 ID 를 사용하는 다른 spec 파일 없음. 패턴도 영역 prefix `web-chat-*` 를 일관되게 따름
- 제안: 없음

### [INFO] `EmbedConfigDto { allowlist, enforce }` / `EmbedConfigService` — 이미 확립된 식별자, 충돌 없음
- target 신규 식별자: target §3-① 에서 정의·참조
- 기존 사용처:
  - `spec/7-channel-web-chat/3-auth-session.md:40` — `GET /api/hooks/:path/embed-config → { allowlist, enforce }` 로 이미 참조
  - `spec/data-flow/14-chat-channel.md:166` — `EmbedConfigService.resolve` 호출 흐름 기술
  - `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` — `allowlist: string[]`, `enforce: boolean` 구현됨
- 상세: target 이 이 식별자를 새로 발명하는 것이 아니라 기존 구현/인접 spec 에 이미 확립된 식별자를 문서화하는 것. 의미가 완전히 일치.
- 제안: 없음

### [INFO] `GET /api/hooks/:endpointPath/embed-config` 엔드포인트 — 충돌 없음
- target 신규 식별자: §3-① 에서 정의
- 기존 사용처:
  - `spec/5-system/12-webhook.md:407` — 동일 `/api/hooks/` 경로를 다루지만, webhook 실행 엔드포인트는 `POST /api/hooks/:endpointPath` (베이스 경로, "POST 전용") 이고, embed-config 는 `GET /api/hooks/:endpointPath/embed-config` (서브경로) 로 경로가 다름
  - `spec/7-channel-web-chat/3-auth-session.md`, `spec/data-flow/14-chat-channel.md`, `spec/7-channel-web-chat/5-admin-console.md` — 모두 같은 경로/의미로 일관되게 참조 중
  - `codebase/backend/src/modules/hooks/hooks.controller.ts:48` — `@Get(':endpointPath/embed-config')` 로 구현 확인됨
- 상세: 12-webhook spec 의 "POST 전용" 선언은 트리거 실행 베이스 경로(`/api/hooks/:endpointPath`)에 국한된 것이고, 서브경로(`/embed-config`)와 분리되어 의미 충돌 없음.
- 제안: 없음 (webhook spec 의 "POST 전용" 주석이 베이스 경로를 가리킨다는 점을 명확히 읽으면 혼동 없음)

### [INFO] ENV var `WEB_CHAT_WIDGET_ORIGINS` — 이미 확립된 키, 충돌 없음
- target 신규 식별자: §2, §2.1 에서 참조 (SoT 로 `0-architecture.md §4` 를 지정)
- 기존 사용처:
  - `spec/7-channel-web-chat/0-architecture.md:95` — 기존 env 키로 이미 정의됨
  - `codebase/backend/.env.example:44`, `codebase/backend/src/main.ts:182`, `codebase/backend/src/common/cors/web-chat-cors.ts:108` — 구현됨
  - `plan/complete/` 다수 완료 플랜에서 "기존 env" 로 명시
- 상세: target 이 이 키를 신설하는 것이 아님. 기존에 확립된 키를 4-security.md 에서 사용 방식과 함께 재설명하는 것. 다른 의미로 쓰이는 곳 없음.
- 제안: 없음

### [INFO] `interactionAllowedOrigins` config key — 이미 확립된 키, 충돌 없음
- target 신규 식별자: §2, §3, `## 1` 표 등 다수 참조
- 기존 사용처:
  - `spec/1-data-model.md §2.2 Workspace.settings` — SoT 로 정의됨
  - `spec/2-navigation/9-user-profile.md:235,239,336` — 편집 표면 정의
  - `spec/5-system/14-external-interaction-api.md:733`, `spec/data-flow/14-chat-channel.md:166,171,252`, `spec/data-flow/12-workspace.md:142,148` 등 — 일관 참조
- 상세: target 이 "CORS allowlist 와 임베드 allowlist 가 동일 키를 공유" 함을 명시하는 것은 data-model SoT 와 일치. 어디서도 다른 의미로 사용되지 않음.
- 제안: 없음

### [INFO] 위젯 상태 `blocked` — SoT 귀속 명확, 충돌 없음
- target 신규 식별자: §3-① 에서 보안 정책 trigger 로 사용
- 기존 사용처: `spec/7-channel-web-chat/1-widget-app.md §3.2` — 상태 정의 SoT
- 상세: target 본문에서 "**상태 정의 SoT = [1-widget-app §3.2]**; 본 §3-① 은 그 상태를 발동하는 정책 trigger" 로 명확하게 귀속을 분리. 충돌 없음.
- 제안: 없음

### [INFO] `PublicWebhookThrottleGuard` / `PublicWebhookQuotaService` — 이미 확립된 식별자, 충돌 없음
- target 신규 식별자: §4 남용 방어 섹션에서 참조
- 기존 사용처: `spec/5-system/12-webhook.md:70,106,320,371,372` — 이미 SoT 로 문서화됨
- 상세: target §4 가 12-webhook §6 을 SoT 로 참조하고("SoT: [Spec 웹채팅 보안 §4]" 역참조 관계) 상호 일관됨. 의미 충돌 없음.
- 제안: 없음

### [INFO] 파일 경로 `spec/7-channel-web-chat/4-security.md` — 충돌 없음
- target 신규 식별자: 파일 경로 자체
- 기존 사용처: 영역 내 `N-name.md` 컨벤션 (`0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `5-admin-console.md`) 에 정합. 해당 경로에 기존 다른 파일 없음.
- 상세: 명명·번호 체계 모두 컨벤션 준수.
- 제안: 없음

---

## 요약

`spec/7-channel-web-chat/4-security.md` 가 도입하거나 참조하는 모든 식별자(spec ID `web-chat-security`, `EmbedConfigDto`, `EmbedConfigService`, `GET /api/hooks/:endpointPath/embed-config`, `WEB_CHAT_WIDGET_ORIGINS`, `interactionAllowedOrigins`, `blocked`, `PublicWebhookThrottleGuard`, `PublicWebhookQuotaService`)는 기존 spec 및 코드베이스에서 동일한 의미로 이미 확립된 것이거나 target 이 최초로 집대성하는 문서임이 확인됐다. 다른 의미로 쓰이는 동명 식별자, 경로 중복, 엔티티명 혼동은 발견되지 않았다.

---

## 위험도

NONE
