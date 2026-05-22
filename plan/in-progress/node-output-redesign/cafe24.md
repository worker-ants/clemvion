# Cafe24 output 개선안

> 대상 spec: `spec/4-nodes/4-integration/4-cafe24.md` (§5 출력 구조)

> **최신화 검토 (2026-05-16)**: Cafe24 노드는 본 redesign 폴더의 1차 초안(2026-04) 이후에 신설된 노드이므로 본 plan 은 최초 작성이다. 현 spec 은 이미 `spec/conventions/node-output.md` 11 원칙을 따른 형태로 출발했다.

## 현재 output (spec 인용)

§5.1 2xx 성공 (port `success`):

```json
{
  "config": {
    "integrationId": "int_cafe24_myshop",
    "resource": "product",
    "operation": "product_list",
    "fields": { "shop_no": 1, "display": "T", "since": "{{ $now.iso }}" },
    "pagination": { "limit": 50, "offset": 0 }
  },
  "output": {
    "response": {
      "products": [{ "product_no": 1001, "product_name": "샘플 상품", "price": "10000.00" }],
      "links": [{ "rel": "next", "href": "/api/v2/admin/products?offset=50&limit=50" }]
    }
  },
  "meta": {
    "statusCode": 200, "durationMs": 320,
    "callUsage": 12, "callRemain": 0, "callLimit": "5/40"
  },
  "port": "success"
}
```

§5.3.1 Cafe24 API 4xx / 5xx (port `error`): `output.response` (서버 body 보존) + `output.error.{code, message, details}` + `meta.statusCode`.

§5.3.2 Rate Limit 재시도 소진: `output.error.code = 'CAFE24_RATE_LIMITED'` + `meta.statusCode: 429` + `meta.callRemain`.

§5.3.3 Transport 실패: `output.error.code = 'CAFE24_TRANSPORT_FAILED'` + `meta.statusCode: 0`.

§5.8 Pre-flight throw — config / Integration / credential 검증 실패 시 throw, `output.error` 가 아니라 노드 실행 실패 (Principle 3.1).

## 진단

Cafe24 는 외부 API 호출 노드 (단계 1개). HTTP Request 와 같은 `success` / `error` 2-포트 구조이지만, **추가 메트릭**(rate-limit 헤더) 와 **자동 상태 전이**(401/403 시 `Integration.status = error(auth_failed)`) 가 노드 고유 특성이다.

| 영역 | 적절성 | 근거 |
| --- | --- | --- |
| `output.response` | 적절 (output) | Cafe24 API 응답 body — Principle 8.2 의 HTTP 관용 네이밍 재사용 (spec §5 head footnote 명시) |
| `output.response` + `output.error` 병존 (4xx/5xx) | 적절 | HTTP Request 와 동일 패턴 — 서버 body 디버깅 보존, `output.error` 존재 여부로 정상/에러 분기 |
| `output.error.{code, message, details}` | 적절 | Principle 3.2 표준 envelope. `details` 에 `statusCode` / `mallId` / `resource` / `operation` / `cafe24ErrorCode` / `cafe24Message` |
| `meta.statusCode` | 적절 (meta) | HTTP 응답 status. Transport 실패 시 `0` (HTTP Request 와 동일 magic number) |
| `meta.durationMs` | 적절 | engine 공통 |
| `meta.callUsage` / `meta.callRemain` / `meta.callLimit` / `meta.timeUsage?` | 적절 (meta) | Cafe24 leaky bucket 헤더 (`X-Cafe24-Call-Usage/Remain`, `X-Api-Call-Limit`, `X-Cafe24-Time-Usage`). Principle 2 (실행 메트릭) |
| `config.{integrationId, resource, operation, fields, pagination}` (raw echo, `{{ }}` 보존) | 적절 | Principle 7. `fields = {}` 도 명시 echo (§5.3.2 footnote) |
| `port: 'success'` / `'error'` | 적절 | Principle 5 |

핵심 점검:

1. **`output.requestBody` 부재 vs HTTP Request 대비 일관성** — HTTP Request 는 `output.requestBody` (evaluated wire body, 256KB cap) 를 surface 하나, Cafe24 는 fields → query/body 분배를 메타데이터로 결정하므로 동등 필드가 없다. 디버깅 측면에서 다음 두 선택지 검토 가치:
   - (a) `output.requestQuery` / `output.requestBody` 를 surface (evaluated, paths/queryParams/jsonBody 분리)
   - (b) 현 상태 유지 — `config.fields` (raw) 와 `meta.statusCode` 로 충분. 디버깅은 IntegrationUsageLog 의 request snapshot 으로 회수.
   spec 은 (b) 채택. AI Agent MCP 도구로도 같은 메타데이터를 쓰므로 일관성 우선.

2. **`meta.statusCode = 0` magic number (transport 실패)** — HTTP Request 와 동일 패턴. `output.error.code === 'CAFE24_TRANSPORT_FAILED'` 분기 키가 더 명확. spec 권장과 정합.

3. **`Integration.status` 자동 전이 (401/403)** — §6.1 명시. handler 실행 부작용으로 외부 상태(`Integration.status='error'`) 가 atomic UPDATE. 노드 output 컨트랙트 자체는 `port:'error'` + `output.error.code = 'CAFE24_AUTH_FAILED'` 단일 — 외부 부작용은 spec 본문(`§6.1`) 에 명시되며 output 5필드 invariant 와 직교.

4. **Pre-flight throw 코드 (`CAFE24_UNKNOWN_OPERATION` / `CAFE24_MISSING_FIELDS` / `CAFE24_INVALID_MALL_ID`)** — output 에 노출되지 않고 노드 실행 실패로 분기. Principle 3.1 정합. `IntegrationUsageLog.error.code` 에만 기록 (§6 마지막 줄). **(2026-05-22 추가)** `CAFE24_MISSING_FIELDS` 는 `requiredFields` 누락 외에도 `constraints?` (kind: `oneOf` / `allOrNone` / `implies`, [Cafe24 API Metadata §2](../../../spec/conventions/cafe24-api-metadata.md#2-operation-메타데이터-형식)) 위반 시에도 동일 코드 재사용. client/UI 분기 추가 없이 message·details 에 어떤 constraint kind 가 어떤 fields 에서 위반됐는지 명시.

5. **MCP Bridge 와 메타데이터 공유** — `Cafe24McpBridge` 가 같은 operation 메타데이터 테이블을 사용해 `tools/list` 응답을 생성. 본 노드의 `config.operation` ↔ MCP 도구의 `tool name` 가 1:1 매핑. spec 본문 §10·§11 명시. output 컨트랙트 자체에는 영향 없음 (LLM 이 MCP 호출하면 별도 AI Agent 노드 컨텍스트에서 처리).

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
// 2xx 성공
{
  "config": { "integrationId": ..., "resource": ..., "operation": ..., "fields": {...}, "pagination"?: {...} },
  "output": { "response": <Cafe24 응답 body> },
  "meta": {
    "statusCode": <2xx>,
    "durationMs": <number>,
    "callUsage"?: <percent>,
    "callRemain"?: <seconds>,
    "callLimit"?: "<현재>/<상한>",
    "timeUsage"?: <percent>
  },
  "port": "success"
}

// 4xx/5xx Cafe24 API 에러
{
  "config": {...},
  "output": {
    "response": <서버 body 보존>,
    "error": {
      "code": "CAFE24_404" | "CAFE24_422" | "CAFE24_AUTH_FAILED" | "CAFE24_4XX" | "CAFE24_5XX",
      "message": "Cafe24 API returned <status> — <statusText>",
      "details": {
        "statusCode": <number>,
        "mallId": <string>,
        "resource": <string>,
        "operation": <string>,
        "cafe24ErrorCode"?: <string>,
        "cafe24Message"?: <string>
      }
    }
  },
  "meta": { "statusCode": <응답>, "durationMs": <number>, "callUsage"?: ... },
  "port": "error"
}

// Rate-limit 소진
{
  "config": {...},
  "output": {
    "error": {
      "code": "CAFE24_RATE_LIMITED",
      "message": "Cafe24 leaky bucket exhausted after 2 retries",
      "details": { "retries": 2, "lastRetryAfterSec": <number>, "mallId": <string> }
    }
  },
  "meta": { "statusCode": 429, "durationMs": <number>, "callUsage": 100, "callRemain": <number> },
  "port": "error"
}

// Transport 실패
{
  "config": {...},
  "output": {
    "error": {
      "code": "CAFE24_TRANSPORT_FAILED",
      "message": <fetch reject 메시지 — ECONNRESET, ETIMEDOUT, abort 등>,
      "details": { "mallId": <string>, "resource": <string>, "operation": <string> }
    }
  },
  "meta": { "statusCode": 0, "durationMs": <number> },
  "port": "error"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- Cafe24 는 HTTP Request 의 친척 노드이지만 (1) operation 메타데이터 테이블 기반 동적 폼, (2) rate-limit 헤더 메트릭, (3) 401/403 → `Integration.status='error'` 자동 전이가 추가된다. output 컨트랙트 자체는 HTTP Request 와 같은 `success`/`error` 2-포트 구조를 그대로 따라 사용자 학습 비용 최소화.
- `output.requestBody` 미surface 는 의도 — fields → path/query/body 분배가 메타데이터 결정이라 raw `config.fields` 만으로 추적 가능. 향후 디버깅 요구가 늘면 (a) 안 검토 가능하나 현재는 MCP Bridge 와의 단순성 우선.
- `Integration.status` 자동 전이는 노드 output 5필드와 직교한 외부 부작용 — spec 본문 §6.1 으로 명시하고 `IntegrationUsageLog` 에 atomic 기록 (멱등성 보장).
- 옛 초안에서 검토 후 폐기된 대안:
  - `output.cafe24` 래퍼 (모든 Cafe24 특이 필드를 모음) — 폐기. HTTP Request 의 평탄한 구조와 비대칭 발생. `output.response` 단일 + `meta.*` 메트릭으로 충분.
  - `output.error.details.requestId` (Cafe24 미제공) — 폐기. Cafe24 응답이 trace id 를 제공하지 않으므로 details 에 둘 데이터 없음.

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/integration/cafe24/{cafe24.handler.ts, cafe24.schema.ts, cafe24-api.client.ts, cafe24.handler.spec.ts, cafe24-token-refresh.processor.ts, metadata/*}`.

1. **spec §5 ↔ handler return 정합성**:
   - 정상 (`cafe24.handler.ts:269-275`): `{ config: echo, output: { response: result.body }, meta: buildMeta(result, durationMs), port: 'success' }`. `buildMeta` (`:347-361`) 가 `statusCode/durationMs/callUsage?/callRemain?/callLimit?/timeUsage?/timeRemain?` 동봉 — spec §5.1 표 정확 일치.
   - HTTP 응답 4xx/5xx (`:231-262`): `{ output: { response: result.body, error: { code, message, details: { statusCode, mallId, resource, operation, cafe24ErrorCode?, cafe24Message? } } }, meta, port: 'error' }`. `codeForStatus` (`:363-368`): 404 → `CAFE24_404`, 422 → `CAFE24_422`, 5xx → `CAFE24_5XX`, 그 외 → `CAFE24_4XX`. spec §5.3.1 + §6 표 정확 일치.
   - Client 에러 catch (`:194-224`): `mapClientErrorToOutput` (`:397-462`) 가 `Cafe24AuthFailedError` / `Cafe24RateLimitedError` / `Cafe24TransportFailedError` / `Cafe24IncompleteCredentialsError` 각각을 envelope 으로 변환. `IncompleteCredentialsError` 는 `IntegrationError('INTEGRATION_INCOMPLETE')` 로 re-throw (Pre-flight). `IntegrationError` 도 re-throw (Pre-flight 분류 보존). 그 외 unknown 은 `CAFE24_TRANSPORT_FAILED` fallback. spec §5.3.2 / §5.3.3 + §5.8 정확 일치.
   - `responseBody` 동봉은 `Cafe24AuthFailedError` 만 (`:421`) — Rate-limit / Transport 는 응답 body 부재 자연스러움.

2. **schema ↔ spec config 정합성**: `cafe24NodeConfigSchema` (`cafe24.schema.ts:29-63`) 의 `integrationId`/`resource` (enum from `CAFE24_RESOURCES`)/`operation`/`fields` (Record)/`pagination` (limit/offset 만 — cursor 폐기, B-3-7) — spec §1 표와 정합. `cafe24PaginationSchema` (`:21-27`) 의 cursor 제거가 spec §1 의 옛 `cursor?: string` 과 미세 불일치 — spec 본문은 cursor 를 여전히 언급(`:23`) 하지만 schema 에서 제거됨.

3. **validate 일관성** (`cafe24.handler.ts:66-108`):
   - `integrationId`/`resource`/`operation` string 가드 + `resource` enum 가드.
   - **`findCafe24Operation` 으로 (resource, operation) 조합을 사전 검증** (`:89-97`) — 캔버스에서 잘못된 operation 선택 시 즉시 경고 (B-3-3). spec §5.8 의 `CAFE24_UNKNOWN_OPERATION` 을 execute 시점이 아닌 validate 시점에도 잡음.
   - `fields` 타입 가드 — object/non-null/non-array.

4. **에러 컨트랙트 (Principle 3)** — **핵심**:
   - **Pre-flight throw**: `CAFE24_UNKNOWN_OPERATION` (`:141-146`), `CAFE24_MISSING_FIELDS` (`:153-158`), `CAFE24_INVALID_MALL_ID` (`:172-177`), `CAFE24_UNRESOLVED_PATH_PARAM` (`buildRequestParts :333-336`), 그리고 `apiClient` 미주입 (`:125-128`) + Integration 단계 errors (resolveIntegration → INTEGRATION_NOT_FOUND/TYPE_MISMATCH/NOT_CONNECTED). 모두 spec §5.8 일치.
   - **Runtime `port:'error'`**: Cafe24Auth/RateLimit/Transport 4종 + 4xx/5xx 일반. 모두 envelope.
   - **401/403 → `Integration.status='error(auth_failed|insufficient_scope)'` 자동 전이** — `Cafe24ApiClient.markAuthFailed` (`:799-830`) 에서 atomic UPDATE + `actionRequiredNotifier` 발사. spec §6.1 정확 일치. `detectInsufficientScope` (`:844-876`) 가 응답 body 시그널로 reason 분기.
   - **3회 연속 transport 실패 → `error(network)`** (`recordNetworkFailure :884-924`, `resetNetworkFailures :926-938`): spec §6 의 status 전이 표 부합. recordNetworkFailure 가 refresh 의 transport 실패에도 적용 (`:694`) — REQ-C2.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1: `config.fields` raw (`{{ }}` 보존), `output.response` evaluated — 직교.
   - Principle 2: `meta` 가 statusCode/durationMs + rate-limit 메트릭. `meta.statusCode=0` magic number 가 HTTP Request 와 동일 패턴.
   - Principle 7: `echo = sanitizeConfigEcho({integrationId, resource, operation, fields ?? {}, pagination})` (`:117-123`). **`sanitizeConfigEcho` 사용** — DB/Email/HTTP 중 유일한 명시적 자격증명 sanitize (defense-in-depth). 자격증명 키 (password/apiKey/token/secret/accessToken 등) 가 `fields` 안에 들어가더라도 `***` 마스킹. spec footnote (`5.3.2 :265` "config.fields = {} 도 명시적으로 echo") 부합.
   - Principle 8.2: `output.response` — HTTP 관용 네이밍 재사용 (spec §9.5 명시).

6. **handler 테스트 (`cafe24.handler.spec.ts`, 503 줄)**:
   - validate (`:73-115`): missing integrationId/resource/operation, unknown resource enum, well-formed accept, fields 타입.
   - Pre-flight (`:117-214`): UNKNOWN_OPERATION / MISSING_FIELDS / TYPE_MISMATCH / NOT_CONNECTED / INVALID_MALL_ID.
   - Runtime (`:216-501`): happy path (path/query/method assertion, config echo 검증), path placeholder (`:272-298`), PUT body/path 분리 (`:300-335`), 4xx 404 (`:337-375` — `output.response` 보존 + `cafe24ErrorCode/cafe24Message` 추출), AUTH_FAILED (`:377-402`), RATE_LIMITED + `details.retries/lastRetryAfterSec` (`:404-431`), TRANSPORT_FAILED + `meta.statusCode=0` (`:433-454`), IntegrationError re-raise (`:456-473`), logUsage 실패 시 result port 보존 (`:476-501` — B-5-6).
   - **누락**: `meta.callLimit/callRemain/callUsage` 의 4xx/5xx 케이스에서의 동봉 (현재 happy path 만 검증). Rate-limit 헤더가 4xx 응답에도 동봉되는지 회귀 보호 부재.
   - **누락**: `sanitizeConfigEcho` 의 실효성 (`fields` 안에 `apiKey` 키 있을 때 `***` 마스킹) 직접 검증 부재 — defense-in-depth 코드의 회귀 보호 없음.

7. **횡단 일관성 (Integration 4종)**:
   - `mapClientErrorToOutput` 의 `IntegrationError` re-throw 분기 (`:446-450`) — DB / Email 패턴과 일치 (pre-flight 분류 보존).
   - `output.response` (HTTP / Cafe24) vs `output.rows` (DB) vs `output.messageId` (Email) — Principle 8.2 표 정합.
   - `meta.statusCode=0` (HTTP / Cafe24 transport) — magic number 공유. DB / Email 은 `meta.statusCode` 자체 미보유.
   - **`sanitizeConfigEcho` 적용은 Cafe24 만 — HTTP/DB/Email 은 미적용**. HTTP 는 `sanitizeUrlCredentials` 로 URL만 sanitize (보안 surface 다름), DB/Email 은 `integrationId` 등 특정 필드만 echo 하므로 schema 차원 보호. Cafe24 의 `fields: Record<string, unknown>` 은 사용자 자유 입력에 가까워 (메타데이터로 제한되지만 schema 차원에선 임의) 추가 마스킹 합리적.

8. **구현 품질**:
   - Token refresh: `Cafe24ApiClient.refreshAccessToken` (`:661-775`) 가 atomic 4-field UPDATE + pessimistic_write row lock (defense-in-depth). BullMQ `cafe24-token-refresh` 큐 (`refreshViaQueue :572-659`) 로 cross-pod 직렬화 — spec §9.6 정확 일치.
   - Rate limit: leaky bucket `executeWithRateLimit` (`:940-1073`) max 2 retries + jitter. 429 헤더 (`X-Cafe24-Call-Remain` / `X-Cafe24-Time-Remain`) 기반 sleep. spec §4.1 + 9.6 정합. `withIntegrationLock` (`:236-258`) 가 in-process mutex 로 같은 Integration 의 동시 호출 직렬화.
   - 응답 크기 제한: cap 없음 — HTTP Request 와 동일 trade-off (응답은 사용자 비즈니스 데이터).
   - SSRF 가드: `buildUrl :1075-1099` 가 host 가 `.cafe24api.com` 인지 강제. 임의 host 호출 차단.
   - Request envelope wrapping: `wrapInCafe24Envelope :1147-1158` 가 POST/PUT 의 `{ shop_no?, request: {...} }` wire format 적용 — spec §4.2 + §9.10 단일 책임 부합. 이중 wrap throw 가드 포함.

## 종합 개선안 (2026-05-16)

- [ ] (spec) `4-cafe24.md:23` 의 `pagination` 설명에서 `cursor?: string` 표기 제거 — schema (`cafe24.schema.ts:21-27`) 는 cursor 폐기 (B-3-7) 됐고 본문 footnote (`:321-322`) 도 cursor 제거 명시. §1 표만 정정 누락. 근거: `cafe24-api.client.ts` 의 fields path/query 분배에서 cursor 미사용.
- [ ] (test) `meta.callLimit/callRemain/callUsage` 가 4xx/5xx 응답에서도 동봉되는지 회귀 테스트 추가 — `cafe24.handler.spec.ts:337-375` 가 4xx 경로의 `buildMeta` 호출 (`cafe24.handler.ts:259`) 결과를 부분적으로만 검증. rate-limit 메트릭이 에러 시에도 디버깅 메트릭으로 유지되는지 spec §5.3.1 표 (callUsage 항목) 와 회귀 보호. 근거: spec `4-cafe24.md:221` (`"callUsage": 13` 4xx 케이스 동봉).
- [ ] (test) `sanitizeConfigEcho` 의 `fields` 마스킹 회귀 테스트 추가 — 사용자가 `fields: { apiKey: 'secret' }` 처럼 자격증명-shape 키를 잘못 입력했을 때 `config.fields.apiKey === '***'` 가 echo 되는지 직접 검증. 현재 `_base/integration-handler-base.spec.ts` 의 sanitizeConfigEcho 단위 테스트는 있으나 Cafe24 handler 통합 테스트 부재. 근거: `cafe24.handler.ts:117-123`.
- [ ] (impl, 선택) Rate-limit 회복 후 정상 응답 동안 `meta.callRemain` 값이 0 보다 큰 경우 spec 표 (`callRemain?: number`) 가 optional 명시 — `buildMeta` (`:347-361`) 는 `undefined` 만 생략, `0` 은 동봉. spec 의 §5.1 JSON 예시 (`"callRemain": 0`) 와 정합. 변경 불필요, 회귀 회피만 점검.
- [ ] (spec, 선택) §5.3.3 (`Transport 실패`) 의 `output.error.code = 'CAFE24_TRANSPORT_FAILED'` 가 unknown error fallback 경로 (`cafe24.handler.ts:451-461`) 에서도 도달하는 사실 명시 — handler 가 모든 unknown 을 transport 로 분류한다는 implementation detail 이 spec 본문에 부재. 운영 측 가시성 향상. 근거: `cafe24.handler.ts:452-461`.
