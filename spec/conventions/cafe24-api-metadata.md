# CONVENTION: Cafe24 API Metadata

> 관련 문서: [Spec Cafe24 노드](../4-nodes/4-integration/4-cafe24.md) · [Spec 통합 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24) · [Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge-in-process) · [Cafe24 API Catalog](./cafe24-api-catalog/_overview.md)

본 컨벤션은 Cafe24 Admin API 의 endpoint 매핑 메타데이터 **형식** 을 정의한다. 실제 endpoint 의 전수 카탈로그(supported/planned/deprecated)는 [`cafe24-api-catalog/`](./cafe24-api-catalog/_overview.md) 에 있고, backend 메타데이터 row 와 카탈로그는 `catalog-sync.spec.ts` 로 양방향 동기 보호된다.

backend 의 `Cafe24` 노드 핸들러와 `Cafe24McpBridge` 양쪽이 **같은 메타데이터 테이블** 을 소비한다 — 신규 endpoint 추가는 메타데이터 row 1 추가 + 카탈로그 row 1 갱신으로 끝나야 한다.

---

## 1. 디렉토리 구조

```
backend/src/nodes/integration/cafe24/metadata/
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
  id: string;                    // 예: 'product_list'. resource 안에서 unique
  label: string;                 // UI 드롭다운 라벨 (한국어) 예: '상품 목록 조회'
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
    category:
      | 'mileage' | 'notification' | 'privacy'         // scope 전체 (resource 단위)
      | 'activitylogs' | 'menus'                        // store 안 operation 단위
      | 'naverpay_setting' | 'kakaopay_setting'
      | 'pg_settings'                                   // paymentgateway_* + paymentgateway_paymentmethods_* + financials_paymentgateway_get 묶음
      | 'analytics';                                    // 별도 프로그램 (placeholder, catalog 대상 외)
    docsUrl?: string;
    inquiryUrl: string;                                 // 카페24 개발자센터 안내 링크
  };
}
```

**`restrictedApproval` 의 의미**

본 필드는 카페24 본사가 별도 승인한 클라이언트만 호출할 수 있는 operation 을 식별한다. 명단의 single-source-of-truth 는 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md). UI 4 화면 (위저드 / 통합 상세 Scope 탭 / Cafe24 노드 Operation 드롭다운 / AI Agent allowlist) 이 본 필드를 읽어 ⚠ 배지·tooltip 을 자동 렌더한다. `level='scope'` 인 row 는 같은 resource (mileage/notification/privacy) 의 모든 자매 operation 에 같은 라벨이 자동 적용되므로 backend 메타데이터에서는 row 별로 빠짐없이 채운다. `level='program'` (Analytics 등) 인 row 는 catalog 대상이 아니므로 catalog-sync 의 `restricted` 컬럼 정합성 검증에서 **제외**된다 ([_overview §4](./cafe24-api-catalog/_overview.md#4-동기-정책-sync-contract) 검증 규칙 8 참고).

**`category` 가 묶는 operation 집합**

| `category` 값 | 묶이는 operation id 패턴 |
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

## 3. 예시 — `product` Resource 일부

```ts
export const productOperations: Cafe24OperationMetadata[] = [
  {
    id: 'product_list',
    label: '상품 목록 조회',
    description: 'List products in the mall. Supports filtering by category, display status, date range.',
    scopeType: 'read',
    method: 'GET',
    path: 'products',
    requiredFields: ['shop_no'],
    fields: {
      shop_no:     { type: 'number',  location: 'query',  description: 'Multi-shop number (default 1)' },
      category_no: { type: 'number',  location: 'query',  description: 'Filter by category' },
      display:     { type: 'enum',    location: 'query',  enum: ['T', 'F'] },
      since:       { type: 'string',  location: 'query',  description: 'ISO8601 date — created_after' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'product_get',
    label: '상품 단건 조회',
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
    label: '상품 수정',
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
- Cafe24 request envelope 변환은 `Cafe24ApiClient` (`backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 의 `wrapInCafe24Envelope`) 가 일괄 처리한다. 메타데이터 row 작성자는 `fields[*].location: 'body'` 분류만 신경 쓰면 되고, envelope 적용은 자동.
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

본 규약을 누락하면 Cafe24 가 `400 "Please enter the Request parameter."` 를 반환한다 — 운영 사고 사례 (2026-05-16, `mcp_b74e1adc__product_update` 실패) 가 본 절 신설의 직접 배경.

> **용어 주의**: 본 절의 "Cafe24 request envelope" / "POST/PUT request envelope" 은 Cafe24 wire format 의 `request` 래퍼다. CONVENTIONS Principle 7 의 **노드 출력 envelope** (`{config, output, meta, port}`) 와 무관한 별개 개념이다.

## 5. 신규 endpoint 추가 절차

1. [Cafe24 공식 문서](https://developers.cafe24.com/docs/ko/api/admin/) 에서 endpoint 의 method / path / 필드 확인.
2. 해당 resource 의 metadata 파일(`backend/src/nodes/integration/cafe24/metadata/<resource>.ts`) 에 §2 형식으로 row 1 추가.
3. `id` 는 `<resource>_<verb>` 형식 (예: `product_list`, `order_update_status`). 중복 금지 (resource 내).
4. `scopeType` 은 read/write 결정 — scope 매핑에 사용.
5. [`cafe24-api-catalog/<resource>.md`](./cafe24-api-catalog/_overview.md) 의 표에 해당 row 의 `status` 를 `planned → supported` 로 갱신하고 `method` / `path` / `scope` / `paginated` 컬럼을 채운다. 카탈로그에 row 자체가 없으면 새로 추가.
   - 추가로 별도 승인 대상인 경우 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md) 명단과 비교해 catalog 의 `restricted` 컬럼(`scope` / `op` / 빈칸) 과 backend 메타데이터의 `restrictedApproval` 필드를 동시 갱신한다.
6. `_overview.md` §5 의 coverage matrix 카운트도 갱신.
7. 백엔드 단위 테스트가 자동으로 검증:
   - 모든 `id` 의 unique (resource 내)
   - 모든 `path` 의 `{placeholder}` 가 `fields` 에 정의됐는지
   - `requiredFields` 가 `fields` 의 키 부분집합인지
   - **카탈로그 ↔ 메타데이터 양방향 동기** (`catalog-sync.spec.ts`)
   - **`restricted` 컬럼 ↔ `restrictedApproval` 양방향 동기** (`catalog-sync.spec.ts`) — catalog 가 `scope` 또는 `op` 면 메타데이터에 `restrictedApproval` 존재, 그 역도 동일. `level='program'` 은 검증 대상 제외 ([_overview §4](./cafe24-api-catalog/_overview.md#4-동기-정책-sync-contract) 검증 규칙 8 참고).
8. **spec 본문 수정 불요** — `4-cafe24.md` 는 형식만 정의.

## 6. MCP Bridge 와의 매핑

> **레이어 경계**: 본 절의 `Cafe24McpBridge.callTool(name, args)` 와 `listTools()` 가 반환하는 도구 `name` 은 **bare operation id** (예: `product_list`) 다. MCP Client 레이어가 외부 노출 시점에 `mcp_<sid>__` prefix 를 자동 부여한다 ([Spec MCP Client §5.2](../5-system/11-mcp-client.md#52-도구-이름-규칙)). AI Agent config 의 `mcpServers[].enabledTools` 도 bare id 배열로 저장된다.

`Cafe24McpBridge.listTools()` 는 메타데이터 테이블을 순회하여 다음을 생성한다:

```ts
function operationToMcpTool(op: Cafe24OperationMetadata): McpTool {
  return {
    name: op.id,                                 // bare id — 예: 'product_list'
    description: `${op.description}\n\n(Cafe24 ${op.method} ${op.path})`,
    inputSchema: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(op.fields).map(([k, f]) => [k, fieldToJsonSchema(f)])
      ),
      required: op.requiredFields,
    },
  };
}
```

`Cafe24McpBridge.callTool(name, args)` 는 args 를 노드 핸들러의 `fields` 와 동일하게 처리하여 `Cafe24ApiClient` 로 위임 — **노드와 MCP 가 같은 호출 경로를 공유**.

## 7. allowlist 와의 관계

> 용어: **UI grouping 단위 = "카테고리"** (사용자 친화 표기) — 백엔드 메타데이터 파일 구조의 "Resource" 와 동일 범위를 가리키며, 문맥에 따라 혼용한다. spec 본문에서는 UI 맥락이면 "카테고리", 백엔드/Operation 메타데이터 맥락이면 "Resource" 사용. `Node.category` Enum 과는 별개 개념 (이름 충돌은 §2 의 `scopeType` 채택으로 이미 회피).

AI Agent `mcpServers[].enabledTools` 가 비어있으면 모든 operation 이 노출. 사용자가 `['product_list', 'product_get']` 로 좁히면 그 둘만 LLM tool 로 노출 (bare id 비교). UI 는 카테고리 단위 grouping (예: "Product (read 전부)" 체크 → 백엔드는 `['product_list', 'product_get']` 로 저장).

## 8. CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-13 | 신규 컨벤션 — Cafe24 API metadata 의 형식·디렉토리·추가 절차 정의. `scopeType` 필드명 채택 (`Node.category` 와의 명명 충돌 회피) |
| 2026-05-16 | 자매 카탈로그 [`cafe24-api-catalog/`](./cafe24-api-catalog/_overview.md) 신설을 반영 — §5 (옛 §4) 추가 절차에 카탈로그 row 갱신·coverage matrix 갱신·양방향 동기 테스트 단계 명시. 도입 결정은 사용자 요청 "Cafe24 docs 전수 등재" (2026-05-16). |
| 2026-05-16 (envelope) | §4 신설 — Cafe24 Admin API 의 POST/PUT 본문 `request` envelope 규약 명문화. 코드 fix (PR #102) 와 결속. 운영에서 `product_update` 가 `400 "Please enter the Request parameter."` 로 실패한 사례 후속. 기존 §4–§7 은 §5–§8 로 번호 +1 이동. consistency-check 세션: `review/consistency/2026/05/16/15_45_35/` (BLOCK: NO). |
| 2026-05-17 | §2 `Cafe24OperationMetadata.restrictedApproval` optional 필드 추가 + §5 절차에 catalog `restricted` 컬럼 동시 갱신 의무 명문화 + §5 step 7 에 양방향 동기 검증 규칙 추가. SoT 는 신규 컨벤션 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md). 사용자 보고 — 카페24 본사 승인 필요 권한이 사용자에게 식별되지 않는 UX 문제 해소. consistency-check 세션: `review/consistency/2026/05/17/12_12_46/` (BLOCK: NO). |
