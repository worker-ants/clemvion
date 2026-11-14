---
id: "CLE-INT-OAUTH-BEGIN"
title: "OAuth 연결과 토큰 갱신 — 연결 시작(begin)"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT-OAUTH"
ancestors: ["CLE-VISION", "CLE-INT", "CLE-INT-OAUTH"]
area: "CLE-INT"
content_hash: "6e6276a77a33c3e5b13a1b9f370a88ac844790d79244f572ddfe577b4486677a"
read_as: "approved_fallback"
task: "CLE-T-ZCEZ46"
source_paths: []
mirror_sha256: "06abdcd6ccd02422572cabb75835bf53f6bcbffdfd5b50614b2716f66f93afee"
etag: "sha256-8d09f95f0f5d1d09a73c79b07db864555f07476ef6338c3f5b3c1914ff0a934a"
---
## 개요

이 문서는 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md) 의 하위 문서로 `oauth/begin` 진입점, 요청과 응답, 같은 상점 검사, 제공자별 설정을 정한다. 설치 대기 행을 다시 쓰는 규칙은 [설치 대기 행 재사용](CLE-INT-OAUTH-PENDING.md) 이 정한다.

## OAuth 연결 흐름

통합 OAuth state(`integration_oauth_state`)의 `mode` 는 `new`·`reauthorize`·`request_scopes` 세 가지다(`OAuthStateMode`). 진입점은 셋이다.

| 진입점 | mode | 설명 |
| --- | --- | --- |
| `POST /api/integrations/oauth/begin` | 본문의 `mode` 를 그대로 쓴다. `request-scopes` 표기는 `request_scopes` 로 바꾼다 | Cafe24 Private 과 MakeShop 은 `mode='new'` 만 받는다(그 밖의 모드 거절은 표 아래). MakeShop 은 통합 재인증과 추가 권한 요청을 지원하지 않는다(아래 두 진입점은 400 `MAKESHOP_CREDENTIALS_REQUIRED` 로 거절한다. [REQ-INTOAUTH-072](CLE-INT-OAUTH.md#요구사항)). `new` 가 아닌 모드는 본문이 `integrationId` 의 대상 통합과 맞지 않으면 400 `OAUTH_TARGET_MISMATCH` 로 거절한다 |
| `POST /api/integrations/:id/reauthorize` | `reauthorize` | 안에서 `begin(mode='reauthorize', integrationId)` 를 부른다. Cafe24 Public 통합은 행의 `credentials.mall_id`·`credentials.app_type` 을 begin 에 넘긴다. OAuth 가 아닌 통합, Cafe24 Private, MakeShop 의 처리는 [통합 재인증과 추가 권한 요청](CLE-INT-OAUTH-REAUTH.md#통합-재인증과-추가-권한-요청) 이 정한다 |
| `POST /api/integrations/:id/request-scopes` | `request_scopes` | 기존 권한 범위와 새 권한 범위를 합친 뒤 begin 을 부른다. Cafe24 Public 은 통합 재인증과 같게 행의 `mall_id`·`app_type` 을 넘긴다. Cafe24 Private·MakeShop 의 처리는 [통합 재인증과 추가 권한 요청](CLE-INT-OAUTH-REAUTH.md#통합-재인증과-추가-권한-요청) 이 정한다 |

- **`oauth/begin` 의 모드 거절**: 본문에 `client_id`·`client_secret` 을 갖춘 요청의 `new` 가 아닌 모드는 Cafe24 Private 이 400 `CAFE24_PRIVATE_APP_USE_TEST_RUN`, MakeShop 이 400 `MAKESHOP_USE_SHOPSTORE_INSTALL` 로 거절한다. 외부 마켓이 흐름을 시작하기 때문이다.
- Cafe24 Private 의 통합 재인증과 추가 권한 요청은 `:id/reauthorize`·`:id/request-scopes` 가 [재설치 대기 표시](CLE-INT-OAUTH-REAUTH.md#재설치-대기-표시)로 처리한다.
- MakeShop 은 삭제 후 재등록으로 복구한다([MakeShop 은 삭제 후 재등록으로만 복구한다](CLE-INT-OAUTH-REAUTH.md#makeshop-은-삭제-후-재등록으로만-복구한다)).

설치 우선 흐름에서는 App URL 이 `mode='reauthorize'` state 를 만든다. 설치 대기 행과 유효한 재설치 대기 표시가 있는 Cafe24 행이 그 대상이다([설치 엔드포인트](CLE-INT-OAUTH-INSTALL.md#설치-엔드포인트-app-url)).

state 는 발급 뒤 10분 동안 유효하고 콜백이 한 번만 소비한다. 권한 판정은 [통합 관리](CLE-INT-MANAGE.md) 의 권한 규칙을 따른다. `oauth/begin` 의 `reauthorize`·`request_scopes` 모드(`integrationId` 지정)도 `:id/reauthorize`·`:id/request-scopes` 와 같은 판정을 받는다. `new` 모드는 통합 생성과 같은 판정을 받는다. 뷰어는 모드와 상관없이 `403 EDITOR_REQUIRED` 이고, 관리자 미만이 조직 공개 범위를 고르면 `403 ADMIN_REQUIRED` 다. 둘 다 요청 본문만 보고 다시 쓸 설치 대기 행을 찾기 전에 거절한다. 테이블 쓰기 순서는 [통합 데이터와 흐름](CLE-INT-DATA.md) 의 시퀀스 그림에 있다.

### `oauth/begin` 요청과 응답

본문은 `{ service, scopes[], mode, integrationId?, integrationName?, scope? }` 이고 서비스에 따라 필드를 더한다. `integrationName`·`scope` 는 `new` 모드에서 만들 통합의 표시 이름과 공개 범위(`personal`·`organization`, 생략하면 `personal`)다(`OAuthBeginDto`). 이 `scope` 는 공개 범위이고 OAuth 권한 범위 `scopes[]` 와 관계없다. 요청 본문 필드 표기는 [미결 사항](#미결-사항) 참조.

| 서비스 | 더하는 필드 | 응답 |
| --- | --- | --- |
| Google, GitHub | 없음 | `{ authUrl, state }` (팝업 흐름) |
| Cafe24 Public | `mall_id`, `app_type='public'` | `{ authUrl, state }` (팝업 흐름). `authUrl` 은 상점별 인가 URL 이다 |
| Cafe24 Private | `mall_id`, `app_type='private'`, `client_id`, `client_secret` | `{ mode:'cafe24_private_pending', integrationId, appUrl, callbackUrl, scope }`. 설치 대기 통합을 만들고 팝업은 없다 |
| MakeShop | `client_id`, `client_secret` | `{ mode:'makeshop_pending_install', integrationId, appUrl, callbackUrl, scope }`. 설치 대기 통합을 만들고 팝업은 없다. ShopStore 앱 설치가 설치 흐름의 진입점이다 |

- `appUrl` 은 Cafe24 Private 이 `${APP_URL}/api/3rd-party/cafe24/install/:installToken`, MakeShop 이 `${APP_URL}/api/3rd-party/makeshop/install/:installToken` 이다. `installToken` 은 이 begin 이 발급한 16바이트 base64url(22자, `^[A-Za-z0-9_-]{22}$`) 설치 토큰이다. 사용자는 이 주소를 외부 콘솔의 App URL 칸에 그대로 등록한다.
- Cafe24 흐름(Public·Private)에 들어오면 같은 `(workspaceId, mall_id)` 의 Cafe24 통합을 먼저 본다.
  - Public: 연결됨 행이 있으면 begin 을 409 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 로 바로 거절한다. Public 은 begin 에서 행을 만들지 않으므로 이 사전 검사가 없으면 사용자가 OAuth 동의까지 마친 뒤에야 충돌을 알게 된다. `new` 가 아닌 모드(`reauthorize`·`request_scopes`)에서는 `integrationId` 가 가리키는 대상 통합 자신을 중복으로 보지 않는다. 대상이 아닌 연결됨 행이 있으면 같은 409 로 거절한다.
  - Private: 연결됨 행이 있으면 같은 코드로 거절한다. `app_type='private'` 인 설치 대기 행이 있으면 새 행을 만들지 않고 그 행을 재사용한다(멱등 begin). 설치 토큰과 발급 시각(`install_token_issued_at`)은 보존한다. 다만 `client_id`·`client_secret` 가운데 하나라도 바뀌었거나 설치 토큰이 없는 옛 행이면 설치 토큰을 새로 발급하고 발급 시각도 그때로 바꾼다. 설치 기한은 그때부터 다시 센다. 재사용은 요청자가 그 행을 바꿀 수 있을 때만 한다. [설치 대기 행 재사용의 권한](CLE-INT-OAUTH-PENDING.md#설치-대기-행-재사용의-권한) 을 따른다. `new` 가 아닌 모드는 이 검사에 닿지 않는다. 자격 증명을 갖춘 요청은 400 `CAFE24_PRIVATE_APP_USE_TEST_RUN` 으로 먼저 거절되고, `:id/reauthorize`·`:id/request-scopes` 는 begin 전에 서비스가 거절한다([통합 재인증과 추가 권한 요청](CLE-INT-OAUTH-REAUTH.md#통합-재인증과-추가-권한-요청)).
  - 만료됨·오류 행은 begin 의 사전 검사가 막지 않는다. 상점 식별자 UNIQUE(V072)가 마지막 방어로 같은 409 를 낸다. Public 은 최종 생성 단계에서, Private 은 begin 이 설치 대기 행을 만들 때 이 제약에 걸린다. 한 워크스페이스 안에서 같은 `(service_type, mall_id)` 통합은 최대 1행이므로 사용자는 기존 통합을 쓰거나 지우고 다시 등록한다.
    - 설치 기한이 지나 만료된 행(`install_timeout`)은 예외다. 만료할 때 상점 식별자를 비우므로([통합 상태와 만료 알림](CLE-INT-STATUS.md#상태-전이)) 이 제약에 걸리지 않는다. 그 행을 지우지 않아도 누구든 그 상점을 다시 등록할 수 있다.
    - 이름은 놓지 않아 같은 이름으로 다시 등록하면 409 `INTEGRATION_NAME_TAKEN` 이다([설치 대기 행 재사용](CLE-INT-OAUTH-PENDING.md#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29)).
- `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 는 세 경로에서 같은 코드로 나온다. 첫째는 begin 의 사전 SELECT 다. 연결됨 행만 차단하고 `new` 가 아닌 모드의 대상 통합은 뺀다. 둘째는 Cafe24 Private begin 이 `23505` 뒤 판정을 한 번 더 했는데도 상점 식별자 UNIQUE 에 걸린 경우다([설치 대기 행 재사용의 권한](CLE-INT-OAUTH-PENDING.md#설치-대기-행-재사용의-권한)). 셋째는 `POST /api/integrations` 최종 생성에서 `idx_integration_workspace_service_mall` 위반(`23505`)을 `throwIfUniqueViolation` 이 서비스 유형이 cafe24 인 분기로 바꾼 것이다. 앱 유형과 상관없이 쓴다. 이름의 `PRIVATE` 는 옛 이름이 남은 것이고 뜻은 «같은 상점의 Cafe24 통합이 이미 있다» 다. 클라이언트는 이름이 아니라 이 뜻으로 분기한다(아래 Rationale).
- `new` 가 아닌 모드(`reauthorize`·`request_scopes`)의 요청은 `integrationId` 의 대상 통합과 맞아야 한다. 본문의 `service` 가 대상 통합의 서비스 유형과 같아야 하고, Cafe24 는 본문의 상점 식별자와 앱 유형도 대상 통합의 `credentials.mall_id`·`credentials.app_type` 과 같아야 한다. 하나라도 다르면 state 를 만들지 않고 400 `OAUTH_TARGET_MISMATCH` 로 거절한다. 그대로 통과시키면 콜백이 다른 서비스나 다른 상점의 토큰을 대상 통합에 쓴다.
  - 판정은 다른 거절을 모두 지난 뒤 state 를 만들기 직전에 한다. 입력 형식(`CAFE24_INVALID_MALL_ID`·`CAFE24_INVALID_APP_TYPE`), 자격 증명과 모드의 거절(`CAFE24_PRIVATE_APP_USE_TEST_RUN`·`MAKESHOP_USE_SHOPSTORE_INSTALL`), `OAUTH_CONFIG_MISSING`, 409 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`가 먼저 걸리고 그 코드는 바뀌지 않는다. Cafe24 Private·MakeShop 의 `new` 가 아닌 모드는 이 판정에 닿지 않는다. 본문에 `client_id`·`client_secret` 이 없으면 `CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED`·`MAKESHOP_CREDENTIALS_REQUIRED` 로, 있으면 그 모드 거절로 먼저 거절된다. 그래서 이 판정에 닿는 것은 Google·GitHub·Cafe24 Public 요청이다.
  - 대상 통합은 컨트롤러가 가시성과 수정 권한을 판정한 그 행이다. begin 이 그 행을 다시 읽어 견주고, 그 사이 행이 지워졌으면 404 `RESOURCE_NOT_FOUND` 다.
  - `:id/reauthorize`·`:id/request-scopes` 는 행의 서비스 유형과 `credentials.mall_id`·`credentials.app_type` 을 넘기므로 이 거절에 걸리지 않는다. 상점 식별자가 없는 옛 행은 그보다 앞에서 `CAFE24_INVALID_MALL_ID` 로 거절된다.
- MakeShop 은 begin 시점에 `shop_uid` 를 모르므로 같은 `(workspace_id, client_id)` 의 설치 대기 행을 재사용하고 상점 중복은 설치 콜백에서 `MAKESHOP_ALREADY_CONNECTED`(409)로 막는다. 재사용 조건은 Cafe24 Private 과 같다. 설치 토큰과 발급 시각은 `client_secret` 이 바뀌어도 그대로 두고 설치 토큰이 없는 행에만 새로 발급한다. Cafe24 Private 과 다른 이 조건은 [미결 사항](CLE-INT-OAUTH-PENDING.md#미결-사항) 에 있다.
- 409 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`·`MAKESHOP_ALREADY_CONNECTED` 는 겹친 행의 통합 ID 를 싣지 않는다. 겹친 행이 남의 개인 통합일 수 있어서다. 예외 객체도 `code`·`message` 만 담는다.
- Cafe24 Private·MakeShop begin 이 설치 대기 행을 만들다 이름 UNIQUE(`integration_workspace_name_unique`)에 걸리면 409 `INTEGRATION_NAME_TAKEN` 이다([통합 관리](CLE-INT-MANAGE.md#에러-코드)). 설치 대기 행을 만드는 것도 통합 생성이라 생성과 같은 코드를 낸다. 동시 begin 이 이름 UNIQUE 에 걸렸을 때 한 번 더 판정하는 순서는 [설치 대기 행 재사용의 권한](CLE-INT-OAUTH-PENDING.md#설치-대기-행-재사용의-권한) 에 있다.
- Cafe24 Private·MakeShop begin 의 트랜잭션이 맨 먼저 잠글 워크스페이스 행이 그 사이 지워졌으면 공개 범위와 관계없이 403 `NOT_A_MEMBER` 다. 개인 공개 범위 요청은 요청자가 그 사이 나갔거나 제거돼 멤버십이 없을 때도 같은 코드다. 둘 다 라우트 가드를 지난 뒤의 경쟁에서만 난다. 가드처럼 없는 워크스페이스와 비멤버를 구분하지 않는다([워크스페이스와 멤버 「가드 거부 에러 코드」](../CLE-ACCT/CLE-ACCT-WS.md#가드-거부-에러-코드)).

### 제공자별 설정

| 제공자 | 인가 URL | 토큰 URL | 권한 범위 구분 | 기본 권한 범위 | 갱신 |
| --- | --- | --- | --- | --- | --- |
| Google | 고정 | `https://oauth2.googleapis.com/token` | 공백 | 사용자 체크박스 선택 결과 | refresh token 을 받지만 갱신 경로는 미구현 |
| GitHub | 고정 | `https://github.com/login/oauth/access_token` | 공백 | `repo`, `read:org` | 없음 |
| Cafe24 | `https://{mall_id}.cafe24api.com/api/v2/oauth/authorize?response_type=code&client_id=...&state=...&redirect_uri=...&scope=...` | `POST https://{mall_id}.cafe24api.com/api/v2/oauth/token` (Basic `client_id:client_secret`) | 콤마 | 사용자 체크박스(카테고리 R·W) 결과 | 있음. 같은 토큰 URL 에 `grant_type=refresh_token` |
| MakeShop | `https://auth.makeshop.com/oauth/authorize` (`response_type=code`, PKCE S256) | `POST https://auth.makeshop.com/oauth/token` (Basic `client_id:client_secret`) | 공백 | 사용자 체크박스 결과 | 있음. refresh token 이 매번 새 값으로 바뀐다 |

- **Cafe24 의 권한 범위는 콤마로 구분한다.** RFC 6749 §3.3 의 공백 구분이 아니라 `mall.read_product,mall.write_order` 처럼 보낸다. 공백이나 `+` 로 보내면 권한 범위가 하나여도 `invalid_scope` 로 거부된다. Cafe24 공식 예제(`developers.cafe24.com`)와 `cafe24-app/cafe24_app_sample` 의 `StoreToken.java#getCodeRedirectUrl` 이 모두 콤마를 쓴다. 다른 제공자는 공백 구분을 유지한다.
- **Cafe24 의 토큰 URL 은 `mall_id` 에 따라 바뀐다.** begin 이 사용자가 입력한 `mall_id` 를 통합 OAuth state 의 `provider_meta`(암호화, V041)에 넣어 콜백의 토큰 교환까지 가져간다. `new`·`reauthorize`·`request_scopes` 모두 같다. `reauthorize`·`request_scopes` 에서는 `:id/reauthorize`·`:id/request-scopes` 가 행의 `credentials.mall_id`·`credentials.app_type` 을 begin 에 넘긴다(`client_id`·`client_secret` 은 넘기지 않는다). `oauth/begin` 을 직접 부르면 본문의 두 값이 대상 통합의 값과 같아야 한다. 값이 없거나 형식이 틀린 옛 행은 begin 이 400 `CAFE24_INVALID_MALL_ID`·`CAFE24_INVALID_APP_TYPE` 으로 거절한다. MakeShop 은 같은 자리에 `shop_uid`, 클라이언트 자격 증명, PKCE `code_verifier` 를 넣는다. `code_verifier` 는 자격 증명에 저장하지 않는다.
- **Cafe24 토큰 응답은 `expires_in` 이 아니라 `expires_at`(ISO8601)을 준다.** 대신 `access_token` 이 JWT 라 `exp` 로도 만료 시각을 알 수 있다. 만료 시각 해석은 [토큰 자동 갱신](CLE-INT-OAUTH-REFRESH.md#토큰-자동-갱신) 의 규칙을 따른다.
- 통합용 콜백(`/api/3rd-party/:provider/callback`)은 사용자 소셜 로그인 콜백(`/api/auth/oauth/:provider/callback`)과 다르다. Google Cloud Console, GitHub OAuth App, Cafe24 개발자 센터에는 두 redirect URI 를 모두 등록한다.

## 미결 사항

- **`oauth/begin` 요청 본문 필드 표기**: 이 문서의 예시와 데이터 흐름 정의는 본문 필드를 `mall_id`·`app_type`·`client_id`·`client_secret` 으로 적는다. 현재 구현(`OAuthBeginDto`)과 프런트엔드는 `mallId`·`appType`·`clientId`·`clientSecret` 을 쓰고 같은 화면 정의의 precheck 쿼리도 `mallId` 다. 문서대로 보내는 클라이언트는 필드가 무시되거나 거부될 수 있다. API 계약의 표기를 정해야 한다.

## 구현 위치

- `codebase/backend/src/modules/integrations/begin-policy.ts` (begin 의 공용 판정. 공개 범위 기본값 `resolveBeginScope`, 상점 식별자 UNIQUE 위반 판정 `isStoreIdentifierConflict`, 409 응답 `toAlreadyConnectedConflict`)
- `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (begin·콜백·설치. `begin`, `handleInstall`, `new` 가 아닌 모드의 대상 통합 대조 `assertBeginMatchesTarget`. 콜백 쪽 함수는 [팝업 연결과 콜백](CLE-INT-OAUTH-CALLBACK.md#구현-위치))

## Rationale

### `:id/reauthorize`·`:id/request-scopes` 는 Cafe24 상점 식별자와 앱 유형을 같은 함수로 만든다 (2026-10-15)

Task CLE-T-WB7JPC 에서 정했다. `:id/reauthorize` 가 Cafe24 통합의 상점 식별자와 앱 유형을 begin 에 넘기지 않아 Cafe24 Public 통합 재인증이 400 `CAFE24_INVALID_MALL_ID` 로 거절됐다. 같은 누락이 다시 생기지 않게 두 엔드포인트가 begin 에 넘길 상점 식별자와 앱 유형(`credentials.mall_id`·`credentials.app_type`)을 한 함수에서 만든다. 세 mode 모두 상점 식별자를 `provider_meta` 로 콜백까지 가져간다는 [제공자별 설정](#제공자별-설정) 의 내용을 지킨 것이고 새 결정은 아니다.

begin 이 `integrationId` 의 행에서 두 값을 직접 채우는 안은 기각했다. begin 은 새 연결의 `oauth/begin` 엔드포인트이기도 해서 본문이 두 값의 원천이다. `oauth/begin` 엔드포인트도 `integrationId` 의 행으로 권한을 판정하지만 두 값을 그 행에서 채우지 않는다. 2026-11-06 부터는 본문과 견주는 데만 그 행의 두 값을 읽는다. 행에서 채우게 하면 같은 값의 원천이 본문과 행 둘이 되어 어느 쪽을 믿을지 정해야 한다. `:id/*` 는 `IntegrationsService` 가 행을 이미 읽고 가시성과 관리자 권한을 판정했으므로 거기서 넘기는 편이 단순하다. 직접 `oauth/begin` 이 대상 통합과 다른 상점 식별자를 싣는 경우는 그때 미결 사항에 두었고 2026-11-06 에 거절로 정했다([`new` 가 아닌 모드의 begin 은 본문이 대상 통합과 다르면 거절한다](#new-가-아닌-모드의-begin-은-본문이-대상-통합과-다르면-거절한다-2026-11-06)).

### Cafe24 Public 흐름에도 begin 사전 검사를 둔다

Public 흐름은 begin 에서 통합 행을 만들지 않아, 상점 식별자 부분 UNIQUE 가 `POST /api/integrations` 최종 생성 단계에서야 발동한다. 사용자가 Cafe24 동의 페이지까지 마친 뒤에야 충돌을 알았고 `IntegrationsService.throwIfUniqueViolation` 의 옛 분기는 `integration_workspace_name_unique` 만 처리해 상점 식별자 UNIQUE 위반은 raw `QueryFailedError` 로 500 이 났다.

- **begin 사전 검사**: Public 분기에도 Private 과 같은 `(workspaceId, mall_id)` 연결됨 행 SELECT 를 더했다. Public 흐름은 `IntegrationOAuthService.findConnectedCafe24MallIntegration` 헬퍼로 찾는다. Private 흐름은 설치 대기 행을 쓰는 `PendingInstallWriter` 가 그 아래층의 같은 상점 행 조회 `findAllCafe24RowsForMall`(`cafe24-store-rows.ts`)을 직접 부른다. 두 흐름은 이 조회 함수를 함께 쓴다.
- **마지막 방어 확장**: `throwIfUniqueViolation` 이 `idx_integration_workspace_service_mall`(V072) 위반을 서비스 유형별 코드로 바꾼다. 사전 검사를 통과한 뒤의 동시 INSERT 와 최종 생성 시점 충돌도 같은 409 가 된다.
- **다른 상태를 begin 에서 막지 않는 이유**: 설치 대기는 Private 의 멱등 begin(같은 행을 재사용해 설치 토큰 보존)과 맞아야 한다. Public 은 begin 에서 행을 만들지 않으므로 설치 대기가 있어도 begin 은 영향이 없고 최종 생성에서 UNIQUE 가 막는다. 만료됨·오류는 사용자의 재연결 의도를 반영해 begin 진입은 허용하되, 한 워크스페이스에 같은 상점 통합이 최대 1행이라는 불변식은 최종 생성에서 UNIQUE 가 지킨다(사용자는 기존 행을 먼저 지워야 한다). 결과적으로 연결됨이 아닌 모든 상태의 충돌은 같은 409 로 바뀌어 클라이언트 분기가 하나다. 설치 기한이 지나 만료된 행은 2026-10-29 결정으로 이 설명에서 빠졌다. 만료할 때 상점 식별자를 비우므로 UNIQUE 에 걸리지 않고 지우지 않아도 된다([만료된 설치 대기 행은 상점 자리를 놓는다](CLE-INT-OAUTH-PENDING.md#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29)).

**2026-10-15 보완(Task CLE-T-WB7JPC)**: 이 사전 검사는 새 연결을 전제로 만들어 모드를 가리지 않았다. `:id/reauthorize` 가 상점 식별자를 begin 에 넘기게 되자 연결됨 Cafe24 Public 통합의 통합 재인증이 그 통합 자신과 충돌해 409 가 났다. 추가 권한 요청은 2026-05-15 부터 상점 식별자를 넘겨 왔으므로 연결됨 Public 통합에서 이미 같은 409 를 내고 있었다. 그래서 `new` 가 아닌 모드에서는 `integrationId` 의 대상 통합을 중복 검사에서 뺀다. 대상이 아닌 연결됨 행이 있으면 여전히 409 다. 한 워크스페이스에서 같은 상점의 Cafe24 행은 UNIQUE(V072)로 하나뿐이다. 그래서 대상이 아닌 행과 충돌하는 경우는 `mall_id` 컬럼이 비어 `credentials.mall_id` 로 비교하는 전환기의 옛 행 정도다. 대상 제외는 본문의 상점 식별자가 대상 통합의 상점과 같을 때만 효과가 있다. 다른 상점을 실은 요청은 그 상점의 연결됨 행과 비교되어 전과 같다. 사전 검사를 `new` 에만 두는 안은 기각했다. 그 안에서는 대상이 아닌 연결됨 행이 있어도 통합 재인증이 콜백까지 진행된다. 콜백은 대상 행의 자격 증명만 바꾸므로 같은 상점을 가리키는 연결됨 행이 둘 남는다.

### 상점 중복 검사는 평문 `mall_id` 컬럼으로 한다

begin 은 메모리 사전 검사(연결됨이면 409, 설치 대기면 재사용)와 평문 `mall_id` 컬럼의 부분 UNIQUE(V072)를 함께 쓴다. 두 검사를 모두 통과한 동시 INSERT 는 `23505` 로 막히고 늦은 쪽의 처리는 [설치 대기 행 재사용의 권한](CLE-INT-OAUTH-PENDING.md#설치-대기-행-재사용의-권한) 이 정한다. V045 이전에는 `mall_id` 가 암호화 JSONB 안에만 있어 복호화 뒤 메모리 비교(O(N))를 했고 조회와 INSERT 사이에 경쟁 창이 있었다. 전환기 동안 begin 의 메모리 비교는 `credentials.mall_id` 대체를 둔다. 컬럼과 인덱스를 둔 이유는 [통합 데이터와 흐름](CLE-INT-DATA.md) 의 Rationale 에 있다.

### `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 이름을 유지한다

Public 흐름에도 이 코드를 쓰면서 `CAFE24_MALL_ALREADY_CONNECTED` 로 바꾸자는 안이 나왔지만 기각했다.

- 기존 클라이언트(프런트엔드, 통합 사용자)는 코드의 뜻(`mall_id` 기준 중복)으로 분기하므로 이름을 바꿔 얻는 가독성 이득이 없다. 바꾸면 deprecated 처리와 별칭 추가 같은 호환 부담만 생긴다.
- 중복·충돌은 409 라는 [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 정책과 `INTEGRATION_IN_USE`(409) 선례에 맞는다. 이름 토큰의 정확성보다 상태 코드와 뜻의 정확성이 먼저다.
- 에러 코드 명명 규율(뜻 기반 명명, 이름 안정성, 예외 레지스트리)의 기준은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 다. 이 항목은 그 옛 이름 예외 레지스트리의 도메인 근거다. `PRIVATE` 토큰은 처음 Private 흐름 전용이던 시절의 흔적이고 지금은 앱 유형과 상관없다. 새 코드는 이 예외를 선례로 삼지 않고 처음부터 뜻이 정확한 이름을 붙인다.

나중에 이 코드를 다른 `mall_id` 충돌(예: 워크스페이스 횡단 정책 변경)과 나눠야 하면 별도 코드를 검토한다.

### `new` 가 아닌 모드의 begin 은 본문이 대상 통합과 다르면 거절한다 (2026-11-06)

`oauth/begin` 은 `new` 가 아닌 모드에서 `integrationId` 의 행으로 권한만 판정하고 본문의 서비스, 상점 식별자, 앱 유형은 그 행과 견주지 않았다. 직접 부르는 클라이언트가 상점 A 의 통합을 가리키고 본문에 상점 B 를 실으면 상점 B 의 연결됨 행이 없는 한 begin 이 통과했고, 콜백이 상점 B 의 토큰을 상점 A 행에 쓸 수 있었다. 서비스 유형도 견주지 않아 GitHub 통합을 가리키고 `service` 에 Google 을 실은 요청도 같은 식으로 통과했다. Cafe24 Private 통합을 가리키고 Public 본문을 실으면 콜백이 그 행의 자격 증명을 Public 앱 토큰으로 바꿨다.

- **본문 값을 무시하고 행 값으로 채우는 안은 기각했다.** 2026-10-15 에 begin 이 행에서 상점 식별자와 앱 유형을 채우는 안을 기각한 근거가 그대로 적용된다([`:id/reauthorize`·`:id/request-scopes` 는 Cafe24 상점 식별자와 앱 유형을 같은 함수로 만든다](#idreauthorizeidrequest-scopes-는-cafe24-상점-식별자와-앱-유형을-같은-함수로-만든다-2026-10-15)). 본문이 두 값의 원천으로 남고 행은 판정에만 쓴다. 다른 값을 말없이 바꿔 쓰면 호출한 쪽은 자기 요청이 틀렸다는 것을 모른다.
- **서비스 유형도 견준다.** 상점 식별자만 견주면 Google·GitHub 처럼 상점이 없는 서비스의 같은 틈이 남는다.
- **400 과 새 코드 `OAUTH_TARGET_MISMATCH` 로 거절한다.** 요청이 가리킨 대상과 맞지 않는 입력이라 같은 요청을 다시 보내도 결과가 같다. 그래서 400 이다. 대상 행의 상태와 부딪힌 것이 아니므로 409 는 쓰지 않는다. `VALIDATION_ERROR` 도 쓰지 않는다. 그 코드는 본문 형식 검증의 실패라 대상 행과 견준 결과까지 담으면 뜻이 갈린다. 코드 이름과 등재의 근거는 [에러 코드 규약과 카탈로그 「`new` 가 아닌 모드의 begin 이 대상 통합과 맞지 않는 요청에 `OAUTH_TARGET_MISMATCH` 를 새로 만들었다」](../CLE-API/CLE-API-ERRCODES.md#new-가-아닌-모드의-begin-이-대상-통합과-맞지-않는-요청에-oauth_target_mismatch-를-새로-만들었다-2026-11-06) 에 있다.
- **판정은 state 를 만들기 직전에 한다.** 앞선 거절이 내던 코드를 바꾸지 않으려는 것이다. 직접 부르는 클라이언트는 지금 받던 코드를 그대로 받는다. 대상과 다른 상점의 연결됨 행이 있으면 지금처럼 409 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 다.
- **견줄 상점 식별자는 `credentials.mall_id` 다.** `:id/reauthorize`·`:id/request-scopes` 가 begin 에 넘기는 값과 원천이 같아 두 진입점의 결과가 갈리지 않는다. 평문 `mall_id` 컬럼은 전환기의 옛 행과 상점 자리를 놓은 만료 행에서 비어 있다.
- **콜백에서 다시 견주지 않는다.** state 는 이 판정을 지난 요청에만 만들어지고 state 에 담긴 서비스와 `provider_meta` 는 그 뒤 바뀌지 않는다. 대상 행의 서비스 유형, `credentials.mall_id`, `credentials.app_type` 을 바꾸는 API 도 없다. 별칭 수정은 이름만 받고 OAuth 통합의 자격 증명 교체는 `INTEGRATION_ROTATE_UNSUPPORTED` 로 거절된다. 콜백에도 판정을 두면 같은 판정이 두 곳에 생긴다.
- **비용**: 본문에 대상과 다른 값을 싣던 직접 호출 클라이언트는 이제 400 을 받는다. 자사 프런트엔드는 `oauth/begin` 을 `new` 모드로만 부른다(2026-11-06 저장소 검색으로 확인). 통합 재인증과 추가 권한 요청은 `:id/reauthorize`·`:id/request-scopes` 를 쓴다.
