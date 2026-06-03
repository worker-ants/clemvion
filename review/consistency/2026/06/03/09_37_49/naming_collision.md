# 신규 식별자 충돌 검토 — spec-draft-channel-web-chat-gaps

## 발견사항

### 1. 요구사항 ID 충돌

특이사항 없음. target 이 새로 부여하는 요구사항 ID(EIA-NF-03, EIA-AU-04, EIA-IN-02)는 모두 기존 `spec/5-system/14-external-interaction-api.md` 에 이미 정의된 EIA 측 ID 를 cross-ref 하는 것이며, 새 ID 를 발급하지 않는다.

### 2. 엔티티/타입명 충돌

- **[INFO]** `visible`/`hidden` 상태 enum 명 — 위젯 SPA 신규 도입
  - target 신규 식별자: `visible`(기본) / `hidden` — `1-widget-app §2/§3` 의 런처 가시성 축
  - 기존 사용처: `spec/7-channel-web-chat/2-sdk.md` §R4 및 §3 `wc:command` 에 `show`/`hide` 는 이미 정의됐으나, 대응하는 **SPA 내부 상태 enum 값** (`visible`/`hidden`)은 기존 spec 어디에도 명시되지 않았다
  - 상세: `spec/1-data-model.md §2.9.1` 의 Integration.status enum(`connected`/`expired`/`error`/`pending_install`), Workspace.settings 키 등 기존 `visible`/`hidden` 사용처는 없다. 단, `spec/0-overview.md §3.4 UI 패턴`에서 "active/inactive" 와 같은 가시성 개념이 Badge 컴포넌트에 사용되지만 직접 충돌하지 않는다(다른 레이어).
  - 제안: 충돌 없음. 단 SPA 내부 상태 값을 spec 본문에서 일관되게 `visible`/`hidden` 으로 표기하면 된다.

- **[INFO]** `blocked` 상태 — target 에서 `4-security §3-①` cross-ref 로 언급
  - target 신규 식별자: `blocked` (임베드 불허 정책 거부 상태, `4-a` 절에서 `hidden` 과 구분)
  - 기존 사용처: `4-security.md` 본문에는 "렌더 거부 + 시작 차단" 동작이 있지만 `blocked` 라는 상태 enum 값은 명시되지 않았다
  - 상세: `spec/1-data-model.md` 의 다른 도메인에서 `blocked` 라는 상태 enum 은 미존재. 의미 충돌 없음.
  - 제안: 정보 보완 수준. `1-widget-app` 본문에 `blocked` 상태를 enum 항목으로 명시할 때 `4-security §3-①` 와 정의가 1:1 임을 inline 언급하면 충분.

### 3. API endpoint 충돌

특이사항 없음. target 이 참조하는 API 표면(`POST /api/hooks/:path`, `GET /api/external/executions/:id`, `POST .../refresh-token`, `POST .../interact`)은 모두 기존 EIA spec 에 정의된 것이며, 신규 endpoint 를 도입하지 않는다.

### 4. 이벤트/메시지명 충돌

특이사항 없음. target 이 언급하는 SSE 이벤트(`ai_message`, `waiting_for_input`, `completed`)와 postMessage 명령(`show`/`hide`/`updateProfile`, `wc:command`)은 모두 기존 `spec/7-channel-web-chat/2-sdk.md` 및 EIA spec 에 이미 정의된 식별자를 재확인하는 것이다.

### 5. 환경변수·설정키 충돌

- **[INFO]** `WEB_CHAT_WIDGET_ORIGINS` — W5 에서 `0-architecture.md §4` 에 명시 + `.env.example` 추가 제안
  - target 신규 식별자: `WEB_CHAT_WIDGET_ORIGINS` (콤마 구분 빌트인 CDN origin 목록, `parseWidgetOrigins` 함수 경유)
  - 기존 사용처: 코드에는 이미 구현돼 있다 (`codebase/backend/src/main.ts:152`, `codebase/backend/src/common/cors/web-chat-cors.ts:108`). `.env.example` 에는 아직 미등재.
  - 상세: 코드 구현과 spec/env.example 사이의 동기화 갭이며 충돌이 아니다. target 이 제안하는 추가는 기존 코드 실체를 문서화하는 것.
  - 기존 `.env.example` 의 `CORS_ORIGINS` 주석 줄(line 25)과 개념이 다르다 — `CORS_ORIGINS`는 내부 frontend CORS, `WEB_CHAT_WIDGET_ORIGINS`는 위젯 CDN 빌트인 origin 전용. 명칭 충돌 없음.
  - 제안: 없음. target 의 `.env.example` 추가가 올바른 방향이다.

- **[INFO]** `INCLUDE_PREFIXES` — W3 에서 `spec-frontmatter-parse.ts` 의 배열에 `"spec/7-channel-web-chat/"` 추가 제안
  - target 신규 식별자: `"spec/7-channel-web-chat/"` prefix 항목
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:47-53` 의 `INCLUDE_PREFIXES` 배열에 현재 `spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/4-nodes/`, `spec/5-system/`, `spec/conventions/` 5개 항목만 있다. `spec/7-channel-web-chat/` 미포함.
  - 상세: 추가이지 충돌이 아니다. `spec/7-*` 파일들은 이미 frontmatter id/status 를 보유하고 있으므로(`web-chat-architecture`, `web-chat-widget-app`, `web-chat-auth-session`, `web-chat-security`) 가드 편입 적격.
  - 제안: 없음.

### 6. 파일 경로 충돌

특이사항 없음. target 이 수정하는 대상 파일(`spec/7-channel-web-chat/1-widget-app.md`, `spec/7-channel-web-chat/3-auth-session.md`, `spec/7-channel-web-chat/4-security.md`, `spec/7-channel-web-chat/0-architecture.md`, `spec/conventions/spec-impl-evidence.md`)은 모두 이미 존재하는 파일이며, 신규 파일을 생성하지 않는다. 컨벤션 문서 명명 패턴(`N-name.md`, `0-architecture.md` 등) 준수.

---

## 요약

target 이 도입하는 신규 식별자는 수가 적고 성격도 "기존에 암묵적으로 존재하던 것을 명시화" 하는 것(W5 env var, W3 prefix, show/hide 핸들러의 SPA 내부 상태 enum)에 해당한다. 다른 의미로 이미 점유된 동일 식별자는 발견되지 않았다. `WEB_CHAT_WIDGET_ORIGINS` 는 이미 코드에 구현돼 있어 spec/env 문서화가 코드와 충돌 없이 정합된다. `visible`/`hidden` 및 `blocked` 상태 enum 명은 기존 도메인과 레이어가 명확히 분리돼 있어 혼동 위험이 낮다.

## 위험도

NONE
