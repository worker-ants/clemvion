# 신규 식별자 충돌 검토 결과

검토 범위: `spec/7-channel-web-chat/` (구현 완료 후 검토, diff-base=origin/main)

---

## 발견사항

### 1. 엔티티/타입명 충돌

- **[WARNING]** `WebChatAppearance` vs `WebChatAppearanceConfig` vs `WebChatAppearanceDto` — 세 이름이 혼재

  - target 신규 식별자:
    - `WebChatAppearanceDto` — 백엔드 `/codebase/backend/src/modules/triggers/dto/web-chat-appearance.dto.ts`
    - `WebChatAppearanceConfig` — 프론트엔드 `/codebase/frontend/src/lib/types/trigger.ts:18`
  - 기존 사용처:
    - `WebChatAppearance` — `/codebase/frontend/src/lib/web-chat/snippet.ts:9` (이미 존재, 스니펫 boot config 의 `appearance` 객체 타입)
  - 상세: 세 타입이 모두 웹채팅 위젯 외형 설정을 표현하지만 이름이 3종으로 분산되어 있다. `WebChatAppearance`(snippet.ts)는 `{ primaryColor, position, zIndex }`만 포함하는 boot-time 타입, `WebChatAppearanceConfig`(trigger.ts)는 서버 저장 shape(`locale`, `headerTitle`, `welcomeText`, `suggestions`, `disclaimer` 추가), `WebChatAppearanceDto`(백엔드 DTO)는 서버 검증 클래스다. 세 타입이 다른 범위를 커버하므로 충돌이 아니나, `WebChatAppearance` vs `WebChatAppearanceConfig` 혼동 가능성이 있다.
  - 제안: 명확화가 필요하다면 `WebChatAppearance` → `WebChatSnippetAppearance` 로 좁은 의미를 명시하거나, JSDoc 주석으로 용도 구분을 명기한다. 현재 두 타입이 서로 다른 파일에 스코프되어 import 시 구분은 가능하므로 긴급 차단 수준은 아니다.

---

### 2. 환경변수 충돌

- **[INFO]** `NEXT_PUBLIC_WIDGET_CDN_BASE` — 신규 env 키, 기존 키와 중복 없음

  - target 신규 식별자: `NEXT_PUBLIC_WIDGET_CDN_BASE` (admin 프론트엔드, 선택)
  - 기존 사용처: `/codebase/frontend/.env.example`, `/codebase/frontend/src/lib/web-chat/widget-base.ts` — 이미 구현 및 문서화됨
  - 상세: 이 키는 이번 diff 에서 신규 도입이 아니라 이미 구현 코드에 반영되어 있다. 기존 `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WEBHOOK_BASE_URL` 과 겹치지 않는다.
  - 제안: 충돌 없음. 현상 유지.

- **[INFO]** `WEB_CHAT_WIDGET_ORIGINS` — 기존 키, spec 에서 신규 언급

  - target 신규 식별자: spec 내 언급 (`0-architecture §4`)
  - 기존 사용처: `/codebase/backend/src/main.ts:182`, `/codebase/backend/src/common/cors/web-chat-cors.ts:108` — 이미 구현됨
  - 상세: 기존 키를 spec 이 참조하는 것이므로 충돌 아님.
  - 제안: 해당 없음.

---

### 3. API Endpoint 충돌

- **[INFO]** `GET /api/triggers?interactionEnabled=true` — 기존 endpoint 에 query param 추가

  - target 신규 식별자: `interactionEnabled` query 파라미터 (`QueryTriggerDto`)
  - 기존 사용처: `GET /api/triggers` 는 기존에 `type`, `status`, `search`, 페이지네이션 파라미터를 수용. `interactionEnabled` 는 동일 endpoint 에 추가된 새 파라미터.
  - 상세: endpoint 자체(`GET /api/triggers`)는 기존이며 충돌 아님. `interactionEnabled` 파라미터명은 신규이고 기존 파라미터(`type`, `status`)와 의미 중복 없음. 구현(`triggers.service.ts`, `query-trigger.dto.ts`)과 spec(`5-admin-console §2`)이 일치한다.
  - 제안: 충돌 없음.

- **[INFO]** `GET /api/hooks/:endpointPath/embed-config` — 이미 구현된 endpoint

  - target 신규 식별자: spec `3-auth-session §3 step 0` 및 `4-security §3-①` 에서 명시
  - 기존 사용처: `/codebase/backend/src/modules/hooks/hooks.controller.ts:48` `@Get(':endpointPath/embed-config')` — 이미 구현됨, 다른 spec 영역(data-flow)에서도 참조됨
  - 상세: 충돌 없음. spec 이 기존 구현을 기술하는 것.
  - 제안: 해당 없음.

---

### 4. 요구사항 ID 충돌

- **[INFO]** `NAV-WC-01..06` — 신규 요구사항 ID 블록

  - target 신규 식별자: `NAV-WC-01`, `NAV-WC-02`, `NAV-WC-03`, `NAV-WC-04`, `NAV-WC-05`, `NAV-WC-06` (`spec/2-navigation/_product-overview.md`)
  - 기존 사용처: 동일 파일에서 정의되며 `spec/7-channel-web-chat/5-admin-console.md` 에서 참조됨. 다른 `NAV-` prefix 그룹과 prefix 구분(예: `NAV-IN-*`, `NAV-TR-*` 등)이 다르다.
  - 상세: `NAV-WC-*` prefix 는 다른 기존 NAV 요구사항 블록과 중복 없음. 충돌 없음.
  - 제안: 해당 없음.

---

### 5. 이벤트/메시지명 충돌

- **[INFO]** `wc:boot`, `wc:command`, `wc:ready`, `wc:resize`, `wc:event` postMessage 타입

  - target 신규 식별자: `wc:` namespace prefix postMessage 프로토콜 (spec `2-sdk §3`)
  - 기존 사용처: SDK 패키지(`/codebase/packages/web-chat-sdk/`) 및 admin console(`/codebase/frontend/src/components/web-chat/live-preview.tsx`) 에서 이미 구현됨
  - 상세: `wc:` prefix 는 "타 채널·OAuth popup 메시지와 혼용 방지" 목적으로 명시적으로 선택됨. 다른 메시지 채널(예: SSE `execution.*`, WebSocket 이벤트)과 namespace 가 다르다. 충돌 없음.
  - 제안: 해당 없음.

---

### 6. 파일 경로 충돌

- **[INFO]** `spec/7-channel-web-chat/` — 번호 `7-` prefix, 기존 영역과 비충돌

  - target 신규 식별자: `spec/7-channel-web-chat/` 폴더 및 하위 6개 파일 (`0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `4-security.md`, `5-admin-console.md`)
  - 기존 사용처: `spec/5-system/`, `spec/6-brand.md` 등 기존 영역과 번호 충돌 없음. `7-` 은 결정 근거(R6)에 따라 선택된 번호.
  - 상세: 충돌 없음.

- **[INFO]** `codebase/backend/src/modules/triggers/dto/web-chat-appearance.dto.ts` — 신규 파일

  - 기존 dto 파일들(`interaction-config.dto.ts`, `query-trigger.dto.ts`, `create-trigger.dto.ts` 등)과 명명 패턴 일치. 중복 파일 없음.
  - 제안: 해당 없음.

---

## 요약

`spec/7-channel-web-chat/` 영역이 도입하는 신규 식별자들은 전반적으로 기존 사용처와 충돌이 없다. 요구사항 ID(`NAV-WC-*`), spec ID(`web-chat-*`), API endpoint(`interactionEnabled` 파라미터 추가), postMessage 이벤트명(`wc:` namespace), 환경변수(`NEXT_PUBLIC_WIDGET_CDN_BASE`, `WEB_CHAT_WIDGET_ORIGINS`), 파일 경로 모두 기존 식별자와 중복 없이 분리된다. 한 가지 주목할 점은 "외형 설정"을 표현하는 타입이 세 이름(`WebChatAppearance`, `WebChatAppearanceConfig`, `WebChatAppearanceDto`)으로 분산되어 있다는 것이다. 이는 각각 boot-time snippet 타입 / 서버 저장 config 타입 / 서버 검증 DTO 라는 서로 다른 관심사를 표현하므로 의미 충돌은 아니지만, 혼동 가능성이 있어 명명 명확화(WARNING)를 권장한다.

## 위험도

LOW
