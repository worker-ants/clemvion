---
id: "CLE-INT-OAUTH-REAUTH"
title: "OAuth 연결과 토큰 갱신 — 재인증과 추가 권한 요청"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT-OAUTH"
ancestors: ["CLE-VISION", "CLE-INT", "CLE-INT-OAUTH"]
area: "CLE-INT"
content_hash: "1b61f4f963aea79affb629acc5907d97129ea7fb65fe71942689de027d76a5ea"
read_as: "approved_fallback"
task: "CLE-T-ZCEZ46"
source_paths: []
mirror_sha256: "73b4e582ca1a28b741c4bf1b0fc12f74c02e5bc50cec240196cd6b902ff395d6"
etag: "sha256-5081ff9671c2894fb5eddb0c9d178bf3df287b819075b3c3b95c99d24e13e212"
---
## 개요

이 문서는 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md) 의 하위 문서로 통합 재인증과 추가 권한 요청 엔드포인트, Cafe24 Private 의 재설치 대기 표시, 상세 화면의 권한 탭을 정한다.

## 통합 재인증과 추가 권한 요청

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/integrations/:id/reauthorize` | OAuth 통합 재인증용 `authUrl` 을 발급한다. OAuth 가 아닌 통합은 바로 연결됨으로 되돌린다. 설치 토큰이 있고 설치 대기가 아닌 Cafe24 Private 통합은 재설치 대기 표시를 남기고 `cafe24_private_pending` 을 돌려준다. 400 거절은 아래 표 |
| POST | `/api/integrations/:id/request-scopes` | 추가 권한 요청. 본문 `{ scopes: string[] }`. 응답은 아래 두 갈래다. 400 거절은 아래 표 |

두 엔드포인트는 가시성과 관리자 판정(404·403)을 먼저 한다. 아래 400 거절은 그 판정을 통과한 요청에만 한다. 뷰어는 그보다 앞에서 라우트 가드가 `403 EDITOR_REQUIRED` 로 거절한다([통합 관리](CLE-INT-MANAGE.md)).

| 행 | `:id/reauthorize` | `:id/request-scopes` |
| --- | --- | --- |
| 설치 대기 Cafe24 Private | 400 `CAFE24_PRIVATE_APP_USE_TEST_RUN` | 권한 범위만 합쳐 저장하고 `cafe24_private_pending` 을 돌려준다 |
| 설치 토큰이 없는 Cafe24 Private | 400 `CAFE24_PRIVATE_APP_INSTALL_TOKEN_MISSING` | 400 `CAFE24_PRIVATE_APP_INSTALL_TOKEN_MISSING` |
| MakeShop | 400 `MAKESHOP_CREDENTIALS_REQUIRED` | 400 `MAKESHOP_CREDENTIALS_REQUIRED` |

- Cafe24 Private 코드의 목록은 [통합 관리 「에러 코드」](CLE-INT-MANAGE.md#에러-코드) 에 있다.
- MakeShop 은 통합 재인증과 추가 권한 요청을 지원하지 않는다([REQ-INTOAUTH-072](CLE-INT-OAUTH.md#요구사항)). 복구는 삭제 후 재등록이다([MakeShop 은 삭제 후 재등록으로만 복구한다](#makeshop-은-삭제-후-재등록으로만-복구한다)).

추가 권한 요청 응답은 백엔드가 제공자에 따라 모양을 정하고 프런트엔드는 모양만 보고 화면을 나눈다.

- **일반 OAuth 제공자(Google·GitHub·Cafe24 Public)**: `{ authUrl }`. 새 창으로 OAuth 팝업을 열고 성공 토스트("Scope request window opened" / "권한 요청 창을 열었어요")를 띄운다. 팝업이 성공으로 닫히면 부모 화면이 합쳐진 `credentials.scopes` 를 다시 조회한다.
- **Cafe24 Private**: `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded: string[] }`. 우리 서버가 OAuth 를 시작할 수 없어 팝업이 없다. 백엔드는 begin 을 부르지 않고 설치 토큰을 보존한 채 `credentials.scopes` 만 합쳐 저장한다. 설치 대기가 아니면 재설치 대기 표시도 남긴다. 사용자가 Cafe24 개발자 센터의 앱 권한에서 추가 권한을 켠 뒤 24시간 안에 «테스트 실행» 을 다시 누르면 App URL 이 표시를 보고 OAuth 로 보내 넓어진 권한의 새 토큰을 받는다. 설치 대기 행은 표시 없이도 App URL 이 OAuth 로 보낸다.

`/:id/reauthorize` 의 Cafe24 Private 응답은 `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl }` 다. 추가 권한 요청의 Private 응답과 같은 모양이고 `scopesAdded` 만 없다.

### 재설치 대기 표시

Cafe24 Private 통합은 우리 서버가 OAuth 를 시작할 수 없다. 그래서 설치를 마친 통합에 통합 재인증이나 추가 권한 요청을 하면 행에 재설치 대기 표시(reinstall request mark)를 남기고 사용자가 Cafe24 개발자 센터에서 «테스트 실행» 을 누르게 한다. «테스트 실행» 이 부른 App URL 이 표시를 보고 OAuth 인가로 보낸다. 표시는 `integration.reinstall_requested_at`(TIMESTAMPTZ, NULL 이면 표시 없음) 컬럼이고 API 응답에는 `reinstallRequestedAt`(ISO 8601 또는 `null`)로 나간다. 컬럼 정의는 [엔티티와 인덱스](CLE-INT-DATA-ENTITY.md#통합-integration), 상태 모델과의 관계와 24시간 유효 기간은 [상태 모델 「재설치 대기 표시」](CLE-INT-STATUS-MODEL.md#재설치-대기-표시)가 정한다. 이 절은 표시를 남기는 엔드포인트와 App URL 분기를 정한다.

| 시점 | 동작 |
| --- | --- |
| `POST /:id/reauthorize` (설치 토큰 있음, 설치 대기 아님) | 판정한 행에 조건부 UPDATE 로 `reinstall_requested_at=now()` 만 쓴다. 이미 표시가 있으면 새 시각으로 덮어써 24시간을 다시 센다. 그 사이 행이 지워졌으면 404 `RESOURCE_NOT_FOUND` 다 |
| `POST /:id/request-scopes` (설치 토큰 있음) | `credentials.scopes` 에 새 권한 범위를 합쳐 저장한다. 설치 대기가 아니면 같은 저장에서 표시도 남긴다(이미 있으면 새 시각으로 덮어쓴다) |
| App URL (HMAC 통과) | 표시가 유효하면 상태(연결됨·오류·만료됨)와 상관없이 설치 대기와 같게 `mode='reauthorize'` state 를 만들고 인가 URL 로 302 한다. 새 mode 는 두지 않는다. 유효하지 않은 표시는 없는 것으로 보고 상세 화면으로 302 한다 |
| 콜백 성공 | 자격 증명 교체와 같은 트랜잭션에서 표시를 NULL 로 지운다. 상태는 `connected`, 상태 사유는 NULL 이 된다. 그 뒤의 «앱으로 가기» 는 다시 상세 화면으로 간다 |
| 콜백 실패 | 표시를 지우지 않는다. 상태 기록은 [상태 모델 「콜백 실패 기록」](CLE-INT-STATUS-MODEL.md#콜백-실패-기록)을 따른다 |
| 표시를 남긴 지 24시간 경과 | 표시가 없는 것으로 본다([상태 모델 「재설치 대기 표시」](CLE-INT-STATUS-MODEL.md#재설치-대기-표시)) |
| 통합 삭제 | 행과 함께 사라진다 |

- 표시를 남겨도 상태·상태 사유·자격 증명·토큰은 그대로다. 연결됨 행은 기존 토큰으로 계속 실행되고 오류·만료됨 행은 콜백이 성공할 때까지 노드 실행이 막힌다.
- **표시는 24시간 동안만 유효하다.** 경계, 지난 값의 처리, 취소 경로가 없다는 것은 [상태 모델 「재설치 대기 표시」](CLE-INT-STATUS-MODEL.md#재설치-대기-표시)가 정한다. 콜백이 성공하면 24시간이 지나기 전이라도 표시를 지운다.
- 설치 대기 24시간 만료 스캐너, 연결됨 만료 스캐너, 주의 필요 술어, 알림은 표시를 보지 않는다. 상태 사유 값도 늘리지 않는다([상태 모델 「재설치 대기 표시」](CLE-INT-STATUS-MODEL.md#재설치-대기-표시)).
- 설치 대기 행에는 표시를 남기지 않는다. 설치 대기 행은 표시 없이도 App URL 이 OAuth 로 보낸다. 설치 대기 Private 행의 통합 재인증은 400 으로 거절된다. 추가 권한 요청은 권한 범위만 합쳐 저장하고 `cafe24_private_pending` 을 돌려준다.
- 설치 토큰이 없는 Private 행(24시간 설치 기한을 넘긴 행, 설치 토큰 보존 전에 연결된 옛 행)은 App URL 이 없어 표시를 남겨도 쓸 곳이 없다. 이 행의 통합 재인증과 추가 권한 요청은 400 으로 거절되고 복구는 같은 상점을 새로 등록하는 것이다. 설치 토큰 보존 전에 연결된 옛 행은 상점 자리를 잡고 있어 먼저 지운다. 설치 기한을 넘긴 행은 상점 자리를 놓았으므로 지우지 않아도 된다([만료된 설치 대기 행은 상점 자리를 놓는다](CLE-INT-OAUTH-PENDING.md#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29)). 화면은 두 버튼을 막는다.
- **유효한 표시가 있는 Cafe24 Private 행은 콜백의 인가 재판정을 건너뛴다.** 이유와 받아들인 잔여 위험은 [상태 모델 「재설치 대기 표시 동안의 콜백은 요청자를 다시 판정하지 않는다 (2026-11-14)」](CLE-INT-STATUS-MODEL.md#재설치-대기-표시-동안의-콜백은-요청자를-다시-판정하지-않는다-2026-11-14)가 정한다. Cafe24 Public 행과 MakeShop 행은 늘 다시 판정한다.
- 표시를 남길 때와 그 콜백이 성공할 때 감사 로그는 남지 않는다. `integration.reauthorized` 는 OAuth 가 아닌 통합의 초기화 경로에서만 남는다([통합 관리](CLE-INT-MANAGE.md#감사-로그)).
- 화면: 상세 화면 머리 아래의 재설치 대기 안내와 보안 탭 통합 재인증 버튼은 [통합 관리](CLE-INT-MANAGE.md#상세-페이지)가 정한다.

### 권한 탭 (OAuth 통합만)

상세 화면의 `Scope & Permissions` 탭이다. OAuth 가 아닌 통합에서는 숨긴다.

| 요소 | 설명 |
| --- | --- |
| 현재 권한 범위 | `credentials.scopes[]` 전체를 체크된 상태로 보인다 |
| 권장 권한 범위 | 서비스별 프리셋. 현재 권한에 없는 항목은 체크를 풀어 보인다 |
| 누락 권한 배지 | `status_reason = insufficient_scope` 면 누락 권한 범위를 빨간 배지로 강조한다 |
| 별도 승인 ⚠ 배지 | 현재·권장·누락 권한의 각 항목 옆에, 백엔드 메타데이터의 `restrictedApproval`(또는 begin 응답의 같은 정보)이 있는 권한 범위·operation 만 ⚠ 배지를 자동으로 보인다. tooltip 은 [Cafe24 별도 승인 scope](CLE-C24-SCOPES) 의 i18n 문구다. `[Request scopes]` 버튼 위에 «추가하려는 scope 중 N개는 카페24 별도 승인 필요» 보조 문구(N 은 교집합 크기)를 보인다. `status_reason='oauth_invalid_scope'` 이거나 `INSUFFICIENT_SCOPE` 응답의 `details.requiresCafe24Approval` 이 채워져 있으면 «이 권한은 카페24 별도 승인이 필요해요» 분기 메시지를 더 보인다 |
| `[Request scopes]` 버튼 | 체크한 추가 권한 범위로 `POST /api/integrations/:id/request-scopes` 를 부른다. 설치 기한이 지나 만료된 통합, MakeShop 통합, App URL 이 없는 Cafe24 Private 통합에서는 비활성이고 이유 안내를 함께 보인다. 이유 값은 `install_timeout`·`makeshop`·`no_app_url` 이고 이 순서로 판정한다(`requestScopesDisabledReason`). 설치 기한 만료는 «권한을 추가할 수 없으니 이 통합을 지우지 않고 필요한 권한으로 같은 상점을 새로 등록하라. 이름이 겹치면 다른 이름을 쓰라»(사전 키 `integrations.requestScopesDisabledInstallTimeout`), MakeShop 은 «권한을 추가할 수 없으니 통합을 삭제한 뒤 필요한 권한으로 다시 등록하라», Private 은 «App URL 이 없어 권한을 추가할 수 없으니 삭제한 뒤 다시 등록하라» 는 뜻이다. 설치 기한 만료를 먼저 보는 순서는 [통합 관리](CLE-INT-MANAGE.md) 의 통합 재인증 비활성 이유와 같다 |

Cafe24 Private 응답(`cafe24_private_pending`)의 화면:

- 공통 인라인 안내 패턴([레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md))의 경고(amber) 톤을 쓴다. 권한 카드 안에 계속 보이고 다음 요청 때 초기화한다.
- 제목: "Cafe24 Developers 에서 권한을 추가해 주세요" / "Grant the additional scopes in Cafe24 Developers"
- 설명: "Cafe24 Developers 의 앱 권한 설정에서 추가 scope 를 활성화한 뒤 '테스트 실행' 을 다시 누르면 새 token 으로 갱신됩니다. (Private 앱은 외부에서 OAuth 화면을 띄울 수 없어 Cafe24 측 작업이 필요해요.)" / "Enable the additional scopes in your Cafe24 Developers app permission settings, then click 'Test run' again to refresh the token with the new scopes. (Private apps cannot initiate the OAuth flow externally, so the action must happen on Cafe24.)"
- `scopesAdded` 가 비어 있지 않으면 목록을 작은 칩으로 안내 안에 보인다("Scopes added: [scope_a] [scope_b]"). 빈 배열이면 칩 영역을 보이지 않는다.
- 안내와 함께 info 토스트를 한 번 띄워 응답이 왔음을 알린다. 본문은 안내가 맡는다.
- 응답을 받으면 통합을 다시 조회한다. 서버가 합친 권한 범위와 재설치 대기 표시를 저장했으므로 상세 화면 머리 아래의 재설치 대기 안내가 바로 보인다. 토큰은 «테스트 실행» 뒤 콜백에서 바뀐다.

통합 재인증 버튼의 비활성 조건은 [통합 관리](CLE-INT-MANAGE.md) 의 상세 화면이 정한다.

## 구현 위치

- `codebase/backend/migrations/V151__integration_reinstall_requested_at.sql` (재설치 대기 표시 컬럼)
- `codebase/backend/src/modules/integrations/entities/integration.entity.ts` (`reinstallRequestedAt`)
- `codebase/backend/src/modules/integrations/integrations.constants.ts` (설치 기한과 재설치 대기 표시 유효 기간의 24시간 상수 `PENDING_INSTALL_TTL_HOURS`·`REINSTALL_REQUEST_TTL_HOURS`)
- `codebase/backend/src/modules/integrations/reinstall-request.ts` (표시의 24시간 유효 판정 `isReinstallRequestActive`, App URL 분기 `isInstallFlowRow`, `isCafe24PrivateRow`)
- `codebase/backend/src/modules/integrations/integrations.service.ts` (`reauthorize`·`requestScopes`, `isCafe24PrivateWithInstallToken`·`buildCafe24PrivatePendingResult`)
- `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (`reinstallRequestedAt`)
- `codebase/frontend/src/lib/integrations/reauthorize.ts` (`reauthorizeDisabledReason`·`requestScopesDisabledReason`)
- `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/scope-tab.tsx` (권한 탭), `reinstall-requested-notice.tsx` (재설치 대기 안내), `page.tsx` (상세 화면)

## Rationale

### Cafe24 Private 추가 권한 요청은 begin 을 우회한다

Cafe24 Private 은 우리 서버가 OAuth 를 시작할 수 없어 `reauthorize` begin 이 `CAFE24_PRIVATE_APP_USE_TEST_RUN` 으로 거절한다. 옛 `/request-scopes` 는 안에서 begin 을 불러 같은 거절에 걸렸고(겉으로는 `CAFE24_INVALID_MALL_ID` 가 보였다), `mall_id` 를 `providerMeta` 로 넘기지 않아 누락 거절도 났다.

그래서 추가 권한 요청이 Cafe24 Private 을 감지하면 begin 을 부르지 않고 설치 토큰을 보존한 채 권한 범위만 합쳐 저장하고 `cafe24_private_pending` 을 돌려주게 했다. 사용자가 Cafe24 쪽에서 권한을 켜고 «테스트 실행» 을 누르면 넓어진 권한의 새 토큰으로 바뀐다는 것이 이 결정의 가정이다. 그 가정이 App URL 분기와 맞지 않던 문제는 아래 2026-10-10 번복에서 풀었다. 권한을 미리 합쳐 두는 것은 설치 처리가 `OAuthState.requestedScopes` 를 채울 때 그 값을 쓰기 때문이다.

화면은 모달이 아니라 인라인 안내와 info 토스트로 정했다. 사용자는 Cafe24 쪽 작업 동안 안내를 계속 봐야 하는데 모달은 닫으면 잊힌다. 당시에는 토큰 갱신을 Cafe24 쪽 후속 콜백이 맡아 바로 다시 조회해도 변화가 없다고 보았다(2026-10-10 번복 뒤에는 응답 뒤 다시 조회한다). 안내와 토스트의 역할 분리, 수명, 톤 규칙은 [레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md) 의 공통 패턴이 정한다.

**2026-10-10 번복(Task CLE-T-NNENG8)**: 연결됨인 Private 통합에서 권한을 더한 뒤 «테스트 실행» 을 눌러도 App URL 이 상세 화면으로 보내 새 토큰을 받을 길이 없었다. 추가 권한 요청이 행에 아무 흔적도 남기지 않았기 때문이다. 그래서 추가 권한 요청과 통합 재인증이 행에 [재설치 대기 표시](#재설치-대기-표시)를 남기고 App URL 이 표시를 보면 OAuth 로 보내게 했다(선택지 ①). 이제 두 엔드포인트 모두 설치 토큰이 있는 Private 행에서 begin 을 우회하고 같은 `cafe24_private_pending` 응답을 돌려준다. 응답 뒤 화면은 통합을 다시 조회한다. 토큰은 그대로지만 표시가 생겨 상세 화면의 재설치 대기 안내를 바로 보여야 하기 때문이다. 기각한 선택지는 둘이다.

- ② App URL 이 권한 범위 불일치를 감지해 OAuth 로 보낸다: 권한 범위가 그대로인 통합 재인증(토큰 오류 복구)에는 불일치가 없어 OAuth 로 갈 수 없다.
- ③ 삭제 후 재등록만 둔다: 그 통합을 쓰는 노드의 참조를 모두 바꿔야 하고 사용처가 남아 있으면 삭제가 409 `INTEGRATION_IN_USE` 로 막힌다. Cafe24 개발자 센터의 «테스트 실행» 은 언제든 App URL 을 다시 부를 수 있어 우리 쪽 표시만으로 OAuth 를 다시 열 수 있다. MakeShop 은 이 전제가 맞지 않아 ③ 을 택했다([MakeShop 은 삭제 후 재등록으로만 복구한다](#makeshop-은-삭제-후-재등록으로만-복구한다)).

### Cafe24 Private 이 오류가 되면 삭제 후 재등록만 된다

처음 결정은 다음과 같았다. 일반 OAuth 제공자는 `expired` 를 통합 재인증이나 자동 갱신으로 되살린다. Cafe24 Private 앱에는 통합 재인증 진입점이 없었다. 갱신은 토큰 endpoint 가 상점별일 뿐 일반 흐름과 같지만 갱신이 실패해 `error(auth_failed)` 가 되면 유일한 복구 경로는 삭제 후 재등록이었다. 우리 서버가 OAuth 를 시작할 수 없는 Private 앱 구조의 결과다. 그래서 «`expired`·`error` → `connected`(통합 재인증)» 전이를 Cafe24 Private 에 적용하지 않았고 화면은 통합 재인증 버튼을 막았다.

**2026-10-10 번복(Task CLE-T-NNENG8)**: 이 결정을 뒤집었다. 설치 토큰이 남아 있는 Cafe24 Private 통합은 오류·만료됨이어도 통합 재인증으로 복구한다. 통합 재인증이 [재설치 대기 표시](#재설치-대기-표시)를 남기고 사용자가 24시간 안에 «테스트 실행» 을 누르면 App URL 이 OAuth 로 보낸다. 그동안 상태와 토큰은 그대로라 오류·만료됨 행은 콜백이 성공할 때까지 노드 실행이 막힌다. 삭제 후 재등록만 남는 것은 설치 토큰이 없는 행(24시간 설치 기한을 넘긴 행, 설치 토큰 보존 전에 연결된 옛 행)이다. 이 가운데 24시간 설치 기한을 넘긴 행은 2026-10-30 번복으로 지우지 않고 같은 상점을 새로 등록한다([만료된 설치 대기 행은 상점 자리를 놓는다](CLE-INT-OAUTH-PENDING.md#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29)). 화면의 통합 재인증 버튼도 이 행에서만 막는다. 이 제목은 다른 문서가 링크하는 앵커라 바꾸지 않는다. 이유와 기각한 선택지 ②·③ 은 위 «Cafe24 Private 추가 권한 요청은 begin 을 우회한다» 의 번복과 같다.

### MakeShop 은 삭제 후 재등록으로만 복구한다

2026-10-10(Task CLE-T-NNENG8)에 정했다. MakeShop 통합에는 통합 재인증과 추가 권한 요청 경로가 없다. begin 은 `new` 가 아닌 모드를 거절하고 화면은 두 버튼을 막는다. `:id/reauthorize`·`:id/request-scopes` 는 400 `MAKESHOP_CREDENTIALS_REQUIRED` 로 거절된다([REQ-INTOAUTH-072](CLE-INT-OAUTH.md#요구사항), [MakeShop 통합 재인증과 추가 권한 요청의 거절 코드를 정했다](#makeshop-통합-재인증과-추가-권한-요청의-거절-코드를-정했다-2026-11-13)). ShopStore 에서 앱을 다시 설치해도 설치 대기가 아닌 행은 App URL 이 상세 화면으로 보낼 뿐 되살아나지 않는다(테스트로 고정했다). 오류가 되거나 권한이 더 필요하면 통합을 지우고 다시 등록한다(선택지 ③). 설치를 마치지 못하고 24시간 설치 기한을 넘긴 설치 대기 행은 이 결정의 대상이 아니다. 그 행은 지우지 않고 같은 상점을 새로 등록한다(2026-10-30, [만료된 설치 대기 행은 상점 자리를 놓는다](CLE-INT-OAUTH-PENDING.md#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29)).

Cafe24 Private 과 달리 재설치 대기 표시(선택지 ①)를 두지 않은 근거는 다음 차이다(Task CLE-T-NNENG8).

- Cafe24 개발자 센터의 «테스트 실행» 은 언제든 App URL 을 다시 부를 수 있어 우리 쪽 표시만으로 OAuth 를 다시 열 수 있다. MakeShop 의 ShopStore 설치는 상점 쪽 앱 설치 이벤트다. 이미 설치된 앱을 다시 설치하려면 상점 운영자가 앱을 지우고 다시 설치해야 해 상점 운영에 부담이 된다.
- 같은 상점 행의 UNIQUE(V072)와 설치 가드 ⑨(`MAKESHOP_ALREADY_CONNECTED`)가 얽혀 있어 기존 행을 안전하게 되살리는 절차를 정하기 어렵다.

비용: 삭제 후 재등록은 그 통합을 쓰는 노드의 참조를 먼저 바꿔야 하고 사용처가 남아 있으면 삭제가 409 `INTEGRATION_IN_USE` 로 막힌다. 기존 행이 남아 있으면 새 등록의 설치가 409 `MAKESHOP_ALREADY_CONNECTED` 로 막히므로 순서는 사용처 교체, 삭제, 재등록이다([설치 엔드포인트](CLE-INT-OAUTH-INSTALL.md#설치-엔드포인트-app-url) 의 가드 ⑨ 설명). 이 결정으로 [통합 상태와 만료 알림](CLE-INT-STATUS.md) 의 MakeShop 오류 복구 미결 사항을 닫았다.

### begin 으로 갈 수 없는 Cafe24 Private 행은 서비스가 먼저 거절한다 (2026-10-15)

재설치 대기 표시 경로를 타지 못하는 Cafe24 Private 행은 두 가지다. 통합 재인증을 받은 설치 대기 행과, 통합 재인증이나 추가 권한 요청을 받은 설치 토큰 없는 행이다. 이 행들은 begin 으로 넘어가 원인과 상관없는 코드로 거절됐다. `:id/reauthorize` 는 상점 식별자를 넘기지 않아 `CAFE24_INVALID_MALL_ID` 가 났다. `:id/request-scopes` 는 `client_id`·`client_secret` 을 넘기지 않아 begin 본문 누락을 뜻하는 `CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED` 가 났다.

이제 `IntegrationsService` 가 begin 을 부르기 전에 이 행들을 거절한다. 거절은 가시성과 관리자 판정(404·403)을 통과한 요청에만 하므로 남의 개인 통합의 상태가 드러나지 않는다. begin 의 Cafe24 Private 분기와 모드 검사는 바꾸지 않는다. begin 모드 거절의 «`client_id`·`client_secret` 을 갖춘 요청» 조건과 진입점 표의 `oauth/begin` 설명은 그대로 맞다. 기각한 선택지는 둘이다.

- begin 의 Cafe24 Private 분기에서 모드 검사를 자격 증명 검사보다 앞에 둔다: `oauth/begin` 을 직접 부르는 클라이언트가 받는 코드가 바뀐다. 2026-10-10 에 Cafe24 Private 모드 거절에 넣은 조건을 Cafe24 만 다시 빼야 해서 같은 조건을 쓰는 MakeShop 모드 거절과 어긋난다.
- 저장된 `client_id`·`client_secret` 을 begin 에 넘겨 begin 의 모드 거절로 보낸다: 거절을 받으려고 비밀값을 복호화해 넘기게 되어 비밀값이 지나가는 자리가 늘어난다. 설치 토큰이 없는 행도 «테스트 실행» 을 하라는 코드를 받게 된다.

코드는 행의 상태에 맞춰 나눈다.

- 설치 대기 행은 `CAFE24_PRIVATE_APP_USE_TEST_RUN` 이다. 이 행은 설치 토큰과 App URL 이 살아 있어 «테스트 실행» 으로 설치를 마치는 것이 정식 경로다. 코드의 뜻과 같다.
- 설치 토큰이 없는 행은 새 코드 `CAFE24_PRIVATE_APP_INSTALL_TOKEN_MISSING` 이다. App URL 이 없어 «테스트 실행» 이 이 행으로 돌아오지 못하고 복구는 삭제 후 재등록이다(24시간 설치 기한을 넘긴 행은 2026-10-30 부터 지우지 않고 같은 상점을 새로 등록한다. [만료된 설치 대기 행은 상점 자리를 놓는다](CLE-INT-OAUTH-PENDING.md#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29)). 뜻이 다르므로 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 의 규칙 6 대로 새 코드를 둔다. 이름은 규칙 1 대로 조건(설치 토큰 없음)을 적는다. `USE_TEST_RUN` 같은 행동 지시형 이름은 규칙 1 에 맞지 않지만 호환 때문에 유지하는 이름이라 새 코드의 본보기로 삼지 않는다. 조건은 행에 설치 토큰이 저장돼 있지 않은 것이다. App URL 의 404 `CAFE24_INSTALL_INVALID_TOKEN`(경로의 설치 토큰으로 행을 찾지 못함)과는 다른 조건이다. 통합 재인증과 추가 권한 요청이 같은 조건에 같은 코드를 낸다.

MakeShop 통합은 이번 범위에서 뺐다. 화면이 두 버튼을 막고 있어서 어느 코드로 거절할지는 MakeShop 코드 정리와 함께 나중에 정하기로 미뤘다. 2026-11-13 에 지금 코드인 400 `MAKESHOP_CREDENTIALS_REQUIRED` 로 정했다([MakeShop 통합 재인증과 추가 권한 요청의 거절 코드를 정했다](#makeshop-통합-재인증과-추가-권한-요청의-거절-코드를-정했다-2026-11-13)).

프런트엔드는 이 코드들로 분기하지 않고 행의 상태와 `appUrl` 유무로 버튼을 막으므로 새 코드를 두는 부담이 적다.

상태 코드는 400 으로 둔다. 입력이 아니라 행의 상태 때문에 거절하므로 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 으로는 409·422 도 맞을 수 있다. 그래도 begin 의 `*_USE_TEST_RUN` 거절과 설치 대기·설치 토큰 없는 행·MakeShop 의 거절이 이미 400 이고, 클라이언트는 상태 코드가 아니라 버튼 비활성으로 이 행들을 다룬다. 바꾸면 계약만 흔들린다. 새 코드만 422 로 두는 안도 기각했다. 같은 두 엔드포인트의 같은 종류 거절(설치 대기 · MakeShop)이 400 이라 클라이언트가 상태 코드로 나눌 수 없게 된다. [통합 관리](CLE-INT-MANAGE.md) 의 설치 대기 연결 테스트가 200 과 `success:false` 를 쓰는 것은 결과 카드를 그리려는 별개 결정이다.

### `CAFE24_PRIVATE_APP_USE_TEST_RUN`·`MAKESHOP_USE_SHOPSTORE_INSTALL` 이름을 유지한다

2026-10-10(Task CLE-T-NNENG8)에 두 코드가 나오는 조건이 좁아졌다. 설치 토큰이 있는 Cafe24 Private 행의 `:id/reauthorize`·`:id/request-scopes` 는 begin 을 부르지 않고 재설치 대기 표시를 남기므로 이 거절에 닿지 않는다. MakeShop 코드(`MAKESHOP_USE_SHOPSTORE_INSTALL`, `oauth/begin` 을 직접 부를 때)의 메시지에는 통합 재인증과 추가 권한 요청이 안 되고 ShopStore 재설치로도 기존 통합이 되살아나지 않으니 삭제 후 재등록하라는 안내를 넣었다. 그래도 두 이름은 바꾸지 않는다. MakeShop 통합의 `:id/reauthorize`·`:id/request-scopes` 는 이 코드가 아니라 400 `MAKESHOP_CREDENTIALS_REQUIRED` 로 거절한다([MakeShop 통합 재인증과 추가 권한 요청의 거절 코드를 정했다](#makeshop-통합-재인증과-추가-권한-요청의-거절-코드를-정했다-2026-11-13)).

- [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 의 규칙 5 대로 이름을 바꾸면 호환이 깨진다.
- «이 통합은 이 요청으로 OAuth 를 시작하지 않는다» 는 뜻은 그대로이고 나오는 조건만 좁아졌다. MakeShop 의 새 등록은 여전히 ShopStore 설치로 끝나 이름의 뜻과도 맞는다.
- 통합 도메인 에러 코드는 아직 그 카탈로그 밖에 있다. 등록은 그 문서의 미결 사항에서 한다.

2026-10-15(Task CLE-T-WB7JPC)부터 `CAFE24_PRIVATE_APP_USE_TEST_RUN` 은 설치 대기 Cafe24 Private 통합의 `:id/reauthorize` 에서도 나온다. begin 이 아니라 `IntegrationsService` 가 내지만 «이 통합은 이 요청으로 OAuth 를 시작하지 않는다. 설치는 «테스트 실행» 으로 마친다» 는 뜻이 같다. 설치 토큰이 없는 행은 뜻이 달라 새 코드를 쓴다([begin 으로 갈 수 없는 Cafe24 Private 행은 서비스가 먼저 거절한다](#begin-으로-갈-수-없는-cafe24-private-행은-서비스가-먼저-거절한다-2026-10-15)).

### 재설치 대기 표시는 24시간 동안만 유효하다 (2026-10-10)

표시에 24시간 유효 기간을 둔다(Task CLE-T-NNENG8). 만료가 없으면 콜백 성공과 행 삭제로만 표시가 사라진다. 이유는 둘이다.

- 요청만 하고 «테스트 실행» 을 하지 않은 행이 App URL 에서 계속 동의 화면으로 가거나 상세 화면에 안내를 계속 보이면 안 된다.
- 표시가 유효한 동안 콜백은 요청자 인가 재판정을 건너뛴다. 이 기간을 설치 대기 기한과 같은 24시간 경계에 묶는다. 그 뒤에는 요청자가 강등됐을 수 있어 다시 판정한다.

지난 값을 지우는 작업을 두지 않고 판정에서 무시하는 것은 Task CLE-T-NNENG8 결정이다. 상태 모델 쪽 설명은 [상태 모델 「재설치 대기 표시는 상태와 따로 둔 컬럼이다」](CLE-INT-STATUS-MODEL.md#재설치-대기-표시는-상태와-따로-둔-컬럼이다) 에 있다.

**받아들인 잔여**: 표시가 유효한 24시간 동안 콜백이 요청자를 다시 판정하지 않는 위험은 2026-11-13 에 이 단락에 처음 적었고 2026-11-14 에 받아들이기로 정했다(NERV Task `CLE-T-EMB185`). 근거와 기각한 대안은 [상태 모델](CLE-INT-STATUS-MODEL.md#재설치-대기-표시-동안의-콜백은-요청자를-다시-판정하지-않는다-2026-11-14)에 있다.

### MakeShop 통합 재인증과 추가 권한 요청의 거절 코드를 정했다 (2026-11-13)

MakeShop 통합의 `:id/reauthorize`·`:id/request-scopes` 는 400 `MAKESHOP_CREDENTIALS_REQUIRED` 로 거절한다. 2026-11-13 에 사용자가 이 코드를 계약으로 정했다.

- 지금 동작을 그대로 계약으로 삼았다. 두 요청은 `IntegrationsService` 가 begin 을 부른다. 행의 클라이언트 자격 증명은 begin 에 넘기지 않는다. 그래서 begin 의 MakeShop 분기가 모드 검사보다 앞의 자격 증명 검사에서 거절하고 이 코드가 나온다.
- 화면은 MakeShop 통합의 두 버튼을 막는다. 그래서 이 코드는 화면을 거치지 않고 두 엔드포인트를 직접 부르는 클라이언트만 받는다.
- 고르지 않은 안: [MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md) Rationale 이 적던 `MAKESHOP_USE_SHOPSTORE_INSTALL` 로 맞추는 안. 그러려면 서비스가 begin 전에 따로 거절하거나 저장된 `client_id`·`client_secret` 을 begin 에 넘겨야 한다. 어느 쪽이든 응답 코드가 바뀐다. 뒤의 방법은 2026-10-15 에 Cafe24 Private 에서 기각한 안과 같다([begin 으로 갈 수 없는 Cafe24 Private 행은 서비스가 먼저 거절한다](#begin-으로-갈-수-없는-cafe24-private-행은-서비스가-먼저-거절한다-2026-10-15)). MakeShop 노드 쪽 서술을 이 코드에 맞춘다.
- 고르지 않은 안: 두 경로 전용 코드를 새로 만드는 안. `MAKESHOP_CREDENTIALS_REQUIRED` 는 이미 클라이언트가 받는 코드다. 이름이 두 경로의 조건과 딱 맞지는 않지만 2026-11-13 에 사용자가 지금 코드를 계약으로 정했다.
- [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 의 이 코드 행에 두 경로를 더하는 일과 규칙 6 예외로 올릴지 정하는 일은 NERV Task `CLE-T-6G3084` 가 맡는다.
- 받아들인 잔여: 코드 이름과 메시지는 begin 본문에 클라이언트 자격 증명이 없다는 뜻이다. 두 엔드포인트는 본문에 자격 증명을 받지 않으므로 응답만 보고는 복구 방법(삭제 후 재등록)을 알 수 없다. 복구 방법은 이 문서의 [MakeShop 은 삭제 후 재등록으로만 복구한다](#makeshop-은-삭제-후-재등록으로만-복구한다) 와 MakeShop 노드가 알린다.
