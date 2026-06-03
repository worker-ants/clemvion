---
id: makeshop
status: implemented
code:
  - codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts
  - codebase/backend/src/nodes/integration/makeshop/makeshop.schema.ts
  - codebase/backend/src/nodes/integration/makeshop/makeshop.component.ts
  - codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts
  - codebase/backend/src/nodes/integration/makeshop/makeshop-token-refresh.processor.ts
  - codebase/backend/src/nodes/integration/makeshop/metadata/index.ts
  - codebase/backend/src/nodes/ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.ts
  - codebase/backend/src/modules/integrations/integration-oauth.service.ts
  - codebase/backend/src/modules/integrations/third-party-oauth.controller.ts
---

# Spec: MakeShop

> 관련 문서: [Integration 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진 §10](../../5-system/4-execution-engine.md#10-integration-handler-계약) · [Spec 통합 §5.9 MakeShop](../../2-navigation/4-integration.md#59-makeshop) · [Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge-in-process) · [CONVENTIONS](../../conventions/node-output.md) · [MakeShop API Metadata 컨벤션](../../conventions/makeshop-api-metadata.md) · [MakeShop API Catalog](../../conventions/makeshop-api-catalog/_overview.md) · **참조 패턴** [Cafe24 노드](./4-cafe24.md)

> **구현 상태 (status: implemented)**: REST 노드 + AI Agent Internal MCP Bridge 구현 완료 (Phase 0~6). 161 REST operation 메타데이터 + `MakeshopApiClient` + 노드(handler/schema/component) + OAuth auth-code+PKCE + ShopStore 설치 HMAC + `MakeshopMcpToolProvider` + frontend + e2e. 설계는 [Cafe24 노드](./4-cafe24.md) 와 동형이며 메이크샵 고유 분기를 본 문서에 명시. **CPIK webhook 11개(이벤트 수신)는 본 노드 범위 밖** — 통합 공통 trigger 노드 후속 (§9.6). §9.7 의 OAuth 호스트·rate limit·timezone·설치 HMAC 메시지 구성은 makeshop 공식 문서 미확정분으로 코드에 `VERIFY` 마킹 + production 전 확인 필요.

## Overview (제품 정의)

한국 이커머스 SaaS [MakeShop](https://developer.makeshop.co.kr/docs/api/shop/상점-설정-정보) 의 신형 Shop API (`connect.makeshop.co.kr/api/v1/{shopId}`, OAuth 2.1) 를 워크플로와 AI Agent 양쪽에서 호출할 수 있게 한다.

- **사용자 가치**: 쇼핑몰 운영자가 상점설정·상품·주문·회원·혜택·게시판 등 Shop API endpoint 를 워크플로 노드 1개로 호출. 동시에 AI Agent 에 같은 Integration 을 도구로 부여하면 LLM 이 자연어로 "어제 결제완료 주문 가져와줘" 같은 작업을 수행한다.
- **지원 범위**: MakeShop Shop API 의 **7 섹션 (Shop / Product / Order / Member / Benefit / Board / CPIK)**, **161 REST operation** ([MakeShop API Catalog](../../conventions/makeshop-api-catalog/_overview.md)). CPIK 의 webhook 11개(이벤트 수신)는 본 노드 범위 밖 — 통합 공통 webhook/trigger 후속 과제 (§9.6).
- **이중 활용**: Cafe24 에 이어 같은 Integration 1개가 워크플로 캔버스 노드와 AI Agent MCP 도구 양쪽에 동시 노출되는 **두 번째 사례**다. backend 의 `MakeshopMcpToolProvider` (AI Agent 핸들러의 `AgentToolProvider` 구현체) 가 [Spec MCP Client §2.3](../../5-system/11-mcp-client.md#23-internal-bridge-in-process) 의 in-process Internal Bridge 패턴으로 본 노드와 같은 메타데이터 테이블에서 MCP 도구 목록을 생성한다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | `service_type='makeshop'` Integration ID ([공통 §1](./0-common.md#1-integration-참조)) |
| resource | Enum | ✓ | — | MakeShop 섹션. 7 값: `shop`, `product`, `order`, `member`, `benefit`, `board`, `cpik` |
| operation | String | ✓ | — | 선택한 `resource` 의 operation 식별자. 메타데이터 테이블 ([makeshop-api-metadata 컨벤션](../../conventions/makeshop-api-metadata.md))에 정의된 enum 중 하나. MakeShop operationId 를 그대로 사용 (예: `get-information`, `get-product`, `post-cart-create`) |
| fields | Record<string, unknown> | — | `{}` | 선택한 operation 의 입력 필드 (path param + query + body). 표현식 `{{ }}` 사용 가능. 각 operation 의 required/optional 필드는 메타데이터 테이블에서 정의 |
| pagination | object? | — | — | `{ limit?: number, offset?: number }`. operation 이 페이지네이션을 지원하는 경우에만. fields 와 분리해 표준화 |

표현식(`{{ }}`)은 `fields[*]` · `pagination.*` 모든 값에서 사용 가능.

> Source of truth: `codebase/backend/src/nodes/integration/makeshop/makeshop.schema.ts`.

## 2. 설정 UI

[Cafe24 §2](./4-cafe24.md#2-설정-ui) 와 동일한 메타데이터 기반 동적 폼 패턴. 차이점만 명시:

- Integration 드롭다운: `IntegrationSelector` 의 `serviceTypes=['makeshop']` 필터.
- Resource 드롭다운: 7 섹션. 메타데이터 라벨 표시 (예: `product` → "Product (상품)", `cpik` → "CPIK (외부연동)").
- Operation 드롭다운: Resource 변경 시 동적 갱신. 메타데이터의 (resource, operation) → 한국어 라벨 매핑 (catalog 의 `라벨 (한)` 컬럼).
- Fields: Operation 선택 시 메타데이터 입력 스키마로 동적 폼 렌더 (Required / Optional 분리, `ExpressionInput` 베이스). 호환 키 보존 규칙은 Cafe24 §2 동일.
- **별도 승인 라벨 없음**: Cafe24 와 달리 MakeShop 은 per-scope/operation 의 별도 파트너 승인 티어가 없다 (심사 시 일괄 검토만). 따라서 ⚠ "별도 승인 필요" 라벨·`restrictedApproval` 메타데이터·`makeshop-restricted-scopes.md` 는 도입하지 않는다 (§9.5).
- Pagination: operation 메타데이터에 `paginated: true` 가 있을 때만 표시.
- Operation 후보: 구현 진행에 따른 supported/planned 표기 정책은 Cafe24 §2 동일. **Phase 0 완료**: [MakeShop catalog](../../conventions/makeshop-api-catalog/_overview.md) 에 `status` 컬럼을 도입하고 backend 메타데이터와 `catalog-sync.spec.ts` 양방향 동기 보호를 적용했다 ([makeshop-api-metadata §5](../../conventions/makeshop-api-metadata.md#5-catalog-동기)).

## 3. 포트

[Cafe24 §3](./4-cafe24.md#3-포트) 동일.

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 입력 데이터 (`$input` 으로 참조) |
| `success` | Success | data | false | MakeShop API 2xx 응답 |
| `error` | Error | error | false | MakeShop API 4xx/5xx, transport 실패, rate-limit 소진, 메타데이터 검증 실패 |

> 3xx 리다이렉트는 `fetch` 가 자동 추종하므로 통상 surface 되지 않는다 (§4 step 12 — 잔여 3xx 는 `MAKESHOP_4XX` fallback).

`status` 는 비-블로킹 노드이므로 항상 생략 (Principle 0).

## 4. 실행 로직

[Integration 공통 §4 Handler 실행 세멘틱](./0-common.md#4-handler-실행-세멘틱) 의 6단계 계약을 따른다. [Cafe24 §4](./4-cafe24.md#4-실행-로직) 와 동형이며, **메이크샵 고유 분기만** 아래 명시:

1. **Config 정규화**: `resource` / `operation` → 메타데이터 조회 `{ method, path, requiredFields, optionalFields, paginated }`. 미존재 시 `MAKESHOP_UNKNOWN_OPERATION` 으로 §5.3 라우팅 (D4).
2. **Config echo** (Principle 7): `integrationId`·`resource`·`operation`·`fields`·`pagination` echo. **자격증명 echo 금지**.
3. **Integration 자격증명 해석**: `service_type='makeshop'` + `status='connected'` 검증. 실패 시 `INTEGRATION_*` 코드 ([공통 §4.2](./0-common.md#42-공통-에러-코드)). integrationId 미존재/타 워크스페이스 소속은 공통 §4.2 의 `NotFoundException` 흡수 동작을 그대로 따른다 (별도 `INTEGRATION_NOT_FOUND` 코드 없음).
4. **credentials 충족 검증 + shop_uid 형식**: `shop_uid`, `access_token`, `refresh_token`, `client_id`, `client_secret` 누락 시 `INTEGRATION_INCOMPLETE` (D4). `shop_uid` 가 형식 규약(영숫자·하이픈·언더스코어, SSRF 방어 — base URL path segment 주입 차단) 위반 시 `MAKESHOP_INVALID_SHOP_UID` (D4). *(MakeShop OAuth 는 confidential client 모델이라 client_id/secret 가 항상 필요 — Cafe24 의 public/private 분기와 달리 단일 형태. shop_uid 정확한 형식 정규식은 코드에 잠정값 + `VERIFY` 마킹, production 전 makeshop 문서로 확정 — §9.7.)*
5. **Required fields + constraints 검증**: Cafe24 §4 step 5 동일. 위반 시 `MAKESHOP_MISSING_FIELDS`.
6. **토큰 만료 확인 및 갱신**: `Integration.token_expires_at` ([데이터 모델 §2.10](../../1-data-model.md#210-integration)) 만료/임박(60초) 시 자동 갱신. **갱신 endpoint = `https://auth.makeshop.com/oauth/token` (`grant_type=refresh_token`)**. refresh token 은 **1회 사용 후 회전(rotation)** 되므로 새 refresh_token 을 반드시 저장한다 (Cafe24 와 동일한 rotation 특성). access token TTL 1시간, refresh token TTL 기본 30일·최대 90일. cross-pod 직렬화는 **전용 `makeshop-token-refresh` BullMQ 큐 (`jobId = integrationId` dedup)** 를 신설한다 — cafe24 의 `cafe24-token-refresh` 큐와 분리 (service 별 token endpoint·rotation 정책이 달라 큐를 공유하지 않음). 갱신 실패 분기·reactive_401 직렬화 정책은 [Cafe24 §4 step 6](./4-cafe24.md#4-실행-로직) 및 [통합 §10.5](../../2-navigation/4-integration.md#105-토큰-자동-갱신) 와 동형. **단 배경(cron) 갱신 잡은 도입하지 않는다** — cafe24 는 refresh_token TTL 이 14일로 짧아 `cafe24-background-refresh` 6h cron 으로 만기 전 선제 갱신하지만, makeshop refresh_token TTL 은 30~90일로 충분히 길어 **proactive(호출 직전 `ensureFreshToken`) + reactive_401 자가회복**으로 커버된다 (장기 미사용 통합은 reauthorize 로 복구). 따라서 [통합 §11.1 스캐너 잡](../../2-navigation/4-integration.md#111-스캐너-잡)의 `cafe24-background-refresh` 동형 잡은 makeshop 에 두지 않는다.
7. **URL 구성**: `https://connect.makeshop.co.kr/api/v1/{shop_uid}/{operation.path}` — `{path}` 는 메타데이터 path template (예: `information`, `product/{product_id}`, `cart/create`). path parameter 는 `fields` 에서 채움. *(Cafe24 의 `{mall_id}.cafe24api.com` 서브도메인 방식과 달리 단일 호스트 + `{shopId}` path segment.)* 호스트가 단일 고정(`connect.makeshop.co.kr`)이라 사용자 입력이 호스트를 결정하지 않으므로 `assertSafeOutboundHostResolved` SSRF 가드는 불필요하다 — SSRF 방어는 step 4 의 `shop_uid` 형식 검증(path segment 주입 차단)으로 충분하다.
8. **Query / Body 구성**: 메타데이터 `fields[*].location` (path / query / body) 에 따라 분배. `pagination.{limit, offset}` 는 query. **POST/PUT body 는 flat JSON 그대로 전송** — Cafe24 의 `{request:{...}}` envelope 래핑은 MakeShop 에 적용하지 않는다 (§9.4. ⚠ production 전 makeshop 문서로 재확인 — 코드 `VERIFY`).
9. **호출 (rate-limit-aware + 401 reactive refresh)**: `MakeshopApiClient` wrapper — `Authorization: Bearer {access_token}` → fetch → **401 응답 시** refresh + 동일 요청 1회 재시도 (Cafe24 §6.1 401 분기 동일 정책). 403 은 즉시 격하. **rate limit**: MakeShop 은 data-call rate limit 헤더·정책을 공개 문서화하지 않았다 (§9.7) — 429 응답 시 `Retry-After` 헤더가 있으면 그 값만큼, 없으면 고정 backoff 로 최대 2회 재시도 후 `MAKESHOP_RATE_LIMITED`.
10. **응답 파싱**: JSON body 를 `output.response` 에 보존. `meta.statusCode`, `meta.durationMs`.
11. **Usage 로깅** ([공통 §4](./0-common.md#4-handler-실행-세멘틱)): 성공·실패 1건. **활동 로그 API 식별 정보** ([`_product-overview.md` INT-US-05](./_product-overview.md#24-사용처-추적-및-라이프사이클)):
    - `api_label` = catalog key `makeshop.<resource>.<operation>` (예: `makeshop.product.get-product`). frontend 가 `GET /api/integrations/services/makeshop/catalog` 응답 `labelKey` + i18n dict 로 렌더.
    - `api_method` = operation 의 `method` (`GET`/`POST`)
    - `api_path` = operation 의 `path` template (placeholder 그대로 — 예: `product/{product_id}`)
12. **반환 분기**: 2xx → §5.1, 4xx/5xx → §5.3 (§6 분류), transport 실패 → `MAKESHOP_TRANSPORT_FAILED`. 3xx 리다이렉트는 `fetch` 가 자동 추종하므로 통상 surface 되지 않으며, 잔여 3xx 응답은 `MAKESHOP_4XX` fallback 으로 분류한다 (별도 `MAKESHOP_3XX` 코드 미도입 — Cafe24 §6 과 동일).

> **Re-run dry-run**: Cafe24 §4 동일 — WRITE(POST/PUT) operation 은 dry-run 시 외부 상태변경 차단 위해 mock 단락, GET 은 그대로 호출.

### 4.1 Timezone semantics

MakeShop API 의 date/time 필드 timezone 규약은 **미확인 (open question)** 이다 (§9.7, 코드 `VERIFY`). production 전 makeshop 공식 문서로 확정하고, KST 고정이면 Cafe24 §4.3·[Cafe24 API Metadata §5](../../conventions/cafe24-api-metadata.md#5-timezone-semantics) 와 동일하게 AI Agent 도구 description suffix 를 도입한다.

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 외 top-level 키 금지. `status` 는 비-블로킹 노드이므로 항상 생략.

[Cafe24 §5](./4-cafe24.md#5-출력-구조) 와 동일한 5필드 envelope (`config`/`output`/`meta`/`port`, `status` 생략).

### 5.1 Case: 2xx 성공 (port `success`)

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
| `config.*` | object | config echo (Principle 7) | 사용자 입력 raw — `{{ }}` 보존 |
| `output.response` | unknown | runtime | MakeShop 응답 body 그대로 보존 (구조는 operation 별, [catalog openapi json](../../conventions/makeshop-api-catalog/_overview.md) 참조) |
| `meta.statusCode` | number | engine inject | HTTP status (2xx) |
| `meta.durationMs` | number | engine inject | 요청~응답 ms |
| `port` | `'success'` | handler return | 2xx 응답 분기 |

> Cafe24 §5.1 의 `meta.callUsage`/`meta.callRemain` (leaky-bucket rate-limit 메트릭) 은 **makeshop 에 없다** — MakeShop 은 data-call rate limit 헤더를 공개 문서화하지 않아 노출할 메트릭이 없다 (§9.7).

### 5.3 Case: API 에러 또는 Transport 실패 (port `error`)

CONVENTIONS Principle 3.2 표준 envelope `output.error.{code, message, details?}`. 4xx/5xx 시 서버 응답 body 는 `output.response` 에 보존. 구조는 [Cafe24 §5.3](./4-cafe24.md#53-case-api-에러-또는-transport-실패-port-error) 동일하되 `code` 는 §6 의 `MAKESHOP_*`, `details` 에 `shopUid`·`resource`·`operation` 포함.

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
      "message": "MakeShop API returned 404 — Not Found",
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
| `output.response` | runtime | 4xx/5xx 시에도 MakeShop 응답 body 보존 |
| `output.error.code` | handler return | §6 vocabulary (`MAKESHOP_*` / `INTEGRATION_*`) |
| `output.error.message` | handler return | `MakeShop API returned <status> — <statusText>` |
| `output.error.details.{statusCode, shopUid, resource, operation}` | handler return | 디버깅 컨텍스트 (`shopUid` = 호출 대상 상점) |
| `meta.statusCode` | handler return | HTTP status (transport 실패 시 `0`) |
| `port` | handler return | `'error'` |

## 6. 에러 코드

런타임 (`port:'error'`) `output.error.code` enum — [`spec/conventions/error-codes.md`](../../conventions/error-codes.md) 의미 기반 명명 준수:

| 코드 | 조건 |
|------|------|
| `MAKESHOP_4XX` / `MAKESHOP_404` / `MAKESHOP_422` | 4xx (404·422 자주 분기, 그 외 fallback) |
| `MAKESHOP_AUTH_FAILED` | 401(refresh+1회 재시도 후에도 401) / 403(즉시). `Integration.status` 를 `error(auth_failed)` 로 atomic 전이. **현재 구현은 403/401 모두 `auth_failed` 로 격하한다** — `insufficient_scope` 세분 전이는 cafe24 한정(INT-AU-07)이며 makeshop 은 미구현 (별도 승인 티어 없음 — §9.5) |
| `MAKESHOP_RATE_LIMITED` | 429 + 재시도 소진 |
| `MAKESHOP_5XX` | 5xx |
| `MAKESHOP_TRANSPORT_FAILED` | fetch reject (DNS/연결/타임아웃). `meta.statusCode=0` |
| `MAKESHOP_UNKNOWN_OPERATION` (D4) | `operation` 메타데이터 미존재 |
| `MAKESHOP_MISSING_FIELDS` (D4) | `requiredFields` 누락 또는 `constraints` 위반 |
| `MAKESHOP_INVALID_SHOP_UID` (D4) | `shop_uid` 형식 위반 |
| `INTEGRATION_*` ([공통 §4.2](./0-common.md#42-공통-에러-코드)) (D4) | Integration resolve / 자격증명 실패 |
| `INTEGRATION_SERVICE_UNAVAILABLE` (D4) | `__workspaceId` 컨텍스트 누락 / `MakeshopApiClient` 미주입 (deployment 오류). Cafe24 와 **동일한 공유 코드** 재사용 — service 별 prefix(`MAKESHOP_`) 를 두지 않는다 (동일 조건을 두 코드로 분기하지 않기 위함) |

### 6.1 인증 실패 자동 status 전환

[Cafe24 §6.1](./4-cafe24.md#61-인증-실패-자동-status-전환) 정책 그대로 재사용 — **401**: refresh + 1회 재시도, 재시도도 401 이면 격하. **403**: 즉시 격하. **현재 구현은 403/401 모두 `error(auth_failed)` 로 격하한다** — cafe24 의 `insufficient_scope` 세분 전이는 makeshop 에 미구현이다. makeshop 은 per-scope 별도 승인 티어가 없어(§9.5) 403 을 scope 부족으로 세분할 근거가 없고, `insufficient_scope` 세분 감지는 cafe24 한정(INT-AU-07)이다. 격하 후 `error→connected` 자동 전이 없음 (사용자 `Reauthorize` 필요).

## 7. 캔버스 요약

[공통 §5](./0-common.md#5-캔버스-요약) — `MakeShop` 행. 요약 포맷: `{resource} · {operation}` (예: `product · get-product`). 연결 Integration 삭제 시 `⚠ Missing integration`.

## 8. AI Agent 노출 (Internal MCP Bridge)

[Cafe24 §8](./4-cafe24.md#8-ai-agent-노출-internal-mcp-bridge) 와 동형. `MakeshopMcpToolProvider` 가 [Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge-in-process) 패턴으로 본 노드와 같은 메타데이터에서 MCP 도구를 생성한다.

### 8.1 도구 이름 매핑

| 노드 측 | MCP 측 |
|---------|--------|
| `resource='product'`, `operation='get-product'` | `mcp_<8자>__get_product` |
| `resource='cpik'`, `operation='post-cart-create'` | `mcp_<8자>__post_cart_create` |

> **MakeShop operationId 의 하이픈·언더스코어 혼용**: MakeShop operationId 는 `get-product`·`get-cart_free_config` 처럼 하이픈과 언더스코어를 혼용한다. MCP §5.2 도구 이름 규칙은 영숫자·underscore 외 문자를 sanitize 하므로 하이픈은 `_` 로 치환된다 (`get-cart-free-config` → `get_cart_free_config`). **sanitize 충돌 방지**: 한 resource 안에서 sanitize 후 토큰이 충돌하면(예: `get-a_b` 와 `get-a-b` 가 모두 `get_a_b` 로) 도구 이름이 겹치므로, `catalog-sync` 테스트가 **resource 내 sanitize-후 operationId 의 unique 성**을 검증한다 (현재 catalog 161 op 은 충돌 없음 — `catalog-sync` 가드로 고정됨). bare operation id(원형)는 allowlist·Bridge 내부 `execute(name, args)` 에서 유지하고, sanitize 는 MCP Client 레이어가 도구 노출 시점에 적용한다.

### 8.2 메타도구 미사용 / 8.3 allowlist / 8.4 Rate Limit 공유 / 8.5 UsageLog / 8.6 expired 자가 회복

[Cafe24 §8.2~§8.6](./4-cafe24.md#82-메타도구-resources--prompts-미사용) 정책 동일. allowlist 는 bare operationId 배열. **별도 승인 ⚠ 라벨은 makeshop 에 없음** (§9.5). UsageLog 는 catalog key `makeshop.<resource>.<operation>` 형식. expired 통합 자가 회복은 refresh_token 보유 시 1회 refresh 동일 정책.

## 9. Rationale

> 공유 결정(단일 노드+메타데이터, Internal MCP Bridge, 메타데이터 위치, 5필드 invariant, fields 동적 폼)은 [Cafe24 §9.1~§9.3, §9.5, §9.9](./4-cafe24.md#9-rationale) 와 **동일 근거**이므로 반복하지 않고 참조한다. 아래는 **메이크샵 고유 분기**만 기록한다.

### 9.1 인증 흐름 — Authorization-Code + refresh (cafe24 동형 선택)

MakeShop 신형 API 는 두 OAuth 흐름을 병행 제공한다 — (a) Authorization-Code(OAuth 2.1 + PKCE, `auth.makeshop.com`, refresh 30~90일) 와 (b) Client-Credentials(`connect.makeshop.co.kr`, `shop_uid`, 토큰 TTL 5분, 발급 5회/분 throttle). **본 통합은 (a) Authorization-Code + refresh 를 채택**한다 — 사용자가 "cafe24 와 동일하게" 요구했고, 기존 third-party-oauth 인프라(authorize 시작·callback·token-refresh 큐·install rate-limit/nonce)를 그대로 재사용하기 때문이다. (b) 는 사용자 redirect·refresh 저장이 불필요한 단순성이 있으나 cafe24 와 다른 흐름이라 신규 인프라가 필요하고 토큰 TTL·throttle 제약이 있어 채택하지 않았다 (향후 재평가 가능).

### 9.2 OAuth scope wire format — 공백 구분 (표준, cafe24 콤마 quirk 없음)

MakeShop 은 OAuth 2.1 표준을 따르므로 scope 를 **공백 구분** (`store.read store.write`) 으로 전송한다. Cafe24 의 콤마 구분 예외([Cafe24 §9.7](./4-cafe24.md#97-oauth-scope-wire-format--콤마-구분-rfc-6749-예외))는 makeshop 에 적용하지 않는다 — begin 단계의 provider 분기에서 makeshop 은 표준 공백 구분 경로를 탄다. scope 는 catalog 의 `x-scope` (주문/상품/회원/상점 설정/게시판/적립금/쿠폰) × read/write 로 구성된다.

### 9.3 단일 호스트 + shop_uid path segment

Cafe24 는 `{mall_id}.cafe24api.com` 서브도메인이지만 MakeShop 은 **단일 호스트 `connect.makeshop.co.kr` + `/api/v1/{shop_uid}/` path segment** 다. 상점 식별자 `shop_uid` 는 Cafe24 의 `mall_id` 와 동일한 역할 — data-model `Integration` 의 **`mall_id` 컬럼**(`credentials.shop_uid` 재사용)으로 투영하고 `(workspace_id, mall_id) WHERE service_type='makeshop'` partial UNIQUE 로 중복 연결을 차단한다 ([data-model §2.10](../../1-data-model.md)). authorize/token 은 별도 호스트 `auth.makeshop.com`.

### 9.4 POST/PUT request envelope 미적용

Cafe24 POST/PUT 은 `{request:{...}}` wire envelope 가 필수([Cafe24 §4.2](./4-cafe24.md#42-request-body-envelope-postput-전용))지만, MakeShop 은 **flat JSON body** 를 받는다 (catalog 의 requestBody 스키마가 모두 flat object). 따라서 `MakeshopApiClient` 에 envelope wrapper 를 두지 않는다. ⚠ **production 전 검증** (코드 `VERIFY`): 일부 operation 이 별도 wrapper 를 요구하면 그 operation 메타데이터에 표기하고 wrapper 정책을 재검토한다.

### 9.5 별도 승인(restricted) scope 미도입

Cafe24 는 일부 scope/operation 이 파트너 별도 승인 대상이라 `restrictedApproval` 메타데이터 + `cafe24-restricted-scopes.md` SoT + UI ⚠ 라벨을 둔다([Cafe24 §9.11](./4-cafe24.md#911-별도-승인-라벨--노드-operation--ai-agent-allowlist-의--표기)). MakeShop 은 **per-scope/operation 의 별도 승인 티어가 없다** — 앱 심사(샵스토어 등록) 시 요청 scope 전체를 일괄 검토할 뿐이다. 따라서 makeshop 은 `restrictedApproval` 메타데이터·`makeshop-restricted-scopes.md`·⚠ 라벨을 도입하지 않는다. (심사 거절·scope 변경 재심사는 앱 등록 운영 영역이며 노드 실행 spec 의 관심사가 아니다.)

### 9.6 CPIK webhook 범위 분리 — cafe24 와 공통 후속

CPIK 섹션의 webhook 11개(`event_code` 기반 상품·주문·배송·카테고리 변경 이벤트)는 호출형 REST 가 아니라 **이벤트 수신(trigger)** 정의다. 본 노드(호출형)·MCP Bridge(도구) 범위 밖이며 워크플로 **trigger 노드**에 매핑된다. **Cafe24 역시 inbound webhook trigger 가 아직 없으므로**, makeshop cpik webhook + cafe24 webhook 을 함께 다루는 **통합 공통 webhook/trigger 노드**를 별 후속 과제로 분리한다 ([plan `makeshop-integration.md` §후속](../../../plan/in-progress/makeshop-integration.md)). MakeShop 측 webhook **구독 등록 API** 는 현재 미문서화(open question) — 후속 착수 전 파트너센터 확인이 선행돼야 한다.

### 9.7 미확인 항목 (production 전 검증 필요)

> 노드·MCP 는 구현 완료(status: implemented)다. 아래는 makeshop 공식 문서 미확정분으로 코드에 `VERIFY` 주석으로 표시되어 production 전 확인 대상이다 — 구현 surface 의 미완이 아니다.

- **OAuth authorize/token 호스트**: `auth.makeshop.com` (authorize·token·refresh) — 본 spec 의 1차 출처는 makeshop 가이드 페이지 추출이며 코드에 `VERIFY` 마킹돼 있다. production 전 공식 OAuth 문서로 호스트·endpoint·Basic auth 방식을 재확인한다 (§4 step 6, §9.1).
- **data-call rate limit**: MakeShop 은 데이터 API 호출의 rate limit 헤더·정책을 공개 문서화하지 않았다 (문서화된 5회/분은 client_credentials **토큰 발급** 한정). §4 step 9 의 429 best-effort backoff 로 시작하고, 운영 관측 후 정책을 보강한다 — Cafe24 의 `meta.callUsage`/`callRemain` 같은 leaky-bucket 메트릭은 헤더 부재로 §5.1 에 노출하지 않는다.
- **timezone**: date/time 필드 timezone 미확인 (§4.1).
- **POST/PUT envelope**: §9.4 — flat 가정, production 전 확인.
- **pagination 방식**: catalog 의 `limit`/`offset` 가정 (§1). cursor 기반은 Cafe24([Cafe24 §9 B-3-7](./4-cafe24.md#9-rationale))와 동일하게 미채택 — production 전 catalog openapi 로 API 지원 여부 확인.

### 9.8 `buildIntegrationMeta` derived 필드 일반화 (C-6 동반 해소)

MakeShop 은 cafe24 에 이은 두 번째 OAuth-refresh 통합이므로, 현재 cafe24 하드코딩인 `IntegrationDto` derived 필드(`autoRefresh`·`appUrl`) 파생을 **service registry 기반 per-service** 로 일반화하는 [cafe24 백로그 C-6](../../../plan/in-progress/cafe24-backlog-residual.md) 을 동반 해소한다. makeshop 은 `autoRefresh=true` (auth-code+refresh) 이며, ShopStore 설치 App URL 을 갖는 경우 `appUrl` 파생도 cafe24 분기에서 registry 함수로 전환된다 ([통합 §9.2 IntegrationDto](../../2-navigation/4-integration.md#92-인증--회전--scope), [data-model §2.10](../../1-data-model.md)). 상세 분해는 [plan `makeshop-integration.md` §C-6 편입](../../../plan/in-progress/makeshop-integration.md#c-6-편입--buildintegrationmeta-레지스트리-전환-cafe24-백로그).
