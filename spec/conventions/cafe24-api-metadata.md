---
id: cafe24-api-metadata
status: implemented
code:
  - codebase/backend/src/nodes/integration/cafe24/metadata/**
  - codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts
  - codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts
  - codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts
---

# CONVENTION: Cafe24 API Metadata

> 관련 문서: [Spec Cafe24 노드](../4-nodes/4-integration/4-cafe24.md) · [Spec 통합 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24) · [Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge-in-process) · [Cafe24 API Catalog](./cafe24-api-catalog/_overview.md)

본 컨벤션은 Cafe24 Admin API 의 endpoint 매핑 메타데이터 **형식** 을 정의한다. 실제 endpoint 의 전수 카탈로그(supported/planned/deprecated)는 [`cafe24-api-catalog/`](./cafe24-api-catalog/_overview.md) 에 있고, backend 메타데이터 row 와 카탈로그는 `catalog-sync.spec.ts` 로 양방향 동기 보호된다.

backend 의 `Cafe24` 노드 핸들러와 `Cafe24McpToolProvider` (AI Agent Internal Bridge) 양쪽이 **같은 메타데이터 테이블** 을 소비한다 — 신규 endpoint 추가는 메타데이터 row 1 추가 + 카탈로그 row 1 갱신으로 끝나야 한다.

---

## 1. 디렉토리 구조

```
codebase/backend/src/nodes/integration/cafe24/metadata/
  index.ts             # 18 resource 의 종합 export
  store.ts             # Store (상점)
  product.ts           # Product (상품)
  order.ts             # Order (주문)
  customer.ts          # Customer (회원)
  community.ts         # Community (게시판)
  design.ts
  promotion.ts
  application.ts       # ⚠ Cafe24 앱 관리 API — OAuth 앱 등록(credentials.app_type)과 무관. naming collision 주의
  category.ts
  collection.ts
  supply.ts
  shipping.ts
  salesreport.ts
  personal.ts
  privacy.ts
  mileage.ts
  notification.ts
  translation.ts
```

각 파일은 한 Resource 의 모든 Operation 메타데이터를 export 한다.

## 2. Operation 메타데이터 형식

```ts
interface Cafe24OperationMetadata {
  // 식별
  id: string;                    // 예: 'product_list'. resource 안에서 unique.
                                 // 사람 친화 라벨은 본 metadata 에 보관하지 않는다 — frontend i18n dict 가
                                 // catalog key (`cafe24.<resource>.<operation>`) 로 lookup 한다 (§7.5).
  description: string;           // MCP tool description (영문 권장) 또는 다국어 키
  scopeType: 'read' | 'write';   // scope 매핑 — mall.read_<resource> / mall.write_<resource>. Node.category 와의 명명 충돌 회피 위해 'category' 가 아닌 'scopeType' 사용

  // HTTP 매핑
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;                  // path template. 예: 'products/{product_no}'

  // 입력 스키마
  requiredFields: string[];
  fields: {
    [fieldName: string]: {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
      location: 'path' | 'query' | 'body';
      enum?: string[];
      description?: string;
      default?: unknown;
    };
  };

  responseShape?: 'list' | 'single' | 'empty';
  paginated?: boolean;

  // 별도 승인 라벨링 — 명단 SoT 는 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md).
  // catalog-sync.spec.ts 가 카탈로그 row 의 `restricted` 컬럼과 양방향 동기 검증.
  restrictedApproval?: {
    level: 'scope' | 'operation' | 'program';
    // approvalGroup — UI 메시지/tooltip 묶음 식별자. `Cafe24Resource.category` enum 및
    // `Node.category` 와의 명명 충돌을 회피하기 위해 `category` 가 아닌 `approvalGroup` 채택
    // (cafe24-api-metadata 컨벤션의 `scopeType` 채택 선례와 동일 패턴).
    approvalGroup:
      | 'mileage' | 'notification' | 'privacy'         // scope 전체 (resource 단위)
      | 'activitylogs' | 'menus'                        // store 안 operation 단위
      | 'naverpay_setting' | 'kakaopay_setting'
      | 'pg_settings'                                   // paymentgateway_* + paymentgateway_paymentmethods_* + financials_paymentgateway_get 묶음
      | 'analytics';                                    // 별도 프로그램 (placeholder, catalog 대상 외)
    docsUrl?: string;
    inquiryUrl: string;                                 // 카페24 개발자센터 안내 링크
  };

  // Cafe24 공식 docs 상으로는 모든 필드가 optional 인데 본문 박스에 자연어로만
  // "회원 아이디 · 휴대전화 중 한 가지는 반드시 입력" 같은
  // 조건부 제약을 명시하는 endpoint 가 다수 있다. `requiredFields: string[]` 는
  // AND 시맨틱(모두 필수) 만 표현하므로, 이런 OR/짝/함의 형태의 제약은 본 필드에
  // 구조화해 표현한다. 의미·매핑·invariant 는 아래 § "`constraints` 의 의미" 참고.
  constraints?: Cafe24FieldConstraint[];
}

type Cafe24FieldConstraint =
  | { kind: 'oneOf';      fields: string[] }                  // 최소 1개 (at-least-one-of). length >= 2
  | { kind: 'allOrNone';  fields: string[] }                  // 함께 있거나 함께 없거나. length >= 2
  | { kind: 'implies';    if: string; then: [string, ...string[]] }   // if 가 있으면 then 도 필수. then length >= 1 (tuple)
  | { kind: 'impliesValue'; if: string; value: string | number | boolean; then: [string, ...string[]] };  // if 의 값이 value 이면 then 도 필수 (value-aware)
```

> **이름 주의** — 본 컨벤션의 `kind: 'oneOf'` (필드 존재 at-least-one) 는 다음 두 가지와 의미가 다르다:
> 1. **JSON Schema 의 `oneOf`** — "정확히 1개 (exactly one)". MCP 노출 시점에 `anyOf` 로 변환한다 (아래 표).
> 2. **Frontend `UiHint.visibleWhen.oneOf`** — "config[field] 가 oneOf 배열에 포함되면 visible" (값 whitelist 비교, 적용 대상은 한 필드의 값). 본 컨벤션의 `oneOf` 는 여러 필드의 존재 여부에 적용된다. 타입 네임스페이스 (`Cafe24FieldConstraint` vs `UiHint`) 가 분리되어 컴파일·런타임 충돌은 없다.

**`restrictedApproval` 의 의미**

본 필드는 카페24 본사가 별도 승인한 클라이언트만 호출할 수 있는 operation 을 식별한다. 명단의 single-source-of-truth 는 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md). UI 4 화면 (위저드 / 통합 상세 Scope 탭 / Cafe24 노드 Operation 드롭다운 / AI Agent allowlist) 이 본 필드를 읽어 ⚠ 배지·tooltip 을 자동 렌더한다. `level='scope'` 인 row 는 같은 resource (mileage/notification/privacy) 의 모든 자매 operation 에 같은 라벨이 자동 적용되므로 backend 메타데이터에서는 row 별로 빠짐없이 채운다. `level='program'` (Analytics 등) 인 row 는 catalog 대상이 아니므로 catalog-sync 의 `restricted` 컬럼 정합성 검증에서 **제외**된다 ([_overview §4](./cafe24-api-catalog/_overview.md#4-동기-정책-sync-contract) 검증 규칙 8 참고).

**`approvalGroup` 이 묶는 operation 집합**

| `approvalGroup` 값 | 묶이는 operation id 패턴 |
|---|---|
| `mileage` | mileage resource 의 모든 supported row |
| `notification` | notification resource 의 모든 supported row |
| `privacy` | privacy resource 의 모든 supported row |
| `activitylogs` | store resource 의 `activitylogs_list`, `activitylogs_get` |
| `menus` | store resource 의 `menus_get` |
| `naverpay_setting` | store resource 의 `naverpay_setting_*` |
| `kakaopay_setting` | store resource 의 `kakaopay_setting_*` |
| `pg_settings` | store resource 의 `paymentgateway_*` + `paymentgateway_paymentmethods_*` + `financials_paymentgateway_get` (UI 메시지 단일화 위해 PG 관련 3 영역 묶음) |
| `analytics` | Cafe24 Analytics API (catalog 외 트랙, placeholder) |

**`constraints` 의 의미**

본 필드는 Cafe24 공식 docs 가 표 파라미터로는 모두 optional 로 적었지만 본문 박스에 자연어로 명시한 조건부 제약 — 예: `customer_list` 의 "회원 아이디 · 휴대전화 중 한 가지는 반드시 입력" — 을 구조화한다. `requiredFields` 는 AND 시맨틱(모두 필수) 만 표현 가능하므로 OR / 짝 / 함의 형태의 제약을 누락하면 AI Agent (MCP 도구) 가 잘못된 인자를 추론해 호출 실패가 발생한다. 본 필드는 **두 의무 채널 + 선택적 schema 변환** 으로 노출하여 회귀를 방어한다 — (1) MCP 도구 description 자동 suffix (LLM 가독, 모든 kind 적용), (2) `cafe24.handler.ts execute()` 와 `Cafe24McpToolProvider.execute()` 의 runtime 검증 (2차 가드, 모든 kind 적용), (3) JSON Schema 변환 (`oneOf` kind 한정).

| kind | 의미 | 위반 예시 |
|---|---|---|
| `oneOf` | listed `fields` 중 **최소 1개** 가 제공되어야 함 (at-least-one-of) | `customer_list` 호출 시 `cellphone` / `member_id` 둘 다 미제공 |
| `allOrNone` | listed `fields` 가 **함께 있거나 함께 없거나** | `{ since: '2026-01-01' }` 만 있고 `until` 누락 |
| `implies` | `if` 필드가 제공되면 `then` 의 모든 필드가 함께 필요 | (가정) `coupon_code` 만 있고 `customer_no` 누락 |
| `impliesValue` | `if` 필드의 값이 `value` 와 정확히 같으면 `then` 의 모든 필드가 함께 필요 (value-aware) | `refund_method='T'` 인데 `refund_bank_name` / `refund_bank_account_no` / `refund_bank_account_holder` 누락 |

> JSON Schema `oneOf` / frontend `UiHint.visibleWhen.oneOf` 와의 이름 차이는 위 type 정의 직후의 "이름 주의" 박스 참고.

**invariant** — `metadata.spec.ts` 가 검증:

1. `oneOf.fields` / `allOrNone.fields` / `implies.if` / `implies.then` 에 등장하는 모든 필드 이름은 해당 operation 의 `fields` 키에 정의되어 있어야 한다.
2. `oneOf.fields` / `allOrNone.fields` 는 길이 2 이상. `implies.then` 은 길이 1 이상.
3. `requiredFields` 의 멤버는 이미 무조건 필수이므로 `constraints` 의 fields 에 중복 등재하지 않는 것을 권장 (자동 검증은 하지 않음 — 무해. 그러나 `oneOf` 에 `requiredFields` 멤버가 들어가면 제약이 의미상 자동 만족되므로 row 작성 실수 신호다).

**MCP/JSON Schema 매핑** — `cafe24-mcp-tool-provider.buildJsonSchema()` + tool description 빌더가 다음 변환을 수행한다:

| kind | JSON Schema 출력 | description suffix 한 줄 |
|---|---|---|
| `oneOf` | top-level `anyOf: [{required:[a]}, {required:[b]}, ...]`. `requiredFields` 가 비어있지 않으면 `allOf: [{required: [...requiredFields]}, {anyOf: ...}]` 로 결합 | `Constraint: at least one of {a}, {b}, {c} must be provided.` |
| `allOrNone` | JSON Schema 변환 없음 (description suffix + runtime 가드만) — `not` 절은 LLM tool-calling validator 들이 일관 처리 못 함 | `Constraint: {a}, {b}, {c} must be provided together (all or none).` |
| `implies` | JSON Schema 변환 없음 (description suffix + runtime 가드만) | `Constraint: when {a} is provided, {b}, {c} are also required.` |
| `impliesValue` | JSON Schema 변환 없음 (description suffix + runtime 가드만) — `if`/`then` 조합은 LLM 가독 +  cafe24 가 400 반환 전 runtime 가드로 차단 | `Constraint: when {a}="{value}", {b}, {c} are also required.` |

- 한 operation 의 `constraints` 배열이 N 개면 description suffix 도 N 줄 추가. base description → `(Cafe24 <method> <path>)` → constraint suffix lines → `CAFE24_TIMEZONE_SUFFIX` 순서로 한 빈 줄씩 띄워 결합.
- `oneOf` 가 여러 개면 JSON Schema 의 `allOf` 안에 각 `anyOf` 가 차례로 들어간다 (AND of OR-clauses).
- description suffix 의 필드 이름은 `, ` 로 join (예: `cellphone, member_id`). `oneOf` / `allOrNone` 모두 동일 포매팅.

**노드 핸들러 / MCP execute 시 runtime 검증** — `cafe24.handler.ts execute()` 와 `Cafe24McpToolProvider.execute()` 양쪽 모두 기존 `requiredFields` 누락 검사 직후 `constraints` 검증 (`validateCafe24Constraints` 공유 헬퍼) 을 수행하고, 위반 시 `IntegrationError('CAFE24_MISSING_FIELDS', ...)` 를 던진다. 기존 에러 코드를 **재사용** 해 client/UI 분기 추가를 피한다 — 메시지에 어떤 constraint kind 가 어떤 fields 에서 위반됐는지 명시 (예: `"constraint violated: oneOf [cellphone, member_id] requires at least one of"`).

**예시 — `customer_list` (보강안)**:

```ts
{
  id: 'customer_list',
  // ... requiredFields: ['shop_no'], fields: { shop_no, group_no, member_id, cellphone, since, until },
  constraints: [
    { kind: 'oneOf', fields: ['cellphone', 'member_id'] },
  ],
}
```

> **참고 — 본 예시의 fields 집합은 cafe24 docs 의 customer_list 전체 필드와 부분 일치**: cafe24 docs 본문에 `email` / `name` / `phone` / `created_start_date` / `created_end_date` 등이 더 있으나 현재 backend metadata 가 이를 미포함. 필드 자체 확장 + 다른 endpoint 의 조건부 제약 audit 은 후속 트랙에서 진행.

생성되는 MCP tool description (`Cafe24McpToolProvider.buildTools` 출력 예):

```
List members (customers) with filters by group, signup date, etc.

(Cafe24 GET customers — via Internal Bridge: <integration.name>)

Constraint: at least one of cellphone, member_id must be provided.

All date/time parameters and response fields use KST (Asia/Seoul, UTC+9) unless the field description states otherwise.
```

대응 JSON Schema:

```jsonc
{
  "type": "object",
  "properties": { /* shop_no, group_no, member_id, cellphone, since, until */ },
  "allOf": [
    { "required": ["shop_no"] },
    { "anyOf": [
        { "required": ["cellphone"] },
        { "required": ["member_id"] }
    ] }
  ]
}
```

> **catalog 노출 정책**: `constraints` 는 [`cafe24-api-catalog/_overview.md`](./cafe24-api-catalog/_overview.md) §2 의 표 컬럼으로 노출하지 않는다 — `restrictedApproval.approvalGroup` 과 동일하게 backend 메타데이터 row 가 단일 SoT 다. 카탈로그 표 폭 유지 + 복잡한 multi-kind constraint 식의 표 표현 부담 회피 + catalog-sync 룰 변경 최소 (3가지 모두 본 컨벤션 안에서만 다룸).

## 3. 예시 — `product` Resource 일부

```ts
export const productOperations: Cafe24OperationMetadata[] = [
  {
    id: 'product_list',
    description: 'List products in the mall. Supports filtering by category, display status, date range.',
    scopeType: 'read',
    method: 'GET',
    path: 'products',
    requiredFields: ['shop_no'],
    fields: {
      shop_no:     { type: 'number',  location: 'query',  description: 'Multi-shop number (default 1)' },
      category_no: { type: 'number',  location: 'query',  description: 'Filter by category' },
      display:     { type: 'enum',    location: 'query',  enum: ['T', 'F'] },
      since:       { type: 'string',  location: 'query',  description: 'ISO8601 datetime (KST, UTC+9) — created_after. e.g. "2026-05-18T00:00:00+09:00" (TZ-less 도 Cafe24 가 KST 로 해석)' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'product_get',
    description: 'Get a single product by product_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}',
    requiredFields: ['product_no'],
    fields: {
      product_no:  { type: 'number',  location: 'path' },
      shop_no:     { type: 'number',  location: 'query' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_update',
    description: 'Update a product (name, price, display, stock, etc).',
    scopeType: 'write',
    method: 'PUT',
    path: 'products/{product_no}',
    requiredFields: ['product_no'],
    fields: {
      product_no:    { type: 'number',  location: 'path' },
      product_name:  { type: 'string',  location: 'body' },
      price:         { type: 'string',  location: 'body', description: 'Decimal string (KRW)' },
      display:       { type: 'enum',    location: 'body', enum: ['T', 'F'] },
    },
    responseShape: 'single',
  },
];
```

## 4. Wire-format 규약 — POST/PUT `request` envelope

Cafe24 Admin API 의 모든 **POST/PUT** 본문은 다음 형태로 직렬화된다 (Cafe24 자체 규약):

```json
{ "shop_no": <n>, "request": { ...payload } }
```

- `shop_no` 는 top-level 에 두는 유일한 필드. 그 외 모든 필드는 `request` 안으로 wrap.
- Cafe24 request envelope 변환은 `Cafe24ApiClient` (`codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 의 `wrapInCafe24Envelope`) 가 일괄 처리한다. 메타데이터 row 작성자는 `fields[*].location: 'body'` 분류만 신경 쓰면 되고, envelope 적용은 자동.
- caller 가 넘긴 body 의 직렬화 결과 (모두 POST/PUT 기준):

  | caller 의 flat body | wire 직렬화 결과 |
  |---|---|
  | `{ shop_no: 1, product_name: "X" }` | `{"shop_no":1,"request":{"product_name":"X"}}` |
  | `{ product_name: "X" }` (shop_no 생략) | `{"request":{"product_name":"X"}}` |
  | `{ shop_no: 1 }` (degenerate — payload 없음) | `{"shop_no":1,"request":{}}` |
  | `{}` 또는 body 미지정 | body 미전송 (Content-Type 도 부여 안 함) |

- `shop_no` 의 값이 `0` 또는 `null` 인 경우도 그대로 top-level 로 hoist (caller 의 실수가 wire 위에서 가시화되도록). `undefined` 만 hoist 제외.
- `request` 키 자체가 없으면 Cafe24 가 `400 "Please enter the Request parameter."` 를 반환하므로, body 에 다른 필드가 없는 (degenerate) 케이스도 빈 `request: {}` 를 함께 보낸다.
- DELETE 에는 Cafe24 request envelope 을 적용하지 않는다 — 우리 메타데이터의 DELETE row 는 모두 path-only (body 필드 없음) 다. 향후 다른 HTTP method (PATCH 등) 가 추가되면 그 시점에 wire format 확인 후 명시적으로 envelope 적용 여부를 결정한다 (현재 코드는 POST/PUT allowlist 로 강제).
- caller 가 이미 `{request: ...}` 형태로 pre-wrap 한 body 를 넘기면 wrapper 가 즉시 throw 하여 이중 래핑을 차단한다 (개발 단계 가드 — 현재 모든 caller 는 flat body 만 사용한다는 전제).

본 규약을 누락하면 Cafe24 가 `400 "Please enter the Request parameter."` 를 반환한다.

> **용어 주의**: 본 절의 "Cafe24 request envelope" / "POST/PUT request envelope" 은 Cafe24 wire format 의 `request` 래퍼다. CONVENTIONS Principle 7 의 **노드 출력 envelope** (`{config, output, meta, port}`) 와 무관한 별개 개념이다.

## 5. Timezone Semantics

Cafe24 Admin API 의 모든 **date/time 필드** (요청 파라미터·응답 모두) 는 **KST (Asia/Seoul, UTC+9)** 기준이다. Cafe24 본사 운영 timezone 이며 공식 docs 가 별도 timezone 명시 없이 사용하는 default 다.

### 5.1 적용 범위

| 위치 | 형식 | 비고 |
|---|---|---|
| 요청 query/body 의 `since`, `created_*`, `start_date`, `end_date` 등 | ISO 8601 (`YYYY-MM-DDTHH:MM:SS+09:00`) 권장. TZ designator 누락 시 Cafe24 가 KST 로 해석 | TZ-less local 문자열 (`YYYY-MM-DD HH:MM:SS`) 도 Cafe24 가 KST 로 해석 — 단, 호출자 코드 가독성을 위해 우리는 항상 `+09:00` 부여를 권장 |
| 응답 본문의 `created_date`, `updated_date`, `order_date` 등 | ISO 8601 with `+09:00` | Cafe24 가 designator 부여해 응답하므로 별도 보정 불요 |
| 응답 헤더 `X-Cafe24-*` (예: `X-Cafe24-Call-Remain` — 초 단위) | 절대 시각 아님 — 영향 없음 | |

> **단, 토큰 만료 (`expires_at`)** 는 본 절의 범주 밖. JWT `exp` claim (RFC 7519, Unix epoch seconds — UTC absolute) 이 single source of truth 다. 자세한 정규화 precedence 는 [Spec 통합 §10.5](../2-navigation/4-integration.md#105-토큰-자동-갱신) 의 "Cafe24 token 만료 SoT — JWT exp 격상" Rationale 참고. TZ-less ISO 의 KST 정규화는 그쪽의 fallback 단계 (precedence 3) 에서만 적용된다.

### 5.2 메타데이터 row 작성 규약

`Cafe24OperationMetadata.fields[*].description` 의 date/time 필드는 다음 두 컨벤션을 따른다:

1. **형식 명시**: `'ISO8601 date (KST, UTC+9)'` 또는 `'ISO8601 datetime (KST)'` — 단순 `'ISO8601 date'` 만 적는 것은 금지.
2. **의미 명시**: `since`/`start_date` 같은 절대 시각 필드는 `'... — KST (UTC+9). Naive ISO 도 Cafe24 가 KST 로 해석'` 형태로 보강.

예시 — `product_list.fields.since`:

```ts
{
  since: {
    type: 'string',
    location: 'query',
    description: 'ISO8601 datetime (KST, UTC+9) — created_after. e.g. "2026-05-18T00:00:00+09:00"',
  },
}
```

§3 의 예시 row 도 본 §5.2 규약을 따른다.

### 5.3 AI Agent / MCP 도구 description 자동 suffix

`Cafe24McpToolProvider.buildTools()` 는 §7 (MCP Bridge 와의 매핑) 의 `buildToolDescription()` 조립 시점에 **모든 도구의 description 끝에 다음 한 줄을 자동 append (suffix)** 한다 (operation 에 `constraints` 가 있는 경우 constraint suffix 줄들 다음에 본 줄이 마지막 — §2 "constraints 의 의미" 의 조립 순서 참고):

```
All date/time parameters and response fields use KST (Asia/Seoul, UTC+9) unless the field description states otherwise.
```

생성 결과 예시 (`product_list`):

```
List products in the mall. Supports filtering by category, display status, date range.

(Cafe24 GET products — via Internal Bridge: <integration.name>)

All date/time parameters and response fields use KST (Asia/Seoul, UTC+9) unless the field description states otherwise.
```

LLM 이 도구 호출 인자를 구성할 때 — 예를 들어 `$now` (UTC) 또는 시스템 프롬프트의 timezone 정보와 cross-check 해 — 9시간 어긋난 필터를 만들지 않도록 하는 1차 방어선이다. AI Agent 가 시스템 프롬프트에서 timezone 컨텍스트를 받지 못하는 경우에도 도구 description 자체로 정보가 전달된다.

> **단일 suffix 정책**: capability 가 `tools` 만 (cafe24 는 `resources`/`prompts` 미보고 — [Spec MCP Client §5.1](../5-system/11-mcp-client.md#51-노출-규칙) 노출 규칙) 이므로 모든 cafe24 도구가 동일한 suffix 를 받는다. 향후 다른 Internal Bridge (Shopify 등) 이 추가될 때 같은 패턴으로 각 bridge 가 자신의 timezone semantics 를 노출할 수 있다.

### 5.4 사용자 입력 변환 (참고 — informative)

> 본 §5.4 는 informative 다 — normative SoT 는 §5.1/§5.2/§5.3.

워크플로 캔버스의 Cafe24 노드는 사용자 표현식 `{{ $now.iso }}` 가 UTC ISO 라는 점을 인지하고 — Cafe24 가 designator 를 존중하므로 — 그대로 전송해도 의미 동일이다 (`+09:00` ↔ `Z` 는 동일 epoch). 단, LLM 이 AI Agent 에서 시각을 직접 문자열로 구성하는 경우 (예: `"2026-05-18T00:00:00"`) 는 §5.1 의 KST 해석이 적용되므로 의도와 9시간 어긋날 수 있다 — 이는 §5.3 의 description 자동 suffix 와 AI 시스템 프롬프트의 timezone 컨텍스트로 완화된다.

---

## 6. 신규 endpoint 추가 절차

1. [Cafe24 공식 문서](https://developers.cafe24.com/docs/ko/api/admin/) 에서 endpoint 의 method / path / 필드 확인.
2. 해당 resource 의 metadata 파일(`codebase/backend/src/nodes/integration/cafe24/metadata/<resource>.ts`) 에 §2 형식으로 row 1 추가.
3. `id` 는 `<resource>_<verb>` 형식 (예: `product_list`, `order_update_status`). 중복 금지 (resource 내).
4. `scopeType` 은 read/write 결정 — scope 매핑에 사용.
5. **조건부 제약 확인** — cafe24 공식 docs 의 endpoint 페이지에서 표 외 본문 박스에 "X·Y·Z 중 한 가지는 반드시 입력" / "A 와 B 는 함께 입력" / "A 가 있으면 B 도 필요" 같은 자연어 제약이 있는지 확인. 있으면 §2 의 `constraints?` 에 `oneOf` / `allOrNone` / `implies` row 로 등재.
6. [`cafe24-api-catalog/<resource>.md`](./cafe24-api-catalog/_overview.md) 의 표에 해당 row 의 `status` 를 `planned → supported` 로 갱신하고 `method` / `path` / `scope` / `paginated` 컬럼을 채운다. 카탈로그에 row 자체가 없으면 새로 추가.
   - 추가로 별도 승인 대상인 경우 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md) 명단과 비교해 catalog 의 `restricted` 컬럼(`scope` / `operation` / 빈칸) 과 backend 메타데이터의 `restrictedApproval` 필드를 동시 갱신한다.
7. `_overview.md` §5 의 coverage matrix 카운트도 갱신.
8. 백엔드 단위 테스트가 자동으로 검증:
   - 모든 `id` 의 unique (resource 내) — `metadata.spec.ts`
   - 모든 `path` 의 `{placeholder}` 가 `fields` 에 정의됐는지 — `metadata.spec.ts`
   - `requiredFields` 가 `fields` 의 키 부분집합인지 — `metadata.spec.ts`
   - `constraints[*]` 가 참조하는 모든 필드명이 `fields` 키 부분집합 + kind 별 길이 invariant — `metadata.spec.ts` (§2 의 `constraints` invariant 참고)
   - **카탈로그 ↔ 메타데이터 양방향 동기** — `catalog-sync.spec.ts`
   - **`restricted` 컬럼 ↔ `restrictedApproval` 양방향 동기** — `catalog-sync.spec.ts`. catalog 가 `scope` 또는 `operation` 면 메타데이터에 `restrictedApproval` 존재, 그 역도 동일. `level='program'` 은 검증 대상 제외 ([_overview §4](./cafe24-api-catalog/_overview.md#4-동기-정책-sync-contract) 검증 규칙 8 참고).
9. **spec 본문 수정 불요** — `4-cafe24.md` 는 형식만 정의.

## 7. MCP Bridge 와의 매핑

> **레이어 경계**: `Cafe24McpToolProvider` 는 Internal Bridge provider 자체이므로 `buildTools()` 가 반환하는 도구 `name` 을 **이미 prefix 가 부여된 `mcp_<sid>__<operation.id>`** (예: `mcp_<sid>__product_list`) 형태로 **직접 생성**한다 ([Spec MCP Client §5.2](../5-system/11-mcp-client.md#52-도구-이름-규칙) 의 도구 이름 규칙과 동일 형식). LLM 에 노출되는 이름은 이 prefixed 이름이고, `execute()` 진입 시 provider 가 prefix 를 벗겨 bare operation id 로 처리한다. 반면 AI Agent config 의 `mcpServers[].enabledTools` 와 §8 allowlist 비교는 **bare id** (예: `product_list`) 배열로 저장·비교된다 (`buildTools` 가 `enabled(operation.id)` 로 bare id 필터).

`Cafe24McpToolProvider.buildTools()` 는 메타데이터 테이블을 순회하여 다음을 생성한다 (pseudo-code — bare id 필터·prefix 부여 포함):

```ts
const CAFE24_TIMEZONE_SUFFIX =
  'All date/time parameters and response fields use KST (Asia/Seoul, UTC+9) unless the field description states otherwise.';

// op 1개 → tool 1개. enabled(op.id) (bare id allowlist) 와 scope grant 통과한 op 만.
for (const { resource, operation } of listAllCafe24Operations()) {
  // ... enabled(operation.id) / grantedScope 필터 ...
  tools.push({
    name: `mcp_${sid}__${operation.id}`,             // prefixed — provider 가 직접 부여
    description: buildToolDescription(operation, integration.name), // §2 조립 순서
    parameters: buildJsonSchema(operation),          // requiredFields + oneOf→anyOf 결합 — §2 "MCP/JSON Schema 매핑"
  });
}
```

`buildToolDescription(operation, integrationName)` 의 조립 순서는 base description → `(Cafe24 <method> <path> — via Internal Bridge: <integrationName>)` → constraint suffix 줄(0..N) → `CAFE24_TIMEZONE_SUFFIX` 이며, 각 part 를 `'\n\n'` 로 join 한다.

> 본 §7 pseudo-code 는 `constraints` 가 description suffix 및 JSON Schema `anyOf` 두 채널 모두에 어떻게 합류되는지의 한 줄 요약이다. 조립 순서·각 kind 별 변환 규칙·`allOf`/`anyOf` 결합 정확한 정의는 §2 "constraints 의 의미" 가 SoT 다 (§7 은 §2 의 derivative). 실제 production 구현은 `cafe24-mcp-tool-provider.ts` 의 `buildToolDescription()` 자유 함수와 `Cafe24McpToolProvider.buildJsonSchema()` 메서드에 자리한다.

`Cafe24McpToolProvider.execute(call)` 는 args 를 노드 핸들러의 `fields` 와 동일하게 처리하여 `Cafe24ApiClient` 로 위임 — **노드와 MCP 가 같은 호출 경로를 공유**.

### 7.5 Catalog key 형식 — 활동 로그 `api_label`

Cafe24 노드 핸들러와 `Cafe24McpToolProvider` 가 [Spec 통합 §4.6 Recent activity 탭](../2-navigation/4-integration.md#46-recent-activity-탭) 의 `api_label` 컬럼에 적재하는 catalog key 형식은 다음과 같다:

```
cafe24.<resource>.<operation>
```

- `<resource>` 는 18 카테고리 enum (`store`, `product`, `order`, ...) 중 하나
- `<operation>` 은 `Cafe24OperationMetadata.id` 의 값 (예: `product_list`, `order_update_status`)
- 예시: `cafe24.product.product_list`, `cafe24.order.order_get`, `cafe24.customer.customer_update`

**책임 분리** — DB·backend 메타데이터는 catalog key (single source of truth) 만 보유하고, frontend i18n dict 가 사람 친화 라벨의 단일 SoT 다. backend 가 한국어 라벨을 직접 보유하지 않는다 — 노드 에디터 operation 드롭다운과 활동 로그 라벨 모두 같은 catalog key 로 dict lookup:

| 책임 | 위치 | 저장/노출 형태 |
|---|---|---|
| catalog key 발급 | (1) backend cafe24 노드 핸들러 (`IntegrationHandlerBase.logUsage` 경유) **및** (2) AI Agent Internal Bridge provider (`Cafe24McpToolProvider` 가 `IntegrationsService.logUsage` 직접 호출) — **두 실행 경로 모두 의무** | `cafe24.<resource>.<operation>` (영문 식별자) |
| catalog key 영속화 | `integration_usage_log.api_label` (`varchar(128)`) | 영속 — 언어 정보 없음 |
| catalog endpoint 노출 | `GET /api/integrations/services/cafe24/catalog` ([통합 §9.3](../2-navigation/4-integration.md#93-사용처활동)) | `{ key, method, path, labelKey, descriptionKey }` 배열. `labelKey`/`descriptionKey` 는 frontend dict 의 lookup key (영문 ID) |
| 노드 에디터 operation 드롭다운 노출 | `GET /nodes/definitions` 의 cafe24 extras (`extras.operationsByResource[].labelKey`) | `cafe24.<resource>.<operation>` (catalog key 와 동일 형식 — 한 SoT) |
| i18n 변환 (단일 진실) | frontend i18n dict `cafe24Catalog.<key>` (KO/EN) | `labelKey` → 사람 친화 라벨 (예: `"상품 목록 조회"` / `"List products"`) |

**왜 이 분리가 필요한가**: backend 가 i18n 결과 (한국어 hardcoded `label`) 를 보유하면 (a) 사용자 UI 언어 변경 시 backend 의 옛 언어 라벨이 영문 UI 에 그대로 노출되는 회귀가 영구화되고, (b) catalog 라벨 수정 시 backend 와 dict 사이에 drift 가 생긴다. backend 는 catalog key 만 노출하고 i18n 을 매 frontend 렌더 시점에 수행하면 두 회귀 모두 발생하지 않는다. 활동 로그 (`api_label`) 와 노드 에디터 드롭다운이 같은 catalog key 로 단일화되어 SoT 가 dict 한 곳에 모인다. 결정 근거 상세는 [Spec 통합 ## Rationale "활동 로그 API 식별 — 3컬럼 (label/method/path) + catalog endpoint 신설"](../2-navigation/4-integration.md#rationale) 및 본 문서 ## Rationale "backend `label` 필드 제거 — frontend i18n dict 단일 SoT" 참조.

**두 실행 경로 모두 동일 catalog key 동반 의무**: 위 "catalog key 발급" 행의 두 경로 — 노드 핸들러와 Internal Bridge provider — 는 활동 로그에 **같은 형식** (`cafe24.<resource>.<operation>`) 의 `api_label` 을 채워야 한다. Internal Bridge (`Cafe24McpToolProvider`) 는 노드 핸들러 base class 를 거치지 않고 `IntegrationsService.logUsage` 를 직접 호출하므로, `api` 채우기를 누락해도 노드 핸들러 테스트는 통과하는 사각지대다. cross-cutting SoT: [`spec/4-nodes/4-integration/_product-overview.md` INT-US-05 "실행 경로"](../4-nodes/4-integration/_product-overview.md#24-사용처-추적-및-라이프사이클).

**`Cafe24OperationMetadata.id` 와의 관계**: `<operation>` 은 metadata row 의 `id` 와 동일 값이다. metadata row 가 추가/변경되면 catalog key 도 자동으로 일치 — drift 방지. catalog endpoint 의 `key` 필드는 `${'cafe24.'}${resource}.${op.id}` 로 생성한다.

**`descriptionKey` 파생 규칙**: catalog endpoint 응답의 `descriptionKey` 는 `cafe24.<resource>.<operation>.description` 형식 (labelKey 끝에 `.description` 접미). frontend dict 가 이 키를 lookup 해 endpoint subtext 또는 tooltip 의 detail 라벨로 사용. 현재 dict 가 description key 미보유 시 frontend 는 라벨 단독 렌더로 fallback.

**dict lookup miss fallback**: frontend `cafe24Catalog` dict 에 `labelKey` 가 등록되지 않은 경우 (예: 새 operation 이 추가됐는데 dict 가 동기되지 않음), 노드 에디터 드롭다운과 활동 로그 라벨은 모두 `labelKey` 자체 (`cafe24.<resource>.<operation>`) 를 그대로 노출한다 — 사용자가 보면 어색하지만 dict 누락 즉시 감지 가능. op.id 또는 임의 영문 변환으로 추측하지 않는다 — drift 가 silent 하게 진행되는 것을 막기 위함.

## 8. allowlist 와의 관계

> 용어: **UI grouping 단위 = "카테고리"** (사용자 친화 표기) — 백엔드 메타데이터 파일 구조의 "Resource" 와 동일 범위를 가리키며, 문맥에 따라 혼용한다. spec 본문에서는 UI 맥락이면 "카테고리", 백엔드/Operation 메타데이터 맥락이면 "Resource" 사용. `Node.category` Enum 과는 별개 개념 (이름 충돌은 §2 의 `scopeType` 채택으로 이미 회피).

AI Agent `mcpServers[].enabledTools` 가 비어있으면 모든 operation 이 노출. 사용자가 `['product_list', 'product_get']` 로 좁히면 그 둘만 LLM tool 로 노출 (bare id 비교). UI 는 카테고리 단위 grouping (예: "Product (read 전부)" 체크 → 백엔드는 `['product_list', 'product_get']` 로 저장).

## Rationale

### Cafe24 API timezone semantics 명시

**문제**: Cafe24 Admin API 의 모든 date/time 필드가 KST(UTC+9) 기준이라는 사실이 spec 어디에도 명시되지 않았다. AI Agent 가 `$now` (UTC ISO8601) 를 그대로 도구 인자로 넘기거나 `"2026-05-18T00:00:00"` 같은 TZ-less 문자열을 생성할 때 Cafe24 가 KST 로 해석해 의도와 9시간 어긋난 결과를 받는 회귀 가능성이 있었다.

**결정**: §5 신설 + `buildToolDescription()` 이 모든 도구 description 끝에 `CAFE24_TIMEZONE_SUFFIX` 한 줄을 자동 append. 토큰 만료 (JWT `exp`) 와는 별개 — 그쪽은 UTC absolute 가 SoT 다 ([Spec 통합 §10.5](../2-navigation/4-integration.md#105-토큰-자동-갱신) "Cafe24 token 만료 SoT — JWT exp 격상" Rationale).

**채택안 — 메타데이터 + 도구 description 자동 suffix + AI 시스템 컨텍스트** 세 곳에 timezone semantics 노출. backend wrapper 가 시각 문자열을 KST 로 자동 변환하는 안은 기각 — `"오늘 자정"` 이 UTC 자정인지 KST 자정인지 모호해 의도 추론이 위험하고, "DB 상태"(timezone-naive 입력) 와 "LLM 의도"(timezone-aware 추론) 를 분리 못 한 채 변환을 강제하면 silent 9시간 시프트가 더 자주 발생한다 (TZ designator 미명시 입력에 default 부여는 fallback 단계에서만 허용 — [`spec/2-navigation/4-integration.md` Rationale "Cafe24 토큰 자동 갱신 — TZ 정규화 fallback"](../2-navigation/4-integration.md#rationale) 의 선례). AI Agent 시스템 프롬프트에만 명시하는 안도 단독으로는 부족 — 도구별 timezone 정보는 도구 description 에 있어야 발견 가능하므로, AI 시스템 프롬프트 prefix ([Spec AI 공통 §11](../4-nodes/3-ai/0-common.md#11-ai-노드-시스템-프롬프트-자동-prefix)) 와 함께 **두 채널 노출** 이 회귀 위험을 최소화한다.

**근거**: Cafe24 MCP 를 AI 에이전트에게 제공할 때 KST 정보를 함께 알려주어야 한다.

### Cafe24 API 조건부 필수 — `constraints` 신설

**문제**: cafe24 공식 admin API docs 가 일부 endpoint 에서 표 파라미터로는 모든 필드를 optional 로 적어두고, 본문 박스에 자연어로만 조건부 제약을 명시한다 — `customer_list` 의 "회원 아이디 · 휴대전화 중 한 가지는 반드시 입력" 이 대표적 사례. backend 메타데이터의 `requiredFields: string[]` 는 AND 시맨틱(전부 필수) 만 표현 가능하므로 이런 OR / 짝 / 함의 제약을 누락한 채 MCP tool 로 노출하면 AI agent 가 "모두 optional" 로 추론해 빈 호출 → cafe24 400 회귀가 발생한다.

**결정**: `Cafe24OperationMetadata` 에 `constraints?: Cafe24FieldConstraint[]` 신설. kind 4종 (`oneOf` / `allOrNone` / `implies` / `impliesValue`) 으로 조건부 제약을 구조화 (§2 의 `Cafe24FieldConstraint` 정의 참고 — `impliesValue` 는 `if` 의 값이 특정 value 와 같을 때만 `then` 을 강제하는 value-aware 변형). 두 채널 동시 노출:
1. MCP tool description 자동 suffix (LLM 가독) — 모든 kind 에 적용.
2. handler/MCP `execute()` 진입 시점 runtime 검증 — 모든 kind 에 적용. 기존 `CAFE24_MISSING_FIELDS` 에러 코드 재사용 (client/UI 분기 추가 없음).
3. JSON Schema `anyOf` 변환 — `oneOf` 만 적용 (LLM 1차 가드 강화).

**채택안 — 구조화 (`constraints?: Cafe24FieldConstraint[]`) + 두 채널 + `oneOf` 만 schema 변환**: 신규 endpoint 추가 시 cafe24 docs 본문 박스를 한 번 읽고 row 1줄 추가하면 모든 채널이 자동으로 갱신된다. description suffix 만 노출하는 안은 기각 — runtime 검증이 없으면 cafe24 가 400 을 반환해야 사용자가 알게 되는데, 그 사이 tool round-trip 1회 + integration 401/403 핸들러 오작동 위험이 있다. `requiredFields` 를 `Array<string | string[]>` 로 확장하는 안도 기각 — catalog-sync / handler / MCP / type 모두 단일 필드를 가정한 코드라 영향 면이 크고 `allOrNone` / `implies` 는 표현 불가. JSON Schema 의 모든 kind 를 변환하는 안 역시 기각 — Anthropic/OpenAI tool-call validator 들의 `not` 처리가 일관되지 않아 LLM 이 over-constrain 추론을 하는 케이스가 있고, 어차피 runtime 검증이 SoT 이므로 schema 변환은 가장 큰 케이스(`oneOf`) 만 처리해 LLM 호환 위험을 최소화한다.

**catalog 컬럼 미노출**: `restrictedApproval.approvalGroup` 이 catalog 컬럼이 아닌 backend 메타데이터 내부 SoT 인 선례와 동일 패턴. 카탈로그 표 폭 유지 + 복잡한 multi-kind constraint 식 (예: `oneOf` + `allOrNone` 두 개) 의 표 표현 부담 회피 + catalog-sync 룰 변경 최소 — `constraints` 자체는 본 컨벤션 안에서만 단일 SoT 다.

**근거**: `customer_list` 가 docs 표상 모두 optional 인데 실제로는 조건부 필수라 AI agent 가 잘못 추론하는 문제를 차단한다.

### backend `label` 필드 제거 — frontend i18n dict 단일 SoT

**문제**: 활동 로그 라벨의 i18n 책임 분리 (DB 는 catalog key, frontend dict 가 KO/EN 사람 친화 라벨 SoT) 와 §7.5 책임 분리 표를 두고도, `Cafe24OperationMetadata.label: string` (한국어 hardcoded — 예: `'상품 목록 조회'`) 이 두 곳에 남아 있으면 — (1) `/nodes/definitions` 응답의 `extras.operationsByResource[].label` 이 frontend `integration-configs.tsx` 의 cafe24 operation 드롭다운 렌더에 그대로 사용되고, (2) `metadata/planned.ts` 의 type 정의가 `label` 을 유지 — 영문 UI 사용자가 cafe24 노드를 편집하면 드롭다운 옵션이 한국어로 노출되는 회귀가 운영에서 가능하다.

**결정**: `Cafe24OperationMetadata.label` 필드를 **완전 제거** (deprecate 가 아님 — 실 소비처가 명확하고 frontend 갱신과 동시에 가는 게 깔끔). 노드 에디터 드롭다운까지 `cafe24Catalog` dict lookup 으로 일원화. `/nodes/definitions` 응답 shape 의 `extras.operationsByResource[].label: string` → `labelKey: string` 으로 필드명 변경 (의미가 lookup key 라는 점 명시). `labelKey` 의 형식은 catalog endpoint (§7.5) 와 동일한 `cafe24.<resource>.<operation>` — backend 가 한 곳에서 동일 catalog key 를 두 endpoint 에 노출하므로 dict 키도 단일.

**채택안 — 완전 제거 + 응답 필드명 변경**: backend metadata 가 영문 식별자 (id, catalog key) 만 보유하고 한국어/영문 라벨은 dict 하나가 SoT 가 되어 drift 가능성을 구조적으로 소거한다. frontend ↔ backend 동시 머지 필요한 wire-format 단절은 작은 비용 (cafe24 단일 노드, 소비처 2곳). `label` 을 deprecated 로만 표기하고 점진 이주하는 안은 기각 — 한국어 hardcoded 잔존 기간 동안 사용자 영향이 계속되고, 옛 label 과 신규 labelKey 가 동시 존재하면 frontend 분기 추가가 필요해 drift 가 생긴다. 노드 에디터 드롭다운만 dict lookup 으로 옮기고 backend `label` 을 유지하는 안도 기각 — backend metadata 의 한국어 hardcoded 가 dict 와 drift 가능하고, spec §7.5 의 "frontend i18n dict 가 SoT" 약속과 어긋난다.

**근거**: 영문 UI 사용자에게 한국어 hardcoded 가 노출되는 회귀를 영구 차단하고 backend metadata 의 SoT 책임을 식별·매핑(영문 ID) 에만 한정한다.
