---
id: makeshop-api-metadata
status: implemented
code:
  - codebase/backend/src/nodes/integration/makeshop/metadata/types.ts
  - codebase/backend/src/nodes/integration/makeshop/metadata/index.ts
  - codebase/backend/src/nodes/integration/makeshop/metadata/constraint-validator.ts
  - codebase/backend/src/nodes/integration/makeshop/metadata/public-meta.ts
---

# CONVENTION: MakeShop API Metadata

> 관련 문서: [Spec MakeShop 노드](../4-nodes/4-integration/5-makeshop.md) · [Spec 통합 §5.9 MakeShop](../2-navigation/4-integration.md#59-makeshop) · [Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge-in-process) · [MakeShop API Catalog](./makeshop-api-catalog/_overview.md) · **참조 패턴** [Cafe24 API Metadata](./cafe24-api-metadata.md)

> **구현 상태 (status: implemented)**: 메타데이터 레이어 구현 완료. 본 컨벤션이 정의하는 메타데이터 **형식** 은 `codebase/backend/src/nodes/integration/makeshop/metadata/` (frontmatter `code:`) 에 실제 구현돼 있다. 형식은 [Cafe24 API Metadata](./cafe24-api-metadata.md) 와 동형이며 메이크샵 고유 분기만 명시한다.

본 컨벤션은 MakeShop Shop API 의 endpoint 매핑 메타데이터 **형식** 을 정의한다. endpoint 의 전수 카탈로그와 요청/응답 **필드 스키마**는 [`makeshop-api-catalog/`](./makeshop-api-catalog/_overview.md) (섹션별 카탈로그 표 + `openapi/<section>.openapi.json` 풀 스키마) 에 있다. backend 의 `Makeshop` 노드 핸들러와 `MakeshopMcpToolProvider` (AI Agent Internal Bridge) 양쪽이 **같은 메타데이터 테이블** 을 소비한다.

---

## 1. 디렉토리 구조

```
codebase/backend/src/nodes/integration/makeshop/metadata/
  index.ts             # 7 섹션 종합 export
  shop.ts              # Shop (상점 설정)
  product.ts           # Product (상품)
  order.ts             # Order (주문)
  member.ts            # Member (회원)
  benefit.ts           # Benefit (혜택)
  board.ts             # Board (게시판)
  cpik.ts              # CPIK (외부연동) — REST only. webhook 11개는 trigger 후속
```

섹션 이름은 catalog 디렉토리 및 노드 `resource` enum 과 1:1 일치한다.

## 2. Operation 메타데이터 형식

```ts
interface MakeshopOperationMetadata {
  // 식별
  id: string;                    // MakeShop operationId. 예: 'get-information', 'post-cart-create'.
                                 // 하이픈 포함 — MCP 도구 노출 시 '_' 로 sanitize (§7). resource 안에서 unique.
                                 // 사람 친화 라벨은 frontend i18n dict 가 catalog key (`makeshop.<resource>.<operation>`) 로 lookup.
  description: string;           // MCP tool description
  scopeType: 'read' | 'write';   // OAuth scope read/write 구분. catalog 의 x-scope 그룹 × read/write 로 wire scope 구성 (예: 'store.read')

  // HTTP 매핑
  method: 'GET' | 'POST';        // MakeShop Shop API 는 GET/POST 만 사용 (PUT/DELETE 없음). 'event'(webhook) 는 본 노드 범위 밖
  path: string;                  // '/api/v1/{shopId}/' 생략한 상대 path. 예: 'information', 'product/{product_id}', 'cart/create'

  // 입력 스키마 (풀 스키마 SoT 는 catalog 의 openapi json)
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

  constraints?: MakeshopFieldConstraint[];   // Cafe24 와 동일 (oneOf / allOrNone / implies / impliesValue)
}
```

> **Cafe24 형식과의 차이**:
> - `method` 는 **`GET`/`POST` 2종만** (Cafe24 의 PUT/DELETE 없음). catalog 분석상 161 REST 전부 GET 또는 POST.
> - **`restrictedApproval` 필드 없음** — MakeShop 은 per-scope/operation 별도 승인 티어가 없다 ([MakeShop 노드 §9.5](../4-nodes/4-integration/5-makeshop.md#95-별도-승인restricted-scope-미도입)). 따라서 `makeshop-restricted-scopes.md` 도 존재하지 않는다.
> - `constraints` 형식·의미는 [Cafe24 API Metadata §2](./cafe24-api-metadata.md#2-operation-메타데이터-형식) 와 동일하므로 재정의하지 않는다.

## 3. 필드 스키마 출처 — catalog openapi json

각 operation 의 `fields` (요청 파라미터) 와 응답 구조는 [`makeshop-api-catalog/openapi/<section>.openapi.json`](./makeshop-api-catalog/_overview.md) 의 OpenAPI 3 operation 객체가 **단일 진실(SoT)** 이다 (메이크샵 공식 문서에서 자동 추출, 한글 description 포함). backend 메타데이터의 `fields` 는 이 스키마에서 도출하며, catalog ↔ 메타데이터 동기를 `catalog-sync.spec.ts` 테스트로 보호한다 (cafe24 동일 패턴, §5).

## 4. Wire format

- **인증**: `Authorization: Bearer {access_token}` (OAuth 2.1 access token). base URL `https://connect.makeshop.co.kr/api/v1/{shop_uid}/{path}`.
- **POST body**: **flat JSON** — Cafe24 의 `{request:{...}}` envelope 래핑 미적용 ([MakeShop 노드 §9.4](../4-nodes/4-integration/5-makeshop.md#94-postput-request-envelope-미적용)). ⚠ production 전 검증 (코드 `VERIFY`). (MakeShop Shop API 는 PUT/DELETE 를 HTTP method 로 쓰지 않는다 — 삭제·수정도 `cart/delete`·`cart/update` 처럼 path segment + POST.)
- **scope wire format**: OAuth 2.1 표준 **공백 구분** (`store.read store.write`) — Cafe24 콤마 예외 미적용 ([MakeShop 노드 §9.2](../4-nodes/4-integration/5-makeshop.md#92-oauth-scope-wire-format--공백-구분-표준-cafe24-콤마-quirk-없음)).
- **timezone**: 미확인 — production 전 확정 ([MakeShop 노드 §4.1](../4-nodes/4-integration/5-makeshop.md#41-timezone-semantics)).

## 5. Catalog 동기

cafe24 의 `catalog-sync.spec.ts` 양방향 동기 정책([cafe24-api-catalog `_overview.md §4`](./cafe24-api-catalog/_overview.md#4-동기-정책-sync-contract))을 makeshop 에도 도입했다 — backend 메타데이터 `(resource, id)` ↔ catalog 표 행의 method/path/scope/paginated 일치 검증.

**Phase 0 완료**: catalog 에 `status` (`supported`/`planned`) · `scope` · `paginated` 컬럼을 추가하고, `catalog-sync.spec.ts` 양방향 동기 보호를 도입했다 (`codebase/backend/src/nodes/integration/makeshop/metadata/catalog-sync.spec.ts`). 섹션별 catalog 표([`makeshop-api-catalog/`](./makeshop-api-catalog/_overview.md))와 backend 메타데이터는 테스트로 상시 동기 보호된다.

## 6. 신규 endpoint 등재 절차

[cafe24-api-catalog `_overview.md §6`](./cafe24-api-catalog/_overview.md#6-신규-endpoint-등재-절차) 와 동일 — catalog 표 row 추가/갱신 + backend 메타데이터 row 추가를 같은 PR 에 묶는다.

## 7. MCP Bridge 와의 매핑

`MakeshopMcpToolProvider` 가 메타데이터에서 MCP 도구를 생성한다. operationId 의 하이픈은 MCP §5.2 sanitize 규칙으로 `_` 치환 (`get-product` → 도구명 토큰 `get_product`). bare operationId(하이픈 형태)는 allowlist (`mcpServers[].enabledTools`) 와 Bridge 내부 `execute(name, args)` 에서 유지한다 ([MakeShop 노드 §8.1](../4-nodes/4-integration/5-makeshop.md#81-도구-이름-매핑)). MakeShop operationId 는 `get-cart_free_config-update` 처럼 **하이픈·언더스코어 혼용** — MakeShop 공식 operationId 원형을 그대로 보존하기 때문이며 (cafe24 의 snake_case 통일과 다름), sanitize 후 resource 내 unique 성은 catalog-sync 테스트로 보장한다 (§5).

## 8. 카탈로그 섹션 파일 frontmatter `id` 규약

[`makeshop-api-catalog/<section>.md`](./makeshop-api-catalog/_overview.md) 의 frontmatter `id` 는 **`makeshop-<section>`** 형식이다 (`makeshop-shop`, `makeshop-product`, …). cafe24 카탈로그가 `id: <resource>` (prefix 없음) 를 쓰는 것과 의도적으로 다르다 — makeshop 섹션명(`shop`/`product`/`order` 등)이 cafe24 resource id 와 겹쳐 spec frontmatter `id` 전역 충돌을 일으키므로 service prefix 로 namespacing 한다. (cafe24 는 18 resource 가 먼저 자리잡아 prefix 없이 unique 했던 선례 — 두 번째 이커머스부터 prefix 가 필요해진 케이스.)

## Rationale

본 컨벤션의 형식 결정 배경은 노드 spec [MakeShop §9 Rationale](../4-nodes/4-integration/5-makeshop.md#9-rationale) 에 통합되어 있다 — 핵심: `restrictedApproval` 미도입(§9.5, 별도 승인 티어 없음), GET/POST 2종(§2, MakeShop Shop API 의 method 분포), flat JSON body(§9.4), 공백 구분 scope(§9.2). 본 문서는 cafe24-api-metadata 와 동형 형식이므로 결정 근거를 중복 기재하지 않고 cafe24 선례 + makeshop 분기만 참조한다.
