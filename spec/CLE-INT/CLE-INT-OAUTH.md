---
id: "CLE-INT-OAUTH"
title: "OAuth 연결과 토큰 갱신"
type: "feature"
version: 15
status: "approved"
requirements: ["REQ-INTOAUTH-001", "REQ-INTOAUTH-002", "REQ-INTOAUTH-003", "REQ-INTOAUTH-004", "REQ-INTOAUTH-005", "REQ-INTOAUTH-006", "REQ-INTOAUTH-007", "REQ-INTOAUTH-008", "REQ-INTOAUTH-009", "REQ-INTOAUTH-010", "REQ-INTOAUTH-011", "REQ-INTOAUTH-012", "REQ-INTOAUTH-013", "REQ-INTOAUTH-014", "REQ-INTOAUTH-015", "REQ-INTOAUTH-016", "REQ-INTOAUTH-017", "REQ-INTOAUTH-018", "REQ-INTOAUTH-019", "REQ-INTOAUTH-020", "REQ-INTOAUTH-021", "REQ-INTOAUTH-022", "REQ-INTOAUTH-023", "REQ-INTOAUTH-024", "REQ-INTOAUTH-025", "REQ-INTOAUTH-026", "REQ-INTOAUTH-027", "REQ-INTOAUTH-028", "REQ-INTOAUTH-029", "REQ-INTOAUTH-030", "REQ-INTOAUTH-031", "REQ-INTOAUTH-032", "REQ-INTOAUTH-033", "REQ-INTOAUTH-034", "REQ-INTOAUTH-035", "REQ-INTOAUTH-036", "REQ-INTOAUTH-037", "REQ-INTOAUTH-038", "REQ-INTOAUTH-039", "REQ-INTOAUTH-040", "REQ-INTOAUTH-041", "REQ-INTOAUTH-042", "REQ-INTOAUTH-043", "REQ-INTOAUTH-044", "REQ-INTOAUTH-045", "REQ-INTOAUTH-046", "REQ-INTOAUTH-047", "REQ-INTOAUTH-048", "REQ-INTOAUTH-049", "REQ-INTOAUTH-050", "REQ-INTOAUTH-051", "REQ-INTOAUTH-052", "REQ-INTOAUTH-053", "REQ-INTOAUTH-054", "REQ-INTOAUTH-055", "REQ-INTOAUTH-056", "REQ-INTOAUTH-057", "REQ-INTOAUTH-058", "REQ-INTOAUTH-059", "REQ-INTOAUTH-060", "REQ-INTOAUTH-061", "REQ-INTOAUTH-062", "REQ-INTOAUTH-063", "REQ-INTOAUTH-064", "REQ-INTOAUTH-065", "REQ-INTOAUTH-066", "REQ-INTOAUTH-067", "REQ-INTOAUTH-068", "REQ-INTOAUTH-069", "REQ-INTOAUTH-070", "REQ-INTOAUTH-071", "REQ-INTOAUTH-072"]
basis_superseded: false
parent: "CLE-INT"
ancestors: ["CLE-VISION", "CLE-INT"]
area: "CLE-INT"
content_hash: "441fbff35717f791e9d48994a690d06472a8a543a6fce6f61d4b2e8d7dce3488"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/2-navigation/4-integration.md", "spec/2-navigation/_product-overview.md", "spec/4-nodes/4-integration/_product-overview.md", "spec/data-flow/5-integration.md"]
mirror_sha256: "0c9b9502d1a972455f3d6e1053c2390701f846f85af7d366e89e02e08202a8bd"
etag: "sha256-77844b8b533b4694630fb64c16492ea4bce51f8d139f040068ecf9d72532241c"
---
> 구현 상태: 부분 구현 · 원문: `spec/2-navigation/4-integration.md` (§3.2 OAuth 흐름, §3.5, §4.4, §9.2 OAuth·설치 행, §10, 관련 Rationale), `spec/data-flow/5-integration.md` (§1.2 진입점 표, §1.2.1 보안 계층, §2.2), `spec/4-nodes/4-integration/_product-overview.md` (INT-AU-01·04·06), `spec/2-navigation/_product-overview.md` (NAV-IN-03) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 OAuth 통합(Integration, `integration`)이 연결되는 방법과 연결 뒤 토큰을 유지하는 방법을 정한다. 연결 방식은 두 가지다. Google·GitHub·Cafe24 Public 앱은 우리 화면의 팝업에서 OAuth 제공자(OAuth provider) 동의를 받는다. Cafe24 Private 앱과 MakeShop 은 외부 마켓의 앱 설치가 흐름을 시작하는 설치 우선 흐름(install-first)이라, 통합이 설치 대기(`pending_install`) 상태로 먼저 생기고 외부가 우리 App URL 을 부른다.

흐름별 규칙은 하위 문서가 정한다(아래 「하위 문서」). 이 문서는 요구사항과 공통 결정의 변경 이력을 둔다.

범위 밖:

- 추가 위저드의 단계 구성과 공통 필드, 관리 API 목록, 에러 코드 카탈로그는 [통합 관리](CLE-INT-MANAGE.md) 가 정한다.
- 서비스별 자격 증명 필드와 권한 범위 프리셋은 [서비스별 인증 방식과 자격 증명](CLE-INT-AUTH.md) 이 정한다.
- 통합 상태 전이와 만료 스캐너, 알림은 [통합 상태와 만료 알림](CLE-INT-STATUS.md) 이 정한다.
- 테이블 쓰기 순서와 시퀀스는 [통합 데이터와 흐름](CLE-INT-DATA.md) 이 정한다.
- Cafe24 설치 엔드포인트의 Redis 키, HMAC 알고리즘, 상수는 [Cafe24 노드 §Private 앱 설치 엔드포인트](../CLE-NODE-INT/CLE-NODE-CAFE24.md#private-앱-설치-엔드포인트) 가, Cafe24 별도 승인 명단은 [Cafe24 별도 승인 scope](CLE-C24-SCOPES) 가 정한다.
- 소셜 로그인은 다른 흐름이다([가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md)).

## 요구사항

- REQ-INTOAUTH-001 WHEN 사용자가 Google·GitHub 통합의 연결 버튼을 누르면 THE SYSTEM SHALL `oauth/begin` 으로 state 를 발급하고 600×700 팝업에서 인가 URL 을 연다. (원본: INT-AU-01, NAV-IN-03)
- REQ-INTOAUTH-002 WHEN 사용자가 OAuth 통합을 추가하면 THE SYSTEM SHALL 서비스별 권장 기본값을 체크해 둔 권한 범위 체크박스를 보인다. (원본: INT-AU-06)
- REQ-INTOAUTH-003 WHEN 사용자가 Cafe24 통합을 추가하면 THE SYSTEM SHALL OAuth 를 시작하기 전에 상점 식별자와 앱 유형을 먼저 입력받는다.
- REQ-INTOAUTH-004 WHEN Cafe24 인가 URL 을 만들면 THE SYSTEM SHALL 권한 범위를 콤마로 구분한다.
- REQ-INTOAUTH-005 IF Cafe24 Public 앱 서버 환경 변수가 설정되지 않았으면 THE SYSTEM SHALL 서비스 목록 응답에 `publicAppAvailable=false` 를 싣고 화면은 Public 선택지를 숨긴다.
- REQ-INTOAUTH-006 WHEN 사용자가 Cafe24 Private 앱 통합을 제출하면 THE SYSTEM SHALL 팝업 없이 설치 대기 통합을 만들고 App URL·Redirect URI 를 담은 설정 안내 화면을 보인다.
- REQ-INTOAUTH-007 IF MakeShop 통합 폼의 Client ID 나 Client Secret 이 비어 있으면 THE SYSTEM SHALL 제출을 막는다.
- REQ-INTOAUTH-008 WHEN 사용자가 MakeShop 통합을 제출하면 THE SYSTEM SHALL 팝업 없이 설치 대기 통합을 만들고 설치 안내 화면을 보인다.
- REQ-INTOAUTH-009 WHILE 설정·설치 안내 화면이 열려 있는 동안 THE SYSTEM SHALL 그 통합을 3초마다 조회하고 연결됨이 되면 토스트를 띄운 뒤 상세 화면으로 이동한다.
- REQ-INTOAUTH-010 WHEN 안내 화면의 조회가 10분을 넘기면 THE SYSTEM SHALL 조회를 멈추고 «아직 대기 중» 안내를 보이며 재진입하거나 창에 포커스가 오면 다시 조회한다.
- REQ-INTOAUTH-011 IF 같은 워크스페이스에 같은 상점 식별자의 연결됨 Cafe24 통합이 있고 그 통합이 `new` 가 아닌 모드의 대상 통합(`integrationId`)이 아니면 THE SYSTEM SHALL Cafe24 `oauth/begin` 을 409 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 로 거절한다.
- REQ-INTOAUTH-012 WHEN Cafe24 Private `oauth/begin` 에 같은 상점의 Private 설치 대기 행이 있고 요청자가 그 행을 바꿀 수 있으면 THE SYSTEM SHALL 새 행을 만들지 않고 그 행을 재사용하며 `client_id`·`client_secret` 이 그대로이고 설치 토큰이 있으면 설치 토큰도 그대로 둔다.
- REQ-INTOAUTH-013 IF `oauth/begin` 이 `client_id`·`client_secret` 을 갖춘 Cafe24 Private 요청을 `new` 가 아닌 모드(`reauthorize`·`request_scopes`)로 받으면 THE SYSTEM SHALL 400 `CAFE24_PRIVATE_APP_USE_TEST_RUN` 으로 거절한다.
- REQ-INTOAUTH-014 WHEN App URL 호출의 HMAC 검증이 통과하고 통합이 설치 대기이면 THE SYSTEM SHALL OAuth state 를 만들고 인가 URL 로 302 한다.
- REQ-INTOAUTH-015 WHEN App URL 호출의 HMAC 검증이 통과하고 통합이 설치 대기가 아니며 유효한 재설치 대기 표시도 없으면 THE SYSTEM SHALL 프런트엔드 통합 상세 화면으로 302 한다.
- REQ-INTOAUTH-016 IF App URL 호출의 timestamp 가 ±5분 창 밖이면 THE SYSTEM SHALL 400 `CAFE24_INSTALL_REPLAY` 로 거절한다.
- REQ-INTOAUTH-017 IF 같은 IP 의 설치 토큰 조회·HMAC 검증 실패가 임계치를 넘으면 THE SYSTEM SHALL 429 `CAFE24_INSTALL_RATE_LIMITED` 로 거절한다.
- REQ-INTOAUTH-018 IF Cafe24 App URL 의 설치 토큰으로 행을 찾지 못하면 THE SYSTEM SHALL 같은 상점 식별자의 Cafe24 행 최대 5개 중 HMAC 이 맞는 행이 정확히 1개일 때만 그 행으로 진행한다.
- REQ-INTOAUTH-019 IF App URL 의 HMAC 검증이 실패하면 THE SYSTEM SHALL 실패 이유와 상관없이 같은 403 `CAFE24_INSTALL_INVALID_HMAC` 로 응답하고 `client_secret` 은 로그에 남기지 않는다.
- REQ-INTOAUTH-020 WHEN App URL 호출이 404 로 끝나고 요청이 `text/html` 을 받으면 THE SYSTEM SHALL 현재 App URL 을 확인하라는 안내가 담긴 HTML 페이지를 보인다.
- REQ-INTOAUTH-021 IF 콜백의 state 가 발급한 값과 맞지 않으면 THE SYSTEM SHALL 팝업에 `Security validation failed` 를 보이고 끝낸다.
- REQ-INTOAUTH-022 IF 콜백에 `error` 파라미터가 있으면 THE SYSTEM SHALL 팝업에 `Authorization denied` 를 보이고 끝낸다.
- REQ-INTOAUTH-023 WHEN 새 연결(`mode='new'`) 콜백의 토큰 교환이 성공하면 THE SYSTEM SHALL 토큰을 10분짜리 미리보기 토큰에 맡기고 `previewToken` 을 돌려준다.
- REQ-INTOAUTH-024 WHEN 통합 재인증 콜백이 성공하면 THE SYSTEM SHALL 자격 증명을 새 토큰으로 바꾸고 상태를 `connected` 로 되돌린다.
- REQ-INTOAUTH-025 WHEN 추가 권한 요청 콜백이 성공하면 THE SYSTEM SHALL 기존 권한 범위에 새 권한 범위를 합치고 토큰을 갱신한다.
- REQ-INTOAUTH-026 WHEN 통합 재인증·추가 권한 요청 콜백을 커밋하기 직전이고 통합이 설치 대기도 아니고 유효한 재설치 대기 표시가 있는 Cafe24 Private 통합도 아니면 THE SYSTEM SHALL 요청자의 가시성, 개인 통합의 편집자 하한, 조직 통합의 관리자 권한을 다시 판정하고 실패하면 롤백한다.
- REQ-INTOAUTH-027 WHEN 콜백 처리가 끝나면 THE SYSTEM SHALL `postMessage` 로 부모 창에 결과를 알리고 성공은 바로, 실패는 3~5초 뒤 팝업을 닫는다.
- REQ-INTOAUTH-028 IF OAuth 팝업이 5분 안에 돌아오지 않으면 THE SYSTEM SHALL 타임아웃 에러를 보이고 다시 시도할 수 있게 한다.
- REQ-INTOAUTH-029 IF 유효한 재설치 대기 표시가 없는 연결됨 통합의 통합 재인증 코드 교환이 실패하면 THE SYSTEM SHALL 상태를 `error(auth_failed)` 로 바꾸고 `last_error` 를 기록한다.
- REQ-INTOAUTH-030 IF Cafe24 가 `invalid_scope` 로 권한 범위를 거부하면 THE SYSTEM SHALL 상태를 보존하고 사유 `oauth_invalid_scope` 와 `last_error.details.requiresCafe24Approval` 을 기록한다.
- REQ-INTOAUTH-031 WHEN 사용자가 설치 토큰이 있는 Cafe24 Private 통합에 추가 권한 요청을 하면 THE SYSTEM SHALL OAuth 를 시작하지 않고 권한 범위를 합쳐 저장하며 통합이 설치 대기가 아니면 재설치 대기 표시를 남긴 뒤 `cafe24_private_pending` 응답을 돌려준다.
- REQ-INTOAUTH-032 WHEN 추가 권한 요청 응답이 `cafe24_private_pending` 이면 THE SYSTEM SHALL 권한 탭에 인라인 안내와 info 토스트를 보이고 통합을 다시 조회한다.
- REQ-INTOAUTH-033 WHEN 갱신 가능 통합으로 외부 API 를 부르기 직전 토큰이 만료됐거나 곧 만료되면 THE SYSTEM SHALL 토큰을 갱신한 뒤 부른다. (원본: INT-AU-04)
- REQ-INTOAUTH-034 WHEN Cafe24·MakeShop API 호출이 401 을 받으면 THE SYSTEM SHALL 토큰을 갱신하고 같은 요청을 한 번만 다시 시도한다.
- REQ-INTOAUTH-035 WHEN 토큰 갱신이 성공하면 THE SYSTEM SHALL `access_token`·`refresh_token`·`credentials.expires_at`·`token_expires_at` 네 값을 한 트랜잭션에서 함께 바꾸고 `last_rotated_at` 도 갱신한다.
- REQ-INTOAUTH-036 WHEN Cafe24 토큰 만료 시각을 정하면 THE SYSTEM SHALL JWT `exp`, `expires_in`, `expires_at` ISO, 2시간 기본값 순서로 처음 얻은 값을 쓴다.
- REQ-INTOAUTH-037 WHEN 호출 직전 갱신이나 배경 갱신을 큐에 넣으면 THE SYSTEM SHALL `jobId = integrationId` 로 같은 통합의 갱신을 클러스터에서 한 번만 실행한다.
- REQ-INTOAUTH-038 WHEN 401 뒤 갱신을 큐에 넣으면 THE SYSTEM SHALL 고유 `jobId` 로 중복 제거를 건너뛰고 DB 행 잠금으로 직렬화한다.
- REQ-INTOAUTH-039 IF 갱신 워커의 토큰 갱신이 실패하면 THE SYSTEM SHALL 작업을 실패로 남기고 큐 수준에서 다시 시도하지 않는다.
- REQ-INTOAUTH-040 IF 갱신 대상 통합이 이미 삭제됐으면 THE SYSTEM SHALL 작업을 실패로 보지 않고 아무것도 하지 않는다.
- REQ-INTOAUTH-041 WHEN MakeShop 토큰을 갱신하면 THE SYSTEM SHALL 매번 새로 받은 refresh token 을 저장한다.
- REQ-INTOAUTH-042 WHEN MakeShop 인가를 시작하면 THE SYSTEM SHALL PKCE S256 을 쓰고 권한 범위를 공백으로 구분한다.
- REQ-INTOAUTH-043 IF `oauth/begin` 이 `client_id`·`client_secret` 을 갖춘 MakeShop 요청을 `new` 가 아닌 모드(`reauthorize`·`request_scopes`)로 받으면 THE SYSTEM SHALL 400 `MAKESHOP_USE_SHOPSTORE_INSTALL` 로 거절하고 삭제 후 재등록을 안내한다.
- REQ-INTOAUTH-044 WHEN 사용자가 설치 토큰이 있고 설치 대기가 아닌 Cafe24 Private 통합에 통합 재인증을 요청하면 THE SYSTEM SHALL OAuth 를 시작하지 않고 재설치 대기 표시만 남긴 뒤 `cafe24_private_pending` 응답을 돌려준다.
- REQ-INTOAUTH-045 WHEN 통합 재인증이나 추가 권한 요청이 재설치 대기 표시를 남기면 THE SYSTEM SHALL 통합의 상태·상태 사유·토큰을 바꾸지 않는다.
- REQ-INTOAUTH-046 WHEN Cafe24 App URL 호출의 HMAC 검증이 통과하고 통합에 유효한 재설치 대기 표시가 있으면 THE SYSTEM SHALL 통합 상태와 상관없이 `mode='reauthorize'` OAuth state 를 만들고 인가 URL 로 302 한다.
- REQ-INTOAUTH-047 WHEN 재설치 대기 표시가 있는 통합의 콜백이 성공하면 THE SYSTEM SHALL 자격 증명 교체와 같은 트랜잭션에서 표시를 지운다.
- REQ-INTOAUTH-048 IF 유효한 재설치 대기 표시가 있는 통합의 콜백이 실패하면 THE SYSTEM SHALL 상태와 표시를 보존하고 `last_error` 를 기록한다.
- REQ-INTOAUTH-049 IF 설치 대기이거나 설치 토큰이 없는 Cafe24 Private 통합이나 MakeShop 통합에 통합 재인증을 요청하면 THE SYSTEM SHALL 400 으로 거절한다.
- REQ-INTOAUTH-050 IF 설치 토큰이 없는 Cafe24 Private 통합이나 MakeShop 통합에 추가 권한 요청을 하면 THE SYSTEM SHALL 400 으로 거절한다.
- REQ-INTOAUTH-051 WHEN MakeShop App URL 호출의 HMAC 검증이 통과하고 통합이 설치 대기가 아니면 THE SYSTEM SHALL 상세 화면으로 302 하고 그 통합의 자격 증명과 상태를 바꾸지 않는다.
- REQ-INTOAUTH-052 IF 통합이 설치 기한이 지나 만료됐거나(`status='expired'`, `status_reason='install_timeout'`) MakeShop 이거나 App URL 이 없는 Cafe24 Private 이면 THE SYSTEM SHALL 권한 탭의 권한 요청 버튼을 비활성으로 두고 이유 안내를 보인다.
- REQ-INTOAUTH-053 WHEN 재설치 대기 표시를 남긴 지 24시간이 지나면 THE SYSTEM SHALL App URL 분기와 콜백 처리에서 그 표시를 없는 것으로 판정한다.
- REQ-INTOAUTH-054 WHEN 재설치 대기 표시가 이미 있는 통합에 통합 재인증이나 추가 권한 요청을 하면 THE SYSTEM SHALL 표시를 새 시각으로 덮어써 유효 기간을 다시 센다.
- REQ-INTOAUTH-055 IF 설치 토큰이 없는 Cafe24 Private 통합에 통합 재인증이나 추가 권한 요청을 하면 THE SYSTEM SHALL `oauth/begin` 처리를 거치지 않고 400 `CAFE24_PRIVATE_APP_INSTALL_TOKEN_MISSING` 으로 거절한다.
- REQ-INTOAUTH-056 IF 설치 대기이고 설치 토큰이 있는 Cafe24 Private 통합에 통합 재인증을 요청하면 THE SYSTEM SHALL `oauth/begin` 처리를 거치지 않고 400 `CAFE24_PRIVATE_APP_USE_TEST_RUN` 으로 거절한다.
- REQ-INTOAUTH-057 WHEN 사용자가 Cafe24 Public 통합에 통합 재인증이나 추가 권한 요청을 하면 THE SYSTEM SHALL 그 통합의 `credentials.mall_id`·`credentials.app_type` 을 `oauth/begin` 처리에 넘겨 그 상점의 인가 URL 을 발급한다.
- REQ-INTOAUTH-058 IF Cafe24 Private `oauth/begin` 이 다시 쓸 같은 상점의 설치 대기 행이 요청자가 통합 소유자가 아닌 개인 통합이면 THE SYSTEM SHALL 409 `CAFE24_PRIVATE_APP_INSTALL_PENDING` 으로 거절한다.
- REQ-INTOAUTH-059 WHEN MakeShop `oauth/begin` 에 같은 `client_id` 의 설치 대기 행이 있고 요청자가 그 행을 바꿀 수 있으면 THE SYSTEM SHALL 새 행을 만들지 않고 그 행을 재사용한다.
- REQ-INTOAUTH-060 IF MakeShop `oauth/begin` 이 다시 쓸 설치 대기 행이 요청자가 통합 소유자가 아닌 개인 통합이면 THE SYSTEM SHALL 409 `MAKESHOP_INSTALL_PENDING` 으로 거절한다.
- REQ-INTOAUTH-061 WHEN 설치 대기 행 때문에 `oauth/begin` 을 409 `CAFE24_PRIVATE_APP_INSTALL_PENDING`·`MAKESHOP_INSTALL_PENDING` 으로 거절하면 THE SYSTEM SHALL 그 행의 통합 ID 와 App URL(`appUrl`)을 싣지 않고 설치 기한 `details.pendingInstallExpiresAt` 만 싣는다.
- REQ-INTOAUTH-062 IF `oauth/begin` 이 다시 쓸 설치 대기 행이 조직 통합이고 요청자가 관리자 미만이면 THE SYSTEM SHALL 403 `ADMIN_REQUIRED` 로 거절한다.
- REQ-INTOAUTH-063 IF 뷰어가 `oauth/begin` 을 부르면 THE SYSTEM SHALL 서비스와 모드에 상관없이 403 `EDITOR_REQUIRED` 로 거절한다.
- REQ-INTOAUTH-064 IF 관리자 미만이 조직 공개 범위로 `oauth/begin` 을 `new` 모드로 부르면 THE SYSTEM SHALL 다시 쓸 설치 대기 행을 찾거나 새로 만들기 전에 403 `ADMIN_REQUIRED` 로 거절한다.
- REQ-INTOAUTH-065 WHEN `oauth/begin`·설치 엔드포인트가 409 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`·`MAKESHOP_ALREADY_CONNECTED` 를 내면 THE SYSTEM SHALL 겹친 행의 통합 ID 를 응답에 싣지 않는다.
- REQ-INTOAUTH-066 WHEN `oauth/begin` 이 설치 대기 행을 다시 쓰면 THE SYSTEM SHALL 그 행을 잠근 뒤 재사용 권한을 판정하고 같은 트랜잭션에서 덮어쓴다. MakeShop 은 같은 `(workspace_id, client_id)` 의 begin 을 트랜잭션 잠금으로 줄 세운다.
- REQ-INTOAUTH-067 WHEN Cafe24 Private·MakeShop `oauth/begin` 이 설치 대기 행을 만들거나 다시 쓰면 THE SYSTEM SHALL 응답에 그 행의 공개 범위 `scope` 를 싣는다.
- REQ-INTOAUTH-068 WHEN 중복 사전 감지, `oauth/begin`, 설치 엔드포인트, 설치 토큰 불일치 회복이 같은 상점의 Cafe24·MakeShop 통합을 찾으면 THE SYSTEM SHALL 설치 기한이 지나 만료된 행(`status='expired'`, `status_reason='install_timeout'`)을 빼고 찾는다. `mall_id` 컬럼이 비어 `credentials.mall_id` 로 상점을 맞추는 행도 같다.
- REQ-INTOAUTH-069 IF 설치 엔드포인트 처리 중 에러 코드가 없고 `HttpException` 도 아닌 예외가 나면 THE SYSTEM SHALL 500 `CAFE24_INSTALL_FAILED`·`MAKESHOP_INSTALL_FAILED` 와 고정 문구로 답하고 예외 원문은 `requestId` 와 함께 서버 로그에만 남긴다.
- REQ-INTOAUTH-070 WHEN 설치 엔드포인트가 실패로 답하면 THE SYSTEM SHALL JSON 본문과 HTML 페이지 모두에 응답마다 새로 발급한 `requestId` 를 싣는다.
- REQ-INTOAUTH-071 IF `oauth/begin` 이 `new` 가 아닌 모드로 받은 본문의 `service` 가 대상 통합(`integrationId`)의 서비스 유형과 다르거나 Cafe24 본문의 상점 식별자·앱 유형이 대상 통합의 `credentials.mall_id`·`credentials.app_type` 과 다르면 THE SYSTEM SHALL state 를 만들지 않고 400 `OAUTH_TARGET_MISMATCH` 로 거절한다.
- REQ-INTOAUTH-072 IF MakeShop 통합에 통합 재인증이나 추가 권한 요청을 하면 THE SYSTEM SHALL 400 `MAKESHOP_CREDENTIALS_REQUIRED` 로 거절한다.

## 하위 문서

요구사항마다 정본 하위 문서를 하나만 둔다. 여러 흐름에 걸친 요구사항(003 은 Cafe24 추가 화면, 046 은 재설치 대기 표시, 057 은 `:id/reauthorize`·`:id/request-scopes`)은 그 주제의 하위 문서에 둔다.

- [연결 시작(begin)](CLE-INT-OAUTH-BEGIN.md): `oauth/begin` 진입점 · 요청과 응답 · 같은 상점 검사 · 역할 판정 · 대상 통합 대조, 제공자별 설정(인가 · 토큰 URL, 권한 범위 구분). 요구사항 004·011·013·042·043·063·064·065·071
- [설치 대기 행 재사용](CLE-INT-OAUTH-PENDING.md): Cafe24 Private·MakeShop 설치 대기 행 재사용의 권한 · 잠금 · 동시 begin 경합, 만료된 설치 대기 행의 상점 자리. 요구사항 012·058·059·060·061·062·066·067·068
- [설치 우선 흐름과 App URL](CLE-INT-OAUTH-INSTALL.md): 설치 우선 흐름의 설정 · 설치 안내 화면과 자동 조회, App URL(설치 엔드포인트)의 가드 순서 · 보안 계층 · 설치 토큰 불일치 회복 · 실패 응답. 요구사항 003·006·007·008·009·010·014·015·016·017·018·019·020·051·069·070
- [팝업 연결과 콜백](CLE-INT-OAUTH-CALLBACK.md): 팝업 연결(Google·GitHub·Cafe24 Public)과 팝업 복귀, OAuth 콜백의 처리 순서 · 에러 매핑. 요구사항 001·002·005·021·022·023·024·025·026·027·028·029·030·047·048
- [재인증과 추가 권한 요청](CLE-INT-OAUTH-REAUTH.md): `:id/reauthorize`·`:id/request-scopes`, Cafe24 Private 재설치 대기 표시, 권한 탭, Cafe24 Private·MakeShop 의 복구 경로. 요구사항 031·032·044·045·046·049·050·052·053·054·055·056·057·072
- [토큰 자동 갱신](CLE-INT-OAUTH-REFRESH.md): 토큰 자동 갱신의 경로, 만료 시각의 기준, 갱신 큐. 요구사항 033·034·035·036·037·038·039·040·041

요구사항 번호는 `REQ-INTOAUTH-` 뒤의 숫자다.

## 옮긴 절

다른 문서가 링크하는 절은 하위 문서로 옮겼다.

### `oauth/begin` 요청과 응답

→ [연결 시작(begin)](CLE-INT-OAUTH-BEGIN.md#oauthbegin-요청과-응답)

### 설치 대기 행 재사용의 권한

→ [설치 대기 행 재사용](CLE-INT-OAUTH-PENDING.md#설치-대기-행-재사용의-권한)

### 설치 우선 흐름: Cafe24 Private·MakeShop

→ [설치 우선 흐름과 App URL](CLE-INT-OAUTH-INSTALL.md#설치-우선-흐름-cafe24-privatemakeshop)

### 설치 엔드포인트 (App URL)

→ [설치 우선 흐름과 App URL](CLE-INT-OAUTH-INSTALL.md#설치-엔드포인트-app-url)

### OAuth 콜백 엔드포인트

→ [팝업 연결과 콜백](CLE-INT-OAUTH-CALLBACK.md#oauth-콜백-엔드포인트)

### 처리 순서

→ [팝업 연결과 콜백](CLE-INT-OAUTH-CALLBACK.md#처리-순서)

### 에러 매핑

→ [팝업 연결과 콜백](CLE-INT-OAUTH-CALLBACK.md#에러-매핑)

### 통합 재인증과 추가 권한 요청

→ [재인증과 추가 권한 요청](CLE-INT-OAUTH-REAUTH.md#통합-재인증과-추가-권한-요청)

### 재설치 대기 표시

→ [재인증과 추가 권한 요청](CLE-INT-OAUTH-REAUTH.md#재설치-대기-표시)

### 권한 탭 (OAuth 통합만)

→ [재인증과 추가 권한 요청](CLE-INT-OAUTH-REAUTH.md#권한-탭-oauth-통합만)

### 만료 시각의 기준

→ [토큰 자동 갱신](CLE-INT-OAUTH-REFRESH.md#만료-시각의-기준)

### 갱신 큐

→ [토큰 자동 갱신](CLE-INT-OAUTH-REFRESH.md#갱신-큐)

## Rationale

주제별 결정은 각 하위 문서의 Rationale 에 있다. 다른 문서가 링크하는 결정은 아래에서 옮긴 위치로 안내한다.

### `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 이름을 유지한다

→ [연결 시작(begin)](CLE-INT-OAUTH-BEGIN.md#cafe24_private_app_already_connected-이름을-유지한다)

### `new` 가 아닌 모드의 begin 은 본문이 대상 통합과 다르면 거절한다 (2026-11-06)

→ [연결 시작(begin)](CLE-INT-OAUTH-BEGIN.md#new-가-아닌-모드의-begin-은-본문이-대상-통합과-다르면-거절한다-2026-11-06)

### 남의 개인 설치 대기 행은 409 로 거절한다 (2026-10-24)

→ [설치 대기 행 재사용](CLE-INT-OAUTH-PENDING.md#남의-개인-설치-대기-행은-409-로-거절한다-2026-10-24)

### 만료된 설치 대기 행은 상점 자리를 놓는다 (2026-10-29)

→ [설치 대기 행 재사용](CLE-INT-OAUTH-PENDING.md#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29)

### 설치 토큰을 App URL 경로의 식별 키로 올렸다

→ [설치 우선 흐름과 App URL](CLE-INT-OAUTH-INSTALL.md#설치-토큰을-app-url-경로의-식별-키로-올렸다)

### 설치 토큰 불일치 회복 흐름

→ [설치 우선 흐름과 App URL](CLE-INT-OAUTH-INSTALL.md#설치-토큰-불일치-회복-흐름)

### Cafe24 별도 승인 권한 범위는 막지 않고 안내한다

→ [팝업 연결과 콜백](CLE-INT-OAUTH-CALLBACK.md#cafe24-별도-승인-권한-범위는-막지-않고-안내한다)

### Cafe24 Private 이 오류가 되면 삭제 후 재등록만 된다

→ [재인증과 추가 권한 요청](CLE-INT-OAUTH-REAUTH.md#cafe24-private-이-오류가-되면-삭제-후-재등록만-된다)

### MakeShop 은 삭제 후 재등록으로만 복구한다

→ [재인증과 추가 권한 요청](CLE-INT-OAUTH-REAUTH.md#makeshop-은-삭제-후-재등록으로만-복구한다)

### `CAFE24_PRIVATE_APP_USE_TEST_RUN`·`MAKESHOP_USE_SHOPSTORE_INSTALL` 이름을 유지한다

→ [재인증과 추가 권한 요청](CLE-INT-OAUTH-REAUTH.md#cafe24_private_app_use_test_runmakeshop_use_shopstore_install-이름을-유지한다)

### 여러 인스턴스의 갱신 경쟁은 BullMQ `jobId` 중복 제거로 푼다

→ [토큰 자동 갱신](CLE-INT-OAUTH-REFRESH.md#여러-인스턴스의-갱신-경쟁은-bullmq-jobid-중복-제거로-푼다)

### 401 을 받으면 갱신하고 한 번 다시 보낸다

→ [토큰 자동 갱신](CLE-INT-OAUTH-REFRESH.md#401-을-받으면-갱신하고-한-번-다시-보낸다)

### Cafe24 토큰 만료 시각의 기준을 JWT `exp` 로 올렸다

→ [토큰 자동 갱신](CLE-INT-OAUTH-REFRESH.md#cafe24-토큰-만료-시각의-기준을-jwt-exp-로-올렸다)

### `reactive_401` 은 고유 jobId 로 중복 제거를 완전히 건너뛴다

→ [토큰 자동 갱신](CLE-INT-OAUTH-REFRESH.md#reactive_401-은-고유-jobid-로-중복-제거를-완전히-건너뛴다)

### 요구사항 변경 이력 (2026-10-10, Task CLE-T-NNENG8)

다음 요구사항의 뜻이 바뀌었다. 번호는 그대로 둔다.

- REQ-INTOAUTH-013: `reauthorize` 만 적던 것을 `new` 가 아닌 모드 전체로 넓히고 `client_id`·`client_secret` 을 갖춘 `oauth/begin` 요청이라는 조건과 400 을 적었다. `:id/reauthorize` 는 더 이상 이 거절에 기대지 않는다.
- REQ-INTOAUTH-015: 상세 화면 302 조건에 «유효한 재설치 대기 표시가 없음» 을 더했다.
- REQ-INTOAUTH-026: 인가 재판정에서 빼는 행(설치 대기, 유효한 재설치 대기 표시가 있는 Cafe24 Private 행)을 요구사항에 적었다. 설치 대기 제외는 전에도 본문에 있었다.
- REQ-INTOAUTH-029: 유효한 재설치 대기 표시가 있는 연결됨 행을 뺐다. 그 행은 REQ-INTOAUTH-048 을 따른다.
- REQ-INTOAUTH-031: 설치 토큰이 있는 행으로 좁히고 설치 대기가 아니면 재설치 대기 표시를 남기게 했다.
- REQ-INTOAUTH-032: «부모 화면을 다시 조회하지 않는다» 를 «통합을 다시 조회한다» 로 뒤집었다.
- REQ-INTOAUTH-043: `client_id`·`client_secret` 을 갖춘 `oauth/begin` 요청이라는 조건, 400, 삭제 후 재등록 안내를 더했다.

새 요구사항은 REQ-INTOAUTH-044 부터다.

### 요구사항 변경 이력 (2026-10-15, Task CLE-T-WB7JPC)

다음 요구사항의 뜻이 바뀌었다. 번호는 그대로 둔다.

- REQ-INTOAUTH-011: `new` 가 아닌 모드의 대상 통합(`integrationId`)을 중복 검사에서 뺐다. 대상이 아닌 연결됨 행은 그대로 409 다.

새로 더한 요구사항은 REQ-INTOAUTH-055~057 이다. REQ-INTOAUTH-049·050 은 그대로 두고 Cafe24 Private 통합의 코드를 REQ-INTOAUTH-055·056 에 정했다. MakeShop 통합의 코드는 그때 미결 사항에 남겼고 2026-11-13 에 REQ-INTOAUTH-072 로 정했다.


### 요구사항 변경 이력 (2026-10-24, Task CLE-T-MG0EQZ)

다음 요구사항의 뜻이 바뀌었다. 번호는 그대로 둔다.

- REQ-INTOAUTH-012: 재사용 조건에 «요청자가 그 행을 바꿀 수 있으면» 을 더했다. 그 밖의 경우는 REQ-INTOAUTH-058·062 를 따른다. «설치 토큰째 재사용한다» 던 것도 코드에 맞춰 고쳤다. `client_id`·`client_secret` 가운데 하나라도 바뀌면 설치 토큰을 새로 발급한다(2026-10-24 코드 확인). 보존하는 이유는 사용자가 외부 콘솔에 처음 등록한 App URL 이 begin 을 다시 불러도 유효해야 해서다(2026-05-15 운영 보고). 발급 시각(`install_token_issued_at`)도 토큰을 새로 발급할 때만 바꾼다. 보존과 재발급의 조건은 2026-05-15 커밋 `f3db9209b` 가 정했다. 그 전에는 재사용할 때마다 새로 발급했다. 그 커밋은 옛 동작의 의도가 보안을 위한 회전이었지만 운영에서 낸 효과는 사용자가 막 등록한 URL 을 무효로 만든 것뿐이었다고 적는다. 그래서 자격 증명(`mall_id`·`client_id`·`client_secret`)이 같으면 보존하고, 자격 증명이 다르거나(사용자가 `client_id` 등을 바꿔 다시 시도한 경우) 설치 토큰이 없을 때만 새로 발급하게 했다. 자격 증명이 다를 때 새로 발급하는 이유는 그 커밋에 따로 적혀 있지 않다. 요구사항 문장에는 «설치 토큰이 있으면» 을 조건으로 넣었다. 설치 토큰이 없는 옛 행은 자격 증명이 같아도 새로 발급하기 때문이다(finding 01a16e25-ca25-70ff-bba4-e76f55bd9e0d).
- REQ-INTOAUTH-026: 콜백의 커밋 직전 재판정에 개인 통합의 편집자 하한을 더했다. begin 은 라우트 가드가 뷰어를 막는데 시작과 콜백 사이에 뷰어로 강등된 요청자는 콜백에서 막히지 않았다(finding 01a16e25-6561-717a-999a-88cc990d8450).

새 요구사항은 REQ-INTOAUTH-058 부터다. REQ-INTOAUTH-059 는 본문에만 있던 MakeShop 설치 대기 행 재사용을 같은 조건으로 요구사항에 올린 것이다. REQ-INTOAUTH-066·067 은 2026-10-25 에 더했다.

### 요구사항 변경 이력 (2026-10-30, Task CLE-T-395HK2)

다음 요구사항의 뜻이 바뀌었다. 번호는 그대로 둔다.

- REQ-INTOAUTH-052: 권한 요청 버튼을 막는 조건에 설치 기한이 지나 만료된 통합(`status='expired'`, `status_reason='install_timeout'`)을 더했다. 같은 Task 의 코드 수정으로 화면이 이 이유를 먼저 판정하고 이 통합을 지우지 않고 같은 상점을 새로 등록하라고 안내한다. 이 통합은 MakeShop 이거나 App URL 이 없는 Cafe24 Private 이라 버튼은 그 전에도 막혔다. 바뀐 것은 이유와 안내다.


### 요구사항 추가 이력

- 2026-10-29: REQ-INTOAUTH-068 (만료된 설치 대기 행은 상점 자리를 놓는다). 2026-10-30 에 구현했다.
- 2026-11-06: REQ-INTOAUTH-069·070 (설치 엔드포인트의 예상 밖 예외), REQ-INTOAUTH-071 (`new` 가 아닌 모드의 대상 통합 대조).
- 2026-11-13: REQ-INTOAUTH-072 (MakeShop 통합 재인증 · 추가 권한 요청의 거절 코드). REQ-INTOAUTH-049·050 의 뜻은 바꾸지 않았다.
