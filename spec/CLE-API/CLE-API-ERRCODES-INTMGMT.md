---
id: "CLE-API-ERRCODES-INTMGMT"
title: "에러 코드 카탈로그 — 통합 관리 · OAuth"
type: "convention"
version: 3
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-ERRCODES"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-ERRCODES"]
area: "CLE-API"
content_hash: "037c27100a3f99605a1cdb24733c1d2fdc526cbdc2406f38b6b8e5a2d017d85f"
read_as: "approved_fallback"
task: "CLE-T-FCN55B"
source_paths: []
mirror_sha256: "4444673c79f245d53a5554641ff85e12590f861f963ca3b6be651acf3fd37741"
etag: "sha256-e7978fac1792b175563c23fdfca4dec83b0d3d02ebae6e7179119f86ae34332e"
---
## 개요

이 문서는 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 의 하위 문서로 카탈로그 가운데 통합 관리 API · 설치 엔드포인트 · 통합 OAuth 콜백 코드(§6.21)를 정한다. 통합 노드 · 연결 테스트 · 도구 결과 코드는 [통합 노드 · MCP 코드](CLE-API-ERRCODES-INTNODE.md) 가 정한다.

## 6.21 통합 관리 · OAuth (도메인 문서 참조)

통합 관리 API(`/api/integrations/*`, `POST /api/integrations/oauth/begin` 포함), 설치 엔드포인트(`GET /api/3rd-party/cafe24/install/:installToken` · `GET /api/3rd-party/makeshop/install/:installToken`), 통합 OAuth 콜백(`GET /api/3rd-party/:provider/callback`)이 내는 코드다. 이 경로들도 내는 공용 코드(§6.2 `NOT_A_MEMBER` · `EDITOR_REQUIRED` · `ADMIN_REQUIRED`, §6.4 `VALIDATION_ERROR` · `RESOURCE_NOT_FOUND`)는 다시 적지 않는다. 통합 노드 · 연결 테스트 · AI 에이전트 도구의 코드는 §6.22 에 있다.

- **설치 엔드포인트도 표준 봉투 `{ error: { code, message, requestId } }` 로 답한다.** 전역 예외 필터를 거치지 않으므로 컨트롤러가 본문을 직접 조립하고 `requestId` 를 응답마다 새로 발급한다. 빈도 제한 · 토큰 형식 · 필수 query 검사는 늘 JSON 으로 답한다. 그 뒤 서비스가 거절하면 `Accept` 에 `text/html` 이 있을 때 코드 · 메시지 · `requestId` 를 담은 HTML 페이지로 답한다.
- **콜백 코드는 HTTP 봉투에 실리지 않는다.** 서비스가 거절하면 콜백은 상태 200 의 HTML 페이지를 그린다. 페이지에는 메시지만 있고 코드는 없다. 콜백이 대상 통합을 알면 코드를 그 통합의 `last_error.code` 에 남긴다. state 를 소비하지 못한 실패, `new` 모드(아직 통합 행이 없다), 상점 자리를 놓은 만료 설치 대기 행, 커밋 직전 재판정의 `RESOURCE_NOT_FOUND` 는 남기지 않는다. 그래서 아래 표는 콜백 코드의 HTTP 칸을 「없음 (통합 `last_error.code`)」 와 「없음 (콜백 HTML)」 로 나눠 적는다. `last_error.code` 에는 노드와 도구 호출의 실패 코드도 들어온다(§6.22).
- **소셜 로그인 콜백**(`GET /api/auth/oauth/:provider/callback`)의 내부 코드는 행을 두지 않는다. 실패는 모두 §3 의 소문자 URL 값(`invalid_state` · `token_exchange_failed` · `email_required` · `server_error`)으로 바뀐다. 연결할 계정을 하나로 정하지 못한 경우의 `OAUTH_ACCOUNT_AMBIGUOUS` 도 새 값 없이 `server_error` 로 바뀐다([가입과 로그인 — 로그인과 소셜 로그인 「에러 처리」](../CLE-ACCT/CLE-ACCT-SIGNIN-LOGIN.md#에러-처리)). 소셜 로그인 시작(`GET /api/auth/oauth/:provider`)은 OAuth 앱 설정이 없으면 표준 봉투로 `OAUTH_CONFIG_MISSING`(500)을 낸다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `INTEGRATION_INVALID_SERVICE` | 400 | 지원하지 않는 서비스와 인증 방식 조합으로 통합을 만들거나 미리보기 연결 테스트를 요청함 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `INTEGRATION_INVALID_CREDENTIALS` | 400 | 통합 생성이나 자격 증명 교체(`POST /api/integrations/:id/rotate`)의 자격 증명이 서비스의 필드 규칙(필수 필드 · 형식)에 맞지 않음. `message` 는 어긋난 항목을 `; ` 로 이어 적는다. 이름이 비슷한 `INTEGRATION_CREDENTIALS_INVALID` 와 다른 코드다(표 아래) | [통합 관리 — API 와 에러 코드 「에러 코드」](../CLE-INT/CLE-INT-MANAGE-API.md#에러-코드), [서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md) |
| `INTEGRATION_CREDENTIALS_INVALID` | 400 | `previewToken` 으로 통합을 만들 때(`POST /api/integrations`) 저장된 미리보기 자격 증명이 암호화되지 않은 문자열이라 쓰지 않음 | [통합 관리 — API 와 에러 코드 「에러 코드」](../CLE-INT/CLE-INT-MANAGE-API.md#에러-코드) |
| `OAUTH_PREVIEW_INVALID` · `OAUTH_PREVIEW_EXPIRED` · `OAUTH_PREVIEW_MISMATCH` | 400 | `previewToken` 으로 통합을 만들 때 미리보기 토큰을 쓸 수 없음. 순서대로 토큰이 없거나 이미 썼거나 요청자(워크스페이스 · 사용자)의 것이 아님, 발급 뒤 10분이 지남, 요청의 서비스 유형이 미리보기와 다름. 미리보기 토큰은 `new` 모드 콜백이 발급한다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `OAUTH_TARGET_MISMATCH` | 400 | `new` 가 아닌 모드의 `oauth/begin` 본문이 대상 통합(`integrationId`)과 맞지 않음. 서비스가 대상 통합의 서비스 유형과 다르거나 Cafe24 상점 식별자 · 앱 유형이 대상 통합의 값과 다름 | [OAuth 연결과 토큰 갱신 「`oauth/begin` 요청과 응답」](../CLE-INT/CLE-INT-OAUTH.md#oauthbegin-요청과-응답) |
| `INTEGRATION_OAUTH_UNSUPPORTED` | 400 | OAuth 를 쓰지 않는 서비스로 `oauth/begin` 을 요청함 | [OAuth 연결과 토큰 갱신 「`oauth/begin` 요청과 응답」](../CLE-INT/CLE-INT-OAUTH.md#oauthbegin-요청과-응답) |
| `OAUTH_CONFIG_MISSING` | 500 · 없음 (통합 `last_error.code`) | OAuth 앱 설정(서버 환경 변수)이 없음. `oauth/begin`(Cafe24 Public 과 환경 변수로 설정하는 프로바이더)과 소셜 로그인 시작(`GET /api/auth/oauth/:provider`)은 500 으로 답한다. 통합 콜백의 토큰 교환에서 나면 통합의 `last_error.code` 에 남는다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [가입과 로그인 「소셜 로그인」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#소셜-로그인) |
| `CAFE24_INVALID_MALL_ID` | 400 · 없음 (통합 `last_error.code`) · 없음 (노드 `output.error.code`) | `mall_id` 가 형식(소문자 영숫자 · 하이픈, 3~50자)에 맞지 않거나 없음. `oauth/begin` 은 400 으로 답하고, 콜백의 토큰 교환에서 state 에 `mall_id` 가 없으면 통합의 `last_error.code` 에 남는다. Cafe24 노드는 통합의 `mall_id` 가 형식에 맞지 않으면 에러 포트로 낸다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [Cafe24 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#에러-코드) |
| `CAFE24_INVALID_APP_TYPE` | 400 | `oauth/begin` 의 Cafe24 앱 유형이 `public` · `private` 가 아님 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED` | 400 · 없음 (통합 `last_error.code`) | Cafe24 Private 앱의 `oauth/begin` 에 `client_id` · `client_secret` 이 없음. 콜백의 토큰 교환에서 state 에 자격 증명이 없어도 나고 이때는 통합의 `last_error.code` 에 남는다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `CAFE24_PRIVATE_APP_USE_TEST_RUN` | 400 | Cafe24 Private 앱은 이 요청으로 OAuth 를 시작하지 않음. `oauth/begin` 이 `new` 가 아닌 모드로 오거나 설치 대기 중인 Private 통합에 재인증을 요청함. 이름의 경위는 §3 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `CAFE24_PRIVATE_APP_INSTALL_TOKEN_MISSING` | 400 | 설치 토큰(App URL)이 없는 Cafe24 Private 통합에 재인증(`POST /api/integrations/:id/reauthorize`)이나 추가 권한 요청(`POST /api/integrations/:id/request-scopes`)을 보냄. 복구는 통합을 지우고 다시 등록하는 것이다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` | 409 | 같은 워크스페이스에 같은 `mall_id` 의 Cafe24 통합이 이미 있음. `oauth/begin` 의 사전 검사, Private 설치 대기 행 쓰기, 통합 저장의 상점 식별자 UNIQUE 경합에서 난다. 응답에 기존 통합의 ID 를 싣지 않는다. 이름의 경위는 §3 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [OAuth 연결과 토큰 갱신 「`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 이름을 유지한다」](../CLE-INT/CLE-INT-OAUTH.md#cafe24_private_app_already_connected-이름을-유지한다) |
| `MAKESHOP_CREDENTIALS_REQUIRED` | 400 · 없음 (통합 `last_error.code`) | MakeShop `oauth/begin` 에 `client_id` · `client_secret` 이 없음. begin 은 모드보다 자격 증명을 먼저 보므로 자격 증명이 없으면 모드와 관계없이 이 코드다. 그래서 본문 없이 begin 을 다시 부르는 MakeShop 재인증도 이 코드로 끝난다. MakeShop 통합의 통합 재인증(`POST /api/integrations/:id/reauthorize`)과 추가 권한 요청(`POST /api/integrations/:id/request-scopes`)도 자격 증명 없이 begin 을 불러 이 코드로 거절된다. 이 거절은 규칙 6 의 예외다(Rationale). 부모 문서 규칙 6 의 예외 문장에는 아직 없고 NERV Task `CLE-T-H5NJZ3` 가 더한다. 콜백의 토큰 교환에서 state 에 자격 증명이 없어도 나고 이때는 통합의 `last_error.code` 에 남는다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [OAuth 연결과 토큰 갱신 「통합 재인증과 추가 권한 요청」](../CLE-INT/CLE-INT-OAUTH.md#통합-재인증과-추가-권한-요청) |
| `MAKESHOP_USE_SHOPSTORE_INSTALL` | 400 | 본문에 자격 증명을 실은 MakeShop `oauth/begin` 이 `new` 가 아닌 모드로 옴. 이름의 경위는 §3 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `CAFE24_PRIVATE_APP_INSTALL_PENDING` · `MAKESHOP_INSTALL_PENDING` | 409 | `oauth/begin`(`new`)이 같은 상점의 설치 대기 행을 다시 쓰려는데 그 행이 남의 개인 통합임. `details` 에는 `pendingInstallExpiresAt` 만 싣는다. 조직 통합의 설치 대기 행이고 요청자가 관리자 미만이면 `ADMIN_REQUIRED`(§6.2)다. 이름의 경위는 §3 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [OAuth 연결과 토큰 갱신 「설치 대기 행 재사용의 권한」](../CLE-INT/CLE-INT-OAUTH.md#설치-대기-행-재사용의-권한) |
| `INTEGRATION_NAME_TAKEN` | 409 | 통합 생성 · 수정이나 `oauth/begin` 의 설치 대기 행 쓰기에서 같은 워크스페이스에 같은 이름의 통합이 있음 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `INTEGRATION_OWNER_NOT_MEMBER` | 409 | 통합 범위 변경(`PATCH /api/integrations/:id/scope`)으로 조직 통합을 개인 통합으로 바꾸려는데 통합을 만든 사람이 워크스페이스 멤버가 아님 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `INTEGRATION_IN_USE` | 409 | 워크플로우 노드가 아직 참조하는 통합을 지우려 함(`DELETE /api/integrations/:id`). 서비스는 예외에 사용처 목록(`usages`)을 함께 넣지만 전역 예외 필터가 `code` · `message` · `details` 만 남겨 응답에는 실리지 않는다 | [통합 관리 「사용처 추적과 삭제 차단」](../CLE-INT/CLE-INT-MANAGE.md#사용처-추적과-삭제-차단), [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `INTEGRATION_ROTATE_UNSUPPORTED` | 400 | OAuth2 통합에 자격 증명 교체(`POST /api/integrations/:id/rotate`)를 요청함. OAuth2 통합은 재인증을 쓴다. 가시성(404) · 역할(403) 판정 뒤에 본다. 관리자 미만이 OAuth2 조직 통합에 요청하면 403 `ADMIN_REQUIRED`(§6.2)다 | [통합 관리 — API 와 에러 코드 「에러 코드」](../CLE-INT/CLE-INT-MANAGE-API.md#에러-코드) |
| `INTEGRATION_TEST_FAILED` | 400 | 자격 증명 교체가 새 자격 증명으로 연결 테스트를 했는데 실패함. 상태는 400 이다([통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드)). `message` 는 연결 테스트 결과의 메시지다. 결과에 `code` 가 있으면 `details: { testCode }` 로 싣고 없으면 `details` 를 싣지 않는다. 이 값은 에러 코드가 아니라 연결 테스트 결과의 코드다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `INTEGRATION_SCOPE_UNSUPPORTED` | 400 | OAuth2 가 아닌 통합에 추가 권한 요청(`POST /api/integrations/:id/request-scopes`)을 보냄. 가시성(404) · 역할(403) 판정 뒤에 본다. 관리자 미만이 OAuth2 가 아닌 조직 통합에 요청하면 403 `ADMIN_REQUIRED`(§6.2)다 | [통합 관리 — API 와 에러 코드 「에러 코드」](../CLE-INT/CLE-INT-MANAGE-API.md#에러-코드), [OAuth 연결과 토큰 갱신 — 재인증과 추가 권한 요청 「통합 재인증과 추가 권한 요청」](../CLE-INT/CLE-INT-OAUTH-REAUTH.md#통합-재인증과-추가-권한-요청) |
| `CAFE24_INSTALL_RATE_LIMITED` · `MAKESHOP_INSTALL_RATE_LIMITED` | 429 | 설치 엔드포인트에서 같은 IP 의 실패가 쌓여 잠김. `details` 와 `Retry-After` 는 없다. 노드의 `CAFE24_RATE_LIMITED` · `MAKESHOP_RATE_LIMITED`(§6.22)와 다른 코드다 | [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url) |
| `CAFE24_INSTALL_INVALID_TOKEN` · `MAKESHOP_INSTALL_INVALID_TOKEN` | 404 | 설치 토큰의 형식이 틀렸거나 그 토큰의 통합이 없음. IP 실패로 센다 | [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url) |
| `CAFE24_INSTALL_MISSING_PARAMS` · `MAKESHOP_INSTALL_MISSING_PARAMS` | 400 | 설치 요청에 필수 query 가 없음. Cafe24 는 `mall_id` · `timestamp` · `hmac`, MakeShop 은 `shop_uid` · `timestamp` · `hmac` 이다 | [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url) |
| `CAFE24_INSTALL_REPLAY` · `MAKESHOP_INSTALL_REPLAY` | 400 | 설치 요청의 `timestamp` 가 ±5분 밖이거나 해석되지 않음, 또는 같은 요청을 다시 보냄(nonce 재사용) | [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url), [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `CAFE24_INSTALL_INVALID_HMAC` | 403 | HMAC 검증 실패, 통합에 `client_secret` 이 없음, 또는 요청의 `mall_id` · 앱 유형이 토큰의 통합과 다름. IP 실패로 센다 | [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url), [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `MAKESHOP_INSTALL_INVALID_HMAC` | 403 | HMAC 검증 실패, 통합에 시크릿이 없음, 또는 요청의 `shop_uid` 가 토큰의 통합과 다름. IP 실패로 센다 | [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url) |
| `CAFE24_INSTALL_FAILED` · `MAKESHOP_INSTALL_FAILED` | 예외의 상태 · 500 | 설치 처리 중 코드가 없는 실패가 남. 코드가 없는 `HttpException` 이면 그 상태와 메시지를 싣는다. 그 밖의 예외(DB · 런타임 오류 등)는 500 과 고정 문구로 답하고 예외 원문은 `requestId` 와 함께 서버 로그에만 남긴다. IP 실패로 세지 않는다 | [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url) |
| `MAKESHOP_ALREADY_CONNECTED` | 409 | MakeShop 설치에서 같은 워크스페이스에 같은 `shop_uid` 의 연결된 MakeShop 통합이 이미 있음. 사전 검사와 상점 식별자 UNIQUE 경합에서 난다. 응답에 기존 통합의 ID 를 싣지 않는다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url) |
| `MAKESHOP_INVALID_SHOP_UID` | 400 · 없음 (노드 `output.error.code`) | `shop_uid` 형식 위반. 설치 엔드포인트는 400 으로 답하고 MakeShop 노드는 에러 포트로 낸다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [MakeShop 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#에러-코드) |
| `OAUTH_STATE_EXPIRED` | 없음 (통합 `last_error.code`) | 콜백의 state 가 만료됨. `new` 모드 state 는 통합이 없어 HTML 로만 끝난다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑) |
| `OAUTH_INVALID_SCOPE` | 없음 (통합 `last_error.code`) | Cafe24 authorize 단계가 `?error=invalid_scope` 로 돌아옴. `last_error.details.requiresCafe24Approval` 에 별도 승인 권한 범위가 원인인지 싣는다. 연결된 통합은 상태를 그대로 두고 사유를 `oauth_invalid_scope` 로 둔다 | [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑) |
| `OAUTH_TOKEN_EXCHANGE_FAILED` | 없음 (통합 `last_error.code`) | 콜백의 토큰 교환 실패. 연결된 통합의 재인증이면 통합이 `error(auth_failed)` 가 된다. 다만 Cafe24 Private 재설치 대기 표시가 살아 있으면 상태를 바꾸지 않는다. 설치 대기 행은 상태를 그대로 두고 사유만 적는다 | [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑) |
| `OAUTH_CALLBACK_FAILED` | 없음 (통합 `last_error.code`) | 콜백 처리 중 코드가 없는 예외가 났을 때 `last_error.code` 에 적는 대체값. 이 코드로 던지는 곳은 없다 | [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑) |
| `OAUTH_DENIED` | 없음 (콜백 HTML) | OAuth 제공자가 `error` query 로 돌아옴(사용자 거부 등). Cafe24 의 `invalid_scope` 는 위 `OAUTH_INVALID_SCOPE` 다 | [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑), [OAuth 연결과 토큰 갱신 「OAuth 콜백 엔드포인트」](../CLE-INT/CLE-INT-OAUTH.md#oauth-콜백-엔드포인트) |
| `OAUTH_STATE_MISSING` · `OAUTH_CODE_MISSING` | 없음 (콜백 HTML) | 콜백 query 에 `state` 나 `code` 가 없음 | [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑), [OAuth 연결과 토큰 갱신 「OAuth 콜백 엔드포인트」](../CLE-INT/CLE-INT-OAUTH.md#oauth-콜백-엔드포인트) |
| `OAUTH_STATE_INVALID` | 없음 (콜백 HTML) | `new` 모드가 아닌 state 에 대상 통합이 없음 | [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑), [OAuth 연결과 토큰 갱신 「OAuth 콜백 엔드포인트」](../CLE-INT/CLE-INT-OAUTH.md#oauth-콜백-엔드포인트) |
| `INTEGRATION_INSTALL_EXPIRED` | 없음 (콜백 HTML) | state 는 유효하지만 대상 통합이 설치 기한을 넘겨 만료되고 상점 자리를 놓았음. 예외는 400 이지만 콜백은 HTML 로 답하고 통합 행과 `last_error` 를 바꾸지 않는다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [OAuth 연결과 토큰 갱신 「만료된 설치 대기 행은 상점 자리를 놓는다」](../CLE-INT/CLE-INT-OAUTH.md#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29) |

- **`OAUTH_STATE_MISMATCH` 는 §6.18 행이다.** 통합 콜백에서 state 를 찾지 못하면 HTML 로만 끝난다. 소비한 state 의 provider 가 다르면 대상 통합의 `last_error.code` 에도 남는다.
- **비슷한 이름 주의**: `INTEGRATION_INVALID_CREDENTIALS` 와 `INTEGRATION_CREDENTIALS_INVALID` 는 다른 코드다. 앞의 것은 입력한 자격 증명이 필드 규칙에 맞지 않을 때, 뒤의 것은 저장된 미리보기 자격 증명을 쓸 수 없을 때 난다. 두 코드를 하나로 묶어 분기하지 않는다(규칙 4).
- **빈도 제한 코드는 세 부류다.** 설치 엔드포인트의 IP 실패 잠금은 `CAFE24_INSTALL_RATE_LIMITED` · `MAKESHOP_INSTALL_RATE_LIMITED` 다. 노드와 도구의 429 재시도 소진은 `CAFE24_RATE_LIMITED` · `MAKESHOP_RATE_LIMITED`(§6.22)다. 요청 빈도 제한(`@Throttle`) 초과는 `RATE_LIMITED`(§6.1)이고 설치 엔드포인트와 콜백에도 걸린다.
- **`INSUFFICIENT_SCOPE` 는 행이 없다(규칙 9).** [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) 는 이 코드를 403 과 `details.missingScopes` 로 적지만 내는 곳이 없다. Cafe24 노드와 도구는 403 을 `CAFE24_AUTH_FAILED` 로 낸다. 권한 범위 부족 신호가 있으면 통합이 `error(insufficient_scope)`, 없으면 `error(auth_failed)` 가 되고 `last_error.code` 는 둘 다 `CAFE24_AUTH_FAILED` 다. 연결 테스트는 403 을 `CAFE24_INSUFFICIENT_SCOPE` 로 돌려준다(§6.22). 어느 코드로 맞출지는 [통합 관리 「미결 사항」](../CLE-INT/CLE-INT-MANAGE.md#미결-사항) 에서 정한다.
- **코드에 있지만 닿지 않는 이름 셋은 행이 없다(규칙 9).** `MAKESHOP_PKCE_REQUIRED` 는 내부 안전망이고 지금 흐름에서는 나지 않는다. `OAUTH_PROVIDER_UNKNOWN` 은 통합 콜백에서는 컨트롤러가 먼저 코드 없는 400 HTML 로 거절하고, 소셜 로그인에서는 경로 파라미터 검사가 먼저 거절한다. `INTEGRATION_ALREADY_CONNECTED` 는 상점 식별자 UNIQUE 경합의 범용 대체값인데 상점 식별자를 쓰는 두 서비스(Cafe24 · MakeShop)가 모두 전용 코드로 바뀐다.

## Rationale

### 설치 엔드포인트의 예상 밖 예외를 500 으로 가리고 `requestId` 를 싣는다 (2026-11-06)

NERV Task `CLE-T-909H23` 이다. 설치 엔드포인트는 `@Res` 로 응답을 직접 써서 전역 예외 필터를 거치지 않는다. 그래서 코드가 없는 예외를 400 `*_INSTALL_FAILED` 로 바꾸면서 예외 메시지를 그대로 실었다. DB · 런타임 오류의 원문이 Cafe24 · MakeShop 콘솔에서 연 브라우저에 보였다([에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 규칙 2). 실패 본문에 `requestId` 가 없어 서버 로그와 이을 수도 없었다(같은 문서 규칙 3).

- **코드 이름은 그대로 쓰고 상태와 문구만 바꿨다.** 코드가 없는 실패라는 뜻은 바뀌지 않는다. `INTERNAL_ERROR` 로 바꾸는 안은 기각했다. 이름 바꾸기는 호환을 깨는 변경이다(규칙 5).
- **상태는 예외 종류로 가른다.** 코드가 없는 `HttpException` 의 상태와 문구는 작성자가 정한 값이라 전역 필터처럼 그대로 싣는다. 그 밖의 예외는 500 과 고정 문구로 가리고 원문은 `requestId` 와 함께 `logger.error` 로만 남긴다.
- **예외를 전역 필터로 다시 던지는 안은 기각했다.** 필터는 JSON 만 그려서 콘솔에서 연 브라우저에 HTML 안내 페이지를 보일 수 없다. 열거 공격 실패 카운트도 컨트롤러가 해야 한다.
- **앞단 가드(빈도 제한 · 토큰 형식 · 필수 query)의 JSON 에도 `requestId` 를 싣는다.** 한 엔드포인트의 실패 본문을 한 모양으로 맞췄다. §6.21 머리말의 「표준 봉투를 쓰지 않는다」 불릿은 이 변경에 맞춰 고쳤다. 그 불릿은 사실만 적었고 까닭을 적은 Rationale 은 없다. 응답을 `@Res` 로 직접 써서 전역 필터가 봉투와 `requestId` 를 채우지 못한 결과였다. 이제 컨트롤러가 봉투를 조립하고 `requestId` 를 발급하므로 표준 봉투로 맞췄다.
- 열거 공격 실패 카운트는 바꾸지 않았다. `*_INSTALL_INVALID_TOKEN` · `*_INSTALL_INVALID_HMAC` 만 센다.

### `new` 가 아닌 모드의 begin 이 대상 통합과 맞지 않는 요청에 `OAUTH_TARGET_MISMATCH` 를 새로 만들었다 (2026-11-06)

NERV Task `CLE-T-9J6W7H` 다. `oauth/begin` 을 `new` 가 아닌 모드로 부르면서 본문의 서비스나 Cafe24 상점 식별자 · 앱 유형을 `integrationId` 의 대상 통합과 다르게 실으면 400 `OAUTH_TARGET_MISMATCH` 로 거절한다(§6.21). 전에는 거절하지 않아 콜백이 다른 상점이나 다른 서비스의 토큰을 대상 통합에 쓸 수 있었다. 동작과 근거의 정본은 [OAuth 연결과 토큰 갱신 「`new` 가 아닌 모드의 begin 은 본문이 대상 통합과 다르면 거절한다」](../CLE-INT/CLE-INT-OAUTH.md#new-가-아닌-모드의-begin-은-본문이-대상-통합과-다르면-거절한다-2026-11-06) 다.

- **새 조건이라 새 코드를 만든다(규칙 6).** 이 엔드포인트에 전에 없던 거절 조건이다.
- **`VALIDATION_ERROR` 를 쓰지 않는다.** 본문 하나만 보면 형식이 맞는 요청이다. 대상 행과 견준 결과를 형식 검증 코드에 담으면 뜻이 갈린다.
- **409 를 쓰지 않는다.** 대상 행의 상태와 부딪힌 것이 아니라 요청이 대상을 잘못 가리킨 것이다. 같은 요청을 다시 보내도 결과가 같은 클라이언트 오류라 400 이다.
- **이름은 `<DOMAIN>_<CONDITION>` 이다(규칙 1 · 3).** 조건이 OAuth 흐름의 시작 요청에 속해 `OAUTH_*` 를 붙였다. 미리보기 토큰과 요청의 서비스 유형이 다를 때 쓰는 `OAUTH_PREVIEW_MISMATCH` 와 같은 꼴이다. 서비스와 상점 식별자를 나눠 코드 둘로 만드는 안은 기각했다. 클라이언트가 할 일이 «대상 통합의 값으로 다시 보낸다» 로 같다.

### 자격 증명 교체의 연결 테스트 실패를 통합 관리 결정에 맞췄다 (2026-11-12)

결정의 정본은 [통합 관리 「자격 증명 교체의 연결 테스트 실패는 400 이다 (2026-11-12)」](../CLE-INT/CLE-INT-MANAGE.md#자격-증명-교체의-연결-테스트-실패는-400-이다-2026-11-12) 다(NERV Task `CLE-T-J6TZGK`).

- **`INTEGRATION_TEST_FAILED` 의 상태는 400 이다.** 이 카탈로그는 통합 관리가 상태를 미결로 둔다고 적었다. 그 미결이 400 으로 닫혀서 행의 문장을 결정으로 바꿨다. 이름과 상태는 그대로라 새 코드가 아니다.
- **테스트 결과 코드는 `details.testCode` 에 싣는다.** 값은 연결 테스트 결과의 이름공간이라 이 카탈로그에 등재하지 않는다. `details.code` 로 두지 않은 이유는 [에러 응답과 클라이언트 처리 2.5](CLE-API-ERROR.md#25-field-를-실으면-code-도-싣는다-2026-09-11) 에 적었다. 구현은 NERV Task `CLE-T-XCMNP6` 이다.
- **`MAKESHOP_AUTH_FAILED` 행(§6.22)에 연결 테스트와 노드의 차이를 적었다.** 연결 테스트의 403 은 통합 상태를 바꾸지 않는다. 노드에서는 같은 이름이 다른 결과를 낸다. 이 차이를 행에 한 문장으로 드러내고 통합 관리의 정의 자리를 링크했다.

### MakeShop 통합 재인증 · 추가 권한 요청의 거절을 `MAKESHOP_CREDENTIALS_REQUIRED` 행에 더했다 (2026-11-14)

NERV Task `CLE-T-6G3084` 다. 행은 begin 의 자격 증명 누락과 본문 없는 MakeShop 재인증만 적었다. 2026-11-13 에 사용자가 MakeShop 통합의 `:id/reauthorize` · `:id/request-scopes` 를 이 코드로 거절한다고 정했다([OAuth 연결과 토큰 갱신 — 재인증과 추가 권한 요청 「MakeShop 통합 재인증과 추가 권한 요청의 거절 코드를 정했다」](../CLE-INT/CLE-INT-OAUTH-REAUTH.md#makeshop-통합-재인증과-추가-권한-요청의-거절-코드를-정했다-2026-11-13)). 그래서 두 경로를 행에 더하고 정의 문서에 그 요청 흐름을 적은 절을 더했다.

- **규칙 6 의 예외다.** 두 요청이 거절되는 실제 조건은 MakeShop 통합에 통합 재인증과 추가 권한 요청 경로가 없다는 것이다. 이름이 말하는 「begin 에 자격 증명이 없음」과 다른 조건이라 규칙 6 대로면 새 코드를 만들어야 한다. 사용자는 전용 코드를 새로 만드는 안을 고르지 않고 클라이언트가 이미 받는 지금 코드를 계약으로 정했다.
- **§3 에는 올리지 않았다.** 이름이 규칙 1~3 을 어긴 것이 아니라 기존 코드를 다시 쓰는 결정이다. [예외 등록 코드](CLE-API-ERRCODES-EXCEPT.md#3-예외-등록-코드) 첫 문단에 따라 등록부에 넣지 않는다.
- **규칙 6 의 예외 문장은 이번에 고치지 않았다.** [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 규칙 6 은 예외를 웹훅 인증의 `AUTH_FAILED` 하나로 적는다. 그 문장에 이 예외를 더하는 일은 NERV Task `CLE-T-H5NJZ3` 가 맡는다.
- 행에 begin 의 검사 순서를 적었다. 자격 증명을 실은 begin 이 `new` 가 아닌 모드로 오면 모드 검사에 닿아 `MAKESHOP_USE_SHOPSTORE_INSTALL`(§3)이 나간다. 두 코드가 갈리는 지점이 이 순서다.

### 정의 문서와 구현 서술을 맞췄다 (2026-11-14)

NERV Task `CLE-T-6G3084` · `CLE-T-NFNMZG` · `CLE-T-FCN55B` · `CLE-T-4F33EZ` 다.

- **`INTEGRATION_SCOPE_UNSUPPORTED`**: 통합 관리 「에러 코드」 표에도 이 코드 행이 있어 정의 문서에 두 문서를 함께 적었다. 통합 관리 쪽은 판정 순서를, OAuth 연결 쪽은 요청 흐름을 적는다.
- **`INTEGRATION_TEST_FAILED`**: NERV Task `CLE-T-XCMNP6` 의 구현으로 결과에 `code` 가 있으면 `details.testCode` 를 싣는다. 「지금 구현은 싣지 않는다」 문장을 지우고 `code` 가 없을 때의 모양을 적었다.
- **소셜 로그인 콜백의 `OAUTH_ACCOUNT_AMBIGUOUS`**: 연결할 계정을 정하지 못한 실패도 다른 내부 코드처럼 행 없이 `server_error` 로 바뀐다고 적었다. 새 `error=` 값을 두지 않은 이유는 [가입과 로그인 — 가입 · 재설정 · 이메일 변경 Rationale 「대소문자만 다른 기존 계정은 대소문자까지 같은 계정만 쓰고 나머지는 모호로 거부한다」](../CLE-ACCT/CLE-ACCT-SIGNIN-SIGNUP.md#대소문자만-다른-기존-계정은-대소문자까지-같은-계정만-쓰고-나머지는-모호로-거부한다-2026-11-05) 에 있다.
- **`INTEGRATION_SCOPE_UNSUPPORTED` · `INTEGRATION_ROTATE_UNSUPPORTED` 의 판정 순서**: 두 행에 가시성(404) · 역할(403) 판정 뒤에 본다고 적었다. 추가 권한 요청은 NERV Task `CLE-T-RW69WZ`, 자격 증명 교체는 `CLE-T-4F33EZ` 로 이 순서가 됐다. 그래서 관리자 미만이 조직 통합에 보낸 요청은 인증 유형과 관계없이 `ADMIN_REQUIRED` 다.
- **정의 문서 링크**: 통합 관리를 하위 문서로 나누며 에러 코드 표를 [통합 관리 — API 와 에러 코드](../CLE-INT/CLE-INT-MANAGE-API.md#에러-코드) 로 옮겼다. `INTEGRATION_INVALID_CREDENTIALS` · `INTEGRATION_CREDENTIALS_INVALID` 는 그 표에 행이 없었다. 그 표에 두 행을 더하고 정의 문서를 그 표로 고쳤다. 판정 순서를 더한 두 UNSUPPORTED 행의 통합 관리 링크도 그 표로 옮겼다. `INTEGRATION_SCOPE_UNSUPPORTED` 의 OAuth 링크는 요청 흐름을 적은 하위 문서 [재인증과 추가 권한 요청](../CLE-INT/CLE-INT-OAUTH-REAUTH.md#통합-재인증과-추가-권한-요청) 으로 고쳤다(NERV Task `CLE-T-FCN55B`).
