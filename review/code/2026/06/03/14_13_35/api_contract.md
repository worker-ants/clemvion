# API 계약(API Contract) 리뷰

## 개요

리뷰 대상 20개 파일은 전부 `spec/` 하위 마크다운 문서(convention, data-flow)다. 변경 내용은 spec 의 기존 기술을 실제 코드와 대조해 갱신한 "spec-sync" 성격의 문서 수정이다. 구현 코드(`codebase/`) 변경은 포함되지 않는다.

다만 여러 파일에서 **API 엔드포인트 경로·HTTP 메서드·응답 코드·요청/응답 형식·인증 정책**이 명시적으로 기술되어 있고, 그 기술 내용이 변경되었다. 이 변경들은 "spec 이 코드를 반영" 하는 것이지만, 동시에 **API 계약의 단일 진실(SoT)** 로 기능하므로 계약 관점의 분석을 수행한다.

---

## 발견사항

### [WARNING] 초대 수락 에러 코드가 HTTP 403 → 400 으로 변경됨

- 위치: `spec/data-flow/12-workspace.md` 파일 13, diff `+    Svc-->>C: 400 code=invitation_email_mismatch`
- 상세: 기존 spec 은 초대 이메일 불일치 시 `403 INVITATION_EMAIL_MISMATCH` 를 반환한다고 기술했으나, 갱신된 spec 은 `400 code=invitation_email_mismatch` 로 기재한다. HTTP 의미론상 403(Forbidden)은 인가 실패, 400(Bad Request)은 잘못된 입력이라는 점에서 400 이 더 정확하지만, **기존 클라이언트가 403 을 분기 기준으로 사용하고 있다면 breaking change** 다. spec 변경 이전에 실제 코드(`workspaces.service.ts`)가 이미 400 을 반환하고 있는지 확인 필요. 또한 에러 코드 네이밍 방식이 `INVITATION_EMAIL_MISMATCH`(대문자 스네이크) → `invitation_email_mismatch`(소문자)로 바뀐 점도 클라이언트 에러 파싱에 영향을 줄 수 있다.
- 제안: 코드가 이미 변경되었다면 하위 호환 공지 또는 API 버전 bump 고려. 에러 코드 형식 컨벤션(대문자 vs 소문자)을 프로젝트 전체에서 통일할 것.

### [WARNING] 계정 잠금 응답 코드가 HTTP 423 → 401 로 변경됨

- 위치: `spec/data-flow/2-auth.md` 파일 14, diff `-    Svc-->>C: 423 ACCOUNT_LOCKED` → `+    Svc-->>C: 401 code=ACCOUNT_LOCKED`
- 상세: 423(Locked)은 WebDAV 확장 코드이지만 계정 잠금의 의미를 명확하게 표현한다. 401(Unauthorized)로 변경하면 클라이언트에서 "인증 실패"와 "계정 잠금"을 code 필드 없이 구분할 수 없게 된다. 기존 클라이언트가 423 여부로 잠금 상태 UI(예: "10분 후 재시도" 안내)를 분기했다면 이 변경이 UX 회귀를 일으킨다.
- 제안: 클라이언트가 `code=ACCOUNT_LOCKED` 를 파싱해 분기하도록 업데이트됐는지 확인. 프론트엔드 에러 핸들러(`auth` 관련 API 호출 코드)와의 정합 검증 필요.

### [WARNING] 세션 취소 엔드포인트가 `DELETE` → `POST` 로 변경, 응답이 204 → 200 으로 변경됨

- 위치: `spec/data-flow/2-auth.md` 파일 14, diff `-  C->>Svc: DELETE /api/auth/sessions/:familyId` → `+  C->>Svc: POST /api/users/me/sessions/:familyId/revoke ...`
- 상세: 세 가지 변경이 복합적으로 발생했다. (1) HTTP 메서드 `DELETE → POST`, (2) 경로 `/api/auth/sessions/:familyId → /api/users/me/sessions/:familyId/revoke`, (3) 응답 코드 `204 No Content → 200 + body`. 이는 모두 **명시적 breaking change** 다. spec 주석("DELETE 대신 POST 를 쓰는 이유는 CDN/프록시가 DELETE 바디를 제거하기 때문")이 기술적 근거를 제공하지만, 기존 클라이언트(프론트엔드 `codebase/frontend/src/lib/api/`)가 갱신되지 않으면 기능 중단이 발생한다.
- 제안: 프론트엔드 API 클라이언트(`/api/auth/sessions` 호출 코드)와의 정합 확인. 같은 PR 또는 직전 PR 에서 이미 갱신되었어야 함.

### [WARNING] OAuth Integration 시작 엔드포인트가 `GET` → `POST` 로, 응답이 302 리다이렉트 → 200 JSON 으로 변경됨

- 위치: `spec/data-flow/5-integration.md` 파일 17, diff `-  C->>Svc: GET /api/integrations/oauth/:service/start` → `+  C->>Svc: POST /api/integrations/oauth/begin { service, mode }`
- 상세: (1) HTTP 메서드 `GET → POST`, (2) 경로 `/oauth/:service/start → /oauth/begin` (서비스명이 URL path → body로 이동), (3) 응답 방식 `302 리다이렉트 → 200 JSON { authUrl, state }` (클라이언트가 직접 authUrl 로 이동). 브라우저 기반 OAuth 흐름에서 서버 사이드 302 대신 클라이언트 사이드 이동으로 전환하는 것은 의도적 아키텍처 변경이지만, 이 엔드포인트를 직접 호출하는 모든 클라이언트(프론트엔드 integration 연동 UI)가 동시에 갱신되어야 한다. Cafe24 Private 앱 분기(`{ mode, integrationId, appUrl, callbackUrl }`)도 동일 엔드포인트에서 응답 형식이 달라지는 oneOf 패턴으로, Swagger `ApiOkWrappedOneOfResponse` 가 적용됐는지 확인 필요.
- 제안: `spec/conventions/swagger.md` 에 `ApiOkWrappedOneOfResponse` 헬퍼가 신규 추가됐음을 확인함. 해당 엔드포인트에 discriminator 기반 oneOf 응답 문서가 실제로 적용됐는지 코드(`integrations.controller.ts`) 검증 필요.

### [WARNING] Webhook 비활성 트리거 응답이 404 → 410 Gone 으로 변경됨

- 위치: `spec/data-flow/10-triggers.md` 파일 11, diff `+    Hk-->>Ext: 410 Gone TRIGGER_INACTIVE`
- 상세: 기존 spec/코드는 비활성 트리거 호출 시 404 를 반환했으나, 갱신된 spec 은 404(미존재)와 410(비활성)을 명확히 구분한다. 외부 webhook 호출자(third-party 클라이언트)가 404 를 파싱해 "트리거 없음"으로 처리하던 로직이 있다면, 410 을 받았을 때 다른 분기로 처리될 수 있다. 그러나 외부 클라이언트 입장에서 410 은 "영구적으로 사라짐"을 의미하므로 의미론상 더 정확하다.
- 제안: 외부 webhook 클라이언트 문서(API 문서/Swagger)에 410 응답 케이스를 명시. 실제 코드(`hooks.service.ts` 또는 `hooks.controller.ts`)가 이미 410 을 반환하는지 확인.

### [WARNING] 워크플로우 실행 시작 엔드포인트 경로 변경 (`/run` → `/execute`) 및 인터랙션 재개 진입 이중화

- 위치: `spec/data-flow/10-triggers.md` 파일 11, diff `-  C->>Ctl: POST /api/workflows/:id/run { inputData }` → `+  C->>Ctl: POST /api/workflows/:id/execute { inputData }`
- 상세: 실행 시작 경로가 변경됨. 프론트엔드 `codebase/frontend/src/lib/api/executions.ts` 및 Manual Trigger 버튼 연동 코드가 `/run` 을 호출하고 있다면 기능 중단. 또한 spec/data-flow/3-execution.md 에서 재개 진입 surface 가 `POST /api/executions/:id/interactions { nodeId, type, payload }` → `REST POST /executions/:id/continue { formData? }` + `WS execution.{submit_form,...}` 로 이중화됨. 기존 `/interactions` 경로를 호출하던 클라이언트가 있다면 갱신 필요.
- 제안: 프론트엔드 API 클라이언트 전체에서 `/run` → `/execute`, `/interactions` → `/continue` 사용 여부 점검.

### [INFO] Workflow Assistant 세션 생성 경로 변경 및 스트리밍 방식 전환 (WebSocket → SSE)

- 위치: `spec/data-flow/11-workflow.md` 파일 12, diff
- 상세: (1) 세션 생성 엔드포인트 경로가 `/api/workflows/:wfId/assistant/sessions → /api/workflow-assistant/sessions {workflowId}` 로 변경됨. (2) Assistant 응답 스트리밍이 WebSocket emit(`assistant:delta`) → HTTP SSE(`text/event-stream`, 이벤트 `text`/`tool_call`/`plan`/`usage`/`done`)로 전환됨. SSE 이벤트 타입이 외부 클라이언트 계약이 되므로 이벤트명 변경 시 breaking change 가 된다. (3) 세션 아카이브가 `PATCH .../archive` 전용 엔드포인트 → 일반 `PATCH /sessions/:id {status: 'archived'}` 로 변경됨. 이 세 가지 모두 프론트엔드 Assistant UI 코드와의 정합이 필요하다.
- 제안: 프론트엔드의 SSE 수신 코드(`EventSource` 또는 `fetch` + `ReadableStream`)가 새 이벤트 타입(`text`, `tool_call`, `plan`, `usage`, `done`)을 처리하는지 확인.

### [INFO] `X-Workspace-Id` 헤더 우선 정책이 보안 위험을 수반함

- 위치: `spec/data-flow/12-workspace.md` 파일 13, Rationale 섹션
- 상세: spec 이 명시적으로 "헤더가 JWT 보다 우선" 함을 인정하고 "헤더 우선 수용은 해당 워크스페이스 멤버십 RBAC 가 각 핸들러/서비스에서 검증된다는 전제에 의존한다"고 기재함. 이는 모든 엔드포인트에서 `@Roles` 가드나 멤버십 검증이 올바르게 적용되어야 함을 의미한다. 단 RBAC 검증이 빠진 엔드포인트에서는 임의 `X-Workspace-Id` 헤더로 다른 워크스페이스 데이터에 접근할 수 있는 인가 bypass 위험이 존재한다.
- 제안: `WorkspaceId` 데코레이터를 사용하는 모든 핸들러에 멤버십 RBAC 검증이 적용됐는지 일괄 점검. 특히 read-only 엔드포인트(GET)에서 워크스페이스 소속 검증 누락 여부 확인.

### [INFO] `(owner_id, type) UNIQUE` 제약이 DB 레벨에서 미강제됨

- 위치: `spec/data-flow/12-workspace.md` 파일 13, Rationale `(owner_id, type) UNIQUE`
- 상세: spec 이 이 제약이 TypeORM `@Unique` 데코레이터로만 존재하고 마이그레이션 SQL 에는 DB UNIQUE 제약이 없음을 명시함. 즉 application 레벨 검증만으로 "사용자당 personal workspace 1개" 를 보장하며, DB 레벨 중복 방지가 없다. 동시 요청(race condition)에서 중복 personal workspace 가 생성될 수 있다.
- 제안: 마이그레이션을 통해 DB 레벨 UNIQUE 제약을 추가하거나, 낙관적 잠금(optimistic lock) 또는 트랜잭션 직렬화로 보완하는 plan 이 필요.

### [INFO] Swagger에 `interaction-token` Bearer scheme 신규 등록

- 위치: `spec/conventions/swagger.md` 파일 7, diff `+\`main.ts\`는 추가로 **\`interaction-token\`** Bearer scheme 도 등록합니다`
- 상세: External Interaction API 전용 `interaction-token` Bearer scheme (`iext_<JWT>` / `itk_<opaque>`) 가 추가됨. 해당 엔드포인트에 `@ApiBearerAuth('interaction-token')` 이 실제로 적용됐는지, 그리고 이 토큰 타입에 대한 인가 가드가 `access-token` 가드와 명확히 분리되어 있는지 확인 필요.
- 제안: Swagger UI 에서 `interaction-token` scheme 가 올바르게 노출되는지, 해당 엔드포인트가 `@ApiBearerAuth('interaction-token')` 만 갖고 `access-token` 을 오용하지 않는지 검토.

### [INFO] OAuth callback 에서 access token 을 URL 에 싣지 않는 정책 명시

- 위치: `spec/data-flow/2-auth.md` 파일 14, diff `+> OAuth 콜백은 access token 을 URL 에 싣지 않는다`
- 상세: OAuth 콜백이 `302 → frontend with tokens` 에서 `Set-Cookie (refreshToken httpOnly) + 302 → {frontendUrl}/callback?success=true` 로 변경됨. access token 을 URL query parameter 에 싣지 않는 것은 보안 향상이다. 프론트엔드 `/callback` 페이지가 `POST /api/auth/refresh` 로 access token 을 발급받도록 업데이트됐는지 확인 필요.
- 제안: 프론트엔드 OAuth callback 페이지(`/callback` route)에서 URL parameter 에서 token 을 읽는 구 로직이 제거됐는지 확인.

### [INFO] `alert_<rule.type>` 알림 type 이 DB CHECK 제약 외부

- 위치: `spec/data-flow/8-notifications.md` 파일 19, 표 `alert_<rule.type>` 행
- 상세: spec 이 명시적으로 "type 값이 동적 `alert_<type>` 라 V052 CHECK 제약 목록 밖" 임을 기재함. 동적 type 값을 허용하면 `notification.type` 컬럼의 DB 레벨 enum 강제가 깨지고, 오타나 잘못된 type 값이 DB 에 삽입될 수 있다. 또한 `notification.type` 로 필터링하는 클라이언트 쿼리가 예상치 못한 값을 받을 수 있다.
- 제안: V052 CHECK 제약에 `alert_%` LIKE 패턴이나 별도 유효성 검증을 추가하는 계획을 수립하거나, 동적 type 을 허용하는 이유와 범위를 spec 에 명시적으로 기술.

---

## 요약

변경된 20개 파일은 모두 spec 문서로, 실제 API 구현 코드 변경은 아니다. 그러나 여러 파일에서 **이미 코드에 반영된 breaking change** 를 spec 에 사후 기록하는 형태로 다수의 API 계약 변경이 드러났다: 초대 수락·계정 잠금 에러 코드 변경(403→400, 423→401), 세션 취소 메서드·경로·응답 변경(DELETE→POST, 204→200), OAuth Integration 시작 방식 변경(GET+302→POST+200 JSON), Webhook 비활성 트리거 404→410 구분, 실행 시작 경로 변경(`/run`→`/execute`), 재개 인터랙션 진입 이중화(`/interactions`→`/continue`+WS), Assistant 스트리밍 방식 전환(WebSocket→SSE) 등이 이에 해당한다. 이 변경들은 대부분 의미론적으로 올바른 방향이지만, 프론트엔드 API 클라이언트와의 정합 여부 및 외부 webhook 호출자 공지 여부가 검증되지 않은 상태로 spec 에만 기록되어 있어 **WARNING 수준의 하위 호환성 리스크**가 존재한다. `X-Workspace-Id` 헤더 우선 정책에서 RBAC 누락 시 인가 bypass 가능성도 주의가 필요하다.

## 위험도

MEDIUM

---

*리뷰어: API 계약(API Contract) sub-agent*
*대상 커밋: 현재 워크트리 변경 (spec-sync-audit)*
