# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 영역: `spec/7-channel-web-chat/` (6개 문서 전체)

---

## 발견사항

### 요구사항 ID 충돌

- **[INFO]** NAV-WC-01..06 — 양쪽 정의 정합 확인 완료
  - target 신규 식별자: `NAV-WC-01` ~ `NAV-WC-06` (`5-admin-console.md` 참조)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/2-navigation/_product-overview.md` 217~222 행
  - 상세: target 이 정의하는 NAV-WC-01..06 과 `2-navigation/_product-overview.md` 의 동일 ID 가 완전히 일치한다. 충돌이 아니라 단일 진실 원칙에 따른 cross-reference. 의미 차이 없음.
  - 제안: 현행 유지.

---

### 엔티티/타입명 충돌

- **[INFO]** `WebChatAppearanceDto` — 이미 EIA spec 에 공동 참조
  - target 신규 식별자: `WebChatAppearanceDto` (`5-admin-console.md §4·R2`)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` 205행 (`tokenStrategy` 보존 맥락에서 언급)
  - 상세: 두 곳 모두 동일 DTO 를 다른 관점에서 참조하는 것으로 의미 충돌 없음. target 이 소유하고 EIA spec 이 참조하는 단방향 구조.
  - 제안: 현행 유지.

- **[INFO]** `EmbedConfigService` / `EmbedConfigDto` — 이미 data-flow 와 webhook spec 에 정합 기재
  - target 신규 식별자: `EmbedConfigService`, `EmbedConfigDto` (`4-security.md §3`)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/data-flow/14-chat-channel.md` 166행, `/Volumes/project/private/clemvion/spec/5-system/2-api-convention.md` 308행
  - 상세: 두 문서 모두 동일 서비스·DTO 를 참조하며 의미 일치. target 이 소유 정의하고 다른 문서가 참조하는 구조.
  - 제안: 현행 유지.

- **[INFO]** `PublicWebhookThrottleGuard` / `PublicWebhookQuotaService` — webhook·chat-channel spec 에 공동 참조
  - target 신규 식별자: `PublicWebhookThrottleGuard`, `PublicWebhookQuotaService` (`4-security.md §4`)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/12-webhook.md` 70·106·371·372행, `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md` 113행, `/Volumes/project/private/clemvion/spec/data-flow/10-triggers.md` 184행
  - 상세: 기존 webhook·chat-channel spec 에서 이미 정의하고 사용 중인 클래스 명칭을 target 이 "공개 webhook 남용 방어" 맥락에서 동일 의미로 참조. 의미 충돌 없음. 소유 정의는 `12-webhook.md`.
  - 제안: 현행 유지.

---

### API endpoint 충돌

- **[INFO]** `GET /api/hooks/:endpointPath/embed-config` — api-convention 에 이미 carve-out 명시
  - target 신규 식별자: `GET /api/hooks/:endpointPath/embed-config` (`4-security.md §3-①`, `3-auth-session.md §3 step 0`)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/2-api-convention.md` 308행 ("같은 라우터에 위젯 부팅용 공개 읽기 엔드포인트 `GET /api/hooks/{endpoint_path}/embed-config` 가 별도로 존재한다" 명시), `/Volumes/project/private/clemvion/spec/data-flow/14-chat-channel.md` 166행
  - 상세: 동일 엔드포인트가 여러 문서에 기재됐으나 모두 같은 의미이며 target 이 소유 정의, 다른 spec 이 참조하는 구조. 충돌 없음.
  - 제안: 현행 유지.

---

### 이벤트/메시지명 충돌

- **[INFO]** `wc:boot` / `wc:command` / `wc:ready` / `wc:resize` / `wc:event` — namespace 전용 격리, 충돌 없음
  - target 신규 식별자: postMessage 이벤트 `wc:boot`, `wc:command`, `wc:ready`, `wc:resize`, `wc:event` (`2-sdk.md §3`)
  - 기존 사용처: 해당 이름들은 spec/ 전체에서 `7-channel-web-chat/` 외부에 정의 없음. `wc:` prefix 는 target 이 "타 채널·OAuth popup 메시지와 혼용 방지" 용도로 명시 선언한 전용 namespace.
  - 상세: 충돌 없음.
  - 제안: 현행 유지.

---

### 환경변수·설정키 충돌

- **[INFO]** `NEXT_PUBLIC_WIDGET_CDN_BASE` — 기존 codebase 에 이미 동일 의미로 구현됨
  - target 신규 식별자: `NEXT_PUBLIC_WIDGET_CDN_BASE` (`0-architecture.md §4`, `5-admin-console.md §5·R4`)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/web-chat/widget-base.ts` 30·68행, `/Volumes/project/private/clemvion/codebase/frontend/.env.example` 50·53행, `/Volumes/project/private/clemvion/codebase/frontend/README.md` 129행
  - 상세: target spec 이 선언한 env key 가 codebase 에 동일 의미로 이미 구현돼 있음. 의미 충돌 없음.
  - 제안: 현행 유지.

- **[INFO]** `WEB_CHAT_WIDGET_ORIGINS` — 기존 codebase 에 이미 동일 의미로 구현됨
  - target 신규 식별자: `WEB_CHAT_WIDGET_ORIGINS` (`0-architecture.md §4`, `4-security.md §2.1`)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/main.ts` 182행, `/Volumes/project/private/clemvion/codebase/backend/src/common/cors/web-chat-cors.ts` 108행, `/Volumes/project/private/clemvion/codebase/backend/.env.example` 44행
  - 상세: target spec 이 "기존 키(`main.ts`·`web-chat-cors.ts`)" 라고 명시하며 소유권을 `4-security.md §2.1` 로 귀속. 의미 충돌 없음.
  - 제안: 현행 유지.

---

### 파일 경로 충돌

- **[INFO]** `spec/7-channel-web-chat/` 영역 번호 `7-` — 기존 폴더와 중복 없음
  - target 신규 식별자: 영역 폴더 `spec/7-channel-web-chat/` (6문서)
  - 기존 사용처: `spec/` 루트에는 `0-overview.md`, `1-data-model.md`, `2-navigation/`, `3-workflow-editor/`, `4-nodes/`, `5-system/`, `6-brand.md`, `conventions/`, `data-flow/` 만 존재
  - 상세: `7-` prefix 는 기존 어느 폴더/파일과도 겹치지 않음. `0-architecture.md §R3` 에 번호 선택 근거("기존 2~5 다음 자리") 명시.
  - 제안: 현행 유지.

- **[INFO]** `spec/7-channel-web-chat/4-security.md` — `id` 필드가 basename 과 의도적으로 다름, 자기문서화됨
  - target 신규 식별자: 파일 basename `4-security` / 전역 고유 ID `web-chat-security`
  - 기존 사용처: spec 전체에서 `4-security.md` 라는 basename 을 갖는 파일이 `7-channel-web-chat/4-security.md` 하나뿐. 다른 영역에 동명 파일 없음.
  - 상세: target 문서 자체가 `id: web-chat-security  # basename 4-security 와 의도적으로 다름` 이라고 주석으로 명시하고 있음. basename 충돌 없음, ID 충돌 없음.
  - 제안: 현행 유지.

- **[INFO]** `spec/7-channel-web-chat/0-architecture.md` spec frontmatter `id: web-chat-architecture` — 전역 유일성 확인
  - target 신규 식별자: `id: web-chat-architecture`, `id: web-chat-widget-app`, `id: web-chat-sdk`, `id: web-chat-auth-session`, `id: web-chat-security`, `id: web-chat-admin-console`
  - 기존 사용처: spec 전체 ID 목록 (`grep -rn "^id: "`)에서 `web-chat-` prefix 를 가진 ID 는 target 6문서 외에 없음
  - 상세: 모든 target spec ID 가 전역 고유. 충돌 없음.
  - 제안: 현행 유지.

---

### 기타

- **[INFO]** `id: common` 다수 존재 — target 과 무관, 기존 문제
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/4-nodes/1-logic/0-common.md`, `4-nodes/3-ai/0-common.md`, `4-nodes/4-integration/0-common.md`, `4-nodes/5-data/0-common.md`, `4-nodes/2-flow/0-common.md`, `4-nodes/7-trigger/0-common.md` — 모두 `id: common`
  - 상세: target `7-channel-web-chat/` 의 6문서는 이 중복 ID 군에 포함되지 않음. target 도입과 무관한 기존 중복. 참고로만 기재.
  - 제안: target scope 밖; 별도 추적 필요 시 기존 영역 정리 플랜.

---

## 요약

`spec/7-channel-web-chat/` 의 6개 문서(0-architecture, 1-widget-app, 2-sdk, 3-auth-session, 4-security, 5-admin-console)가 도입하는 신규 식별자 전체를 검토한 결과, 실질적 충돌은 발견되지 않았다. 요구사항 ID(`NAV-WC-*`)는 `2-navigation/_product-overview.md` 에 동일 의미로 이미 정의되어 단일 진실 원칙상 정합한 cross-reference 관계다. spec frontmatter ID(`web-chat-*` prefix 6개)는 spec 전체에서 유일하며 기존 어느 ID 와도 겹치지 않는다. 환경변수 `NEXT_PUBLIC_WIDGET_CDN_BASE`·`WEB_CHAT_WIDGET_ORIGINS` 는 target 이 "기존 키" 로 명시하였고 codebase 에도 동일 의미로 이미 구현되어 있어 의미 충돌이 없다. `wc:` namespace postMessage 이벤트는 target 만의 전용 namespace 로 다른 영역에 동명 이벤트가 없다. `GET /api/hooks/:endpointPath/embed-config` 엔드포인트는 `2-api-convention.md` 에 carve-out 으로 이미 명시되어 있어 의미 일치한 참조 관계다. `/web-chat` 라우트, `sidebar.webChat` i18n 키, `webChat.ts` dict 파일 모두 target 이 소유하며 기존 다른 영역과 충돌하지 않는다.

---

## 위험도

NONE
