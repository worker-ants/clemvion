---
id: cafe24
status: implemented
code:
  - codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts
  - codebase/backend/src/nodes/integration/cafe24/cafe24.schema.ts
  - codebase/backend/src/nodes/integration/cafe24/cafe24.component.ts
  - codebase/backend/src/nodes/integration/cafe24/metadata/index.ts
  - codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts
  - codebase/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts
  - codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts
  - codebase/backend/src/modules/integrations/third-party-oauth.controller.ts
  - codebase/backend/src/modules/integrations/cafe24-install-rate-limit.service.ts
  - codebase/backend/src/modules/integrations/cafe24-install-nonce-cache.service.ts
---

# Spec: Cafe24

> 관련 문서: [Integration 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진 §10](../../5-system/4-execution-engine.md#10-integration-handler-계약) · [Spec 통합 §5.8 Cafe24](../../2-navigation/4-integration.md#58-cafe24) · [Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge-in-process) · [CONVENTIONS](../../conventions/node-output.md) · [Cafe24 API Metadata 컨벤션](../../conventions/cafe24-api-metadata.md) · [Cafe24 API Catalog](../../conventions/cafe24-api-catalog/_overview.md)

## Overview (제품 정의)

한국 이커머스 SaaS [Cafe24](https://developers.cafe24.com/docs/ko/api/admin/) 의 Admin API 를 워크플로와 AI Agent 양쪽에서 호출할 수 있게 한다.

- **사용자 가치**: 쇼핑몰 운영자가 상품·주문·회원·프로모션 등 모든 Admin API endpoint 를 워크플로 노드 1개로 호출 가능. 동시에 AI Agent 에 같은 Integration 을 도구로 부여하면 LLM 이 자연어로 "어제 미발송 주문 가져와줘" 같은 작업을 수행한다.
- **지원 범위**: Cafe24 Admin API 의 **18 카테고리 전부 (Store / Product / Order / Customer / Community / Design / Promotion / Application / Category / Collection / Supply / Shipping / Salesreport / Personal / Privacy / Mileage / Notification / Translation)**. 카테고리당 평균 ~10 operation = 총 ~180 endpoint 를 메타데이터 기반 동적 폼으로 표현한다.
- **이중 활용**: Cafe24 는 본 프로젝트에서 "같은 Integration 1개가 워크플로 캔버스 노드와 AI Agent MCP 도구 양쪽에 동시 노출되는" 첫 사례다. backend 의 `Cafe24McpToolProvider` (AI Agent 핸들러의 `AgentToolProvider` 인터페이스 구현체) 가 [Spec MCP Client §2.3](../../5-system/11-mcp-client.md#23-internal-bridge-in-process) 의 in-process Internal Bridge 패턴으로 본 노드와 같은 메타데이터 테이블에서 MCP 도구 목록을 생성한다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | `service_type='cafe24'` Integration ID ([공통 §1](./0-common.md#1-integration-참조)) |
| resource | Enum | ✓ | — | Cafe24 카테고리. 18 값: `store`, `product`, `order`, `customer`, `community`, `design`, `promotion`, `application` (**※ Cafe24 앱 관리 API — OAuth 앱 등록과 무관**), `category`, `collection`, `supply`, `shipping`, `salesreport`, `personal`, `privacy`, `mileage`, `notification`, `translation` |
| operation | String | ✓ | — | 선택한 `resource` 의 operation 식별자. 메타데이터 테이블 ([cafe24-api-metadata 컨벤션](../../conventions/cafe24-api-metadata.md))에 정의된 enum 중 하나 (예: `product_list`, `product_get`, `order_list`, `order_update_status`, ...) |
| fields | Record<string, unknown> | — | `{}` | 선택한 operation 의 입력 필드. 표현식 `{{ }}` 사용 가능. 각 operation 의 required/optional 필드는 메타데이터 테이블에서 정의 |
| pagination | object? | — | — | `{ limit?: number, offset?: number }`. operation 이 페이지네이션을 지원하는 경우에만 사용. fields 와 분리해 표준화. `cursor` 는 Cafe24 Admin API 가 일관 지원하지 않아 폐기됨 (B-3-7, Rationale 참조) |

표현식(`{{ }}`)은 `fields[*]` · `pagination.*` 모든 값에서 사용 가능.

> Source of truth: `codebase/backend/src/nodes/integration/cafe24/cafe24.schema.ts` (export `cafe24NodeConfigSchema`, `cafe24NodeMetadata`)

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
- Fields: Operation 선택 시 메타데이터의 입력 스키마(JSON Schema 호환 형식) 로 동적 폼 렌더. Required / Optional 두 그룹으로 분리. 각 필드는 `ExpressionInput` 베이스 위젯을 사용하여 표현식(`{{ }}`) 입력을 모든 칸에서 허용하며, `enum` / `boolean` / `default` 정보는 hint 텍스트로 표면화한다. 키는 메타데이터로 고정되므로 사용자가 임의 key 를 추가하는 경로는 없다 (배경: §9.9).
  - **호환 키 보존**: Operation 변경 시 새 op 의 `fields[].name` 과 교집합인 키만 유지하고 무관 키는 drop. 예) `product_get` (shop_no 만) → `product_list` (shop_no + display + ...) 전환 시 `shop_no` 값은 유지된다.
- Operation 후보 표시: 카탈로그 (`spec/conventions/cafe24-api-catalog/`) 의 `status: planned` 행도 dropdown 에 노출하되 disabled + "(지원 예정)" 접미사로 구분. resource 옆에 "지원 N개 · 추후 지원 M개" coverage hint.
  - **별도 승인 라벨**: 메타데이터 row 에 `restrictedApproval` ([cafe24-api-metadata 컨벤션 §2](../../conventions/cafe24-api-metadata.md#2-operation-메타데이터-형식)) 이 있는 operation 은 라벨 우측에 ⚠ 아이콘 + 보조 텍스트 ("별도 승인 필요") 표시. resource 가 scope 단위 restricted (mileage / notification / privacy — `restrictedApproval.level='scope'`) 면 같은 resource 의 모든 operation 에 자동 적용. store resource 의 `restrictedApproval.level='operation'` row (paymentgateway_*, paymentgateway_paymentmethods_*, financials_paymentgateway_get, menus_get, activitylogs_*, naverpay_setting_*, kakaopay_setting_*) 는 해당 row 만 ⚠. tooltip 본문·문의 링크는 [`spec/conventions/cafe24-restricted-scopes.md §4.1`](../../conventions/cafe24-restricted-scopes.md#41-사용자-안내-ui). `approvalGroup` 필드 (메시지 묶음 식별자) 별 문구는 frontend i18n dict 가 관리한다.
- Pagination: operation 메타데이터에 `paginated: true` 가 있을 때만 표시. supported 가 아닌 operation (planned / unknown) 선택 시 fields/pagination 미렌더.

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

1. **Config 정규화**: `resource` / `operation` 을 메타데이터에서 조회하여 `{ method, path, requiredFields, optionalFields, paginated, responseShape }` 해석. 미존재 시 catch 후 §5.3 (`port: 'error'`, `output.error.code = 'CAFE24_UNKNOWN_OPERATION'`) 라우팅 (D4).
2. **Config echo 빌드** (Principle 7): `context.rawConfig` 를 그대로 spread — `resource`, `operation`, `fields`, `pagination` 의 `{{ }}` 표현식 보존. **자격증명은 echo 금지** — `integrationId` 만 echo.
3. **Integration 자격증명 해석**: `IntegrationsService.getForExecution(integrationId, workspaceId)` → `serviceType='cafe24'` 검증, `status='connected'` 검증. 실패 시 `INTEGRATION_NOT_FOUND` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` 코드로 §5.3 라우팅 ([공통 §4.2](./0-common.md#42-공통-에러-코드), D4).
4. **credentials 충족 검증** (공통 §4.2 `INTEGRATION_INCOMPLETE`): `mall_id`, `app_type`, `access_token`, `refresh_token` 누락 시 catch 후 §5.3 라우팅. `app_type='private'` 인데 `client_id`/`client_secret` 누락 시 동일 (D4).
5. **Required fields + conditional constraints 검증**: 메타데이터의 `requiredFields` (AND 시맨틱 — 모두 필수) 가 `config.fields` 에 모두 존재하는지 + 메타데이터의 `constraints?` (kind 3종: `oneOf` (at-least-one-of) / `allOrNone` / `implies`, [Cafe24 API Metadata §2](../../conventions/cafe24-api-metadata.md#2-operation-메타데이터-형식)) 가 만족되는지 검증. 누락 또는 위반 시 catch 후 §5.3 (`output.error.code = 'CAFE24_MISSING_FIELDS'`, `details` 에 어느 필드 또는 어느 constraint kind 가 위반됐는지 명시) 라우팅 (D4).
6. **토큰 만료 확인 및 갱신**: `Integration.token_expires_at` 가 만료됐거나 60초 내 만료 예정이면 자동 갱신 ([§통합 §10.5 토큰 자동 갱신](../../2-navigation/4-integration.md#105-토큰-자동-갱신)). 갱신 실패 시: `refresh_token invalid_grant` 면 `error(auth_failed)` 로 전이 ([통합 §6 / Rationale "refresh 실패 시 status_reason 통일"](../../2-navigation/4-integration.md#rationale)), transport 3회 연속 실패면 `error(network)` 로 전이. throw `INTEGRATION_NOT_CONNECTED` 는 동일. cafe24 refresh 호출의 cross-pod 직렬화는 source 에 따라 다르다 — `proactive`/`background` 은 `cafe24-token-refresh` BullMQ 큐의 `jobId = integrationId` dedup 으로, `reactive_401` 은 unique jobId + `refreshAccessToken` 의 PostgreSQL row-level `pessimistic_write` lock 폴백 (§9.6 참고).
7. **URL 구성**: `https://{credentials.mall_id}.cafe24api.com/api/v2/admin/{operation.path}` — `{path}` 는 메타데이터에 정의된 path template (예: `products/{product_no}`). path parameter 는 `fields` 에서 채움.
8. **Query / Body 구성**: 메타데이터의 `fields[*].location` (path / query / body) 에 따라 분배. `pagination.{limit, offset}` 는 항상 query. body 의 envelope 직렬화는 step 9 의 wrapper 가 단일 책임으로 담당한다 (§4.2 참고).
9. **호출 (rate-limit-aware + 401 reactive refresh)**: `Cafe24ApiClient` wrapper 가 다음을 수행 — `Authorization: Bearer {access_token}` 헤더 부여 → POST/PUT 본문은 Cafe24 request envelope 으로 wrap (§4.2) → fetch → 응답 헤더 `X-Cafe24-Call-Remain` 모니터링 → 429 응답 시 헤더 값(초) 만큼 sleep 후 재시도(최대 2회). **401 응답 시** `refresh_token` 으로 access_token 을 1회 갱신 후 동일 요청 1회 재시도 (§6.1 의 401 분기 — proactive step 6 가 race window 로 빗나간 경우 자가 회복). 재시도가 2xx 면 step 10 정상 흐름; 재시도도 401 이면 §6.1 격하 (`error(auth_failed)`). 403 은 본 reactive refresh 대상 아님 — 즉시 §6.1 격하.
10. **응답 파싱**: JSON 본문을 그대로 `output.response` 에 보존. `meta.statusCode`, `meta.durationMs`, `meta.callUsage` (헤더 `X-Cafe24-Call-Usage`), `meta.callRemain` (헤더 `X-Cafe24-Call-Remain`).
11. **Usage 로깅** ([공통 §4 의 6단계 Usage 로깅](./0-common.md#4-handler-실행-세멘틱)): 성공·실패 무관 1건. `error.code` 는 §6 의 vocabulary. **활동 로그 API 식별 정보** ([`_product-overview.md` INT-US-05](./_product-overview.md#24-사용처-추적-및-라이프사이클)):
    - `api_label` = catalog key `cafe24.<resource>.<operation>` — 예: `cafe24.product.product_list`. cafe24 만 catalog 를 가지므로 4개 통합 중 유일하게 라벨이 NULL 이 아니다. frontend 가 `GET /api/integrations/services/cafe24/catalog` ([통합 §9.3](../../2-navigation/4-integration.md#93-사용처활동)) 응답의 `labelKey` 와 i18n dict 를 결합해 사람 친화 라벨로 렌더한다 — DB 는 언어 정보 없는 catalog key 만 저장 ([`cafe24-api-metadata.md`](../../conventions/cafe24-api-metadata.md))
    - `api_method` = operation 의 `method` (메타데이터 row 의 `method` 값 — `GET`/`POST`/`PUT`/`DELETE`)
    - `api_path` = operation 의 `path` template (메타데이터 row 의 `path` 값 — placeholder 그대로. 예: `products/{product_no}`. 실제 호출 URL 의 path 치환값이 아님 — endpoint 단위 그룹화 + path placeholder 안의 ID PII 누출 방지)
12. **반환 분기**:
    - 2xx → §5.1 (`port:'success'`)
    - 3xx/4xx/5xx → §5.3 (`port:'error'`, `output.error.code` 는 §6 분류 (`CAFE24_404` / `CAFE24_422` / `CAFE24_AUTH_FAILED` / `CAFE24_RATE_LIMITED` / `CAFE24_4XX` / `CAFE24_5XX`))
    - transport 실패 → §5.3 (`output.error.code = 'CAFE24_TRANSPORT_FAILED'`, `meta.statusCode = 0`)

> **Re-run dry-run** ([Spec Re-run §7](../../5-system/13-replay-rerun.md#7-dry-run-모드-정의)): 노드 schema 의 `supportsDryRun: true`. dry-run 실행 시 operation 의 `method` 가 GET 이 아닌 (= WRITE: POST/PUT/DELETE) 호출은 외부 commerce 상태 변경 부수효과를 차단하기 위해 실제 `Cafe24ApiClient` 호출 없이 step 1 직후 mock 응답으로 단락한다 (`buildDryRunMock('cafe24', ...)`, `meta.statusCode=0`, `port:'success'`). GET operation 은 부수효과가 없어 dry-run 에서도 그대로 호출한다. Usage 로그는 단락 시에도 1건 기록한다.

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

### 4.2 Request body envelope (POST/PUT 전용)

Cafe24 Admin API 의 POST/PUT 본문은 반드시 `{ shop_no?, request: { ...payload } }` 형태로 직렬화된다 — `request` 키 자체가 없으면 Cafe24 가 `400 "Please enter the Request parameter."` 를 반환한다. wrapper (`Cafe24ApiClient`) 가 자동 wrap 하므로 호출자(노드 핸들러·MCP Bridge) 는 flat 한 body 객체를 그대로 넘기면 된다.

| caller 의 flat body | wire 직렬화 결과 |
|---|---|
| `{ shop_no: 1, product_name: "X" }` | `{"shop_no":1,"request":{"product_name":"X"}}` |
| `{ product_name: "X" }` (shop_no 생략) | `{"request":{"product_name":"X"}}` |
| `{ shop_no: 1 }` (degenerate — payload 없음) | `{"shop_no":1,"request":{}}` |
| `{}` 또는 body 미지정 | body 미전송 (Content-Type 도 부여 안 함) |

규약 상세는 [`spec/conventions/cafe24-api-metadata.md` §4](../../conventions/cafe24-api-metadata.md#4-wire-format-규약--postput-request-envelope) 가 단일 진실. 본 절은 노드 실행 로직에서 Cafe24 request envelope 의 책임이 wrapper 에 있다는 사실만 명시한다.

- DELETE / GET 에는 Cafe24 request envelope 을 적용하지 않는다.
- 호출자가 이미 `{request: ...}` 형태로 pre-wrap 한 body 를 넘기면 wrapper 가 즉시 throw 하여 이중 래핑을 차단한다 (개발 단계 가드).

> **용어 주의**: 본 절의 "Cafe24 request envelope" / "POST/PUT request envelope" 은 Cafe24 wire format 의 `request` 래퍼다. §5 의 노드 출력 envelope (`{config, output, meta, port}`) 와 무관한 별개 개념이다.

### 4.3 Timezone semantics

Cafe24 Admin API 의 date/time 필드는 모두 **KST (Asia/Seoul, UTC+9)** 기준이다. 자세한 규약은 [Cafe24 API Metadata §5 Timezone Semantics](../../conventions/cafe24-api-metadata.md#5-timezone-semantics) (normative SoT) 가 단일 진실.

- 워크플로 캔버스 노드: 사용자 표현식 `{{ $now.iso }}` (UTC ISO8601) 를 그대로 전송해도 의미 동일 — Cafe24 가 designator 를 존중한다.
- AI Agent (Internal MCP Bridge) 노출: 모든 도구 description 끝에 KST suffix 가 자동 append 된다 (§8.1, [Cafe24 API Metadata §5.3](../../conventions/cafe24-api-metadata.md#53-ai-agent--mcp-도구-description-자동-suffix)).
- 토큰 만료 (`expires_at`) 는 본 절의 범주 밖 — JWT `exp` (UTC absolute) 가 SoT 다. [§통합 §10.5 토큰 자동 갱신](../../2-navigation/4-integration.md#105-토큰-자동-갱신) 참고.

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

### 5.8 (D4) handler.validate 실패만 throw, 나머지 모두 §5.3 으로 라우팅

config 처리는 다음 두 경로로 분리된다:

- **`handler.validate()` 실패** (config 형식 자체가 잘못된 경우): 여전히 사전 검증 단계에서 노드 실행 자체가 시작되지 않는다. warningRule + `evaluateMetadataBlockingErrors` 가 throw 하며 엔진이 워크플로우를 실패 처리. 예: `Integration 을 선택해야 합니다.`, `resource must be one of: store, product, order, ... (18 categories)`.
- **`execute()` 안의 모든 IntegrationError**: §5.3 (`port: 'error'` + `output.error.*`) 으로 라우팅된다. 다음 코드들이 해당:
  - `CAFE24_UNKNOWN_OPERATION` — `operation` 이 메타데이터에 미존재
  - `CAFE24_MISSING_FIELDS` — operation 의 `requiredFields` 중 일부 누락 또는 `constraints?` 위반 (`details` 에 어느 필드 또는 어느 constraint kind 가 위반됐는지 명시)
  - `CAFE24_INVALID_MALL_ID` — `mall_id` 형식 위반 (소문자 영숫자·하이픈, 3~50자 외)
  - `INTEGRATION_NOT_FOUND` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` ([공통 §4.2](./0-common.md#42-공통-에러-코드))
  - `INTEGRATION_SERVICE_UNAVAILABLE` — `__workspaceId` 컨텍스트 누락 / `Cafe24ApiClient` 미주입

> 모든 `IntegrationError.code` 가 `output.error.code` 로 surface. Usage 로그 (`status: 'failed'` + `error: {code, message}`) 는 양쪽 모두에서 동일하게 기록.

## 6. 에러 코드

런타임 (`port:'error'`) 에서 채워지는 `output.error.code` enum:

| 코드 | 조건 | `output.response` | `meta.statusCode` |
|------|------|-------------------|---------------------|
| `CAFE24_4XX` | `400 ≤ statusCode < 500` (404·422 외의 fallback) | 서버 body 보존 | 응답 status |
| `CAFE24_404` | Cafe24 응답 404 (자주 분기되는 케이스) | 서버 body 보존 | 404 |
| `CAFE24_422` | Cafe24 응답 422 (validation 실패) | 서버 body 보존 | 422 |
| `CAFE24_AUTH_FAILED` | **401**: refresh + 1회 재시도 후에도 401 (§6.1) / **403**: 즉시. `Integration.status` 를 `error(auth_failed)` 또는 `error(insufficient_scope)` 로 atomic 전이 | 서버 body 보존 | 401 / 403 |
| `CAFE24_RATE_LIMITED` | 429 응답 + 재시도 소진 | 서버 body 보존 (있으면) | 429 |
| `CAFE24_5XX` | `500 ≤ statusCode < 600` | 서버 body 보존 | 응답 status |
| `CAFE24_TRANSPORT_FAILED` | `fetch` reject (DNS / 연결 거부 / 소켓 / `AbortController` timeout) | 미정의 | `0` |
| `CAFE24_UNKNOWN_OPERATION` (D4) | `operation` 이 메타데이터에 미존재 | — | `0` |
| `CAFE24_MISSING_FIELDS` (D4) | operation 의 `requiredFields` 중 일부 누락 또는 `constraints?` (kind: `oneOf` / `allOrNone` / `implies`, [Cafe24 API Metadata §2](../../conventions/cafe24-api-metadata.md#2-operation-메타데이터-형식)) 위반. 두 사유 모두 동일 코드 재사용 | — | `0` |
| `CAFE24_INVALID_MALL_ID` (D4) | `mall_id` 형식 위반 | — | `0` |
| `INTEGRATION_*` ([공통 §4.2](./0-common.md#42-공통-에러-코드)) (D4) | Integration resolve / 자격증명 실패 | — | `0` |
| `INTEGRATION_SERVICE_UNAVAILABLE` (D4) | `__workspaceId` 컨텍스트 누락 / `Cafe24ApiClient` 미주입 (deployment 오류) | — | `0` |

### 6.1 인증 실패 자동 status 전환

#### 401 (access_token 만료) — refresh + 1회 재시도

401 응답은 access_token 만료 가능성이 있어 `refresh_token` 으로 1회 갱신 후 동일 요청을 재시도한다. 재시도 흐름은 [Spec 통합 §10.5 토큰 자동 갱신](../../2-navigation/4-integration.md#105-토큰-자동-갱신) 의 "401 자동 회복 (`call()` 경로)" 와 동일 정책.

1. refresh 시도 (`refreshViaQueue` — `source='reactive_401'` 로 unique jobId 사용. BullMQ dedup 우회. cross-pod 직렬화는 `refreshAccessToken` 의 PostgreSQL row-level `pessimistic_write` lock 폴백. [Rationale "reactive_401 jobId unique 화"](../../2-navigation/4-integration.md#reactive_401-jobid-unique-화--dedup-완전-우회) 참고)
2. refresh 성공 → 새 access_token 으로 **동일 요청 1회 재시도**
3. 재시도 응답이 2xx → `status='connected'` 유지 (애초에 `error` 로 전이하지 않음). 정상 결과 반환
4. 재시도 응답도 401 → 토큰 자체 문제 확정 → 아래 "공통 격하" 1~3 발사

refresh 자체가 401/403 (`invalid_grant`) 으로 실패하면 refresh 단계가 이미 `error(auth_failed)` 로 전이시키고 throw — 재시도 없음. 재시도 횟수는 **정확히 1회** (무한 retry 차단). 429 rate limit 재시도와 별개 카운터.

본 자가 회복은 [통합 §5.8 의 연결 테스트 (`pingConnection`)](../../2-navigation/4-integration.md#58-cafe24) 의 동일 패턴과 정책 통일.

#### 403 (스코프 부족 / 앱 미설치) — 즉시 격하

403 은 refresh 로 회복 불가능하므로 즉시 격하한다 (`insufficient_scope` 시그널 시 `status_reason='insufficient_scope'`, 그 외 `auth_failed`).

#### 공통 격하 동작 (Spec MCP Client §8.4 의 일반 정책)

위 두 분기에서 격하가 결정되면 다음을 동시에 수행:

1. `port: 'error'`, `output.error.code = 'CAFE24_AUTH_FAILED'` 로 분기
2. `IntegrationUsageLog.error.code = 'CAFE24_AUTH_FAILED'` 로 로그 기록
3. **`Integration.status` 를 `error` 로, `status_reason` 을 `auth_failed` (또는 `insufficient_scope`) 로 atomic UPDATE 전환** — 다음 노드 실행이 기동될 때 통합 관리 화면이 "Need attention" 배너로 자동 노출

격하 이후 `error → connected` 자동 전이는 없다 — 사용자가 명시적으로 `Reauthorize` 로 복귀 ([Spec MCP Client §8.4](../../5-system/11-mcp-client.md#84-인증-실패-자동-status-전환) 의 race-of-clock 시나리오 방지 정책).

## 7. 캔버스 요약

[공통 §5](./0-common.md#5-캔버스-요약) — `Cafe24` 행 인용. 요약 포맷: `{resource} · {operation}` (예: `product · product_list`). 연결된 Integration 이 삭제된 경우 `⚠ Missing integration` (앰버색).

## 8. AI Agent 노출 (Internal MCP Bridge)

`Integration` 1개가 본 노드와 AI Agent 의 MCP 도구 양쪽에서 사용된다. 백엔드의 `Cafe24McpToolProvider` (`codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts`, AI Agent 핸들러의 `AgentToolProvider` 인터페이스 구현체) 가 [Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge-in-process) 의 in-process Internal Bridge 패턴으로 본 노드와 동일한 메타데이터 테이블로부터 MCP 도구 목록을 자동 생성한다.

### 8.1 도구 이름 매핑

| 노드 측 | MCP 측 |
|---------|--------|
| `resource='product'`, `operation='product_list'` | `mcp_<int8자>__product_list` |
| `resource='order'`, `operation='order_get'` | `mcp_<int8자>__order_get` |
| `resource='customer'`, `operation='customer_update'` | `mcp_<int8자>__customer_update` |

도구 이름 sanitize / 길이 규칙은 [Spec MCP Client §5.2 도구 이름 규칙](../../5-system/11-mcp-client.md#52-도구-이름-규칙) 그대로 적용. `<resource>_<operation>` 토큰 안에 underscore 가 1개 들어가는 점에 유의 — MCP §5.2 의 `__` 구분자 규칙은 server↔tool 의 첫 `__` 발생 위치로 split 하므로 충돌 없음.

> **Bridge 내부 API 형식**: `Cafe24McpToolProvider.execute(name, args)` 에서 `name` 은 bare operation id (예: `product_list`) — MCP Client 레이어가 `mcp_<sid>__` prefix 를 자동 부여한다. allowlist (`mcpServers[].enabledTools`) 도 동일하게 bare id 배열로 저장한다 ([Cafe24 API Metadata 컨벤션 §7](../../conventions/cafe24-api-metadata.md#7-mcp-bridge-와의-매핑)).

> **도구 description 자동 suffix**: `Cafe24McpToolProvider.buildTools()` 는 모든 도구의 description 끝에 KST timezone 명시 한 줄 (`CAFE24_TIMEZONE_SUFFIX`) 을 자동 append 한다 ([Cafe24 API Metadata §5.3](../../conventions/cafe24-api-metadata.md#53-ai-agent--mcp-도구-description-자동-suffix)). AI Agent 가 `$now`(UTC) 와 KST 의 9시간 차이를 인지하지 못해 도구 인자가 어긋나는 회귀의 1차 방어선. AI 노드 systemPrompt 의 시스템 컨텍스트 prefix ([Spec AI 공통 §11](../../4-nodes/3-ai/0-common.md#11-ai-노드-시스템-프롬프트-자동-prefix-system-context-prefix)) 와 두 채널이 보완 관계.

### 8.2 메타도구 (resources / prompts) 미사용

Cafe24 MCP Bridge 는 `tools` capability 만 보고하고 (`Cafe24McpToolProvider.buildTools()` 로 도구 목록 생성) `resources` / `prompts` capability 는 **보고하지 않는다** — Cafe24 Admin API 는 도구 기반 RPC 모델이며 prompt 템플릿이나 read-only resource 모델이 없다. 따라서 `mcp_<sid>__list_resources` 등 메타도구는 노출되지 않는다 ([Spec MCP Client §5.1 노출 규칙](../../5-system/11-mcp-client.md#51-노출-규칙)).

### 8.3 allowlist (`mcpServers[].enabledTools`)

AI Agent config 의 `mcpServers[i].enabledTools` 는 `['product_list', 'order_list', ...]` 형식의 bare operation id 배열로 저장한다 ([Spec MCP Client §5.6](../../5-system/11-mcp-client.md#56-도구-allowlist)). UI 에서는 카테고리 단위 grouping 으로 사용성 보강 — "Product (read/write 전부 허용)" 같은 short form 을 frontend 가 enabledTools 배열로 펼쳐 저장한다 (용어 정의는 [Spec Cafe24 API 메타데이터 §8](../../conventions/cafe24-api-metadata.md#8-allowlist-와의-관계)).

**별도 승인 라벨 (UI)**: AI Agent allowlist 의 카테고리 단위 grouping UI 에서, scope 전체가 별도 승인 대상인 카테고리 (mileage / notification / privacy) 는 그룹 헤더에 ⚠ + "별도 승인 필요". store 카테고리 안 operation 단위 restricted (paymentgateway_*, paymentgateway_paymentmethods_*, financials_paymentgateway_get, menus_get, activitylogs_*, naverpay_setting_*, kakaopay_setting_*) 는 operation 행 단위로 같은 ⚠ 표기. backend 가 `tools/list` 응답 메타데이터에 `restrictedApproval` 을 통과시켜 frontend 가 자동 렌더한다. 명단 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md). 차단 없음 — 사용자가 인지하고 선택할 수 있게 안내만.

### 8.4 Rate Limit 공유 (동일 프로세스 인스턴스 내)

노드 호출 / MCP `tools/call` 모두 같은 `Cafe24ApiClient` wrapper 를 통과한다 → 같은 Integration credential 에 대한 leaky bucket 공유. AI Agent multi-turn 도중 LLM 이 빠르게 연속 호출하면 다른 워크플로의 같은 Integration 사용도 함께 대기한다 (§4.1 의 동일 프로세스 인스턴스 mutex). 격리는 Integration 단위 — 서로 다른 `mall_id` 의 Integration 간에는 공유되지 않는다.

### 8.5 IntegrationUsageLog

MCP 측 호출도 동일한 `IntegrationUsageLog` 에 기록된다 ([Spec MCP Client §8.3](../../5-system/11-mcp-client.md#83-integrationusagelog)). `node_execution_id` 는 호출 시점의 AI Agent NodeExecution. 통합 관리 상세 페이지의 Recent Activity 탭은 두 경로의 호출을 함께 표시한다.

### 8.6 expired 통합의 buildTools 자가 회복

`Cafe24McpToolProvider.buildTools()` 는 AI Agent 노드 실행 시점에 `mcpServers[]` 의 각 cafe24 Integration 을 조회해 tool catalog 를 구성한다. **`integration.status === 'expired'` 인 행은 다음 정책으로 처리한다**:

| 상태 | 처리 |
|------|------|
| `expired` + `status_reason='install_timeout'` | skip (refresh 불가 — install_token 자체가 NULL). `mcpDiagnostics.serverSummaries[].skipReason='expired_install_timeout'` |
| `expired` + `credentials.refresh_token` 존재 + `status_reason !== 'install_timeout'` | **1회 `refreshViaQueue` 시도 후 성공 시 fresh row 로 tool 등록 계속**. refresh 성공은 worker 가 `status='connected'` 로 전이시키므로 본 노드 실행은 정상 catalog 받음. refresh 실패 시 worker 가 `error(auth_failed)` 전이 → skip + `skipReason='expired_refresh_failed'` |
| `expired` + `refresh_token` 누락 | skip + `skipReason='expired_no_refresh_token'` (이상 케이스 — 사용자 reauth 필요) |
| `error(*)` | skip + `skipReason='error'` (외부 명시 reauth 가 정식 회복 — [§6.1 공통 격하](#61-인증-실패-자동-status-전환) 및 [Spec MCP Client §8.4](../../5-system/11-mcp-client.md#84-인증-실패-자동-status-전환) 와 동일 정책) |
| `connected` | 정상 catalog 구성 |

**근거**: §11.1 `connected-expiry` scanner 의 cafe24 분기 (refresh enqueue) 가 정상 동작하면 cafe24 가 `expired` 로 격하되는 경로는 사실상 `install_timeout` 한 가지만 남는다. 그러나 (a) scanner 가 아직 도달하지 못한 race window, (b) 마이그레이션 직후의 잔여 expired row, (c) 향후 다른 expired 경로 추가에 대비해 본 buildTools 단계의 1회 자가 회복을 두 번째 방어선으로 둔다. 정상 케이스에선 추가 latency 없음 (status='connected' 우회), expired 케이스에서만 최대 1회의 refresh round-trip (큐 dedup 으로 cross-pod 단일 실행).

**진단 노출**: skip 여부와 사유는 모두 AI Agent 노드의 `meta.mcpDiagnostics.serverSummaries[]` 에 노출되어 사용자가 "통합이 보이지 않는다" 원인을 즉시 식별할 수 있다 ([Spec MCP Client §6.2](../../5-system/11-mcp-client.md#62-진단-누적-mcpdiagnostics)).

---

## 9. Rationale

### 9.1 단일 노드 + 메타데이터 테이블

**단일 노드 + Resource/Operation 동적 폼**: 캔버스 노드 1개 + 카테고리당 평균 ~10 endpoint 의 동적 폼. 신규 endpoint = 메타데이터 row 1 추가. endpoint 당 도메인 노드 (~180개) 는 캔버스 가독성·노드 카탈로그를 무너뜨리고, 범용 HTTP 노드 + 인증 등록 방식은 매번 URL/method 구성으로 UX 가 저하되고 rate-limit 헤더 처리를 일반화하기 어렵다. n8n / Make 의 Cafe24 노드 패턴과 동일한 결정.

### 9.2 Internal MCP Bridge

**Internal MCP Bridge** — 같은 Integration 1개, in-process bridge. AI Agent spec/handler 변경 0. backend 구현은 AI Agent 핸들러의 `AgentToolProvider` 인터페이스 (`codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts`) 를 구현한 `Cafe24McpToolProvider` 구현체 (`tool-providers/cafe24-mcp-tool-provider.ts` — 메타데이터 → `buildTools()`/`execute()`). 별도 외부 MCP 서버 + Integration 2번 등록 방식은 credential 중복·운영 부담이 크다.

### 9.3 노드의 Resource/Operation 메타데이터 위치

- 메타데이터 **형식** 은 [`spec/conventions/cafe24-api-metadata.md`](../../conventions/cafe24-api-metadata.md) 에 정의되어 있고, 실제 row 는 backend metadata 모듈(`codebase/backend/src/nodes/integration/cafe24/metadata/*.ts`) 에 저장된다.
- Cafe24 Admin API 의 **모든 endpoint 카탈로그** (구현됨/예정/폐기 포함) 는 [`spec/conventions/cafe24-api-catalog/`](../../conventions/cafe24-api-catalog/_overview.md) 에 18 resource 단위로 분리되어 있다. 카탈로그 ↔ backend 메타데이터는 `catalog-sync.spec.ts` 양방향 동기 테스트로 보호된다 — 신규 endpoint 추가 시 카탈로그 row 갱신과 메타데이터 row 추가가 같은 PR 에 묶여야 CI 가 통과한다.
- spec 본문에 endpoint enumeration 을 인라인하지 않는다 — drift 방지 목적. 본 문서는 형식·예시·18 카테고리 enum 만 명시한다.

### 9.4 Public + Private 앱 동시 지원

Cafe24 앱은 모두 Cafe24 Developers 에서 생성한다. 차이는 앱스토어 심사 제출 여부다.

- **Public 앱**: 앱스토어에 등록(심사 완료 또는 대기) 된 앱. 우리 서버 env `CAFE24_CLIENT_ID`/`CAFE24_CLIENT_SECRET` 으로 OAuth 진행. 우리 서비스가 `begin` 에서 authorize URL 팝업을 직접 시작한다.
- **Private 앱** (미심사 비공개 앱): Cafe24 Developers 에서 생성 후 심사 미제출. 최대 5개 쇼핑몰에만 설치 가능. **OAuth 흐름을 우리 서비스가 시작할 수 없다** — Cafe24 Developers 의 "테스트 실행"이 우리 App URL 을 호출하며 흐름을 시작한다.

Private 앱 연동 흐름 요약:
1. 사용자가 우리 통합 폼에 `mall_id`, `client_id`, `client_secret`, `scopes` 사전 등록 → Integration `status=pending_install` 생성
2. 사용자가 Cafe24 Developers → 내 앱 → 개발 정보에 App URL·Redirect URI 등록 → 테스트 실행
3. Cafe24 가 `GET /api/3rd-party/cafe24/install/:installToken?mall_id=...&hmac=...` 로 App URL 호출 — path 의 `install_token` 은 step 1 의 `pending_install` 생성 시 발급된 16바이트 base64url (22자, `^[A-Za-z0-9_-]{22}$`)
4. 백엔드: path 의 `install_token` 으로 Integration 단일 row 조회 → 그 row 의 `client_secret` 으로 HMAC 1회 검증 (§9.8 — 단일 row 조회 + 1회 검증) → status 분기 (`pending_install` → Cafe24 authorize URL 로 redirect; `connected`/`error(*)`/`expired` → 우리 frontend `${FRONTEND_URL}/integrations/<id>` 로 redirect — post-install navigation 흐름. 자세한 근거는 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale) "Cafe24 App URL 재호출 흐름 — install_token persistent 격상" 항). 토큰 미존재 시 `404 CAFE24_INSTALL_INVALID_TOKEN`, HMAC 불일치 시 `403 CAFE24_INSTALL_INVALID_HMAC`
5. 동의 → callback → 토큰 교환 → Integration `pending_install → connected`. `install_token` 은 **보존** (post-install navigation 의 식별 키).
6. **실패 시**: callback 처리 중 token exchange 실패 등이 발생하면 `pending_install` 행에 `status_reason` (예: `oauth_token_exchange_failed`) + `last_error` 가 기록되고 **status 는 보존**된다. 사용자는 cafe24 측 설정을 고치고 "테스트 실행" 을 다시 호출해 재시도한다. (상세는 [Spec 통합 화면 §10.4](../../2-navigation/4-integration.md#104-에러-매핑))
7. **TTL 만료**: install_token 발급 후 24시간 내 step 5/6 가 성공하지 못하면 일일 스캐너가 `status='expired'`, `status_reason='install_timeout'`, `install_token=NULL` 로 자동 전이한다. 재시도하려면 사용자가 행을 삭제 후 새로 등록한다 — Private 앱은 재인증 진입점이 없다. (상세는 [Spec 통합 화면 §6](../../2-navigation/4-integration.md#6-상태-전이))

### 9.5 5필드 invariant 준수

본 노드는 CONVENTIONS Principle 0~11 을 모두 준수한다:
- Principle 0: 5필드 (`config`/`output`/`meta`/`port`) — `status` 는 비-블로킹이므로 생략.
- Principle 1.1: config (raw) ↔ output (런타임) 직교.
- Principle 3: `port: 'error'` + `output.error.{code, message, details?}`.
- Principle 7: `config` 는 `context.rawConfig` echo. 자격증명은 echo 금지 (integrationId 만 echo).
- Principle 8.2: HTTP 관용 네이밍 `output.response` 재사용.

### 9.6 Rate Limit 의 범위 한정

`Cafe24ApiClient` wrapper 의 in-memory mutex 는 **동일 프로세스 인스턴스 내** API 호출의 leaky-bucket 직렬화 보호만 담당한다. trade-off 와 보완:

- Cafe24 leaky bucket 은 Integration 단위 quota (mall_id 기준) → 인스턴스 간 동시 호출 시 429 가 자체적으로 backoff 신호로 작동. 따라서 API 호출 자체의 cross-pod 직렬화는 불필요.
- Token refresh 의 cross-pod 직렬화는 BullMQ `cafe24-token-refresh` 큐 (`jobId = integrationId` dedup) 로 해소된다. 자세한 결정 배경은 [통합 화면 ## Rationale "BullMQ cafe24-token-refresh 큐 — 멀티 인스턴스 race 해소"](../../2-navigation/4-integration.md#rationale) 참고. `reactive_401` 경로는 본 BullMQ jobId dedup 을 우회하고 PostgreSQL row-level `pessimistic_write` lock 폴백을 사용한다 — 자세한 결정 배경은 [Rationale "reactive_401 jobId unique 화 — dedup 완전 우회"](../../2-navigation/4-integration.md#reactive_401-jobid-unique-화--dedup-완전-우회) 참고.
- 즉 현재 구조: **API 호출 = 같은 pod 내 in-memory mutex** (leaky bucket 공유) + **Token refresh 직렬화는 source 별 분기**: `proactive`/`background` 는 BullMQ 큐 (`jobId = integrationId` dedup), `reactive_401` 은 PostgreSQL row lock 폴백 — refresh_token rotation race 차단의 2단 보호.
- **Refresh 진입점은 넷 — 모두 동일 BullMQ 큐 경유, source 별 dedup 전략 분리**:
  1. `Cafe24ApiClient.call()` proactive (`ensureFreshToken` → `refreshViaQueue`) — API 호출 직전 token expiry window 검사. `source='proactive'`. `jobId = integrationId` BullMQ dedup.
  2. `connected-expiry` 일일 잡의 0d 분기 — `service_type='cafe24'` AND refresh_token 보유 행을 enqueue (이전 `expired` 격하 분기 폐기). `source='background'`. `jobId = integrationId` BullMQ dedup.
  3. `Cafe24McpToolProvider.buildTools()` — `status='expired'` AND refresh_token 보유 AND `status_reason !== 'install_timeout'` 행에 한해 1회 큐 경유 refresh 시도 (§8.6 자가 회복). expired 가 race window 또는 잔여 데이터로 남아있는 경우의 두 번째 방어선. `source='background'`. `jobId = integrationId` BullMQ dedup.
  4. `Cafe24ApiClient.performAuthRefresh` (`executeWithRateLimit` 의 401 자가 회복 경로) — caller 가 empirical 401 을 받은 신호. `source='reactive_401'`. `jobId = ${integrationId}#reactive-${Date.now()}-${rand6}` 형태의 unique jobId 로 BullMQ dedup 자체를 우회 — completed proactive/background job 으로 dedup 되어 worker 가 새로 돌지 않는 회귀 영구 차단. cross-pod 직렬화는 `refreshAccessToken` 의 PostgreSQL row-level `pessimistic_write` lock 폴백 보호. 워커가 short-circuit guard 를 skip 하고 항상 refresh 시도. caller 는 새 token 으로 동일 요청을 1회 retry (`triedAuthRetry=true` flag 로 무한 재귀 차단). 자세한 결정 배경은 [Rationale "reactive_401 jobId unique 화 — dedup 완전 우회"](../../2-navigation/4-integration.md#reactive_401-jobid-unique-화--dedup-완전-우회) 참고.

  진입점 (1) (2) (3) 은 `jobId = integrationId` dedup 으로 같은 통합에 동시 요청이 와도 클러스터 전체에서 worker 가 단일 실행한다 (waiting/active/completed 상태 dedup 보증). 진입점 (4) `reactive_401` 은 BullMQ dedup 을 우회하므로 cross-pod 동시 401 시 두 pod 의 worker 가 모두 실행될 수 있으나, `refreshAccessToken` 의 PostgreSQL `pessimistic_write` row lock 이 동일 row 의 동시 UPDATE 를 직렬화한다 (한 pod 만 새 token 으로 저장, 다른 pod 은 invalid_grant 격하 — fail-safe). leaky bucket 부담은 (3) 이 정상 케이스 (`connected`) 를 우회하고 (4) 가 실제 401 을 empirical 으로 받은 케이스에만 발사되므로 noticeable 증가 없음.

### 9.7 OAuth scope wire format — 콤마 구분 (RFC 6749 예외)

Cafe24 의 `/oauth/authorize` 는 **RFC 6749 §3.3 의 공백 구분이 아닌 콤마 구분 scope** 를 요구한다 (자체 규약). 우리는 begin 단계에서 `service.oauthProvider === 'cafe24'` 분기로 `,` 를 사용하고, 다른 provider (google, github) 는 표준 공백 구분을 유지한다.

증상: 공백/`+` 으로 보내면 Cafe24 가 전체 문자열을 단일 토큰으로 해석해, 단일 scope (예: `mall.read_product` 하나) 만 보내도 `invalid_scope` 응답을 돌려준다. 트러블슈팅 시 "사용자 앱 권한 사전 등록 누락" 으로 오진하기 쉬워, 본 노트로 명시.

확인 출처:
- `https://developers.cafe24.com/app/front/app/develop/oauth/oauthcode` 의 인증코드 요청 example URL — `scope=mall.read_application,mall.write_application`
- 공식 샘플 앱 `cafe24-app/cafe24_app_sample` 의 `StoreToken.java#getCodeRedirectUrl` — `APP_SCOPE` 를 `&scope=` 에 raw concat (공백/특수 인코딩 없음)
- velog `@yl9517` 의 단일 `mall.read_product` 콤마 구분 정상 동작 사례

회귀 보호: `codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` 가 `authUrl` 에 `scope=...%2C...` 가 포함되는지, `+` / `%20` 으로 회귀하지 않는지 명시 검증.

### 9.8 Private 앱 App URL HMAC 검증

Cafe24 는 App URL 호출 시 **HmacSHA256 + Base64** 서명(`hmac` 파라미터)을 함께 전송한다. 우리 설치 엔드포인트는 이 서명을 검증해야 한다.

**알고리즘 (공식 문서 + 공식 Java 샘플 기준):**

1. `hmac` 파라미터를 제외한 나머지 쿼리 파라미터를 **알파벳순 정렬** (key 기준)
2. **원본 URL-encoded 값을 그대로 보존** 해서 query string 형태로 직렬화: `key=raw-value&...`. **decode/re-encode 금지** — Cafe24 의 공식 Java 샘플 `validationCheckHmac` 는 `request.getQueryString()` 을 `&` 로 split 한 뒤 `=` 로 한 번만 split 해서 value 부분을 **raw 그대로** TreeMap 에 저장한다. 즉 Cafe24 가 URL 에 `%20` 으로 보냈으면 HMAC 메시지에도 `%20`, `+` 로 보냈으면 `+` 그대로 유지된다. value 의 의미를 해석하지 않고 byte 단위로 매칭하는 게 정답. 배경은 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale) "HMAC 검증 알고리즘 — raw URL-encoded 값 보존" 항 참조.
3. `client_secret` 을 키로 HmacSHA256 해싱
4. 결과를 **Base64 인코딩**
5. URL-decoded `hmac` 파라미터 값과 timing-safe 비교

```typescript
// Cafe24 는 URL 의 값을 decode/re-encode 없이 raw 그대로 HMAC 메시지에
// 사용한다. URL 의 `%20` 을 `+` 등으로 변환하면 byte 불일치를 일으키므로
// raw 보존이 invariant.
function buildHmacMessage(rawQuery: string): string {
  return rawQuery
    .split('&')
    .map((part) => {
      const eqIdx = part.indexOf('=');
      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
      return { key, raw: part };
    })
    .filter((p) => p.key.length > 0 && p.key !== 'hmac')
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((p) => p.raw)
    .join('&');
}

function verifyHmac(rawQuery: string, clientSecret: string, receivedHmac: string): boolean {
  const message = buildHmacMessage(rawQuery);
  const computed = createHmac('sha256', clientSecret).update(message, 'utf8').digest('base64');
  return timingSafeEqual(Buffer.from(computed), Buffer.from(receivedHmac));
}
```

**보안 추가 조치:**
- `timestamp` ± 5분 이외 요청은 재전송 공격 방어 목적으로 즉시 거부 (`CAFE24_INSTALL_REPLAY`)
- HMAC 미일치 → `403 CAFE24_INSTALL_INVALID_HMAC` (에러 세부 내용 노출 금지)

> **Nonce cache 보호:** ±5분 윈도우 + HMAC 검증을 통과한 (mall_id, timestamp, hmac) 튜플을 Redis 에 10분 TTL 로 기록 (`Cafe24InstallNonceCache`). 동일 윈도우 안에서 같은 튜플이 재전송되면 `CAFE24_INSTALL_REPLAY` 로 거절 — 옛 잔여 위험인 "유효 HMAC + 동일 timestamp 재전송" 까지 차단. Redis 미설정 / 통신 실패 시 graceful degradation — nonce 검사는 skip 되고 옛 ±5분 윈도우 정책으로 fallback. 운영 환경에선 BullMQ 가 이미 사용 중인 Redis 인스턴스를 공유하므로 별도 비용 없음.
>
> **키 구성:** `cafe24:install:nonce:{mall_id}:{timestamp}:{hmac 앞 8자}` — base64 hmac(~44자) 전체 대신 앞 8자(=48bit, 약 2.8e14 공간)만 prefix 로 써서 Redis 키 길이를 제한한다. 같은 윈도우·같은 (mall_id, timestamp) 에서 hmac 앞 8자까지 동일할 확률은 무시 가능하며, 설령 충돌해도 이미 HMAC 검증을 통과한 요청이므로 보안 영향 없이 (드물게) 정상 재시도가 replay 로 거절될 뿐이다. (이 충돌은 nonce Redis 키 고유성에 관한 것이며, `install_token` capability-token 가정 및 HMAC cryptographic strength 와는 독립이다.)

> **Rate limiting (enumeration 방어 — defense-in-depth):** install endpoint 는 capability-token 가정(`install_token` 은 128-bit 이상 random 이라 추측 불가 — [Spec 통합 화면 Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제"](../../2-navigation/4-integration.md#cafe24_install_invalid_token404-의-보안-전제)) 위에 두 겹의 운영 방어를 더한다.
>
> - **Layer 1 — IP throttle (`30/min` per IP):** `@Throttle({ limit: 30, ttl: 60_000 })` (미인증 경로라 `UserThrottlerGuard` 의 IP fallback 키 사용). **현재는 `@nestjs/throttler` 기본 store 라 pod별 in-memory** — 멀티 인스턴스/재배포 시 quota 가 인스턴스마다 분산된다. 클러스터 전역 직렬화를 위한 **Redis 분산 store 이전은 전역 storage 교체(모든 throttled 엔드포인트에 영향)라 별 infra PR 로 분리(deferred)** — 본 endpoint 의 enumeration 방어 핵심은 Redis 기반 cross-pod 인 Layer 2 가 담당하므로 Layer 1 의 분산화는 보강 성격이다.
> - **Layer 2 — 실패 페널티 lockout:** install_token 조회/HMAC 검증이 **실패**한 요청 (`CAFE24_INSTALL_INVALID_TOKEN` / `CAFE24_INSTALL_INVALID_HMAC`) 에 한해 IP별 카운터 `cafe24:install:fail:{ip}` 를 `INCR` (EX `INSTALL_FAIL_WINDOW_SEC`). `INSTALL_FAIL_THRESHOLD` 초과 시 HMAC 검증·row 조회 이전에 `429 CAFE24_INSTALL_RATE_LIMITED` 로 즉시 거절. **성공한 install(302 redirect) 은 카운트하지 않는다** — 정상 사용자(유효 토큰·소수 요청)는 무영향, enumeration(대량 실패)만 정조준한다. nonce-cache 와 동일하게 Redis 부재 시 **fail-open(skip)** — in-memory 등가물이 없는 순수 강화 layer 라 Redis 가 없을 때 차단을 끄고 기존 정책(±5분 윈도우 + capability-token)으로 회귀하는 게 정상 install 을 막지 않아 안전하다. Layer 1(in-memory fallback) 과 **의도적으로 다른 degradation 경로** — 근거는 [Spec 통합 화면 Rationale "install endpoint rate limiting"](../../2-navigation/4-integration.md#install-endpoint-rate-limiting--redis-분산-throttle--실패-페널티) 참조.

**식별 전략:** App URL path 의 `:installToken` 으로 Integration 을 **단일 row 조회** 한다 (status 무관 — `pending_install`/`connected`/`error(*)`/`expired` 모두 매칭). 조회된 row 의 `client_secret` 으로 HMAC 을 **1회만** 검증한다 (in-memory 스캔 + trial HMAC 방식 대신 — dedup 시나리오 + O(N) 비용 동시 해소). 단일 row 조회 실패 시 **install_token mismatch 회복 흐름** (`tryRecoverByMallId`) 이 좁은 fall-back 으로 작동 — mall_id 매칭 후보 (상한 `RECOVERY_CANDIDATE_LIMIT=5`) 의 client_secret 으로 HMAC trial 1회씩. 정확히 1개 통과 시 그 row 로 fall-through, 0개 또는 다수면 회복 포기. 자세한 보안 전제·DoS 보호는 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale) "Cafe24 install_token mismatch 회복 흐름 — 보안 전제" 항 참조. 토큰 미존재 (회복 흐름 fall-back 후에도 미매칭) 시 `404 CAFE24_INSTALL_INVALID_TOKEN`, HMAC 불일치 시 `403 CAFE24_INSTALL_INVALID_HMAC`, timestamp 윈도우 초과 시 `400 CAFE24_INSTALL_REPLAY`, 파라미터 누락 시 `400 CAFE24_INSTALL_MISSING_PARAMS`, 같은 IP 의 조회/HMAC 실패가 `INSTALL_FAIL_THRESHOLD` 를 넘으면 `429 CAFE24_INSTALL_RATE_LIMITED` (위 Rate limiting note 의 Layer 2). `install_token` 은 통합 lifetime 동안 보존되며, 통합 삭제 또는 `pending_install → expired (install_timeout)` 24h TTL 만료 시에만 NULL 로 소거된다.

> 식별 전략 번복(mall_id 스캔 → install_token 단일 조회) 배경은 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale) 의 "install_token 을 App URL path 식별 키로 승격" 항목 참조.

**관련 코드 상수**:

| 상수 | 값 | 의미 |
|------|-----|------|
| `RECOVERY_CANDIDATE_LIMIT` | `5` (코드 상수, 환경변수 아님) | install_token mismatch 회복 흐름의 HMAC trial 상한. workspace 횡단으로 같은 mall_id 가 5건 초과면 회복 포기 (DoS amplification 차단). 정상 운영에서 mall_id 당 cafe24 row 는 보통 1~2건. |
| nonce key hmac prefix 길이 | `8` (코드 리터럴, `Cafe24InstallNonceCache.buildKey`) | Redis nonce 키의 hmac 세그먼트 길이. base64 8자 ≈ 48bit ≈ 2.8e14 공간으로 충돌 무시 가능. 키 길이 제한 목적이며, 변경 시 `buildKey` 의 `slice(0, 8)` 와 동기화 필요. |
| `INSTALL_FAIL_THRESHOLD` | `10` (코드 상수, 환경변수 아님) | install_token 조회/HMAC 실패의 IP별 허용 횟수 (Layer 2). window 내 초과 시 `429 CAFE24_INSTALL_RATE_LIMITED`. 정상 사용자(유효 토큰)는 실패하지 않아 무영향. |
| `INSTALL_FAIL_WINDOW_SEC` | `600` (10분, 코드 상수) | 실패 카운터(`cafe24:install:fail:{ip}`) 의 Redis TTL. nonce TTL(10분) 과 동일 마진. |

### 9.9 Fields 편집 UI — 메타데이터 기반 typed 동적 폼

**operation 메타데이터 기반 동적 폼**: `extras.operationsByResource` 페이로드로 (resource, operation) 별 `fields[]` 가 frontend 에 도달한다. UI 는 메타데이터에 명시된 키만 행으로 렌더하고 required / optional 두 그룹으로 분리. 사용자가 임의 key 를 추가하는 경로 자체가 없어 빈 key 행 / 편집 버퍼 문제는 구조적으로 소멸. 모든 값 입력칸은 `ExpressionInput` 베이스로 표현식 (`{{ }}`) 입력을 유지한다. 자유 key/value 행 입력 방식 (사용자가 키 이름을 외워서 입력) 은 어느 키가 필수/선택인지 UI 가 안내하지 못하고 빈 key 행용 내부 편집 버퍼 분리가 필요해 채택하지 않았다.

다른 통합 노드 (`http_request` 의 `headers` / `queryParams`) 는 `KeyValue[]` 형태로 직렬화하여 본 결정의 대상이 아니다 (빈 key 행도 그대로 echo).

**호환 키 보존**: Operation 변경 시 fields 를 전부 reset 하면 같은 키를 다음 operation 도 받는 경우 사용자가 다시 입력해야 함. 새 op 의 `fields[].name` 과 현재 `config.fields` 의 키 집합의 **교집합** 만 유지해 ("product_get → product_list" 같은 점진 전환에서 `shop_no` 등 공통 키 보존) 무관 키는 drop. Resource 변경 시는 의미 단절이 너무 커 fields 전체 reset.

### 9.10 Cafe24 request envelope wrapping 의 위치 — wrapper 단일 책임

Cafe24 POST/PUT 본문의 `request` envelope (§4.2, 자세한 규약: [`spec/conventions/cafe24-api-metadata.md` §4](../../conventions/cafe24-api-metadata.md#4-wire-format-규약--postput-request-envelope)) 은 `Cafe24ApiClient.executeWithRateLimit` 의 wire 직렬화 단계 — `JSON.stringify` 직전 — 에서 적용한다. 노드 핸들러 / `Cafe24McpToolProvider` 의 body 구성 단계에서 wrap 하는 대신 wrapper 단일 지점으로 둔 배경:

- envelope 은 Cafe24 wire format 의 고유 규약이지 노드/MCP 의 관심사가 아니다. wrapper 가 이미 URL prefix (`{mall_id}.cafe24api.com`)·leaky bucket 헤더·토큰 refresh 같은 Cafe24-only 책임을 갖고 있어 SRP 정합.
- 노드 핸들러 (`buildRequestParts`) 와 `Cafe24McpToolProvider.execute` 두 곳이 같은 splitting 로직을 중복 보유 — 단일 지점 fix 가 drift 를 막는다.
- `Cafe24CallOptions.body: Record<string, unknown>` 외부 시그니처는 변경 없음 — caller 는 flat 객체로 넘기면 됨.
- 두 호출 경로가 모두 flat body 를 직렬화하면 `request` 래퍼 누락으로 `400 "Please enter the Request parameter."` 함정에 빠지므로, wrapper 단일 책임이 이를 구조적으로 차단한다.

POST/PUT 외 method 는 allowlist 로 강제 — 미래 method (PATCH 등) 추가 시 wrapper 안에서 명시적 결정이 강제된다 (DELETE 의 body 가 silently envelope 되지 않도록).

이중 래핑 throw 가드의 전제: 현재 모든 caller (노드 핸들러·MCP Bridge) 는 flat body 만 사용하므로 pre-wrap 은 반드시 오류 신호다. 향후 wrapper 외부에서 envelope 을 미리 적용해야 하는 새 caller 가 생기면 본 가드의 전제가 깨지므로 그 시점에 가드 정책을 재검토한다.

### 9.11 별도 승인 라벨 — 노드 Operation / AI Agent allowlist 의 ⚠ 표기

UI 4 화면 (통합 추가 위저드 / 통합 상세 §4.4 Scope & Permissions / 본 노드 Operation 드롭다운 / AI Agent allowlist) 의 ⚠ 라벨링은 모두 같은 메타데이터 SoT (`Cafe24OperationMetadata.restrictedApproval`) 에서 자동 렌더한다. 명단의 진위 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) 가 유일 출처이며, 본 노드 spec 은 그 라벨이 노드/AI Agent 의 어디에서 시각화되는지만 명시한다 — 명단을 spec 본문에 직접 enumerate 하지 않는 이유는 drift 방지 ([§9.3](#93-노드의-resourceoperation-메타데이터-위치) 의 "endpoint enumeration 을 spec 본문에 인라인하지 않는다" 정책과 동일).

차단 정책 채택 안 한 이유는 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#cafe24-별도-승인-scope-의-식별안내) 의 "Cafe24 별도 승인 scope 의 식별·안내" 항 참조. 신규 에러 코드 미추가 + `INSUFFICIENT_SCOPE` 의 `details.requiresCafe24Approval` 보강 필드만 사용한다.
