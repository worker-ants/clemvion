# 신규 식별자 충돌 검토 결과

검토 대상: `spec/7-channel-web-chat/` (0-architecture · 1-widget-app · 2-sdk · 3-auth-session · 4-security · 5-admin-console · _product-overview)
검토 모드: --impl-prep (구현 착수 전)

---

## 발견사항

### 1. 요구사항 ID 충돌

- **[INFO]** NAV-WC-01..06 은 `spec/2-navigation/_product-overview.md` 에 이미 등재 — 정합 확인됨
  - target 신규 식별자: NAV-WC-01 ~ NAV-WC-06 (5-admin-console.md 참조)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/2-navigation/_product-overview.md` 217~222행
  - 상세: target 이 참조하는 방향으로만 사용되며 충돌 아님. 두 곳이 동일 의미로 일치.
  - 제안: 없음.

- **[INFO]** EIA-IN-02, EIA-IN-12, EIA-NF-03, EIA-AU-04 는 EIA spec 에 이미 존재 — 동일 의미로 참조
  - target 신규 식별자: 위 4개 ID (3-auth-session, 1-widget-app 참조)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` 72·82·92·152행
  - 상세: target 은 이들을 새로 부여하지 않고 기존 EIA ID 를 cross-reference 하는 방식이라 충돌 없음.
  - 제안: 없음.

### 2. 엔티티/타입명 충돌

- **[INFO]** `EmbedConfigDto`, `EmbedConfigService`, `PublicWebhookThrottleGuard`, `PublicWebhookQuotaService`, `WebChatAppearanceDto`
  - target 신규 식별자: 위 5개 DTO/서비스명 (4-security.md, 5-admin-console.md)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/12-webhook.md`, `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md`, `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` — `PublicWebhookThrottleGuard`/`PublicWebhookQuotaService` 는 webhook spec 에, `WebChatAppearanceDto` 는 EIA spec §4 에 이미 기재됨.
  - 상세: 이들은 기존 spec 이 이미 명명한 구현체를 target 이 동일 명칭으로 참조하는 것이므로 의미 충돌 없음. 단, target 이 이들을 최초로 도입했다고 오해할 여지가 없음을 확인.
  - 제안: 없음.

- **[INFO]** `ChatInstance`, `BootConfig`, `WidgetEvent`, `Unsubscribe` (2-sdk.md §4·§5)
  - target 신규 식별자: 위 4개 TypeScript 인터페이스/타입명
  - 기존 사용처: 검색 결과 `spec/` 전역에서 동일 명으로 다른 의미로 쓰이는 용례 없음.
  - 상세: 충돌 없음.
  - 제안: 없음.

### 3. API endpoint 충돌

- **[INFO]** `GET /api/hooks/:endpointPath/embed-config` (3-auth-session §3 step 0, 4-security §3-①)
  - target 신규 식별자: 위 엔드포인트
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/data-flow/14-chat-channel.md` 30행 이하 — 동일 엔드포인트가 이미 data-flow spec 에 기재됨.
  - 상세: 의미 일치. target 이 새로 규정하는 것이 아니라 이미 구현된 엔드포인트를 기술하는 방향이므로 충돌 없음.
  - 제안: 없음.

- **[INFO]** 기존 EIA 엔드포인트들 (`POST /api/hooks/:path`, `GET /api/external/executions/:id/stream`, `POST .../interact`, `POST .../refresh-token` 등)
  - target 신규 식별자: 위 엔드포인트들 (0-architecture §3, 3-auth-session §3)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md`
  - 상세: target 은 신규 endpoint 를 추가하지 않고 기존 EIA 표면을 소비 위치에서 매핑한 것이라 충돌 없음.
  - 제안: 없음.

### 4. 이벤트/메시지명 충돌

- **[INFO]** postMessage 이벤트: `wc:boot`, `wc:command`, `wc:ready`, `wc:resize`, `wc:event` (2-sdk §3)
  - target 신규 식별자: 위 5개 메시지 type (모두 `wc:` namespace prefix 적용)
  - 기존 사용처: `spec/` 전역 검색 결과, 위 이름들은 `spec/7-channel-web-chat/` 외부에 등장하지 않음.
  - 상세: `wc:` prefix 로 타 채널·OAuth popup 메시지와 분리가 명시되어 있으므로 충돌 없음.
  - 제안: 없음.

- **[INFO]** SDK 이벤트: `open`, `close`, `message`, `unread`, `conversationStarted`, `conversationEnded` (2-sdk §5 `WidgetEvent`)
  - target 신규 식별자: 위 6개 이벤트명 (`WidgetEvent` union)
  - 기존 사용처: EIA SSE 이벤트명(`execution.waiting_for_input`, `execution.ai_message` 등)과 namespace 가 다름. `spec/` 전역에서 동일 string 을 다른 의미로 정의하는 용례 없음.
  - 상세: 충돌 없음.
  - 제안: 없음.

### 5. 환경변수·설정키 충돌

- **[INFO]** `NEXT_PUBLIC_WIDGET_CDN_BASE` (0-architecture §4, 5-admin-console §5·R4)
  - target 신규 식별자: 위 env 키 (admin 프론트엔드, 선택)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/frontend/.env.example` 50~53행 — 이미 주석 처리된 샘플 항목으로 등재됨. `spec/7-channel-web-chat/` 외부 spec 에는 미등장.
  - 상세: 코드베이스에서 이미 쓰이고 있으며 target 이 이를 공식화하는 방향이므로 충돌 없음.
  - 제안: 없음.

- **[INFO]** `WEB_CHAT_WIDGET_ORIGINS` (0-architecture §4, 4-security §2.1)
  - target 신규 식별자: 위 env 키 (백엔드, 기존)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/.env.example` 44행, `/Volumes/project/private/clemvion/codebase/backend/src/main.ts` 및 `web-chat-cors.ts` — "기존 키" 로 target 이 명시하고 있으며 코드베이스에서 이미 사용 중.
  - 상세: 충돌 없음. target 이 신규 도입이 아니라 기존 키 참조로 명확히 구분하고 있음.
  - 제안: 없음.

### 6. 파일 경로 충돌

- **[INFO]** `spec/7-channel-web-chat/4-security.md` — `id: web-chat-security` 로 타 영역 `4-security` 슬러그와 충돌 회피
  - target 신규 식별자: 파일명 `4-security.md` + frontmatter `id: web-chat-security`
  - 기존 사용처: 다른 spec 영역(예: `spec/5-system/`) 에 `4-security.md` 에 해당하는 파일은 존재하지 않음. `find` 결과 `spec/7-channel-web-chat/4-security.md` 가 유일.
  - 상세: 파일명 `4-security` 는 이 영역 내 컨벤션(숫자 prefix 순서 배치)을 따르며, frontmatter `id` 는 `web-chat-security` 로 의도적으로 전역 유일하게 처리됨(파일 내 주석으로도 명시). 충돌 없음.
  - 제안: 없음.

- **[INFO]** `spec/7-channel-web-chat/` 신규 영역 번호 `7-`
  - target 신규 식별자: top-level 영역 번호 `7`
  - 기존 사용처: `spec/` 디렉토리 목록 상 `6-brand.md` 다음 자리. `spec/7-*` 경로는 `spec/7-channel-web-chat/` 만 존재.
  - 상세: 충돌 없음.
  - 제안: 없음.

---

## 요약

`spec/7-channel-web-chat/` 의 6개 문서가 도입하는 신규 식별자들을 전수 점검한 결과 충돌 없음. 문서 ID (`web-chat-architecture`, `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-security`, `web-chat-admin-console`) 는 모두 `web-chat-` prefix 로 전역 유일하고, 타 영역 기존 `id: common`, `id: execution` 등 비전역 ID 와 이름 공간이 다르다. 환경변수 `NEXT_PUBLIC_WIDGET_CDN_BASE`·`WEB_CHAT_WIDGET_ORIGINS` 는 코드베이스에서 이미 사용 중인 키를 target 이 공식 문서화한 것이며, 다른 ENV 키와 명칭 충돌이 없다. postMessage namespace `wc:*` 은 타 이벤트 채널과 격리되고, SDK 이벤트 타입은 EIA SSE namespace 와 충돌하지 않는다. 신규 API endpoint 는 기존 EIA 표면을 소비 위치에서 매핑한 참조이며 중복 정의가 아니다.

## 위험도

NONE
