# 신규 식별자 충돌 검토 — `spec/7-channel-web-chat/4-security.md`

검토 대상: `spec/7-channel-web-chat/4-security.md` (frontmatter `id: web-chat-security`)

---

## 발견사항

### 1. 요구사항 ID 충돌

target 문서는 독자적인 요구사항 ID(WH-SC-01 등)를 직접 부여하지 않는다. 참조하는 요구사항 ID(`WH-SC-01`, `EIA-NX-07`, `CCH-SE-01` 등)는 모두 각 SoT 문서(12-webhook.md, 14-external-interaction-api.md, 15-chat-channel.md)에서 원래 정의된 것으로, 교차 참조만 하고 있다. 새로 부여하는 독자 ID 없음 → 충돌 없음.

### 2. 엔티티/타입명 충돌

target 이 새로 명시하는 엔티티/서비스 이름들을 기존 사용처와 대조한 결과:

- **`EmbedConfigDto` / `EmbedConfigService`**: target §3 에서 명시. `spec/data-flow/14-chat-channel.md`(line 166)가 이미 `EmbedConfigService.resolve` 로 참조하고, `spec/data-flow/14-chat-channel.md`(line 280)에도 언급됨. 동일 의미(공개 embed-config 조회 서비스)로 일관 사용 → 의미 충돌 없음.

- **`PublicWebhookThrottleGuard` / `PublicWebhookQuotaService`**: target §4 에서 명시. `spec/5-system/12-webhook.md`(lines 70, 106, 314, 315, 371, 372)가 동일 명칭으로 동일 역할(공개 webhook IP 단위 rate-limit)로 이미 사용. `spec/5-system/15-chat-channel.md`(line 113)도 동일 서비스명 참조. 의미 충돌 없음.

- **`web-chat-cors-origin.resolver.ts` / `createWebChatCorsDelegate`**: target §2.1 에서 명시. `spec/5-system/14-external-interaction-api.md`(lines 737–738)가 동일 경로·컴포넌트를 이미 참조. 의미 충돌 없음.

### 3. API endpoint 충돌

- **`GET /api/hooks/:endpointPath/embed-config`**: target §3 에서 정의. `spec/7-channel-web-chat/3-auth-session.md`(line 36)와 `spec/data-flow/14-chat-channel.md`(line 166)가 이미 동일 endpoint를 동일 용도로 참조. `spec/data-flow/0-overview.md`(line 64)에도 `embed-config` 참조. 새로 신설하는 endpoint가 아니라 기존 구현 사실을 서술하는 것으로, 의미 충돌 없음.

### 4. 이벤트/메시지명 충돌

target 문서는 새로운 webhook/queue/SSE 이벤트 이름을 도입하지 않는다. `conversationEnded` 는 기존 SDK 이벤트를 언급하는 것이며 신규 정의가 아님. 충돌 없음.

### 5. 환경변수·설정키 충돌

- **`WEB_CHAT_WIDGET_ORIGINS`**: target §2 및 §2.1 에서 SoT 선언. `spec/7-channel-web-chat/0-architecture.md`(line 91)가 이미 "기존(`main.ts`·`web-chat-cors.ts`)"로 분류하고 참조. `spec/7-channel-web-chat/5-admin-console.md`(lines 189, 265, 268)도 동일 의미로 참조. target 이 SoT 선언을 재확인하는 것이고 별도 재정의가 아님 → 충돌 없음.

- **`NEXT_PUBLIC_WIDGET_CDN_BASE`**: target §1 표 sandbox 행 및 §R5 에서 언급. 이미 `spec/7-channel-web-chat/0-architecture.md`(line 90, 94, 115)와 `spec/7-channel-web-chat/5-admin-console.md`(lines 153, 159, 207, 265)에서 동일 의미로 정의·참조. 의미 충돌 없음.

- **`CORS_ORIGINS` → `FRONTEND_URL`**: target §2.1 에서 기존 내부 라우트의 CORS 정책을 설명하며 언급. `spec/5-system/1-auth.md`(lines 164, 322, 654)에서 `FRONTEND_URL` 을 다른 컨텍스트(WebAuthn, 쿠키 Domain 계산)로 사용하고 있으나, target 은 기존 동작을 서술한 것이며 새로 정의하지 않음. 충돌 없음.

### 6. 파일 경로·spec ID 충돌

- **`id: web-chat-security`**: target frontmatter. 전체 spec 디렉토리에서 이 ID 를 가진 다른 파일이 없음(`grep` 확인). `spec/7-channel-web-chat/` 영역의 다른 파일 ID는 `web-chat-architecture`, `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-admin-console` 으로 모두 고유 prefix 사용. target 의 인라인 주석("타 영역의 `4-security` 슬러그와 충돌 방지")이 이미 의도를 명문화함 → 충돌 없음.

- **파일 경로 `spec/7-channel-web-chat/4-security.md`**: 기존 `7-channel-web-chat/` 폴더 내 번호 부여 파일(`0-architecture`, `1-widget-app`, `2-sdk`, `3-auth-session`, `5-admin-console`)과 일관된 `N-name.md` 명명 컨벤션 준수. 다른 영역의 동명 파일(`4-security`)과 경로가 다르므로 파일 경로 충돌 없음.

---

## 요약

`spec/7-channel-web-chat/4-security.md` 가 도입 또는 명시하는 모든 식별자(spec ID `web-chat-security`, 서비스명 `EmbedConfigService`/`PublicWebhookThrottleGuard`/`PublicWebhookQuotaService`, 환경변수 `WEB_CHAT_WIDGET_ORIGINS`/`NEXT_PUBLIC_WIDGET_CDN_BASE`, endpoint `GET /api/hooks/:endpointPath/embed-config`)는 기존 corpus 에서 동일 의미로 일관 사용 중인 것들이며, target 이 새로 재정의하거나 충돌하는 사례가 없다. 요구사항 ID는 기존 문서 것을 교차 참조만 하며 독자 부여 없음. 파일 경로와 spec ID 모두 기존 컨벤션에 부합하고 전역 유일하다. 식별자 충돌 위험은 발견되지 않았다.

---

## 위험도

NONE
