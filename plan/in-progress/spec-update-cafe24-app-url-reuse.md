---
worktree: cafe24-app-url-reuse-f9a2e3
started: 2026-05-15
owner: developer (Claude)
---

# Cafe24 App URL 재사용 — install_token persistent + post-install navigation 분기

## 배경

Cafe24 Developers Console 에 등록한 **App URL** (`/api/3rd-party/cafe24/install/:installToken`) 은 두 가지 용도로 호출된다.

1. **초기 install** — 사용자가 "테스트 실행" 클릭. 우리 백엔드가 HMAC 검증 → OAuth authorize 로 redirect.
2. **post-install navigation** — 설치 후 카페24 쇼핑몰 관리자 화면의 "앱으로 가기" 버튼이 같은 App URL 을 호출. 사용자는 이미 connected 상태이며, 이 호출의 목적은 **우리 앱으로의 이동** (OAuth 가 아님).

옛 spec/구현은 ①번만 가정해 callback 성공 시 `installToken=NULL` 로 소거했다. 따라서 ②번 호출은 우리 DB 에서 token 미존재로 보여 `404 CAFE24_INSTALL_INVALID_TOKEN` 응답 — 카페24 사용자 입장에서 "앱으로 가기" 버튼이 망가져 있다.

운영 사용자 보고 (2026-05-15):
```
GET /api/3rd-party/cafe24/install/GFirdVtcR_wcvgvj81ju4w?...&mall_id=gehrig0301...&hmac=...
→ {"code":"CAFE24_INSTALL_INVALID_TOKEN","message":"install_token is not associated with a pending installation"}
```

## 결정

### install_token 은 **persistent identifier** 로 격상

- 옛 의미: `pending_install → connected` 전이 시 NULL 처리 (single-use).
- 새 의미: 통합 lifetime 동안 보존. 사용자가 통합을 **삭제하기 전까지** 같은 token 이 App URL path 에 유효.
- 예외: `pending_install → expired (install_timeout)` 의 24h TTL 만료 경로는 token 을 NULL 로 소거 유지 (사용자가 새 통합을 등록해야 하므로 옛 token 무효화가 정당함).

### App URL handler 분기

`handleInstall` 의 status 분기:

| 조회된 row 의 status | 처리 |
| --- | --- |
| `pending_install` | 기존 흐름 유지 — HMAC 검증 → OAuthState 생성 → Cafe24 authorize URL 로 302 |
| `connected` | **신규** — HMAC 검증 → `${FRONTEND_URL}/integrations/<id>` 로 302 (또는 `/` 로 통일) |
| `error(*)` / `expired` | HMAC 검증 → `${FRONTEND_URL}/integrations/<id>` 로 302 (사용자가 화면에서 diagnostic 확인) |
| (미존재 token / null) | 기존 동작 — `404 CAFE24_INSTALL_INVALID_TOKEN` |

post-install navigation 에서도 HMAC 검증은 유지한다 — App URL 은 Cafe24 가 호출한다는 신뢰 전제이며, HMAC 이 그 출처를 보증한다. unsigned 호출이 우리 frontend 로 redirect 되는 것을 막아 open-redirect / CSRF 류 우회를 차단.

### request-scopes (cafe24 Private) 분기

cafe24 Private + `mode='request_scopes'` 는 OAuth begin 의 `CAFE24_PRIVATE_APP_USE_TEST_RUN` 금지에 걸려 동작 불가. 새 의미에서는:

1. `IntegrationsService.requestScopes` 가 cafe24 Private 을 감지하면 begin 우회.
2. 기존 `installToken` 보존 (이미 persistent), `credentials.scopes` 를 `existing ∪ requested` 로 merge 만 갱신.
3. 응답: `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded: [...] }` + 안내 메시지 "Cafe24 Developers 의 앱 권한 설정에서 추가 scope 를 활성화한 뒤 '테스트 실행' 을 다시 누르면 새 token 으로 갱신됩니다."
4. 사용자가 "테스트 실행" 누르면 기존 install handler 가 작동 → OAuth callback → token 의 scope 가 확장된 token 으로 교체.

`CAFE24_PRIVATE_APP_USE_TEST_RUN` 거부 자체는 `mode='reauthorize'` 에 한정 (Private 은 reauthorize 진입점이 없음). request_scopes 는 위 경로로 우회.

## 영향 받는 spec 섹션

- `spec/2-navigation/4-integration.md` §3.2 (Step 2 Private 흐름 — 응답 안내)
- `spec/2-navigation/4-integration.md` §4.4 (Scope & Permissions 탭의 Request scopes 동작)
- `spec/2-navigation/4-integration.md` §6 (상태 전이 — pending_install → connected 시 token 보존)
- `spec/2-navigation/4-integration.md` §9 (API — App URL endpoint 의 status 분기, request-scopes 의 Private 응답 shape)
- `spec/2-navigation/4-integration.md` §10.2 (callback 처리 — installToken 보존)
- `spec/2-navigation/4-integration.md` Rationale (신규 항목)
- `spec/4-nodes/4-integration/4-cafe24.md` §9.4 의 install_token 소거 표기 갱신

## 영향 받는 코드

- `backend/src/modules/integrations/integration-oauth.service.ts` — `handleInstall` 분기, `handleCallback` 의 installToken 보존
- `backend/src/modules/integrations/integrations.service.ts` — `requestScopes` 의 cafe24 Private 우회
- `backend/src/modules/integrations/third-party-oauth.controller.ts` — handleInstall 호출 결과(URL) 처리 변화 없음 (이미 string redirect URL 반환)
- 신규: `frontend` 에서 post-install navigation 진입 시 처리하는 page (이미 `/integrations` 존재) — 별도 작업 없음

## 호환성

- 기존 `pending_install` 흐름은 그대로 동작.
- 옛 connected 통합은 `install_token` 이 이미 NULL — 새 동작이 동작하지 않음. 사용자가 통합을 다시 만들면 새 token 발급되고 새 동작 적용. 마이그레이션은 별도 plan 없이 자연 해소.
- DB 인덱스 변화 없음 — V045 partial UNIQUE `(install_token) WHERE install_token IS NOT NULL` 그대로.

## 후속 작업

- [ ] spec 갱신
- [ ] backend 구현 + 테스트
- [ ] frontend MCP UX 개선 (별개 이슈 — 본 PR 에 동봉)
- [ ] PR 머지 후 본 plan 을 `plan/complete/` 로 이동
