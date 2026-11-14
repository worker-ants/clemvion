---
id: "CLE-NODE-CAFE24-EXEC"
title: "Cafe24 노드 — 실행 로직"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-CAFE24"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT", "CLE-NODE-CAFE24"]
area: "CLE-NODE-INT"
content_hash: "905f25b5e0ae1bac46168d49009f1488bd5e1da6b28d175ac9e46eaeec9bd003"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "ca02f9279a39a6ae8bb140d88bb844314ec3754e4d8b462d76fe3cbf8bbf3c02"
etag: "sha256-5d1bd0cceade80bab40e1b4a77b8a7f9bd9c9c437cb2edceef119108f93a49fb"
---
## 개요

이 문서는 [Cafe24 노드](CLE-NODE-CAFE24.md) 의 하위 문서로 노드의 실행 흐름, dry-run, 호출 제한, 시간대 규칙을 정한다. 출력 형식과 에러 코드는 [Cafe24 노드 — 설정과 출력](CLE-NODE-CAFE24-CONFIG.md)이 정한다.

## 실행 로직

[통합 노드 공통](CLE-NODE-INT-COMMON.md)의 6단계 계약을 따른다. 노드 고유 흐름은 다음과 같다.

1. **설정 정규화**: `resource`·`operation` 으로 메타데이터를 찾아 `{ method, path, requiredFields, optionalFields, paginated, responseShape }` 를 얻는다. 없으면 `CAFE24_UNKNOWN_OPERATION` 으로 에러 포트에 보낸다(D4).
2. **설정 에코 만들기**: `integrationId`·`resource`·`operation`·`fields`·`pagination` 을 원본 설정에서 하나씩 명시적으로 읽어 에코한다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 7 D1). `fields`·`pagination` 의 `{{ }}` 표현식은 그대로 남는다. 자격 증명은 싣지 않는다.
3. **통합 자격 증명 해소**: `getForExecution` 으로 통합을 읽고 `serviceType='cafe24'`·`status='connected'` 를 확인한다. 넘기는 인자는 [통합 노드 공통](CLE-NODE-INT-COMMON.md#integrationsservice-api-실행-엔진용) 이 정한다. 실패하면 `INTEGRATION_TYPE_MISMATCH`·`INTEGRATION_NOT_CONNECTED` 로 에러 포트에 보낸다(D4). 통합이 없거나 다른 워크스페이스 소속이면 공통 규칙대로 `INTEGRATION_CALL_FAILED` 가 된다.
4. **자격 증명 충족 검증**: `mall_id`·`app_type`·`access_token`·`refresh_token` 이 없으면 `INTEGRATION_INCOMPLETE` 다. `app_type='private'` 인데 `client_id`·`client_secret` 이 없어도 같다(D4).
5. **필수 필드·조건부 필수 제약 검증**: 메타데이터의 `requiredFields`(모두 필수)가 `config.fields` 에 다 있는지, 조건부 필수 제약(`constraints`)을 만족하는지 확인한다. 제약 종류와 의미는 [Cafe24 operation 메타데이터](CLE-C24-META)가 정한다. 어기면 `CAFE24_MISSING_FIELDS` 로 에러 포트에 보내고, `details` 에 어느 필드나 어느 제약 종류가 어긋났는지 적는다(D4).
6. **토큰 만료 확인과 갱신**: `Integration.token_expires_at` 이 지났거나 60초 안에 만료되면 호출 전에 자동 갱신한다. 갱신 실패의 상태 전이(리프레시 토큰 `invalid_grant` 면 `error(auth_failed)`, 전송 3회 연속 실패면 `error(network)`)와 갱신 요청의 여러 인스턴스 사이 직렬화는 [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md)과 [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)에서 정한다. 갱신에 실패해 연결이 끊긴 통합은 `INTEGRATION_NOT_CONNECTED` 로 끝난다.
7. **URL 만들기**: `https://{credentials.mall_id}.cafe24api.com/api/v2/admin/{operation.path}`. `{path}` 는 메타데이터의 path 템플릿(예: `products/{product_no}`)이고 path 파라미터는 `fields` 에서 채운다.
8. **query·본문 만들기**: 메타데이터의 `fields[*].location`(path·query·body)에 따라 나눈다. `pagination.{limit, offset}` 은 언제나 query 다. 본문을 Cafe24 요청 봉투로 감싸는 일은 9단계의 API 클라이언트가 혼자 맡는다.
9. **호출**: `Cafe24ApiClient` 가 다음을 한다.
   - `Authorization: Bearer {access_token}` 헤더를 붙인다.
   - POST·PUT 본문을 Cafe24 요청 봉투(`{ shop_no?, request: { ...payload } }`)로 감싼다. 직렬화 규칙은 [Cafe24 operation 메타데이터](CLE-C24-META) wire format 절이 단일 기준이다. DELETE·GET 에는 감싸지 않는다. 호출자가 이미 `{request: ...}` 로 감싼 본문을 넘기면 즉시 throw 해 이중 감싸기를 막는다(개발 단계 가드).
   - 응답 헤더 `X-Cafe24-Call-Remain` 을 지켜보고 429 를 받으면 기다렸다 재시도한다([호출 제한](#호출-제한)).
   - 401 을 받으면 액세스 토큰을 한 번 갱신하고 같은 요청을 한 번 재시도한다. 6단계의 사전 갱신이 경쟁 구간에서 빗나간 경우를 되살리는 장치다. 403 은 갱신 없이 즉시 격하한다. 절차는 [인증 실패 처리](CLE-NODE-CAFE24-CONFIG.md#인증-실패-처리)가 정한다.
   - 현재 구현은 상위 취소 신호(`context.abortSignal`)를 API 클라이언트에 넘긴다. 그 때문에 생긴 `AbortError` 는 에러 포트로 바꾸지 않고 다시 던져 노드 실행이 `cancelled` 로 분류되게 한다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)).
10. **응답 파싱**: JSON 본문을 그대로 `output.response` 에 둔다. `meta.statusCode`, `meta.durationMs`, `meta.callUsage`(헤더 `X-Cafe24-Call-Usage`), `meta.callRemain`(헤더 `X-Cafe24-Call-Remain`)을 채운다.
11. **활동 로그 기록**: 통합을 얻은 뒤(`getForExecution` 이 성공한 뒤)에는 성공·실패와 관계없이 1건 남긴다. 통합을 얻기 전에 끝난 실패는 남기지 않는다([통합 노드 공통](CLE-NODE-INT-COMMON.md#공통-에러-코드)). operation 조회(1단계)와 필수 필드 검사(5단계)의 실패도 통합을 얻기 전에 끝나므로 남기지 않는다. 현재 구현은 5단계 검사를 3단계보다 먼저 한다. dry-run 모의 출력은 1단계 직후에 끝나 이 단계에 닿지 않는다. `error.code` 는 [에러 코드](CLE-NODE-CAFE24-CONFIG.md#에러-코드) 표의 값이다. API 식별 정보는 다음과 같다(통합별 전체 표는 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) INT-US-05).
    - `api_label` = 카탈로그 키 `cafe24.<resource>.<operation>`(예: `cafe24.product.product_list`). DB 에는 언어 정보가 없는 카탈로그 키만 저장하고 사람이 읽는 라벨은 프론트엔드 i18n 사전이 만든다([Cafe24 operation 메타데이터](CLE-C24-META) 카탈로그 키 절).
    - `api_method` = 메타데이터 행의 `method`(`GET`·`POST`·`PUT`·`DELETE`).
    - `api_path` = 메타데이터 행의 `path` 템플릿. placeholder 를 그대로 둔다(예: `products/{product_no}`). 실제 호출 URL 의 치환값을 넣지 않는다. 엔드포인트 단위로 묶고 path 안 ID 에 담긴 개인정보가 새지 않게 하기 위해서다.
12. **반환**: 2xx 면 `port: 'success'`. 3xx·4xx·5xx 면 에러 케이스(`CAFE24_404`·`CAFE24_422`·`CAFE24_AUTH_FAILED`·`CAFE24_RATE_LIMITED`·`CAFE24_4XX`·`CAFE24_5XX`). 전송 실패면 `CAFE24_TRANSPORT_FAILED`, `meta.statusCode = 0`.

### dry-run

노드 스키마가 `supportsDryRun: true` 인 부수효과 노드다([재실행](../CLE-EXEC/CLE-EXEC-RERUN.md)). 부수효과로 판정된 operation 은 dry-run 에서 `Cafe24ApiClient` 를 부르지 않고 1단계 직후 모의 출력으로 끝낸다(`buildDryRunMock('cafe24', ...)`, `port:'success'`). 모의 출력의 `output` 에는 `_dryRun: true` · `skippedReason` · `wouldHaveCalled`(`kind: 'cafe24'` 와 `operation` · `method` · `resource`)가 들고 `meta` 는 `statusCode: 0` · `durationMs` 다. 판정 기준은 [재실행 §부수효과 판정](../CLE-EXEC/CLE-EXEC-RERUN.md#부수효과-판정)이다. operation `method` 가 GET 이 아닌 호출(쓰기: POST·PUT·DELETE)이 대상이다. Cafe24 에는 상태를 바꾸는 GET 이 없어(2026-10-23 확인) 예외 목록이 비어 있고 GET operation 은 모두 dry-run 에서도 그대로 부른다. 메타데이터를 다시 생성해 쓰기를 뜻하는 낱말이 든 GET 이 생기면 단위 테스트(`dry-run-state-changing-get.spec.ts`)가 예외 목록이나 확인한 조회 목록에 올리게 한다. `scopeType` 은 OAuth 권한 범위라 판정에 쓰지 않는다. 모의 출력으로 끝낸 경우에는 외부 호출이 없었으므로 활동 로그를 남기지 않는다(같은 절).

AI 에이전트가 내부 MCP 브리지로 부르는 Cafe24 도구도 같은 기준으로 판정하고, 모의 응답으로 대신한 호출은 활동 로그를 남기지 않는다. 다만 도구 경로는 필수 필드 검증(`CAFE24_MISSING_FIELDS`)을 dry-run 확인보다 먼저 한다. 노드는 dry-run 확인이 먼저라 필수 필드가 빠진 쓰기 operation 도 모의 출력으로 끝난다. 도구 경로의 결과 형식은 [MCP 클라이언트 §dry-run 재실행](../CLE-INT/CLE-INT-MCP.md#dry-run-재실행)이 정한다.

### 호출 제한

| 헤더 | 뜻 | 동작 |
|------|----|------|
| `X-Api-Call-Limit` | `현재/상한` (예: `1/40`) | 진단 메트릭으로만 보존(`meta.callLimit`) |
| `X-Cafe24-Call-Usage` | 호출 사용률(%) | `meta.callUsage` |
| `X-Cafe24-Call-Remain` | 재개까지 남은 시간(초) | 429 때 대기 시간 |
| `X-Cafe24-Time-Usage` | 처리 시간 사용률(%) | `meta.timeUsage`(있을 때) |
| `X-Cafe24-Time-Remain` | 처리 시간 재개까지 남은 시간(초) | 429 때 대기 시간 보정 |

- 429 를 받으면 `max(X-Cafe24-Call-Remain, X-Cafe24-Time-Remain)` 초만큼 기다린다. 최대 2회 재시도하고, 세 번째 429 면 `CAFE24_RATE_LIMITED` 로 에러 포트에 보낸다.
- 노드와 MCP 도구 호출은 같은 통합 자격 증명을 쓰므로 같은 leaky bucket 을 공유한다. API 클라이언트의 대기는 같은 프로세스 인스턴스 안에서 통합 ID 별 메모리 mutex 로 보호되어 한 호출이 기다리는 동안 같은 통합의 다른 호출도 기다린다(과부하 방지).
- 여러 인스턴스 사이 직렬화는 보장하지 않는다. 429 응답이 자체 backoff 신호가 되고, 필요하면 Redis 기반 조율을 별도 스펙으로 도입한다([호출 제한 범위](#호출-제한-범위)).
- 격리 단위는 통합이다. `mall_id` 가 다른 통합끼리는 대기를 공유하지 않는다.

### 시간대

Cafe24 Admin API 의 날짜·시간 필드는 모두 KST(Asia/Seoul, UTC+9) 기준이다. 규칙의 단일 기준은 [Cafe24 operation 메타데이터](CLE-C24-META) 시간대 절이다.

- 워크플로우 캔버스 노드는 사용자 표현식 `{{ $now }}`(UTC ISO 8601)를 그대로 보내도 뜻이 같다. Cafe24 가 시간대 표기를 존중하기 때문이다.
- AI 에이전트에 내부 MCP 브리지로 노출할 때는 모든 도구 설명 끝에 KST 안내가 자동으로 붙는다([AI 에이전트 노출](CLE-NODE-CAFE24-AGENT.md#ai-에이전트-노출)).
- 토큰 만료 시각(`expires_at`)은 이 규칙 밖이다. JWT `exp`(UTC 절대 시각)가 기준이며 [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md)에서 정한다.

## Rationale

### Cafe24 요청 봉투를 API 클라이언트 한 곳에서 감싸는 이유

POST·PUT 본문의 `request` 봉투는 `Cafe24ApiClient.executeWithRateLimit` 의 wire 직렬화 단계(`JSON.stringify` 직전)에서 적용한다. 노드 핸들러나 `Cafe24McpToolProvider` 의 본문 구성 단계에서 감싸지 않는 이유는 다음과 같다.

- 봉투는 Cafe24 wire format 고유 규약이지 노드나 MCP 의 관심사가 아니다. API 클라이언트가 이미 URL 접두(`{mall_id}.cafe24api.com`), leaky bucket 헤더, 토큰 갱신 같은 Cafe24 전용 책임을 맡고 있어 단일 책임 원칙에 맞는다.
- 노드 핸들러(`buildRequestParts`)와 `Cafe24McpToolProvider.execute` 가 같은 분리 로직을 따로 갖고 있었다. 한 지점에서 고쳐야 어긋남을 막는다.
- 외부 시그니처 `Cafe24CallOptions.body: Record<string, unknown>` 은 바뀌지 않는다. 호출자는 평평한 객체를 넘기면 된다.
- 두 호출 경로가 모두 평평한 본문을 직렬화하면 `request` 봉투가 빠져 `400 "Please enter the Request parameter."` 에 빠진다. API 클라이언트 단일 책임이 이를 구조적으로 막는다.

POST·PUT 밖의 method 는 허용 목록으로 강제한다. PATCH 같은 method 가 나중에 생기면 API 클라이언트 안에서 명시적으로 정하게 된다(DELETE 본문이 조용히 감싸지지 않도록). 이중 감싸기 throw 가드는 현재 모든 호출자(노드 핸들러, 내부 MCP 브리지)가 평평한 본문만 쓴다는 전제에 기댄다. 봉투를 미리 적용해야 하는 새 호출자가 생기면 그때 가드 정책을 다시 본다.

### 호출 제한 범위

`Cafe24ApiClient` 의 메모리 mutex 는 같은 프로세스 인스턴스 안에서 API 호출의 leaky bucket 직렬화만 맡는다.

- Cafe24 leaky bucket 은 통합 단위(`mall_id` 기준) quota 라서 인스턴스 사이 동시 호출에서도 429 가 스스로 backoff 신호가 된다. 그래서 API 호출 자체를 인스턴스 사이에서 직렬화할 필요는 없다.
- 토큰 갱신의 인스턴스 사이 직렬화는 따로 푼다. `proactive`·`background` 경로는 `cafe24-token-refresh` BullMQ 큐의 `jobId = integrationId` dedup 으로, `reactive_401` 경로는 dedup 을 우회하는 고유 jobId 와 `refreshAccessToken` 의 PostgreSQL 행 잠금(`pessimistic_write`)으로 모은다. 리프레시 토큰 회전 경쟁을 두 단계로 막는 구조다. 갱신 진입점 다섯(내부 MCP 브리지의 `expired` 자가 회복 포함)과 큐 설정은 [OAuth 연결과 토큰 갱신 §갱신 큐](../CLE-INT/CLE-INT-OAUTH.md#갱신-큐)가 단일 기준이고, 자가 회복이 실제로 통합을 되살리는지는 [미결 사항](CLE-NODE-CAFE24.md#미결-사항)이다. 결정 배경은 같은 문서 Rationale 의 [BullMQ `jobId` 중복 제거](../CLE-INT/CLE-INT-OAUTH.md#여러-인스턴스의-갱신-경쟁은-bullmq-jobid-중복-제거로-푼다)와 [`reactive_401` 고유 jobId](../CLE-INT/CLE-INT-OAUTH.md#reactive_401-은-고유-jobid-로-중복-제거를-완전히-건너뛴다)에 있다.
- 두 인스턴스가 동시에 401 을 받아 `reactive_401` worker 가 둘 다 돌면 행 잠금이 같은 행의 동시 UPDATE 를 직렬화한다. 한 인스턴스만 새 토큰을 저장하고 다른 쪽은 `invalid_grant` 로 격하된다(fail-safe). `reactive_401` 은 실제 401 을 받았을 때만 발생하므로 leaky bucket 부담이 눈에 띄게 늘지 않는다.

### dry-run 모의 출력에 활동 로그를 남기지 않는다 (2026-10-23)

이전에는 노드 dry-run 이 모의 출력에도 활동 로그를 1건 남겼고 AI 에이전트의 내부 MCP 브리지 도구 경로는 남기지 않아 두 경로의 규칙이 달랐다. [MCP 클라이언트 Rationale](../CLE-INT/CLE-INT-MCP.md#dry-run-재실행에서-건너뛴-호출의-기록-2026-10-10)은 노드의 1건을 모의 실행을 활동 탭에서 추적하려는 것이라 적었지만 요구사항 문서에는 근거가 없었다. HTTP Request · Send Email · Database Query 노드의 모의 출력은 처음부터 활동 로그를 남기지 않았고 Cafe24 · MakeShop 노드만 달랐다.

2026-10-23 에 사람이 «둘 다 남기지 않음» 을 골랐다. 활동 로그는 실제로 나간 외부 호출의 기록이고 활동 탭과 `lastUsedAt` 이 여기서 나온다. 모의 실행은 노드 출력(`output._dryRun`)에서 확인한다. 같은 날 dry-run 판정도 노드와 도구가 같은 함수를 쓰도록 맞췄고 MakeShop 노드도 같은 규칙을 두었다. 근거 전체는 [재실행 Rationale](../CLE-EXEC/CLE-EXEC-RERUN.md#dry-run-에서-부수효과-도구만-모의-응답으로-대신한다-2026-10-23)에 있다.

- 기각한 안: «둘 다 1건 남김» 은 dry-run 표시가 없는 `success` 행이 남고 `lastUsedAt` 이 실제 호출 없이 바뀌어 기각했다. 노드만 남기는 차이를 그대로 두는 안은 같은 dry-run 에서 두 경로의 규칙이 갈려 택하지 않았다.
- 상태를 바꾸는 GET 예외 목록: MakeShop `get-cart_free_config-update` 는 GET 인데 카트프리 설정을 바꾼다. 메서드만으로는 부족한 곳이 있어 판정에 예외 목록을 더했다. Cafe24 목록은 비어 있고, 목록이 낡지 않도록 단위 테스트가 쓰기 낱말이 든 GET 을 예외 목록이나 확인한 조회 목록에 올리게 한다.
- 요구사항 변경 내역은 [Cafe24 노드 Rationale](CLE-NODE-CAFE24.md#요구사항-변경-2026-10-23--2026-10-24)에 있다.

### 통합을 얻기 전에 끝난 실패는 활동 로그에 남기지 않는다 (2026-10-24)

규칙과 근거는 [통합 노드 공통](CLE-NODE-INT-COMMON.md#남의-개인-통합-조회는-없는-통합과-같게-실패한다-2026-10-24) Rationale 에 있다. 요구사항 변경 내역은 [Cafe24 노드 Rationale](CLE-NODE-CAFE24.md#요구사항-변경-2026-10-23--2026-10-24)에 있다.
