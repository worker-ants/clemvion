---
id: "CLE-NODE-MAKESHOP-EXEC"
title: "MakeShop 노드 — 실행 로직"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-MAKESHOP"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT", "CLE-NODE-MAKESHOP"]
area: "CLE-NODE-INT"
content_hash: "5c2240d82bddf793998ddf3b9ffe3232f47efe18a1c3d8a9beda3330c66335ed"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "86a5ced3207a1de137daadf64ffce7d4806c0305d10c7f187368fe19b90f9025"
etag: "sha256-dc77d1f4af92bff768c25e742a39bdab783a8528399069a07da4eb938ef9dd9b"
---
## 개요

이 문서는 [MakeShop 노드](CLE-NODE-MAKESHOP.md) 의 하위 문서로 노드 실행 단계, 페이지네이션 변환, dry-run, 시간대 규약을 정한다. 설정 필드와 포트는 부모 문서, 출력 모양과 에러 코드는 [MakeShop 노드 — 출력 구조와 에러](CLE-NODE-MAKESHOP-OUTPUT.md)가 정한다.

## 실행 로직

[통합 노드 공통](CLE-NODE-INT-COMMON.md)의 6단계 계약을 따른다. [Cafe24 노드](CLE-NODE-CAFE24.md) 실행 로직과 같은 모양이며 MakeShop 고유 분기는 다음과 같다.

1. **설정 정규화**: `resource`·`operation` 으로 메타데이터 `{ method, path, requiredFields, optionalFields, paginated }` 를 찾는다. 없으면 `MAKESHOP_UNKNOWN_OPERATION` 으로 에러 포트에 보낸다.
2. **설정 에코**: `integrationId`·`resource`·`operation`·`fields`·`pagination` 을 사용자가 넣은 원래 값으로 에코한다([노드 출력 규약 Principle 7](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-7-설정-에코-원칙)). 표현식과 `pagination.offset` 도 그대로 싣는다. 자격 증명은 싣지 않는다.
3. **통합 자격 증명 해소**: `getForExecution` 으로 통합을 읽고 `service_type='makeshop'` 과 `status='connected'` 를 확인한다. 넘기는 인자는 [통합 노드 공통](CLE-NODE-INT-COMMON.md#integrationsservice-api-실행-엔진용) 이 정한다. 실패하면 공통 `INTEGRATION_*` 코드다. 통합이 없거나 다른 워크스페이스 소속이면 공통 규칙대로 `INTEGRATION_CALL_FAILED` 다.
4. **자격 증명 충족 검증과 `shop_uid` 형식**: `shop_uid`·`access_token`·`refresh_token`·`client_id`·`client_secret` 중 하나라도 없으면 `INTEGRATION_INCOMPLETE` 다. `shop_uid` 가 형식 규약(영숫자·하이픈·언더스코어)을 어기면 `MAKESHOP_INVALID_SHOP_UID` 다. 이 검증이 base URL 경로 조각 주입을 막는 사설망 방어다. MakeShop OAuth 는 confidential client 모델이라 `client_id`·`client_secret` 이 언제나 필요하다. Cafe24 처럼 Public·Private 로 나뉘지 않는다. `shop_uid` 의 정확한 정규식은 코드에 잠정값과 `VERIFY` 표시로 두고 운영 전에 MakeShop 문서로 확정한다.
5. **필수 필드·조건부 필수 제약 검증**: Cafe24 와 같다. 제약 형식은 [MakeShop operation 메타데이터](CLE-MKS-META)가 Cafe24 형식을 그대로 쓴다. 어기면 `MAKESHOP_MISSING_FIELDS` 다. 현재 구현은 이 검사와 8단계의 페이지네이션 검사를 3단계 통합 해소보다 먼저 한다.
6. **토큰 만료 확인과 갱신**: `Integration.token_expires_at`([통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md))이 지났거나 60초 안이면 자동 갱신한다.
   - 갱신 엔드포인트는 `https://auth.makeshop.com/oauth/token`(`grant_type=refresh_token`)이다.
   - 리프레시 토큰은 한 번 쓰면 회전(rotation)하므로 새 리프레시 토큰을 반드시 저장한다. Cafe24 와 같은 특성이다. 액세스 토큰 TTL 은 1시간, 리프레시 토큰 TTL 은 기본 30일·최대 90일이다.
   - 여러 인스턴스 사이 직렬화는 전용 `makeshop-token-refresh` BullMQ 큐(`jobId = integrationId` dedup)가 맡는다. 서비스마다 토큰 엔드포인트와 회전 정책이 달라 Cafe24 의 `cafe24-token-refresh` 큐와 공유하지 않는다.
   - 갱신 실패 분기와 `reactive_401` 직렬화 정책은 Cafe24 와 같은 모양이며 [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md)이 정한다.
   - 배경 주기 갱신 잡은 두지 않는다. Cafe24 는 리프레시 토큰 TTL 이 14일로 짧아 6시간 주기 `cafe24-background-refresh` 잡으로 만기 전에 미리 갱신한다. MakeShop 은 리프레시 토큰 TTL 이 30~90일로 충분히 길어 호출 직전 갱신(`ensureFreshToken`)과 401 재시도로 충분하다. 오래 쓰지 않아 리프레시 토큰까지 만료된 통합은 더 갱신할 수 없고, 통합을 삭제하고 다시 등록해서 복구한다([인증 실패 처리](CLE-NODE-MAKESHOP-OUTPUT.md#인증-실패-처리)).
7. **URL 만들기**: `https://connect.makeshop.co.kr/api/v1/{shop_uid}/{operation.path}`. `{path}` 는 메타데이터 path 템플릿(예: `information`, `product`, `cart/create`)이고 path 파라미터는 `fields` 에서 채운다. 호스트 하나에 `{shopId}` 경로 조각을 쓴다([Rationale](CLE-NODE-MAKESHOP.md#호스트-하나--shop_uid-경로-조각)). 호스트가 고정돼 사용자 입력이 호스트를 정하지 않으므로 `assertSafeOutboundHostResolved` 사설망 차단은 필요 없다. 4단계의 `shop_uid` 형식 검증으로 충분하다.
8. **query·본문 만들기**: 메타데이터 `fields[*].location`(path·query·body)대로 나눈다. operation 이 `paginated: true` 면 `pagination` 을 MakeShop query `limit` · `page` 로 바꿔 싣고 `offset` 은 싣지 않는다([페이지네이션 변환](#페이지네이션-변환)). POST 본문은 평평한 JSON 그대로 보내고 Cafe24 의 `{request:{...}}` 요청 봉투를 쓰지 않는다. MakeShop Shop API 는 GET·POST 만 쓴다([MakeShop operation 메타데이터](CLE-MKS-META)). 봉투 여부는 운영 전에 다시 확인한다(코드 `VERIFY`, [Rationale](CLE-NODE-MAKESHOP.md#post-요청-봉투-미적용)).
9. **호출**: `MakeshopApiClient` 가 `Authorization: Bearer {access_token}` 을 붙여 보낸다.
   - 401 을 받으면 토큰을 갱신하고 같은 요청을 한 번 재시도한다(Cafe24 와 같은 정책). 403 은 즉시 격하한다([인증 실패 처리](CLE-NODE-MAKESHOP-OUTPUT.md#인증-실패-처리)).
   - MakeShop 은 데이터 호출의 호출 제한 헤더·정책을 공개 문서로 밝히지 않았다. 429 를 받으면 `Retry-After` 헤더가 있으면 그 값만큼, 없으면 고정 간격만큼 기다려 최대 2회 재시도하고, 다 쓰면 `MAKESHOP_RATE_LIMITED` 다.
   - 현재 구현은 상위 취소 신호(`context.abortSignal`)를 API 클라이언트에 넘긴다. 그 때문에 생긴 `AbortError` 는 에러 포트로 바꾸지 않고 다시 던져 노드 실행이 `cancelled` 로 분류되게 한다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)).
10. **응답 파싱**: JSON 본문을 `output.response` 에 둔다. `meta.statusCode`, `meta.durationMs` 를 채운다.
11. **활동 로그 기록**: 통합을 얻은 뒤(`getForExecution` 이 성공한 뒤) 끝난 실행마다 성공·실패 1건을 남긴다. 통합을 얻기 전에 끝난 실패는 남기지 않는다([통합 노드 공통](CLE-NODE-INT-COMMON.md#공통-에러-코드)). dry-run 모의 출력은 통합을 얻기 전(1단계 직후)에 끝나 이 단계에 닿지 않는다. 노드 취소 신호(`AbortError`)로 끝난 호출은 남기지 않는다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)). API 식별 정보는 다음과 같다(통합별 전체 표와 요구사항은 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md)).
    - `api_label` = 카탈로그 키 `makeshop.<resource>.<operation>`(예: `makeshop.product.get-product`). 프론트엔드가 `GET /api/integrations/services/makeshop/catalog` 응답의 `labelKey` 와 i18n 사전으로 렌더한다.
    - `api_method` = operation 의 `method`(`GET`·`POST`).
    - `api_path` = operation 의 path 템플릿(placeholder 그대로).
12. **반환**: 2xx 는 성공 케이스, 4xx·5xx 는 에러 케이스([에러 코드](CLE-NODE-MAKESHOP-OUTPUT.md#에러-코드)), 전송 실패는 `MAKESHOP_TRANSPORT_FAILED`. 남은 3xx 는 `MAKESHOP_4XX` 로 분류한다. 별도 `MAKESHOP_3XX` 코드는 두지 않는다(Cafe24 와 같음).

## 페이지네이션 변환

노드 설정의 `pagination` 은 `{ limit?, offset? }` 이다. [MakeShop API 카탈로그](CLE-MKS-CATALOG) 기준으로 MakeShop 목록 API 에는 `offset` 파라미터가 없고 `page` · `limit` 으로 조회한다. 실제 호출로는 아직 확인하지 않았다([미결 사항](CLE-NODE-MAKESHOP.md#미결-사항)). 그래서 operation 이 `paginated: true` 면 핸들러(`resolveMakeshopPagination`)가 `pagination` 을 MakeShop query `limit` · `page` 로 바꾼다. `offset` 은 MakeShop 에 보내지 않는다.

| `pagination` | 보내는 query |
|--------------|--------------|
| 없음 | 아무것도 만들지 않는다. `fields` 에 `limit` · `page` 가 있으면 그 값이 그대로 간다 |
| `offset` 없음 | `limit` 이 있으면 `limit` 만 보낸다. `page` 는 보내지 않으므로 MakeShop 기본 page 가 된다 |
| `offset` 이 0 | `page=1`. `limit` 이 있으면 함께 보낸다 |
| `offset` 이 0 보다 크고 `limit` 의 배수 | `limit` 과 `page = offset / limit + 1`(예: `limit` 50 · `offset` 100 이면 `page=3`) |
| `limit` 없이 `offset` 이 0 보다 큼 | 거절 |
| `offset` 이 `limit` 의 배수가 아님 | 거절(예: `limit` 50 · `offset` 30). 내림하지 않는다 |
| `limit` 이 양의 정수가 아님, 또는 `offset` 이 음수이거나 정수가 아님 | 거절 |
| 객체가 아님 | 거절 |

- 값 읽기: 숫자와 정수 숫자 문자열(예: `"40"`)을 정수로 읽는다. 표현식이 풀린 값은 문자열일 수 있기 때문이다. 소수(`2.5`)와 숫자가 아닌 문자열은 정수가 아니다.
- 거절: 모두 `MAKESHOP_INVALID_PAGINATION` 으로 에러 포트에 보낸다. 판정은 통합을 읽거나 API 를 부르기 전에 한다. 그래서 `output.error.details` 에는 `resource` · `operation` 만 있고 `shopUid` 는 없다. `meta.statusCode` 는 0 이다. 메시지는 원인과 받은 값 뒤에 `(for <resource>.<operationId>)` 를 붙인다. 통합을 얻기 전에 끝난 실패라 활동 로그를 남기지 않는다(11단계).
- `fields` 와의 우선순위: `pagination` 에서 만든 `limit` · `page` 가 같은 이름의 `fields` 값을 덮는다. `pagination` 이 만들지 않은 키는 `fields` 값이 그대로 간다. 예를 들어 `pagination` 이 `{ limit: 20 }` 이고 `fields.page` 가 `"4"` 면 query 는 `{ limit: 20, page: "4" }` 다.
- paginated 가 아닌 operation: 실행할 때 `pagination` 을 읽지 않는다.
- 사전 검증: 실행 직전 노드 설정 사전 검증(`validate()`)은 `pagination` 을 보지 않는다. 숫자로 적은 값이든 표현식이든 규칙 위반은 실행할 때 외부 호출 전에 `MAKESHOP_INVALID_PAGINATION` 으로 에러 포트에 나간다. 그래서 페이지네이션 때문에 `INVALID_NODE_CONFIG` 로 노드가 실패하는 일은 없다.
- 설정 에코: 출력 `config.pagination` 에는 사용자가 넣은 원래 값(`offset` 포함)이 실린다. 실제로 보낸 `page` 는 출력에 없다.
- AI 에이전트 도구: 내부 MCP 브리지는 MakeShop API 처럼 `page` · `limit` 을 인자로 직접 받는다. 이 변환을 거치지 않는다.

`limit` 50 · `offset` 30 을 넣은 예다.

```json
{
  "config": {
    "integrationId": "int_makeshop_myshop",
    "resource": "product",
    "operation": "get-product",
    "fields": {},
    "pagination": { "limit": 50, "offset": 30 }
  },
  "output": {
    "error": {
      "code": "MAKESHOP_INVALID_PAGINATION",
      "message": "pagination.offset must be a multiple of pagination.limit (offset 30, limit 50) — MakeShop pages by page number (page = offset / limit + 1) (for product.get-product)",
      "details": { "resource": "product", "operation": "get-product" }
    }
  },
  "meta": { "statusCode": 0, "durationMs": 2 },
  "port": "error"
}
```

## dry-run

[Cafe24 노드](CLE-NODE-CAFE24.md#dry-run)와 같은 규칙이고 판정 기준은 [재실행 §부수효과 판정](../CLE-EXEC/CLE-EXEC-RERUN.md#부수효과-판정)이다. operation `method` 가 GET 이 아니면 dry-run 에서 외부 상태 변경을 막으려고 모의 출력으로 끝낸다. MakeShop Shop API 는 GET · POST 만 쓰므로 POST 가 대상이다. 읽기 의도인 POST(예: `post-cpik_member-check` 회원 연동 확인)도 메서드로 판정해 모의 출력으로 끝난다. 메서드는 GET 인데 상태를 바꾸는 operation 은 예외 목록(`MAKESHOP_STATE_CHANGING_GET_OPERATION_IDS`)에 올려 모의 출력으로 끝낸다. 지금은 `get-cart_free_config-update`(카트프리 설정 변경) 하나다. 나머지 GET 은 그대로 부른다.

모의 출력은 실행 로직 1단계 직후, 필수 필드 · 페이지네이션 검증과 통합 자격 증명 해소보다 먼저 `success` 포트로 끝난다. `output` 에는 응답 대신 `_dryRun: true` · `skippedReason` · `wouldHaveCalled`(`kind: 'makeshop'` 와 `operation` · `method` · `resource`)가 들고 `meta` 는 `statusCode: 0` · `durationMs` 다. 2xx 응답과 달리 `statusCode` 가 0 이다. 모의 출력으로 끝낸 경우에는 외부 호출이 없었으므로 활동 로그를 남기지 않는다. [통합 노드 공통](CLE-NODE-INT-COMMON.md) 6단계의 «성공·실패와 관계없이 `logUsage` 를 부른다» 는 외부 호출이 나간 경우를 말한다. 공통 문서에 이 예외를 적는 일은 [재실행 미결 사항](../CLE-EXEC/CLE-EXEC-RERUN.md#미결-사항)에 있다.

AI 에이전트가 내부 MCP 브리지로 부르는 MakeShop 도구도 같은 기준으로 판정하고, 모의 응답으로 대신한 호출은 활동 로그를 남기지 않는다. 도구 경로는 필수 필드 검증(`MAKESHOP_MISSING_FIELDS`)을 dry-run 확인보다 먼저 한다는 점만 다르다([MCP 클라이언트 §dry-run 재실행](../CLE-INT/CLE-INT-MCP.md#dry-run-재실행)).

## 시간대

MakeShop API 날짜·시간 필드의 시간대 규약은 **확인되지 않았다**(코드 `VERIFY`). 운영 전에 MakeShop 공식 문서로 확정한다. KST 고정이면 Cafe24 처럼([Cafe24 operation 메타데이터](CLE-C24-META) 시간대 절) AI 에이전트 도구 설명에 시간대 안내를 붙인다.

## 구현 위치

- `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts` (`resolveMakeshopPagination` 페이지네이션 변환, `buildRequestParts` query·본문 만들기)
- `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts` (401 재시도·429 재시도)
- `codebase/backend/src/nodes/integration/makeshop/makeshop-token-refresh.processor.ts` (토큰 갱신 worker)
- `codebase/backend/src/nodes/integration/makeshop/metadata/index.ts` (상태를 바꾸는 GET 예외 목록 `MAKESHOP_STATE_CHANGING_GET_OPERATION_IDS`)
- `codebase/backend/src/nodes/core/dry-run.util.ts` (dry-run 부수효과 판정 `isDryRunMockedOperation`)

## Rationale

### 페이지네이션 방식

[MakeShop API 카탈로그](CLE-MKS-CATALOG)의 정본인 저장소 `codebase/api-catalogs/makeshop/` 에서 paginated operation 42개는 모두 `page` · `limit` 파라미터만 있고 `offset` 파라미터는 0개다. 그런데 이 노드의 원문은 `pagination` 을 `{ limit?, offset? }` 로 표준화하고 `offset` 을 query 에 그대로 실었다. 카탈로그가 맞다면 MakeShop 은 이 `offset` 을 무시하고 `offset` 과 상관없이 같은 page 를 돌려준다.

Task CLE-T-XVS8H7 에서 다음 두 안 가운데 (2) 를 택했다.

- (1) 설정 모양을 `{ page?, limit? }` 로 바꾼다. 필드 이름과 저장 형식이 바뀌므로 이미 저장된 노드 설정을 옮겨야 한다.
- (2) 설정은 `{ limit?, offset? }` 그대로 두고 핸들러가 보낼 때 `page = offset / limit + 1` 로 바꾼다. 필드 이름과 저장 형식은 그대로다.

`limit` 의 배수가 아닌 `offset` 은 거절한다. 내림(floor)으로 가까운 page 를 고르는 안은 기각했다. 조용히 내리면 조회 창이 사용자가 적은 위치보다 앞으로 밀려 앞뒤 page 와 행이 겹치거나 빠진다. `limit` 없이 0 보다 큰 `offset` 은 page 를 셀 수 없어 거절한다.

실행 직전 사전 검증(`validate()`)은 `pagination` 을 보지 않는다. 사전 검증에서 거르면 숫자로 적은 값의 위반만 `INVALID_NODE_CONFIG` 로 노드 실행이 실패하고 표현식 값의 위반은 에러 포트로 간다. 같은 규칙 위반이 두 경로로 갈리지 않도록 실행 단계의 `MAKESHOP_INVALID_PAGINATION` 하나로 모았다.

출력 `config` 에는 사용자가 넣은 `offset` 을 그대로 싣는다. [노드 출력 규약 Principle 7](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-7-설정-에코-원칙)을 따른 것이다.

이 결정은 카탈로그를 근거로 했다. 실측은 아직 하지 못했다(2026-10-10 기준, [미결 사항](CLE-NODE-MAKESHOP.md#미결-사항)). 실측에서 `offset` 이 먹으면 (2) 의 근거가 사라지므로 다시 검토한다. 원래 요구사항은 "페이지네이션 입력을 보여 주고 그 값을 query 로 보낸다" 였고, 2026-10-10 에 변환 · 에코 원래 값 · 경계값 · 거절 · `fields` 우선순위 · 사전 검증 · 설정 화면 동작 규칙을 두었다.

### 활동 로그 범위 (2026-10-10, 2026-10-24)

원래 요구사항은 "호출이 끝나면 성공·실패와 관계없이 활동 로그를 1건 남긴다" 였다. 2026-10-10 에 통합을 해소한 뒤(당시 표현) 끝난 실행으로 범위를 좁히고 노드 취소 신호로 끝난 호출은 남기지 않는다고 더했다. 해소 전 실패의 기록은 당시 알려진 결함(Task CLE-T-PTC4SF)이었고 2026-11-05 에 고쳤다.

2026-10-24 에 «통합을 해소한 뒤» 를 «통합을 얻은 뒤» 로 바꿨다. «해소» 는 3단계 전체(조회와 유형 · 연결 상태 확인)를 가리켜 유형 불일치와 미연결로 끝난 실행이 빠지는 것처럼 읽혔다. 두 실패는 통합을 얻은 뒤의 실패라 기록한다. 규칙과 근거는 [통합 노드 공통](CLE-NODE-INT-COMMON.md#남의-개인-통합-조회는-없는-통합과-같게-실패한다-2026-10-24) Rationale 에 있다.

### dry-run 판정과 활동 로그 (2026-10-23)

2026-10-23 에 dry-run 판정 요구사항을 «GET 이 아니거나 예외 목록에 있으면» 으로 바꾸고 dry-run 모의 출력의 활동 로그 제외 요구사항을 더했다.

- dry-run 판정: 원래 «POST 면 mock, GET 이면 실제 호출» 이었다. `get-cart_free_config-update` 는 GET 인데 카트프리 설정을 바꿔서 메서드만으로는 dry-run 에서 설정이 실제로 바뀐다. 2026-10-23 에 두 카탈로그의 GET operation 을 모두 확인해 이 하나를 상태를 바꾸는 GET 예외 목록에 넣고 판정을 «GET 이 아니거나 예외 목록에 있으면» 으로 바꿨다. 판정 기준과 근거는 [재실행 Rationale](../CLE-EXEC/CLE-EXEC-RERUN.md#dry-run-에서-부수효과-도구만-모의-응답으로-대신한다-2026-10-23)에 있다.
- 활동 로그: 이전에는 «Cafe24 노드와 같은 규칙» 이라 노드 dry-run 모의 출력에도 활동 로그를 1건 남겼다. 2026-10-23 에 사람이 노드 경로와 AI 에이전트 도구 경로 모두 «남기지 않음» 을 골랐다. 활동 로그는 실제로 나간 외부 호출의 기록이라 나가지 않은 모의 출력은 적지 않는다. 옛 목적(모의 실행을 활동 탭에서 추적)은 실행 상세의 노드 출력 `_dryRun` 이 대신한다. «둘 다 1건 남김» 은 dry-run 표시가 없는 `success` 행이 남고 `lastUsedAt` 이 실제 호출 없이 바뀌어 기각했다. 도구 경로는 [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md#부수효과-판정)이 정한다. 나머지 근거는 [Cafe24 노드](CLE-NODE-CAFE24.md)의 Rationale «dry-run 모의 출력에 활동 로그를 남기지 않는다» 와 같다.

### 운영 전 확인할 항목

노드와 MCP 도구는 구현이 끝났다. 아래는 MakeShop 공식 문서로 확정하지 못해 코드에 `VERIFY` 주석을 달아 둔 운영 전 확인 대상이다.

- OAuth 인가·토큰 호스트 `auth.makeshop.com`(인가·토큰·갱신): 1차 출처는 MakeShop 가이드 페이지다. 공식 OAuth 문서로 호스트·엔드포인트·Basic 인증 방식을 다시 확인한다.
- 데이터 호출 호출 제한: MakeShop 은 데이터 API 의 호출 제한 헤더·정책을 공개하지 않았다(문서의 분당 5회는 client_credentials **토큰 발급** 한정). 429 best-effort 대기로 시작하고 운영 관측 뒤 정책을 보강한다. Cafe24 의 leaky bucket 메트릭은 헤더가 없어 출력에 넣지 않는다.
- 시간대 · POST 봉투 · 페이지네이션 방식: 각각 [시간대](#시간대), [Rationale «POST 요청 봉투 미적용»](CLE-NODE-MAKESHOP.md#post-요청-봉투-미적용), [페이지네이션 방식](#페이지네이션-방식)의 미확인 항목이다(페이지네이션 실측은 2026-10-10 기준 미완). POST 봉투는 카탈로그 requestBody 스키마가 모두 평평한 객체라 래퍼를 두지 않았고, 일부 operation 이 래퍼를 요구하면 그 operation 메타데이터에 표시하고 정책을 다시 본다. cursor 방식은 Cafe24 처럼 쓰지 않는다.
