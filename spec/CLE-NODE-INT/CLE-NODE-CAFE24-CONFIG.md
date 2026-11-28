---
id: "CLE-NODE-CAFE24-CONFIG"
title: "Cafe24 노드 — 설정과 출력"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-CAFE24"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT", "CLE-NODE-CAFE24"]
area: "CLE-NODE-INT"
content_hash: "93dc041c637dd53a640a940eba89dd9da3de4a311fb895ec21ab190a0380d206"
read_as: "approved_fallback"
task: "CLE-T-ABHBSV"
source_paths: []
mirror_sha256: "642e23082c865a0dd0458aee2f335d7e89dc6870094e526e4c3b0a7524d9157d"
etag: "sha256-563a93dbbaaedede73bebeb6243d3153ad2a510146729a0913e6c7d673f3148f"
---
## 개요

이 문서는 [Cafe24 노드](CLE-NODE-CAFE24.md) 의 하위 문서로 노드 설정 필드, 설정 화면, 포트, 캔버스 요약, 출력 구조, 에러 코드와 인증 실패 처리를 정한다. 실행 흐름은 [Cafe24 노드 — 실행 로직](CLE-NODE-CAFE24-EXEC.md)이 정한다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `integrationId` | UUID | ✓ | — | `service_type='cafe24'` 통합 ID([통합 노드 공통](CLE-NODE-INT-COMMON.md) 통합 참조) |
| `resource` | Enum | ✓ | — | Cafe24 리소스. 아래 표의 18개 값 중 하나 |
| `operation` | String | ✓ | — | 선택한 리소스의 operation id. 메타데이터 테이블([Cafe24 operation 메타데이터](CLE-C24-META))에 있는 값 중 하나(예: `product_list`, `product_get`, `order_list`, `order_update_status`) |
| `fields` | Record<string, unknown> | — | `{}` | 선택한 operation 의 입력 필드. 표현식 가능. operation 별 필수·선택 필드는 메타데이터가 정한다 |
| `pagination` | object? | — | — | `{ limit?: number, offset?: number }`. operation 이 페이지네이션을 지원할 때만 쓴다. `fields` 와 분리해 표준화했다. `cursor` 는 Cafe24 Admin API 가 일관되게 지원하지 않아 쓰지 않는다(B-3-7) |

표현식(`{{ }}`)은 `fields[*]` 와 `pagination.*` 의 모든 값에서 쓸 수 있다. 설정 스키마의 단일 기준은 `codebase/backend/src/nodes/integration/cafe24/cafe24.schema.ts` 의 `cafe24NodeConfigSchema`·`cafe24NodeMetadata` 다.

리소스 값과 operation 목록 문서:

| `resource` | 뜻 | operation 목록 |
|------------|----|----------------|
| `store` | 상점 | [Store](CLE-C24-STORE) |
| `product` | 상품 | [Product](CLE-C24-PRODUCT) |
| `order` | 주문 | [Order](CLE-C24-ORDER) |
| `customer` | 회원 | [Customer](CLE-C24-CUSTOMER) |
| `community` | 게시판 | [Community](CLE-C24-COMMUNITY) |
| `design` | 디자인 | [Design](CLE-C24-DESIGN) |
| `promotion` | 프로모션 | [Promotion](CLE-C24-PROMOTION) |
| `application` | 앱 관리. OAuth 앱 등록과 무관한 Cafe24 앱 관리 API 다 | [Application](CLE-C24-APPLICATION) |
| `category` | 상품분류 | [Category](CLE-C24-CATEGORY) |
| `collection` | 판매분류 | [Collection](CLE-C24-COLLECTION) |
| `supply` | 공급사 | [Supply](CLE-C24-SUPPLY) |
| `shipping` | 배송 | [Shipping](CLE-C24-SHIPPING) |
| `salesreport` | 매출통계 | [Salesreport](CLE-C24-SALESREPORT) |
| `personal` | 개인화 | [Personal](CLE-C24-PERSONAL) |
| `privacy` | 개인정보 | [Privacy](CLE-C24-PRIVACY) |
| `mileage` | 적립금 | [Mileage](CLE-C24-MILEAGE) |
| `notification` | 알림 | [Notification](CLE-C24-NOTIFICATION) |
| `translation` | 번역 | [Translation](CLE-C24-TRANSLATION) |

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 통합 | 맨 위 | 통합 선택기(`serviceTypes=['cafe24']`) | Cafe24 통합만 보여 준다 |
| 리소스 | 통합 아래 | Resource 드롭다운 | 18개 리소스를 라벨과 함께 보인다(예: `product` → "Product (상품)") |
| operation | 리소스 아래 | Operation 드롭다운 | 리소스를 바꾸면 목록이 바뀐다. 리소스 옆에 "지원 N개 · 추후 지원 M개" 안내를 보인다 |
| 필수 필드 | operation 아래 | Required 묶음 | 메타데이터가 정한 필수 필드 행 |
| 선택 필드 | 필수 필드 아래 | Optional 묶음 | 메타데이터가 정한 선택 필드 행 |
| 페이지네이션 | 맨 아래 | Limit·Offset 입력 | `paginated: true` 인 operation 에만 보인다 |

- operation 라벨: 백엔드는 카탈로그 키(`labelKey`, `cafe24.<resource>.<operation>`)만 내려 주고 프론트엔드 i18n 사전이 사람이 읽는 라벨로 바꾼다. 사전에 키가 없으면 키 자체를 보인다. 규칙은 [Cafe24 operation 메타데이터](CLE-C24-META) 카탈로그 키 절이 정한다.
- 필드 입력: operation 을 고르면 메타데이터의 입력 스키마(JSON Schema 호환 형식)로 동적 폼을 렌더하고 필수와 선택 두 묶음으로 나눈다. 모든 칸은 `ExpressionInput` 을 바탕으로 해서 표현식을 받는다. `enum`·`boolean`·`default` 정보는 힌트 문구로 보인다. 키는 메타데이터로 고정되므로 사용자가 임의 키를 더하는 경로는 없다([필드 편집 UI](#필드-편집-ui)).
- 호환 키 보존: operation 을 바꾸면 새 operation 의 `fields[].name` 과 겹치는 키만 남기고 나머지는 버린다. 예를 들어 `product_get`(`shop_no` 만)에서 `product_list`(`shop_no`·`display` 등)로 바꾸면 `shop_no` 값이 남는다. 리소스를 바꾸면 `fields` 를 모두 초기화한다.
- 지원 예정 operation: 카탈로그의 `status: planned` 행도 드롭다운에 보이지만 비활성이며 "(지원 예정)" 접미사를 붙인다. supported 가 아닌 operation(planned·unknown)을 고르면 `fields`·`pagination` 입력을 렌더하지 않는다.
- 별도 승인 라벨: 메타데이터 행에 `restrictedApproval` 이 있는 operation 은 라벨 오른쪽에 ⚠ 아이콘과 "별도 승인 필요" 보조 문구를 보인다. 리소스 전체가 별도 승인 대상(`restrictedApproval.level='scope'`)이면 그 리소스의 모든 operation 에, `level='operation'` 이면 해당 행에만 붙는다. 명단, 툴팁 본문, 문의 링크는 [Cafe24 별도 승인 scope](CLE-C24-SCOPES)가 정한다. `approvalGroup`(문구 묶음 식별자)별 문구는 프론트엔드 i18n 사전이 관리한다.

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|----|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 입력 데이터(`$input` 으로 참조) |
| 출력 | `success` | Success | data | false | Cafe24 API 2xx 응답 |
| 출력 | `error` | Error | error | false | Cafe24 API 3xx·4xx·5xx, 전송 실패, 429 재시도 소진, 메타데이터 검증 실패 |

## 캔버스 요약

[통합 노드 공통](CLE-NODE-INT-COMMON.md) 캔버스 요약 표의 Cafe24 행을 따른다. 포맷은 `{{resource}} · {{operation}}`(예: `product · product_list`)이고 렌더된 한 줄을 40자에서 자른다. 참조하던 통합이 삭제되면 `⚠ Missing integration` 배지를 붙인다.

## 출력 구조

노드 출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 11 형식을 따른다. JSON 예시는 `undefined` 필드를 생략하고, 다섯 필드 밖의 최상위 키는 두지 않는다. `output.response` 는 Principle 8.2 의 HTTP 관용 명명을 다시 쓴다. `status` 는 비블로킹 노드이므로 항상 생략한다.

### 2xx 성공 (`success`)

```json
{
  "config": {
    "integrationId": "int_cafe24_myshop",
    "resource": "product",
    "operation": "product_list",
    "fields": {
      "shop_no": 1,
      "display": "T",
      "created_start_date": "{{ $now }}"
    },
    "pagination": { "limit": 50, "offset": 0 }
  },
  "output": {
    "response": {
      "products": [
        { "product_no": 1001, "product_name": "샘플 상품", "price": "10000.00" }
      ],
      "links": [{ "rel": "next", "href": "/api/v2/admin/products?offset=50&limit=50" }]
    }
  },
  "meta": {
    "statusCode": 200,
    "durationMs": 320,
    "callUsage": 12,
    "callRemain": 0,
    "callLimit": "5/40"
  },
  "port": "success"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.integrationId` | UUID | 설정 에코 | 사용자 입력 원본 |
| `config.resource` | Enum | 설정 에코 | Cafe24 리소스 18개 중 하나 |
| `config.operation` | string | 설정 에코 | operation id |
| `config.fields` | object | 설정 에코 | 사용자 입력 원본(`{{ }}` 보존). `{}` 여도 명시적으로 에코한다(누락과 `undefined` 는 다르다) |
| `config.pagination?` | object | 설정 에코 | 페이지네이션 operation 일 때 |
| `output.response` | unknown | Cafe24 응답 본문 | 그대로 보존. 구조는 operation 마다 다르다 |
| `meta.statusCode` | number | 핸들러 반환 | HTTP 응답 상태(2xx) |
| `meta.durationMs` | number | 핸들러 반환 | 요청 시작부터 응답까지 ms |
| `meta.callUsage?` | number | 런타임 | `X-Cafe24-Call-Usage` 헤더(%) |
| `meta.callRemain?` | number | 런타임 | `X-Cafe24-Call-Remain` 헤더(초) |
| `meta.callLimit?` | string | 런타임 | `X-Api-Call-Limit` 헤더(`현재/상한`) |
| `port` | `'success'` | 핸들러 반환 | 2xx 분기 |

표현식 접근 예:

- `$node["X"].output.response.products[0].product_no` → `1001`
- `$node["X"].meta.statusCode` → `200`
- `$node["X"].config.resource` → `"product"`

### API 에러 또는 전송 실패 (`error`)

[노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 3.2 의 `output.error.{code, message, details?}` 를 쓴다. 응답이 3xx·4xx·5xx 면 서버 응답 본문을 디버깅을 위해 `output.response` 에 둔다.

Cafe24 API 3xx·4xx·5xx 응답(예: 404):

```json
{
  "config": {
    "integrationId": "...",
    "resource": "product",
    "operation": "product_get",
    "fields": { "product_no": 9999 }
  },
  "output": {
    "response": {
      "error": { "code": "404", "message": "Not Found", "more_info": "..." }
    },
    "error": {
      "code": "CAFE24_404",
      "message": "Cafe24 API returned 404",
      "details": {
        "statusCode": 404,
        "mallId": "myshop",
        "resource": "product",
        "operation": "product_get",
        "cafe24ErrorCode": "404",
        "cafe24Message": "Not Found"
      }
    }
  },
  "meta": { "statusCode": 404, "durationMs": 120, "callUsage": 13 },
  "port": "error"
}
```

429 재시도 소진:

```json
{
  "config": { "integrationId": "...", "resource": "product", "operation": "product_list", "fields": {} },
  "output": { "error": { "code": "CAFE24_RATE_LIMITED", "message": "Cafe24 leaky bucket exhausted after 2 retries",
    "details": { "retries": 2, "lastRetryAfterSec": 5, "mallId": "myshop" } } },
  "meta": { "statusCode": 429, "durationMs": 12500, "callUsage": 100, "callRemain": 5 },
  "port": "error"
}
```

전송 실패(네트워크·타임아웃):

```json
{
  "config": { "integrationId": "...", "resource": "order", "operation": "order_list", "fields": {} },
  "output": { "error": { "code": "CAFE24_TRANSPORT_FAILED", "message": "ECONNRESET",
    "details": { "mallId": "myshop", "resource": "order", "operation": "order_list" } } },
  "meta": { "statusCode": 0, "durationMs": 30000 },
  "port": "error"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.fields` | object | 설정 에코 | 호출하려던 입력(`{{ }}` 보존) |
| `output.response` | unknown | 런타임 | 3xx·4xx·5xx 에서도 Cafe24 응답 본문 보존 |
| `output.error.code` | string | 핸들러 반환 | 아래 에러 코드 표의 값 |
| `output.error.message` | string | 핸들러 반환 | `Cafe24 API returned <status>`. statusText 는 넣지 않는다. 서버 쪽 사유는 `details.cafe24ErrorCode`·`cafe24Message` 로 보존한다 |
| `output.error.details.statusCode` | number | 핸들러 반환 | HTTP 상태 |
| `output.error.details.mallId` | string | 핸들러 반환 | 호출 대상 `mall_id`(디버깅) |
| `output.error.details.resource` / `operation` | string | 핸들러 반환 | 호출하려던 노드 설정 |
| `output.error.details.cafe24ErrorCode` / `cafe24Message` | string? | 핸들러 반환 | Cafe24 응답 본문의 `error.code`·`message`(있을 때) |
| `meta.statusCode` | number | 핸들러 반환 | HTTP 응답 상태(전송 실패는 `0`) |
| `port` | `'error'` | 핸들러 반환 | 에러 분기 |

## 에러 코드

### 사전 검증 에러

`handler.validate()` 가 실패하면(설정 형식 자체가 잘못된 경우) 노드 실행이 시작되지 않는다. 경고 규칙과 `evaluateMetadataBlockingErrors` 가 throw 하고 엔진이 실행을 실패로 끝낸다. 예: `Integration 을 선택해야 합니다.`, `resource must be one of: store, product, order, ... (18 categories)`.

### 런타임 에러 (`port: 'error'`)

`execute()` 안의 실패는 에러 포트로 간다(D4). 예외는 상위 취소 신호(`context.abortSignal`) 때문에 생긴 `AbortError` 하나다. 이 예외는 에러 포트로 바꾸지 않고 다시 던지므로 노드 실행이 `cancelled` 로 분류된다([실행 로직](CLE-NODE-CAFE24-EXEC.md#실행-로직) 9단계, [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)). 활동 로그에는 통합을 얻은 뒤의 실패를 `status: 'failed'` 와 `error: {code, message}` 로 기록한다([실행 로직](CLE-NODE-CAFE24-EXEC.md#실행-로직) 11단계).

| 코드 | 조건 | `output.response` | `meta.statusCode` |
|------|------|-------------------|-------------------|
| `CAFE24_4XX` | `400 ≤ statusCode < 500` 중 404·422 가 아닌 경우. 리다이렉트를 자동으로 따라간 뒤에도 남은 3xx 도 이 코드다([리다이렉트 뒤에도 남은 3xx 는 `CAFE24_4XX` 다](#리다이렉트-뒤에도-남은-3xx-는-cafe24_4xx-다)) | 서버 본문 보존 | 응답 상태 |
| `CAFE24_404` | Cafe24 응답 404(자주 분기하는 경우) | 서버 본문 보존 | 404 |
| `CAFE24_422` | Cafe24 응답 422(검증 실패) | 서버 본문 보존 | 422 |
| `CAFE24_AUTH_FAILED` | 401: 토큰 갱신 후 1회 재시도에도 401. 403: 즉시. 토큰 갱신 요청이 401·403 으로 거절된 경우도 이 코드다. 통합 상태 사유는 403 에 권한 범위 부족 신호가 있으면 `insufficient_scope`, 그 밖은 `auth_failed` 이고 코드는 둘 다 이 값이다([인증 실패 처리](#인증-실패-처리)) | 서버 본문 보존 | 401 / 403 |
| `CAFE24_RATE_LIMITED` | 429 와 재시도 소진 | 서버 본문 보존(있으면) | 429 |
| `CAFE24_5XX` | `500 ≤ statusCode < 600` | 서버 본문 보존 | 응답 상태 |
| `CAFE24_TRANSPORT_FAILED` | 요청 reject(DNS·연결 거부·소켓·타임아웃). API 호출 중 분류되지 않은 예외도 이 코드로 대체한다(경고 로그를 남긴다). 토큰 갱신 요청이 401·403 밖의 상태로 실패한 경우도 이 코드다([토큰 갱신 실패](#토큰-갱신-실패)) | 없음 | `0` |
| `CAFE24_UNKNOWN_OPERATION` | `operation` 이 메타데이터에 없음 | — | `0` |
| `CAFE24_MISSING_FIELDS` | `requiredFields` 누락 또는 조건부 필수 제약 위반. 두 사유 모두 같은 코드를 쓴다 | — | `0` |
| `CAFE24_INVALID_MALL_ID` | `mall_id` 형식 위반(소문자 영숫자·하이픈, 3~50자 밖) | — | `0` |
| `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` / `INTEGRATION_CALL_FAILED` | 통합 해소·자격 증명 실패([통합 노드 공통](CLE-NODE-INT-COMMON.md)) | — | `0` |
| `INTEGRATION_SERVICE_UNAVAILABLE` | `__workspaceId` 누락 또는 `Cafe24ApiClient` 미주입(배포 구성 에러) | — | `0` |

**경로 자리표시자가 남으면 `INTEGRATION_CALL_FAILED` 다.** operation 경로의 자리표시자(`{member_id}` 같은)가 요청을 보내기 직전까지 채워지지 않으면 외부 API 를 부르지 않고 실패한다. 메시지는 `CAFE24_UNRESOLVED_PATH_PARAM: operation '<id>' has unresolved path placeholder(s): <list>. Check that required fields are provided and field metadata location='path' is correct.` 다. 앞의 이름은 코드가 아니라 메시지 접두이고 출력 코드는 `INTEGRATION_CALL_FAILED` 다. 이 접두로 분기하지 않는다([에러 코드 규약과 카탈로그 「6.22」](../CLE-API/CLE-API-ERRCODES.md#622-통합-노드-도메인-문서-참조) · 규칙 4).

### 인증 실패 처리

**401(액세스 토큰 만료 가능성)**: 토큰을 한 번 갱신한 뒤 같은 요청을 다시 보낸다. 통합 화면의 연결 테스트(`pingConnection`)도 같은 정책을 쓴다.

1. 토큰 갱신을 요청한다(`refreshViaQueue`, `source='reactive_401'`). 이 경로의 큐 dedup 우회와 여러 인스턴스 사이 직렬화는 [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md)에서 정한다.
2. 갱신에 성공하면 새 액세스 토큰으로 같은 요청을 **한 번** 다시 보낸다.
3. 재시도 응답이 2xx 면 통합을 `error` 로 바꾸지 않고(`connected` 그대로) 정상 결과를 돌려준다.
4. 재시도 응답도 401 이면 토큰 자체의 문제로 확정하고 아래 격하 동작을 한다.

갱신 요청이 실패하면 요청을 다시 보내지 않는다. 실패 종류별 코드와 상태는 [토큰 갱신 실패](#토큰-갱신-실패)가 정한다. 재시도는 정확히 1회이고(무한 재시도 차단) 429 재시도와 따로 센다.

**403(권한 범위 부족·앱 미설치)**: 토큰 갱신으로 되살릴 수 없으므로 즉시 격하한다. 권한 범위 부족 신호가 있으면 사유를 `insufficient_scope` 로, 그 밖은 `auth_failed` 로 둔다.

**격하 동작**: 위 두 경우 모두 다음을 함께 한다.

1. `port: 'error'` 로 보내고 `output.error.code` 를 인증 실패 코드로 둔다.
2. 활동 로그의 `error.code` 에도 같은 코드를 남긴다.
3. 통합 상태를 `error` 로, 사유를 `auth_failed` 또는 `insufficient_scope` 로 한 번의 UPDATE 로 바꾼다. 통합 관리 화면에 "Need attention" 이 보이게 된다. 전이 조건과 사유 값은 [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)이 정한다.

격하한 뒤 `error → connected` 로 자동으로 돌아가지 않고 사용자가 통합 재인증으로 되돌린다. Cafe24 Private 앱은 통합 재인증이 [재설치 대기 표시](../CLE-INT/CLE-INT-OAUTH.md#재설치-대기-표시)만 남기고, 24시간 안에 Cafe24 Developers 의 "테스트 실행" 으로 콜백이 성공하면 `connected` 로 돌아간다. 그때까지 노드는 `INTEGRATION_NOT_CONNECTED` 로 끝난다. App URL 이 없는(설치 토큰이 없는) Private 통합만 삭제 후 다시 등록해야 한다([OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md#cafe24-private-이-오류가-되면-삭제-후-재등록만-된다)). 자동 복귀를 막는 것은 시각 경쟁으로 상태가 뒤바뀌지 않게 하려는 정책이고 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)의 인증 실패 전환 정책과 같다.

### 토큰 갱신 실패

호출 전 사전 갱신([실행 로직](CLE-NODE-CAFE24-EXEC.md#실행-로직) 6단계)과 401 뒤 갱신(위 1단계)은 실패를 같은 규칙으로 다룬다.

| 갱신 요청의 결과 | 노드 출력 코드 | 통합 상태 | 연속 전송 실패 카운터 |
|------------------|----------------|-----------|-----------------------|
| 401·403 으로 거절 | `CAFE24_AUTH_FAILED` | 갱신 단계가 `error(auth_failed)` 로 바꾼다 | 바꾸지 않는다 |
| 401·403 밖의 상태(5xx·429·400 등)로 실패 | `CAFE24_TRANSPORT_FAILED`(`meta.statusCode = 0`) | 바꾸지 않는다 | 더하지 않는다 |
| 응답을 받지 못함(DNS·연결·타임아웃) | `CAFE24_TRANSPORT_FAILED`(`meta.statusCode = 0`) | 3회 연속이면 `error(network)` | 더한다 |

401·403 밖 상태의 갱신 실패는 노드가 따로 분류하지 않아 전송 실패와 같은 코드로 나간다. 그래도 토큰 엔드포인트가 응답한 실패라서 연속 전송 실패 카운터([통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md) REQ-INTSTAT-008)에는 더하지 않는다. 연결 테스트(`pingConnection`)는 같은 실패를 `CAFE24_API_ERROR` 로 돌려준다([서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md#cafe24)). 리프레시 토큰이 무효(`invalid_grant`)라는 응답이 401·403 이 아닌 상태로 올 때의 처리는 후속 Task `CLE-T-S0BJBV` 에서 정한다.

## Rationale

### 필드 편집 UI

operation 메타데이터 기반 동적 폼을 쓴다. `extras.operationsByResource` 로 (리소스, operation) 별 `fields[]` 가 프론트엔드에 도착한다. UI 는 메타데이터에 적힌 키만 행으로 렌더하고 필수와 선택으로 나눈다. 사용자가 임의 키를 더하는 경로가 없으니 빈 키 행이나 편집 버퍼 문제가 구조적으로 사라진다. 모든 값 칸은 `ExpressionInput` 을 바탕으로 해서 표현식을 유지한다. 자유 key-value 행 입력은 어느 키가 필수·선택인지 안내하지 못하고 빈 키 행용 편집 버퍼를 따로 둬야 해서 쓰지 않았다. 다른 통합 노드(HTTP Request 의 `headers`·`queryParams`)는 `KeyValue[]` 로 직렬화하므로 이 결정의 대상이 아니다(빈 키 행도 그대로 에코).

operation 을 바꿀 때 `fields` 를 모두 초기화하면 다음 operation 도 받는 키를 사용자가 다시 입력해야 해서 키의 **교집합**만 남긴다. 리소스를 바꾸면 뜻이 너무 크게 달라지므로 모두 초기화한다.

### 별도 승인 라벨을 메타데이터 한 곳에서 렌더

화면 네 곳(통합 추가 위저드, 통합 상세 권한 범위 영역, 이 노드의 operation 드롭다운, AI 에이전트 노출 도구 목록)의 ⚠ 라벨은 모두 같은 메타데이터(`Cafe24OperationMetadata.restrictedApproval`)에서 자동으로 렌더한다. 명단의 단일 기준은 [Cafe24 별도 승인 scope](CLE-C24-SCOPES)뿐이다. 이 문서는 라벨이 보이는 자리만 적고 명단을 되풀이하지 않는다(어긋남 방지). 막는 정책을 택하지 않은 이유는 [OAuth 연결과 토큰 갱신 Rationale](../CLE-INT/CLE-INT-OAUTH.md#cafe24-별도-승인-권한-범위는-막지-않고-안내한다)에 있다. 새 에러 코드는 더하지 않았다. 403 은 `CAFE24_AUTH_FAILED` 로 알리고 별도 승인 단서는 `last_error.details.requiresCafe24Approval` 에 둔다. `CAFE24_INSUFFICIENT_SCOPE` 는 연결 테스트 결과 코드로만 쓰고 노드 출력에는 내지 않는다([Cafe24 노드 Rationale](CLE-NODE-CAFE24.md#403-은-cafe24_auth_failed-와-사유-insufficient_scope-로-낸다)).

### 리다이렉트 뒤에도 남은 3xx 는 `CAFE24_4XX` 다

결정일: 2026-11-28

API 클라이언트의 `fetch` 는 리다이렉트를 자동으로 따라간다. 그 뒤에도 3xx 가 남았다면 요청한 자원의 응답을 받지 못한 것이다. 그래서 2xx 만 성공으로 보고 남은 3xx 는 에러 포트로 보낸다(NERV Task `CLE-T-8SCV17`). 노드 핸들러와 AI 에이전트 도구는 같은 판정 함수(`isHttpFailureStatus`)를 쓴다. 코드는 `CAFE24_4XX` 를 그대로 쓴다. 이 코드는 따로 이름이 없는 2xx 밖 응답을 받는 대체값이라 3xx 를 넣어도 워크플로우 분기가 바뀌지 않는다. HTTP Request 노드의 `HTTP_4XX` 도 같은 판단이다([에러 코드 카탈로그 — 워크플로우 실행](../CLE-API/CLE-API-ERRCODES-EXEC.md)). MakeShop 노드의 `MAKESHOP_4XX` 도 같은 규칙이다.

- 기각한 안: 3xx 를 성공으로 보는 안은 요청한 자원이 아닌 본문이 `success` 포트로 가서 다음 노드가 잘못된 데이터를 받는다. `CAFE24_3XX` 를 새로 만드는 안은 노드 출력 코드가 늘고 워크플로우가 분기를 하나 더 다뤄야 해서 택하지 않았다.

### 토큰 갱신이 401 이나 403 밖의 상태로 실패해도 노드 출력 코드는 그대로다

결정일: 2026-11-28

연결 테스트는 갱신 요청이 401·403 밖의 상태로 실패하면 `CAFE24_API_ERROR` 로 돌려준다. 사용자가 직접 누른 진단이라 받은 상태를 메시지에 실어 원인을 보여 준다. 노드 출력은 지금처럼 `CAFE24_TRANSPORT_FAILED` 다(NERV Task `CLE-T-DJGSBR`). 노드 출력 코드를 바꾸면 이 코드로 분기하던 워크플로우가 깨진다. `CAFE24_API_ERROR` 는 연결 테스트 결과 코드이고 노드 출력에는 나오지 않는다. 이 실패는 연속 전송 실패 카운터에 더하지 않는다. 토큰 엔드포인트가 응답했으므로 연결이 끊겼다는 신호로 보지 않는다.

- 기각한 안: 노드도 `CAFE24_API_ERROR` 를 내는 안은 노드 출력 코드 집합이 바뀌어 택하지 않았다.
- `invalid_grant` 처리는 이 결정에서 떼어 후속 Task `CLE-T-S0BJBV` 로 넘겼다.
