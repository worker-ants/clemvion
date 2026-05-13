# Spec: Cafe24

> 관련 문서: [Integration 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진 §10](../../5-system/4-execution-engine.md#10-integration-handler-계약) · [Spec 통합 §5.8 Cafe24](../../2-navigation/4-integration.md#58-cafe24) · [Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge) · [CONVENTIONS](../../conventions/node-output.md) · [Cafe24 API Metadata 컨벤션](../../conventions/cafe24-api-metadata.md)

## Overview (제품 정의)

한국 이커머스 SaaS [Cafe24](https://developers.cafe24.com/docs/ko/api/admin/) 의 Admin API 를 워크플로와 AI Agent 양쪽에서 호출할 수 있게 한다.

- **사용자 가치**: 쇼핑몰 운영자가 상품·주문·회원·프로모션 등 모든 Admin API endpoint 를 워크플로 노드 1개로 호출 가능. 동시에 AI Agent 에 같은 Integration 을 도구로 부여하면 LLM 이 자연어로 "어제 미발송 주문 가져와줘" 같은 작업을 수행한다.
- **지원 범위**: Cafe24 Admin API 의 **18 카테고리 전부 (Store / Product / Order / Customer / Community / Design / Promotion / Application / Category / Collection / Supply / Shipping / Salesreport / Personal / Privacy / Mileage / Notification / Translation)**. 카테고리당 평균 ~10 operation = 총 ~180 endpoint 를 메타데이터 기반 동적 폼으로 표현한다.
- **이중 활용**: Cafe24 는 본 프로젝트에서 "같은 Integration 1개가 워크플로 캔버스 노드와 AI Agent MCP 도구 양쪽에 동시 노출되는" 첫 사례다. backend 의 `Cafe24McpBridge` 가 [Spec MCP Client §2.3](../../5-system/11-mcp-client.md#23-internal-bridge) 의 in-process `IMcpClient` 인터페이스를 구현하여 본 노드와 같은 메타데이터 테이블에서 MCP `tools/list` 응답을 생성한다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | `service_type='cafe24'` Integration ID ([공통 §1](./0-common.md#1-integration-참조)) |
| resource | Enum | ✓ | — | Cafe24 카테고리. 18 값: `store`, `product`, `order`, `customer`, `community`, `design`, `promotion`, `application` (**※ Cafe24 앱 관리 API — OAuth 앱 등록과 무관**), `category`, `collection`, `supply`, `shipping`, `salesreport`, `personal`, `privacy`, `mileage`, `notification`, `translation` |
| operation | String | ✓ | — | 선택한 `resource` 의 operation 식별자. 메타데이터 테이블 ([cafe24-api-metadata 컨벤션](../../conventions/cafe24-api-metadata.md))에 정의된 enum 중 하나 (예: `product_list`, `product_get`, `order_list`, `order_update_status`, ...) |
| fields | Record<string, unknown> | — | `{}` | 선택한 operation 의 입력 필드. 표현식 `{{ }}` 사용 가능. 각 operation 의 required/optional 필드는 메타데이터 테이블에서 정의 |
| pagination | object? | — | — | `{ limit?: number, offset?: number, cursor?: string }`. operation 이 페이지네이션을 지원하는 경우에만 사용. fields 와 분리해 표준화 |

표현식(`{{ }}`)은 `fields[*]` · `pagination.*` 모든 값에서 사용 가능.

> Source of truth: `backend/src/nodes/integration/cafe24/cafe24.schema.ts` (export `cafe24NodeConfigSchema`, `cafe24NodeMetadata`)

## 2. 설정 UI

```
┌──────────────────────────────────────────┐
│  Integration: [my-cafe24-shop ▼]         │
│                                          │
│  Resource:    [Product           ▼]      │
│  Operation:   [Search products   ▼]      │
│                                          │
│  ┌─ Required ─────────────────────────┐ │
│  │ shop_no       [{{ $input.shop }} ] │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌─ Optional ─────────────────────────┐ │
│  │ category_no   [_________________ ] │ │
│  │ display       [☑ T  ☐ F          ] │ │
│  │ since         [{{ $now.iso }}    ] │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌─ Pagination ───────────────────────┐ │
│  │ Limit: [50_]   Offset: [0__]       │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

- Integration 드롭다운: `IntegrationSelector` 의 `serviceTypes=['cafe24']` 필터 (Cafe24 만 표시).
- Resource 드롭다운: 18 카테고리. 메타데이터에 정의된 라벨 표시 (예: `product` → "Product (상품)").
- Operation 드롭다운: Resource 변경 시 동적 갱신. 메타데이터의 (resource, operation) → label 매핑.
- Fields: Operation 선택 시 메타데이터의 입력 스키마(JSON Schema 호환 형식) 로 동적 폼 렌더. Required / Optional 두 그룹으로 분리.
- Pagination: operation 메타데이터에 `paginated: true` 가 있을 때만 표시.

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 입력 데이터 (`$input` 으로 참조) |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `success` | Success | data | false | Cafe24 API 2xx 응답 |
| `error` | Error | error | false | Cafe24 API 3xx/4xx/5xx, transport 실패, rate-limit 재시도 소진, 또는 메타데이터 검증 실패 |

`status` 는 비-블로킹 노드이므로 항상 생략 (Principle 0).

## 4. 실행 로직

[Integration 공통 §4 Handler 실행 세멘틱](./0-common.md#4-handler-실행-세멘틱) 의 6단계 계약을 따른다. 노드 고유 흐름:

1. **Config 정규화**: `resource` / `operation` 을 메타데이터에서 조회하여 `{ method, path, requiredFields, optionalFields, paginated, responseShape }` 해석. 미존재 시 throw `CAFE24_UNKNOWN_OPERATION`.
2. **Config echo 빌드** (Principle 7): `context.rawConfig` 를 그대로 spread — `resource`, `operation`, `fields`, `pagination` 의 `{{ }}` 표현식 보존. **자격증명은 echo 금지** — `integrationId` 만 echo.
3. **Integration 자격증명 해석**: `IntegrationsService.getForExecution(integrationId, workspaceId)` → `serviceType='cafe24'` 검증, `status='connected'` 검증. 실패 시 `INTEGRATION_NOT_FOUND` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` ([공통 §4.2](./0-common.md#42-공통-에러-코드)).
4. **credentials 충족 검증** (공통 §4.2 `INTEGRATION_INCOMPLETE`): `mall_id`, `app_type`, `access_token`, `refresh_token` 누락 시 throw. `app_type='private'` 인데 `client_id`/`client_secret` 누락 시 동일.
5. **Required fields 검증**: 메타데이터의 `requiredFields` 에 명시된 키가 `config.fields` 에 모두 존재하는지 검증. 누락 시 throw `CAFE24_MISSING_FIELDS` (어느 필드인지 details 에 명시).
6. **토큰 만료 확인 및 갱신**: `Integration.token_expires_at` 가 만료됐거나 60초 내 만료 예정이면 자동 갱신 ([§통합 §10.5 토큰 자동 갱신](../../2-navigation/4-integration.md#105-토큰-자동-갱신)). 갱신 실패 시 status 를 `expired` 로 전이하고 throw `INTEGRATION_NOT_CONNECTED`.
7. **URL 구성**: `https://{credentials.mall_id}.cafe24api.com/api/v2/admin/{operation.path}` — `{path}` 는 메타데이터에 정의된 path template (예: `products/{product_no}`). path parameter 는 `fields` 에서 채움.
8. **Query / Body 구성**: 메타데이터의 `fieldLocation` (path / query / body) 에 따라 분배. `pagination.{limit, offset, cursor}` 는 항상 query.
9. **호출 (rate-limit-aware)**: `Cafe24ApiClient` wrapper 가 다음을 수행 — `Authorization: Bearer {access_token}` 헤더 부여 → fetch → 응답 헤더 `X-Cafe24-Call-Remain` 모니터링 → 429 응답 시 헤더 값(초) 만큼 sleep 후 재시도(최대 2회).
10. **응답 파싱**: JSON 본문을 그대로 `output.response` 에 보존. `meta.statusCode`, `meta.durationMs`, `meta.callUsage` (헤더 `X-Cafe24-Call-Usage`), `meta.callRemain` (헤더 `X-Cafe24-Call-Remain`).
11. **Usage 로깅** ([공통 §4 의 6단계 Usage 로깅](./0-common.md#4-handler-실행-세멘틱)): 성공·실패 무관 1건. `error.code` 는 §6 의 vocabulary.
12. **반환 분기**:
    - 2xx → §5.1 (`port:'success'`)
    - 3xx/4xx/5xx → §5.3 (`port:'error'`, `output.error.code` 는 §6 분류 (`CAFE24_404` / `CAFE24_422` / `CAFE24_AUTH_FAILED` / `CAFE24_RATE_LIMITED` / `CAFE24_4XX` / `CAFE24_5XX`))
    - transport 실패 → §5.3 (`output.error.code = 'CAFE24_TRANSPORT_FAILED'`, `meta.statusCode = 0`)

### 4.1 Rate Limit 처리 상세

| 헤더 | 의미 | 동작 |
|------|------|------|
| `X-Api-Call-Limit` | `현재/상한` (예: `1/40`) | 진단 메트릭으로만 보존 (`meta.callLimit`) |
| `X-Cafe24-Call-Usage` | 호출 사용률 (%) | `meta.callUsage` |
| `X-Cafe24-Call-Remain` | 재개까지 남은 시간 (초) | 429 시 sleep 시간 |
| `X-Cafe24-Time-Usage` | 처리시간 사용률 (%) | `meta.timeUsage` (있을 때) |
| `X-Cafe24-Time-Remain` | 처리시간 재개 시간 (초) | 429 시 sleep 보정 |

- **429 응답 시 정책**: `max(X-Cafe24-Call-Remain, X-Cafe24-Time-Remain)` 만큼 sleep. 최대 2회 재시도. 3번째 429 시 `output.error.code = 'CAFE24_RATE_LIMITED'` 로 error 포트 라우팅.
- **노드 / MCP Bridge 공유 (동일 프로세스 인스턴스 내)**: 같은 Integration credential 을 사용하므로 같은 leaky bucket. wrapper 의 sleep 은 **동일 프로세스 인스턴스 내** Integration ID 별 in-memory mutex 로 보호되어 한 노드가 sleep 중이면 동일 Integration 의 다른 호출도 자동 대기 (오버드라이브 방지). 멀티 인스턴스 배포 환경에서는 인스턴스 간 직렬화가 자동 보장되지 않으며, 필요 시 Redis 기반 조율을 별도 spec 으로 도입 가능 (현 spec 의 trade-off — Cafe24 leaky bucket 은 Integration 단위 quota 이므로 인스턴스 간 동시 호출 시에도 429 응답이 자체 backoff 신호로 작동).

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 외 top-level 키 금지. `output.response` (Principle 8.2 의 HTTP 관용 네이밍 재사용). `meta.durationMs` 통일 ([공통 §6.1](./0-common.md#61-metaduration-vs-metadurationms-명명-통일)).
>
> `status` 는 비-블로킹 노드이므로 항상 생략.

### 5.1 Case: 2xx 성공 (port `success`)

```json
{
  "config": {
    "integrationId": "int_cafe24_myshop",
    "resource": "product",
    "operation": "product_list",
    "fields": {
      "shop_no": 1,
      "display": "T",
      "since": "{{ $now.iso }}"
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
| `config.integrationId` | UUID | config echo (Principle 7) | 사용자 입력 raw |
| `config.resource` | Enum | config echo | 18 카테고리 중 하나 |
| `config.operation` | string | config echo | operation 식별자 |
| `config.fields` | object | config echo | 사용자 입력 raw — `{{ }}` 보존 |
| `config.pagination?` | object | config echo | paginated operation 시 |
| `output.response` | unknown | runtime — Cafe24 응답 body | Cafe24 API 응답을 그대로 보존 (구조는 operation 별 차이) |
| `meta.statusCode` | number | engine inject (handler return) | HTTP 응답 status (2xx) |
| `meta.durationMs` | number | engine inject | 요청 시작부터 응답 수신까지의 ms |
| `meta.callUsage?` | number | runtime | `X-Cafe24-Call-Usage` 헤더 (%) |
| `meta.callRemain?` | number | runtime | `X-Cafe24-Call-Remain` 헤더 (초) |
| `meta.callLimit?` | string | runtime | `X-Api-Call-Limit` 헤더 (`현재/상한`) |
| `port` | `'success'` | handler return | 2xx 응답 분기 |

**Expression 접근 예**:
- `$node["X"].output.response.products[0].product_no` → 1001
- `$node["X"].meta.statusCode` → 200
- `$node["X"].config.resource` → `"product"`

### 5.3 Case: API 에러 또는 Transport 실패 (port `error`)

CONVENTIONS Principle 3.2 의 표준 envelope `output.error.{code, message, details?}`. 4xx/5xx 의 경우 서버가 돌려준 응답 body 는 `output.response` 에 보존 (디버깅).

#### 5.3.1 Cafe24 API 4xx / 5xx 응답

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
      "message": "Cafe24 API returned 404 — Not Found",
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

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.fields` | object | config echo | 호출 시도한 입력 (Principle 7 — `{{ }}` 보존) |
| `output.response` | unknown | runtime | 4xx/5xx 시에도 Cafe24 응답 body 보존 |
| `output.error.code` | string | handler return | §6 vocabulary |
| `output.error.message` | string | handler return | `Cafe24 API returned <status> — <statusText>` |
| `output.error.details.statusCode` | number | handler return | HTTP status |
| `output.error.details.mallId` | string | handler return | 호출 대상 mall_id (디버깅) |
| `output.error.details.resource` / `operation` | string | handler return | 호출 시도한 노드 설정 |
| `output.error.details.cafe24ErrorCode` / `cafe24Message` | string? | handler return | Cafe24 응답 body 의 `error.code` / `message` (있을 때) |
| `meta.statusCode` | number | handler return | HTTP 응답 status |
| `port` | `'error'` | handler return | 에러 분기 |

#### 5.3.2 Rate Limit 재시도 소진

```json
{
  "config": {
    "integrationId": "...",
    "resource": "product",
    "operation": "product_list",
    "fields": {}
  },
  "output": {
    "error": {
      "code": "CAFE24_RATE_LIMITED",
      "message": "Cafe24 leaky bucket exhausted after 2 retries",
      "details": {
        "retries": 2,
        "lastRetryAfterSec": 5,
        "mallId": "myshop"
      }
    }
  },
  "meta": { "statusCode": 429, "durationMs": 12500, "callUsage": 100, "callRemain": 5 },
  "port": "error"
}
```

> `config.fields` 가 `{}` 인 경우에도 명시적으로 echo 한다 (Principle 7 — 누락 ≠ undefined).

#### 5.3.3 Transport 실패 (네트워크 / 타임아웃)

```json
{
  "config": {
    "integrationId": "...",
    "resource": "order",
    "operation": "order_list",
    "fields": {}
  },
  "output": {
    "error": {
      "code": "CAFE24_TRANSPORT_FAILED",
      "message": "ECONNRESET",
      "details": { "mallId": "myshop", "resource": "order", "operation": "order_list" }
    }
  },
  "meta": { "statusCode": 0, "durationMs": 30000 },
  "port": "error"
}
```

### 5.8 Pre-flight throw (노드 실패)

다음은 모두 throw → 노드 실행 실패 처리 (CONVENTIONS Principle 3.1). 워크플로우 수준에서는 `error` 포트가 아닌 실행 실패로 표면화된다.

| 발생 조건 | 메시지 / 코드 | 시점 |
|-----------|----------------|------|
| `integrationId` 누락 | `Integration 을 선택해야 합니다.` | warningRule (캔버스 배지) + handler.validate |
| `resource` 누락 또는 enum 미일치 | `resource must be one of: store, product, order, ... (18 categories)` | handler.validate |
| `operation` 누락 또는 메타데이터에 미존재 | `CAFE24_UNKNOWN_OPERATION: operation "<value>" not defined for resource "<resource>"` | handler.execute |
| Integration `serviceType !== 'cafe24'` | `INTEGRATION_TYPE_MISMATCH` ([공통 §4.2](./0-common.md#42-공통-에러-코드)) | handler.execute |
| Integration `status !== 'connected'` | `INTEGRATION_NOT_CONNECTED` ([공통 §4.2](./0-common.md#42-공통-에러-코드)) | handler.execute |
| credentials 필수 필드 누락 (`mall_id`, `access_token`, `refresh_token`, app_type=private 시 `client_id`/`client_secret`) | `INTEGRATION_INCOMPLETE` ([공통 §4.2](./0-common.md#42-공통-에러-코드)) | handler.execute |
| `mall_id` 형식 위반 (소문자 영숫자·하이픈, 3~50자 외) | `CAFE24_INVALID_MALL_ID: mall_id must match /^[a-z0-9-]{3,50}$/` | handler.execute |
| operation 의 `requiredFields` 중 일부 누락 | `CAFE24_MISSING_FIELDS: missing required fields [field1, field2]` | handler.execute |
| `__workspaceId` 컨텍스트 누락 | `Missing workspace context — handler cannot resolve the integration` | handler.execute |

## 6. 에러 코드

런타임 (`port:'error'`) 에서 채워지는 `output.error.code` enum:

| 코드 | 조건 | `output.response` | `meta.statusCode` |
|------|------|-------------------|---------------------|
| `CAFE24_4XX` | `400 ≤ statusCode < 500` (404·422 외의 fallback) | 서버 body 보존 | 응답 status |
| `CAFE24_404` | Cafe24 응답 404 (자주 분기되는 케이스) | 서버 body 보존 | 404 |
| `CAFE24_422` | Cafe24 응답 422 (validation 실패) | 서버 body 보존 | 422 |
| `CAFE24_AUTH_FAILED` | 401 / 403. `Integration.status` 를 `error(auth_failed)` 로 atomic 전이 | 서버 body 보존 | 401 / 403 |
| `CAFE24_RATE_LIMITED` | 429 응답 + 재시도 소진 | 서버 body 보존 (있으면) | 429 |
| `CAFE24_5XX` | `500 ≤ statusCode < 600` | 서버 body 보존 | 응답 status |
| `CAFE24_TRANSPORT_FAILED` | `fetch` reject (DNS / 연결 거부 / 소켓 / `AbortController` timeout) | 미정의 | `0` |

Pre-flight throw 코드는 §5.8 참조 — `output.error.code` 가 아니라 노드 실행 실패로 분기되며, `IntegrationUsageLog` 의 `error.code` 로만 기록된다 (`CAFE24_UNKNOWN_OPERATION`, `CAFE24_MISSING_FIELDS`, `CAFE24_INVALID_MALL_ID`, `INTEGRATION_*`).

### 6.1 인증 실패 자동 status 전환

응답이 401/403 이면 다음을 동시에 수행 (Spec MCP Client §8.4 와 동일 정책):

1. `port: 'error'`, `output.error.code = 'CAFE24_AUTH_FAILED'` 로 분기
2. `IntegrationUsageLog.error.code = 'CAFE24_AUTH_FAILED'` 로 로그 기록
3. **`Integration.status` 를 `error` 로, `status_reason` 을 `auth_failed` 로 atomic UPDATE 전환** — 다음 노드 실행이 기동될 때 통합 관리 화면이 "Need attention" 배너로 자동 노출

자동 복구 없음 — 토큰이 다시 유효해지면 사용자가 명시적으로 `Reauthorize` 로 `connected` 복귀.

## 7. 캔버스 요약

[공통 §5](./0-common.md#5-캔버스-요약) — `Cafe24` 행 인용. 요약 포맷: `{resource} · {operation}` (예: `product · product_list`). 연결된 Integration 이 삭제된 경우 `⚠ Missing integration` (앰버색).

## 8. AI Agent 노출 (Internal MCP Bridge)

`Integration` 1개가 본 노드와 AI Agent 의 MCP 도구 양쪽에서 사용된다. 백엔드의 `Cafe24McpBridge` 가 [Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge) 의 in-process `IMcpClient` 인터페이스를 구현하여 본 노드와 동일한 메타데이터 테이블로부터 MCP `tools/list` 응답을 자동 생성한다.

### 8.1 도구 이름 매핑

| 노드 측 | MCP 측 |
|---------|--------|
| `resource='product'`, `operation='product_list'` | `mcp_<int8자>__product_list` |
| `resource='order'`, `operation='order_get'` | `mcp_<int8자>__order_get` |
| `resource='customer'`, `operation='customer_update'` | `mcp_<int8자>__customer_update` |

도구 이름 sanitize / 길이 규칙은 [Spec MCP Client §5.2 도구 이름 규칙](../../5-system/11-mcp-client.md#52-도구-이름-규칙) 그대로 적용. `<resource>_<operation>` 토큰 안에 underscore 가 1개 들어가는 점에 유의 — MCP §5.2 의 `__` 구분자 규칙은 server↔tool 의 첫 `__` 발생 위치로 split 하므로 충돌 없음.

> **Bridge 내부 API 형식**: `Cafe24McpBridge.callTool(name, args)` 에서 `name` 은 bare operation id (예: `product_list`) — MCP Client 레이어가 `mcp_<sid>__` prefix 를 자동 부여한다. allowlist (`mcpServers[].enabledTools`) 도 동일하게 bare id 배열로 저장한다 ([Cafe24 API Metadata 컨벤션 §5](../../conventions/cafe24-api-metadata.md#5-mcp-bridge-와의-매핑)).

### 8.2 메타도구 (resources / prompts) 미사용

Cafe24 MCP Bridge 는 `listTools` 만 보고하고 `resources` / `prompts` capability 는 **보고하지 않는다** — Cafe24 Admin API 는 도구 기반 RPC 모델이며 prompt 템플릿이나 read-only resource 모델이 없다. 따라서 `mcp_<sid>__list_resources` 등 메타도구는 노출되지 않는다 ([Spec MCP Client §5.1 노출 규칙](../../5-system/11-mcp-client.md#51-노출-규칙)).

### 8.3 allowlist (`mcpServers[].enabledTools`)

AI Agent config 의 `mcpServers[i].enabledTools` 는 `['product_list', 'order_list', ...]` 형식의 bare operation id 배열로 저장한다 ([Spec MCP Client §5.6](../../5-system/11-mcp-client.md#56-도구-allowlist)). UI 에서는 Resource 단위 grouping 으로 사용성 보강 — "Product (read/write 전부 허용)" 같은 short form 을 frontend 가 enabledTools 배열로 펼쳐 저장한다.

### 8.4 Rate Limit 공유 (동일 프로세스 인스턴스 내)

노드 호출 / MCP `tools/call` 모두 같은 `Cafe24ApiClient` wrapper 를 통과한다 → 같은 Integration credential 에 대한 leaky bucket 공유. AI Agent multi-turn 도중 LLM 이 빠르게 연속 호출하면 다른 워크플로의 같은 Integration 사용도 함께 대기한다 (§4.1 의 동일 프로세스 인스턴스 mutex). 격리는 Integration 단위 — 서로 다른 `mall_id` 의 Integration 간에는 공유되지 않는다.

### 8.5 IntegrationUsageLog

MCP 측 호출도 동일한 `IntegrationUsageLog` 에 기록된다 ([Spec MCP Client §8.3](../../5-system/11-mcp-client.md#83-integrationusagelog)). `node_execution_id` 는 호출 시점의 AI Agent NodeExecution. 통합 관리 상세 페이지의 Recent Activity 탭은 두 경로의 호출을 함께 표시한다.

---

## 9. Rationale

### 9.1 단일 노드 + 메타데이터 테이블

대안:
- (A) **endpoint 당 도메인 노드** (예: `cafe24_product_list`, `cafe24_order_get` 등 ~180개): 캔버스 가독성·노드 카탈로그가 무너짐.
- (B) **범용 HTTP 노드 + 인증만 등록**: 사용자가 매번 URL/method 구성 → UX 저하. rate-limit 헤더 처리 일반화 어려움.
- (C, 채택) **단일 노드 + Resource/Operation 동적 폼**: 캔버스 노드 1개 + 카테고리당 평균 ~10 endpoint 의 동적 폼. 신규 endpoint = 메타데이터 row 1 추가.

n8n / Make 의 Cafe24 노드 패턴과 동일한 결정.

### 9.2 Internal MCP Bridge

AI Agent 에서 Cafe24 를 도구로 쓰는 옵션 비교 (사용자 대화 로그):

- (A, 채택) Internal MCP Bridge — 같은 Integration 1개, in-process bridge. AI Agent spec/handler 변경 0. `IMcpClient` 인터페이스의 backend 구현 경로는 `backend/src/integrations/mcp/imcp-client.ts` (interface) + `Cafe24McpBridge` 구현체 (메타데이터 → tools/list).
- (B) 별도 외부 MCP 서버 + Integration 2번 등록 — credential 중복·운영 부담.
- (C) 일반 도구 재작성을 기다려 캔버스 노드를 Tool Area 등록 — `plan/in-progress/ai-agent-tool-connection-rewrite.md` 일정 종속. 단일 노드 1개를 도구화하면 (resource, operation) 1조합만 → 캔버스에 노드 다중 배치 필요. **옵션 A 채택 + 옵션 C 보완** (재작성 완료 후 합류).

### 9.3 노드의 Resource/Operation 메타데이터 위치

- spec 본문에 ~180개 enumeration 을 적지 않는다 — Cafe24 가 추가/변경할 때마다 spec drift 위험. spec 은 형식·예시·카테고리 18개만 명시.
- 정식 메타데이터는 [`spec/conventions/cafe24-api-metadata.md`](../../conventions/cafe24-api-metadata.md) 의 컨벤션을 따르는 backend metadata 모듈 (예: `backend/src/nodes/integration/cafe24/metadata/*.ts`) 에 저장. 신규 endpoint 추가 절차도 컨벤션에 정의.

### 9.4 Public + Private 앱 동시 지원

대화에서 사용자가 "둘 다 지원" 선택. 공개 앱(앱스토어 등록 전 단계)과 단일 mall private 앱 양쪽 모두 같은 spec 에서 처리. credentials JSONB 에 `app_type` 라디오 + private 시 `client_id`/`client_secret` 입력란.

### 9.5 5필드 invariant 준수

본 노드는 CONVENTIONS Principle 0~11 을 모두 준수한다:
- Principle 0: 5필드 (`config`/`output`/`meta`/`port`) — `status` 는 비-블로킹이므로 생략.
- Principle 1.1: config (raw) ↔ output (런타임) 직교.
- Principle 3: `port: 'error'` + `output.error.{code, message, details?}`.
- Principle 7: `config` 는 `context.rawConfig` echo. 자격증명은 echo 금지 (integrationId 만 echo).
- Principle 8.2: HTTP 관용 네이밍 `output.response` 재사용.

### 9.6 Rate Limit 의 범위 한정

`Cafe24ApiClient` wrapper 의 in-memory mutex 는 **동일 프로세스 인스턴스 내** 보호만 보장한다. 멀티 인스턴스 배포에서는 인스턴스 간 직렬화 없음. trade-off:
- Cafe24 leaky bucket 은 Integration 단위 quota (mall_id 기준) → 인스턴스 간 동시 호출 시 429 가 자체적으로 backoff 신호로 작동.
- Redis 기반 분산 mutex 도입은 별도 spec 으로 — 운영 부하 vs 호출 효율의 trade-off 가 도입 시점에 결정.

## 10. CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-13 | 신규 spec — Cafe24 Admin API 단일 노드 (Resource × Operation 동적 폼). AI Agent Internal MCP Bridge 노출 (§8). credentials 스키마는 [통합 §5.8 Cafe24](../../2-navigation/4-integration.md#58-cafe24). consistency-check 세션: `review/consistency/2026-05-13_23-22-19/` (Critical 0) |
