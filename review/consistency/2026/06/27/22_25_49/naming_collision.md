# 신규 식별자 충돌 검토 결과

검토 대상: `spec/7-channel-web-chat/` (6개 문서) + 구현 diff (`codebase/channel-web-chat/`, `codebase/frontend/`, `codebase/backend/`)
검토 모드: --impl-done, diff-base=origin/main

---

## 발견사항

### [INFO] spec 문서 ID `id: common` 다중 존재 — 영역 간 비전역 충돌

- target 신규 식별자: 없음 (target 자체는 `web-chat-*` 접두 사용)
- 기존 사용처: `spec/4-nodes/1-logic/0-common.md`, `spec/4-nodes/2-flow/0-common.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/4-nodes/5-data/0-common.md`, `spec/4-nodes/7-trigger/0-common.md` — 모두 `id: common`
- 상세: `7-channel-web-chat/` 영역은 `web-chat-architecture`, `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-security`, `web-chat-admin-console` 으로 영역 prefix 를 잘 붙이고 있다. `id: common` 중복은 `7-channel-web-chat` 가 새로 만든 문제가 아니며 기존 `4-nodes/` 하위에서 이미 반복되고 있는 사전 기존 패턴이다. target 이 이 패턴을 따르지 않은 것은 전혀 없다. 충돌 관점에서 target 에 귀책 없음.
- 제안: 해당 없음 (기존 영역 문제, target 미도입).

---

### [INFO] `id: web-chat-security` — basename `4-security` 와 의도적으로 다름

- target 신규 식별자: `id: web-chat-security` (`spec/7-channel-web-chat/4-security.md`)
- 기존 사용처: 타 영역에 `4-security.md` 파일 없음 (`find` 결과 zero). `id: security` 도 별도 존재하지 않음.
- 상세: 문서 자체가 인라인 주석으로 "타 영역의 `4-security` 슬러그와 충돌 방지 위해 `web-chat-` prefix 사용"을 명문화하고 있다. 전역 spec ID 목록 검색 결과 실제 충돌하는 `id: security` / `id: 4-security` 없음. 선제 조치가 필요한 충돌이 아니라 예방적 prefix 사용.
- 제안: 현재 충돌 없음. 유지 적절.

---

### [INFO] `NEXT_PUBLIC_WIDGET_CDN_BASE` — 신규 env 키, 기존 `NEXT_PUBLIC_*` 와 네이밍 일관

- target 신규 식별자: `NEXT_PUBLIC_WIDGET_CDN_BASE` (admin 프론트엔드, 선택)
- 기존 사용처: `codebase/frontend/.env.example:53` 에 이미 주석으로 등재됨. `spec/5-system/12-webhook.md`, `spec/2-navigation/2-trigger-list.md` 에서 `NEXT_PUBLIC_WEBHOOK_BASE_URL` / `NEXT_PUBLIC_API_URL` 이 다른 의미로 이미 존재.
- 상세: 기존 `NEXT_PUBLIC_API_URL`(API origin), `NEXT_PUBLIC_WEBHOOK_BASE_URL`(webhook base)와 이름이 다르며 용도(위젯 CDN base)가 명확히 구분된다. `.env.example` 에 이미 반영돼 있어 미확인 신규 충돌 없음.
- 제안: 이상 없음.

---

### [INFO] `WEB_CHAT_WIDGET_ORIGINS` — 기존 백엔드 env 키, target 이 "기존" 명시

- target 신규 식별자: `WEB_CHAT_WIDGET_ORIGINS` (백엔드, target 이 "기존" 으로 분류)
- 기존 사용처: `codebase/backend/.env.example:44`, `codebase/backend/src/main.ts`, `codebase/backend/src/common/cors/web-chat-cors.ts` — 이미 구현됨.
- 상세: target spec 이 "기존(`main.ts`·`web-chat-cors.ts`)"으로 명시하고 있어 target 이 새로 도입하는 식별자가 아니다. 충돌 없음.
- 제안: 이상 없음.

---

### [INFO] `isTextInputSurface` 함수 — widget-state 내부 신규, 외부 영역 충돌 없음

- target 신규 식별자: `isTextInputSurface` (`codebase/channel-web-chat/src/lib/widget-state.ts`)
- 기존 사용처: `grep` 결과 `codebase/frontend/src`, `codebase/backend/src` 에 동명 함수 없음. `channel-web-chat` 내부 신규.
- 상세: `widget-state.ts` 에서 `PendingInteraction | null → boolean` 을 반환하는 순수 함수로, 범위가 `channel-web-chat` 패키지 내에 격리된다. `@workflow/web-chat` npm 패키지로 export 되더라도 `isTextInputSurface` 는 내부 상태 헬퍼라 공개 API 목록(`ChatInstance` 인터페이스)에 포함되지 않아 외부 충돌 무관.
- 제안: 이상 없음.

---

### [INFO] `["web-chat-instances"]` React Query 캐시 키 — 외부 충돌 없음

- target 신규 식별자: `WEB_CHAT_INSTANCES_KEY = ["web-chat-instances"]` (`codebase/frontend/src/components/web-chat/use-web-chat.ts:42`)
- 기존 사용처: `["triggers"]` 등 기존 캐시 키와 구분. `grep` 결과 `web-chat-instances` 가 동일 의미로 다른 곳에 중복 정의된 사례 없음.
- 상세: React Query 캐시 키는 애플리케이션 레벨 식별자로 전역 고유성이 요구된다. `web-chat-instances` 는 기존 `triggers`, `schedules`, `integrations` 등과 접두가 겹치지 않는다.
- 제안: 이상 없음.

---

### [INFO] `sidebar.webChat` i18n 키 + `webChat` dict 네임스페이스 — 기존 없음

- target 신규 식별자: `sidebar.webChat` (sidebar i18n 키), `webChat` dict 네임스페이스 (`lib/i18n/dict/{ko,en}/webChat.ts`)
- 기존 사용처: `codebase/frontend/src/lib/i18n/dict/ko/sidebar.ts:6` 에 `webChat: "웹채팅"`, `dict/en/sidebar.ts:8` 에 `webChat: "Web Chat"` 으로 이미 추가됨. `dict/ko/webChat.ts`, `dict/en/webChat.ts` 신규 파일 존재.
- 상세: 기존 `sidebar.ts` 의 다른 키(`workflows`, `triggers`, `schedule`, `integrations`, `knowledgeBase` 등)와 충돌 없음. `webChat` dict 네임스페이스는 신규이며 기존 네임스페이스(`editor`, `integrations`, `history` 등)과 겹치지 않음.
- 제안: 이상 없음.

---

### [INFO] `NAV-WC-01..06` 요구사항 ID — 기존 NAV-WC 없음, 적절히 신설

- target 신규 식별자: `NAV-WC-01` ~ `NAV-WC-06` (`spec/2-navigation/_product-overview.md`)
- 기존 사용처: 같은 파일에 `NAV-WF-*`(workflow), `NAV-TR-*`(trigger), `NAV-SC-*`(schedule), `NAV-IN-*`(integration) 등이 존재. `NAV-WC-*` 는 없었다가 target 이 추가.
- 상세: `WC` 접두는 `WF`(workflow)/`TR`(trigger)/`SC`(schedule)/`IN`(integration) 과 겹치지 않는다. 새 prefix 체계가 일관성이 있으며 실제 중복 정의 없음.
- 제안: 이상 없음.

---

### [INFO] `GET /api/hooks/:endpointPath/embed-config` 신규 sub-path — 기존 정의 없음

- target 신규 식별자: `GET /api/hooks/:endpointPath/embed-config`
- 기존 사용처: `spec/5-system/12-webhook.md` 에 `POST /api/hooks/:endpointPath` (webhook 시작), `GET /api/external/*` (EIA 표면) 정의. `/embed-config` sub-path 는 없었음.
- 상세: `/api/hooks/:endpointPath` 의 sub-path(`/embed-config`)를 신설하는 것으로, 기존 webhook trigger 엔드포인트(`POST /api/hooks/:endpointPath`)와 method+path 가 다르다. `data-flow/14-chat-channel.md` 와 `data-flow/10-triggers.md` 에서 이미 참조 정합 확인됨.
- 제안: 이상 없음.

---

### [INFO] `wc:*` postMessage 네임스페이스 — 기존 타 채널 이벤트와 구분

- target 신규 식별자: `wc:boot`, `wc:command`, `wc:ready`, `wc:resize`, `wc:event` (host↔iframe postMessage 프로토콜)
- 기존 사용처: `spec/` 전체 및 `codebase/` 에서 `wc:` prefix 를 다른 의미로 쓴 사례 없음 (OAuth popup 메시지 등 별도). spec 2-sdk 가 "타 채널·OAuth popup 메시지와 혼용 방지" 목적으로 명문화.
- 상세: OAuth popup 이나 다른 채널(텔레그램/슬랙 어댑터)이 `postMessage` 를 쓰더라도 `wc:` namespace 와 겹치지 않음. 정확한 검색 결과 기존 `wc:` 이벤트 없음.
- 제안: 이상 없음.

---

### [INFO] `@workflow/web-chat` npm 패키지명 — 기존 `@workflow/sdk` 와 scope 일관

- target 신규 식별자: `@workflow/web-chat` (npm package)
- 기존 사용처: `@workflow/sdk` 가 기존에 존재. `plan/complete/eia-sdk-publish.md §결정 #3` 에서 `@workflow/*` scope 로 통일 확정됨.
- 상세: 패키지명 `web-chat` 은 `sdk` 와 다른 하위 scope 이며 중복 없음. npm scope 규칙 및 기존 결정과 정합.
- 제안: 이상 없음.

---

### [INFO] `spec/7-channel-web-chat/` 영역 파일 경로 — 기존 컨벤션 준수

- target 신규 식별자: `spec/7-channel-web-chat/` (영역 폴더), 내부 파일 `0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `4-security.md`, `5-admin-console.md`, `_product-overview.md`
- 기존 사용처: `spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/4-nodes/`, `spec/5-system/` 등이 동일 명명 컨벤션 사용.
- 상세: `7-` 번호 prefix 는 기존 `2-`~`5-` 다음 자리. 파일명 패턴(`N-name.md`, `_product-overview.md`)이 기존 영역과 동일. 번호 `6-`(`spec/6-brand.md` 루트 레벨 문서)은 영역 폴더가 아니라 루트 파일이므로 `7-channel-web-chat/` 와 충돌 없음. `spec/0-overview.md §8 문서 맵` 에도 `spec/7-channel-web-chat/` 로 등록됨.
- 제안: 이상 없음.

---

## 요약

`spec/7-channel-web-chat/` 영역이 도입하는 모든 신규 식별자(spec 문서 ID, 요구사항 ID `NAV-WC-*`, env 키 `NEXT_PUBLIC_WIDGET_CDN_BASE`, postMessage 이벤트 `wc:*`, npm 패키지명 `@workflow/web-chat`, React Query 캐시 키 `["web-chat-instances"]`, i18n 키 `sidebar.webChat`/`webChat` 네임스페이스, API endpoint `GET /api/hooks/:endpointPath/embed-config`, 코드 내 `isTextInputSurface` 함수)는 기존 영역의 다른 의미와 충돌하지 않는다. spec 문서 ID 는 `web-chat-` 접두를 일관되게 사용해 전역 유일성을 확보했으며, `4-security.md` 의 `id: web-chat-security` 는 타 영역의 동명 basename 과의 잠재 충돌을 문서 내 주석으로 사전 명시하고 있다. 환경변수 두 키(`NEXT_PUBLIC_WIDGET_CDN_BASE`, `WEB_CHAT_WIDGET_ORIGINS`)는 `.env.example` 에 이미 반영되어 미탐 충돌 없음. 전체 범위에서 CRITICAL 또는 WARNING 수준의 식별자 충돌은 발견되지 않았다.

## 위험도

NONE
