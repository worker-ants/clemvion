---
id: "CLE-NODE-MAKESHOP-OUTPUT"
title: "MakeShop 노드 — 출력 구조와 에러"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-MAKESHOP"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT", "CLE-NODE-MAKESHOP"]
area: "CLE-NODE-INT"
content_hash: "63494060781de158eb1ee27db544ff9a5b22d1c9da7f177e7dded8fd589f07d7"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "730283532eae37d532e256f8e9940b96c29b6fb63866c9db399c3c9fcf23a5f9"
etag: "sha256-78be1049656da1fe7db943a71cdcf23e02a217b0f3ea1bf679b07a0c1d330f7e"
---
## 개요

이 문서는 [MakeShop 노드](CLE-NODE-MAKESHOP.md) 의 하위 문서로 노드 출력 구조, 에러 코드, 인증 실패 처리와 복구 경로를 정한다. 실행 단계와 에러가 나는 시점은 [MakeShop 노드 — 실행 로직](CLE-NODE-MAKESHOP-EXEC.md)이 정한다.

## 출력 구조

노드 출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 11 형식을 따르며 [Cafe24 노드](CLE-NODE-CAFE24.md)와 같은 다섯 필드 구조다(`config`·`output`·`meta`·`port`, `status` 생략). dry-run 모의 출력의 모양은 [실행 로직 §dry-run](CLE-NODE-MAKESHOP-EXEC.md#dry-run)에 있다.

### 2xx 성공 (`success`)

```json
{
  "config": {
    "integrationId": "int_makeshop_myshop",
    "resource": "product",
    "operation": "get-product",
    "fields": { "product_id": "{{ $input.pid }}" }
  },
  "output": {
    "response": { "list": { "product_id": "1001", "product_name": "샘플 상품" } }
  },
  "meta": { "statusCode": 200, "durationMs": 280 },
  "port": "success"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | object | 설정 에코 | 사용자 입력 원본(`{{ }}` 보존) |
| `output.response` | unknown | 런타임 | MakeShop 응답 본문 그대로. 구조는 operation 마다 다르며 [MakeShop API 카탈로그](CLE-MKS-CATALOG)의 스키마를 본다 |
| `meta.statusCode` | number | 핸들러 반환 | HTTP 상태(2xx) |
| `meta.durationMs` | number | 핸들러 반환 | 요청부터 응답까지 ms |
| `port` | `'success'` | 핸들러 반환 | 2xx 분기 |

Cafe24 의 `meta.callUsage`·`meta.callRemain`(leaky bucket 메트릭)은 MakeShop 에 **없다**. MakeShop 이 호출 제한 헤더를 공개하지 않아 보일 메트릭이 없다.

### API 에러 또는 전송 실패 (`error`)

`output.error.{code, message, details?}`(Principle 3.2)를 쓴다. 4xx·5xx 면 서버 응답 본문을 `output.response` 에 둔다. 구조는 Cafe24 와 같고 `code` 는 `MAKESHOP_*` 다. `details` 에는 `resource`·`operation` 을 담고 통합을 얻어 `shop_uid` 를 읽은 뒤의 실패면 `shopUid` 도 담는다. 아래 표에서 `?` 가 붙은 필드는 경우에 따라 빠지며 빠지는 경우를 설명 칸에 적는다.

```json
{
  "config": {
    "integrationId": "int_makeshop_myshop",
    "resource": "product",
    "operation": "get-product",
    "fields": { "product_id": "9999" }
  },
  "output": {
    "response": { "error": { "code": "404", "message": "Not Found" } },
    "error": {
      "code": "MAKESHOP_404",
      "message": "MakeShop API returned 404",
      "details": {
        "statusCode": 404,
        "shopUid": "myshop",
        "resource": "product",
        "operation": "get-product"
      }
    }
  },
  "meta": { "statusCode": 404, "durationMs": 120 },
  "port": "error"
}
```

| 필드 | 출처 | 설명 |
|------|------|------|
| `output.response?` | 런타임 | `MAKESHOP_4XX` · `MAKESHOP_404` · `MAKESHOP_422` · `MAKESHOP_5XX` 면 MakeShop 응답 본문을 그대로 둔다. `MAKESHOP_AUTH_FAILED` 는 응답 본문이 있을 때만 둔다. 전송 실패 · `MAKESHOP_RATE_LIMITED` · 외부 호출 전에 거른 에러에는 없다 |
| `output.error.code` | 핸들러 반환 | 아래 에러 코드 표의 값(`MAKESHOP_*`·`INTEGRATION_*`) |
| `output.error.message` | 핸들러 반환 | `MAKESHOP_4XX` · `MAKESHOP_404` · `MAKESHOP_422` · `MAKESHOP_5XX` 면 `MakeShop API returned <status>` 다. statusText 는 넣지 않는다. 서버 쪽 사유는 `details` 의 MakeShop 응답 필드로 일부 보존한다. 그 밖의 에러는 원인을 적은 영문 메시지다 |
| `output.error.details.{resource, operation}` | 핸들러 반환 | 늘 있다 |
| `output.error.details.shopUid?` | 핸들러 반환 | 호출 대상 상점. 통합을 얻어 `shop_uid` 를 읽은 뒤의 실패에만 있다. `MAKESHOP_INVALID_PAGINATION` 처럼 통합을 얻기 전에 거른 에러에는 없다 |
| `output.error.details.statusCode?` | 핸들러 반환 | HTTP 상태. `MAKESHOP_4XX` · `MAKESHOP_404` · `MAKESHOP_422` · `MAKESHOP_5XX` · `MAKESHOP_AUTH_FAILED` 에만 있다. `MAKESHOP_RATE_LIMITED` 에는 없다 |
| `output.error.details.{makeshopErrorCode?, makeshopMessage?}` | 핸들러 반환 | `MAKESHOP_4XX` · `MAKESHOP_404` · `MAKESHOP_422` · `MAKESHOP_5XX` 응답 본문에서 읽은 MakeShop 에러 코드와 메시지. 본문에 그 값이 있을 때만 싣는다 |
| `output.error.details.{retries?, lastRetryAfterSec?}` | 핸들러 반환 | `MAKESHOP_RATE_LIMITED` 에만 있다. 재시도 횟수와 마지막 `Retry-After` 값이다 |
| `meta.statusCode` | 핸들러 반환 | HTTP 상태(`MAKESHOP_RATE_LIMITED` 는 429). 전송 실패와 외부 호출 전에 거른 에러는 `0` |
| `port` | 핸들러 반환 | `'error'` |

## 에러 코드

런타임(`port: 'error'`) `output.error.code` 값이다. 실행 중 실패는 모두 에러 포트로 보낸다([통합 노드 공통](CLE-NODE-INT-COMMON.md)). 의미 기반 명명은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md)를 따른다.

| 코드 | 조건 |
|------|------|
| `MAKESHOP_4XX` / `MAKESHOP_404` / `MAKESHOP_422` | 4xx. 404·422 는 자주 분기해 따로 두고 그 밖은 `MAKESHOP_4XX`. 남은 3xx 도 `MAKESHOP_4XX` |
| `MAKESHOP_AUTH_FAILED` | 401(토큰 갱신 후 1회 재시도에도 401) 또는 403(즉시). 통합 상태를 `error(auth_failed)` 로 한 번에 바꾼다. 복구는 통합 삭제 후 재등록이다([인증 실패 처리](#인증-실패-처리)) |
| `MAKESHOP_RATE_LIMITED` | 429 와 재시도 소진 |
| `MAKESHOP_5XX` | 5xx |
| `MAKESHOP_TRANSPORT_FAILED` | 요청 reject(DNS·연결·타임아웃). `meta.statusCode=0` |
| `MAKESHOP_UNKNOWN_OPERATION` | `operation` 이 메타데이터에 없음 |
| `MAKESHOP_MISSING_FIELDS` | `requiredFields` 누락 또는 조건부 필수 제약 위반 |
| `MAKESHOP_INVALID_PAGINATION` | 외부 호출 전에 거르는 런타임 에러. paginated operation 의 `pagination` 이 [페이지네이션 변환](CLE-NODE-MAKESHOP-EXEC.md#페이지네이션-변환) 규칙을 어김(`limit` 이 양의 정수가 아님, `offset` 이 0 이상의 정수가 아님, `limit` 없이 0 보다 큰 `offset`, `limit` 의 배수가 아닌 `offset`). 숫자로 적은 값과 표현식 값 모두 실행할 때 판정하고 통합을 읽거나 API 를 부르기 전에 거른다 |
| `MAKESHOP_INVALID_SHOP_UID` | `shop_uid` 형식 위반 |
| `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` / `INTEGRATION_CALL_FAILED` | 통합 해소·자격 증명 실패([통합 노드 공통](CLE-NODE-INT-COMMON.md)) |
| `INTEGRATION_SERVICE_UNAVAILABLE` | `__workspaceId` 누락 또는 `MakeshopApiClient` 미주입(배포 구성 에러). Cafe24 와 **같은 공용 코드**를 쓴다. 같은 조건을 두 코드로 나누지 않으려고 서비스별 접두(`MAKESHOP_`)를 붙이지 않는다 |

**경로 자리표시자가 남으면 `INTEGRATION_CALL_FAILED` 다.** operation 경로의 자리표시자(`{member_id}` 같은)가 요청을 보내기 직전까지 채워지지 않으면 외부 API 를 부르지 않고 실패한다. 메시지는 `MAKESHOP_UNRESOLVED_PATH_PARAM: operation '<id>' has unresolved path placeholder(s): <list>. Check that required fields are provided and field metadata location='path' is correct.` 다. 앞의 이름은 코드가 아니라 메시지 접두이고 출력 코드는 `INTEGRATION_CALL_FAILED` 다. 이 접두로 분기하지 않는다([에러 코드 규약과 카탈로그 「6.22」](../CLE-API/CLE-API-ERRCODES.md#622-통합-노드-도메인-문서-참조) · 규칙 4).

## 인증 실패 처리

[Cafe24 노드](CLE-NODE-CAFE24.md) 인증 실패 처리 정책을 그대로 쓴다. 401 은 토큰을 갱신하고 한 번 재시도하며 재시도도 401 이면 격하한다. 403 은 즉시 격하한다.

현재 구현은 401·403 모두 `error(auth_failed)` 로 격하한다. Cafe24 의 `insufficient_scope` 세분 전이는 MakeShop 에 없다. MakeShop 은 권한 범위별 별도 승인 단계가 없어 403 을 권한 범위 부족으로 나눌 근거가 없고, `insufficient_scope` 감지는 Cafe24 에만 있다([통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)의 `insufficient_scope` 감지 요구사항. 번호는 [상위 문서의 하위 문서 절](CLE-NODE-MAKESHOP.md#하위-문서)). 격하 조건과 사유 값은 [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)이 정한다. 격하한 뒤 `error → connected` 로 자동으로 돌아가지 않는다.

격하된 MakeShop 통합은 통합을 삭제하고 다시 등록해야 복구된다. 오래 쓰지 않아 리프레시 토큰까지 만료된 통합도 같다.

- 통합 재인증과 추가 권한 요청은 둘 다 막혀 있다. 통합 화면은 두 버튼을 비활성으로 두고 그 사유를 보여 준다. 서버는 MakeShop 통합의 `:id/reauthorize` · `:id/request-scopes` 를 400 `MAKESHOP_CREDENTIALS_REQUIRED` 로 거절하고 이 응답을 계약으로 둔다. 두 경로는 자격 증명(`client_id` · `client_secret`) 없이 인가 시작(begin)을 부르고, MakeShop begin 은 모드보다 자격 증명을 먼저 확인한다.
- 인가 시작(begin) 요청이 본문에 `client_id` · `client_secret` 을 갖췄는데 `mode` 가 `new` 가 아니면(`reauthorize` · `request_scopes`) 400 `MAKESHOP_USE_SHOPSTORE_INSTALL` 로 거절한다. [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md)의 MakeShop begin 모드 거절 요구사항과 같은 조건이다(번호는 [상위 문서의 하위 문서 절](CLE-NODE-MAKESHOP.md#하위-문서)). 코드 이름은 호환을 위해 그대로 둔다.
- ShopStore 에서 앱을 다시 설치해도 기존 행은 되살아나지 않는다. 설치 대기가 아닌 행(`connected` · `error`)이면 App URL 이 그 행의 상세 화면으로 간다. 설치 대기 중 `install_timeout` 으로 만료된 행은 설치 토큰이 없어 App URL 이 404 가 된다. 설치 대기(`pending_install`) 행만 예전처럼 ShopStore 설치로 이어진다.
- 통합을 쓰는 노드가 있으면 삭제가 409 `INTEGRATION_IN_USE` 로 막힌다. 노드의 통합 참조를 먼저 바꾼 뒤 삭제한다.

## 구현 위치

- `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts` (출력 · 에러 코드 분류)
- `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (OAuth auth-code + PKCE, 통합 재인증 · 추가 권한 요청 거절, ShopStore 설치 처리 `handleMakeshopInstall`)
- `codebase/backend/src/modules/integrations/integrations.service.ts`
- `codebase/backend/src/modules/integrations/third-party-oauth.controller.ts` (ShopStore 설치 HMAC)

## Rationale

### 인증 실패 뒤 복구는 삭제 후 재등록

이전 원문은 격하된 통합과 오래 쓰지 않은 통합을 통합 재인증(`Reauthorize`)으로 복구한다고 적었다. 서버는 그때도 MakeShop 통합의 통합 재인증 · 추가 권한 요청을 거절했고 통합 화면의 버튼만 활성이었다. ShopStore 재설치로 기존 행이 복구되는지도 정해져 있지 않았다. Task CLE-T-NNENG8 에서 복구 경로를 통합 삭제 후 재등록 하나로 정했고 화면 버튼도 막았다.

- 거절 코드: 그 거절은 원래 `MAKESHOP_USE_SHOPSTORE_INSTALL` 로 적혀 있었지만 실제로는 400 `MAKESHOP_CREDENTIALS_REQUIRED` 로 끝났다. 2026-11-13 에 사람이 이 응답을 계약으로 정했다(Task CLE-T-10N47M).
- 기각한 안(ShopStore 재설치로 기존 행 되살리기): 설치 토큰과 HMAC 검증으로 이어지는 설치 흐름은 설치 대기 행 전용이다. App URL 은 설치가 끝난 행을 상세 화면으로 보낸다. 그래서 재설치는 기존 행을 되살리는 경로가 되지 못한다.
- 택한 안의 비용: 통합을 쓰는 노드가 있으면 노드의 통합 참조를 먼저 바꾼 뒤 삭제 · 재등록해야 한다([인증 실패 처리](#인증-실패-처리)).

상세 근거는 [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md) Rationale 에 있다.
