---
id: http-request
status: spec-only
code: []
---

# Spec: HTTP Request

> 관련 문서: [Integration 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진 §10](../../5-system/4-execution-engine.md#10-integration-handler-계약) · [CONVENTIONS](../../conventions/node-output.md)

범용 HTTP 요청 노드. 인증 없이 사용하거나 Integration 을 참조해 인증 헤더/쿼리/`base_url` 을 자동 주입한다. 응답은 `success` / `error` 두 포트로 라우팅된다 (Principle 3 — runtime 실패는 `port:'error'` + `output.error`).

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| method | Enum | ✓ | `GET` | `GET` / `POST` / `PUT` / `PATCH` / `DELETE` / `HEAD` / `OPTIONS` |
| url | String (표현식) | ✓ | — | 요청 URL. `{{ }}` 사용 가능. URL 내 `user:pass@` / 자격증명 쿼리 파라미터(`api_key`, `token`, `signature` 등)는 echo 시 제거/마스킹 (Principle 7) |
| authentication | Enum | ✓ | `none` | `none` / `integration` / `custom` |
| integrationId | UUID | — | — | `authentication='integration'` 일 때 필수 ([공통 §1](./0-common.md#1-integration-참조)) |
| headers | KeyValue[] | — | `[]` | 요청 헤더. `{key, value}` 항목. CRLF 포함 입력은 schema 단계에서 거부 |
| queryParams | KeyValue[] | — | `[]` | URL 쿼리 파라미터. 동일 규약 |
| body | unknown | — | — | 요청 본문 (JSON object / 문자열 / KeyValue[] 등 `bodyType` 에 따름) |
| bodyType | Enum | — | `json` | `json` / `form-data` / `x-www-form-urlencoded` / `raw` / `binary` (legacy `form` → `x-www-form-urlencoded`) |
| responseType | Enum | — | `json` | `json` / `text` / `binary` |
| timeout | Integer | — | `30000` | 요청 타임아웃 (ms). `> 0` |
| followRedirects | Boolean | — | `true` | 리다이렉트 따라가기 (`integration` 인증 시 5홉 한도 + 매 홉 SSRF 재검증) |
| verifySsl | Boolean | — | `true` | SSL 인증서 검증 |

표현식(`{{ }}`)은 `url`·`headers[i].value`·`queryParams[i].value`·`body` 안에서 사용 가능.

> Source of truth: `codebase/backend/src/nodes/integration/http-request/http-request.schema.ts` (export `httpRequestNodeConfigSchema`, `httpRequestNodeMetadata`)

## 2. 설정 UI

```
┌──────────────────────────────────────────┐
│  [GET ▼]  https://api.example.com/...   │
│                                          │
│  Authentication: [Integration ▼]         │
│  Integration:    [api-prod ▼]            │
│                                          │
│  ┌─ Headers · Query · Body · Advanced ─┐│
│  │ Headers                              ││
│  │  Authorization  {{ $node.X.token }} ││
│  │  X-Request-Id   req-{{ $exec.id }}  ││
│  │  [+ Add Header]                      ││
│  └──────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

- `Authentication`: None / Integration (드롭다운) / Custom (직접 헤더 입력)
- 탭: Headers / Query Params / Body / Advanced
- Body 탭: `bodyType` 에 따라 JSON 에디터 / Key-Value 폼 전환
- Advanced 탭: `timeout`, `followRedirects`, `verifySsl`

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 입력 데이터 (표현식 `$input` 으로 참조) |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `success` | Success | data | false | HTTP 2xx 응답 |
| `error` | Error | error | false | HTTP 3xx/4xx/5xx 또는 transport 실패 (네트워크 / 타임아웃) |

> HTTP Request 는 동적 포트가 없다.

## 4. 실행 로직

[Integration 공통 §4 Handler 실행 세멘틱](./0-common.md#4-handler-실행-세멘틱) 의 6단계 계약을 따른다. 노드 고유 흐름:

1. **Config 정규화**: `method` 대문자 변환, `bodyType` / `responseType` 기본값 적용
2. **Config echo 빌드** (Principle 7): `context.rawConfig` 를 그대로 spread + `url` 만 `sanitizeUrlCredentials` 결과로 교체
   - URL 내 `user:pass@host` → userinfo 제거
   - 쿼리 파라미터 키가 `api_key` / `token` / `secret` / `signature` / `x-amz-signature` 등 자격증명 후보 → 값을 `[REDACTED]` 로 교체
   - 파싱 실패 시 정규식으로 userinfo 만 제거 (best-effort)
3. **Integration 자격증명 해석** (`authentication='integration'` 일 때만):
   - `IntegrationsService.getForExecution(integrationId, workspaceId)` 호출 → `serviceType='http'` 검증, `status='connected'` 검증
   - `auth_type` 별 credential 빌드 (§4.1 표). 실패 시 `INTEGRATION_INCOMPLETE` 등 catch 후 §5.3 (`port: 'error'`) 라우팅 + Usage 로그 `failed` 기록 (D4, 2026-05-17)
4. **URL 결합**: `base_url` 이 있고 `url` 이 절대(`https?://`)가 아니면 `{base_url}/{url}` (중복 슬래시 정규화)
5. **Query Params 병합**: 노드 `queryParams` → URL 에 append → `auth_type='api_key' & location='query'` credential append
6. **Headers 병합** (뒤가 우선): `credentials.default_headers` ← 노드 `headers` ← `credentials.headers`. 즉 **integration 자격증명 헤더가 사용자 입력을 덮어쓴다** (사용자가 `Authorization` 을 위조해 자격증명을 무력화하는 경로 차단)
7. **Body 직렬화**: `GET` / `HEAD` 외 method 일 때 `bodyType` 에 따라 직렬화. `form-data` 는 multipart boundary 자동 부여 (Content-Type 미지정)
8. **SSRF 가드** (`authentication='integration'` 일 때만): `assertSafeOutboundUrl(url)` 로 loopback / RFC1918 / link-local / CGNAT / IPv6 link-local·ULA 차단. 실패 시 catch 후 §5.3 (`port: 'error'`, `output.error.code = 'HTTP_BLOCKED'`) 라우팅 + Usage 로그 `failed` 기록 (D4, 2026-05-17)
9. **fetch 호출**: `AbortController` 로 `timeout` 적용, `redirect: 'manual'`. `integration` 인증인 경우 3xx 응답을 받으면 최대 5홉까지 수동 follow + 매 홉 SSRF 재검증
10. **응답 파싱**: `responseType='json'` → `res.json()` (실패 시 `null`), 그 외 `text`
11. **Usage 로깅** (§4.2): `integration` 인증일 때만 `success` / `failed` 기록
12. **반환 분기**:
    - `res.ok` → §5.1 (`port:'success'`)
    - 3xx/4xx/5xx → §5.3 (`port:'error'`, `output.error.code = 'HTTP_4XX' | 'HTTP_5XX'` — 3xx 도 manual redirect 한도 도달 시 도달 가능)
    - fetch reject (네트워크 / 타임아웃 / abort) → §5.3 (`output.error.code = 'HTTP_TRANSPORT_FAILED'`, `meta.statusCode = 0`)

### 4.1 `auth_type` 별 credential 적용

| `auth_type` | 주입 위치 | 예시 |
|-------------|----------|------|
| `api_key` + `location=header` | `credentials.headers[key_name] = value` | `X-Api-Key: secret` |
| `api_key` + `location=query` | URL 쿼리 파라미터 append | `?token=secret` |
| `bearer_token` | `Authorization: Bearer {token}` | — |
| `basic` | `Authorization: Basic {base64(username:password)}` | — |
| 그 외 | `INTEGRATION_AUTH_UNSUPPORTED` (catch 후 §5.3 라우팅, D4 2026-05-17) | — |

### 4.2 Usage 로깅 매트릭스 (`authentication='integration'` 일 때)

| 조건 | `status` | `error.code` |
|------|----------|--------------|
| 2xx | `success` | — |
| 3xx · 4xx · 5xx | `failed` | `HTTP_{status}` |
| fetch reject (네트워크 / 타임아웃) | `failed` | `HTTP_TRANSPORT_FAILED` |
| SSRF 차단 / redirect 한도 초과 | `failed` | `HTTP_BLOCKED` |

### 4.3 활동 로그 API 식별 정보 ([`_product-overview.md INT-US-05`](./_product-overview.md#24-사용처-추적-및-라이프사이클))

본 식별 정보는 `authentication === 'integration'` (통합 연결된 HTTP 요청) 호출에만 `logUsage` 가 발생하므로 그 경우에만 기록된다. inline credentials 모드는 활동 로그 자체가 생성되지 않는다.

`logUsage` 호출 시 `api` 식별 정보를 함께 전달한다:

- `api_label` = NULL (HTTP Request 는 endpoint 카탈로그가 없음 — 사용자가 임의 URL 을 호출하므로 catalog key 가 의미 없음)
- `api_method` = 정규화된 HTTP method (`GET` / `POST` / ...)
- `api_path` = `host + path`. URL 의 query string 은 제거 (endpoint 단위 그룹화 + 자격증명 누출 방지). `base_url` 이 합성된 후의 절대 URL 기준. `base_url` 없이 상대 URL 만 들어오면 path-only fallback (host 미포함). URL parse 실패 시 best-effort raw string 그대로 저장 (잘림 정책은 [`0-common.md §4.1 step 6`](./0-common.md#4-handler-실행-세멘틱) 의 백엔드 자동 truncate)

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지. `output.response` 는 1차 네이밍 통일 (Principle 8.2). `meta.durationMs` 통일 ([공통 §6.1](./0-common.md#61-metaduration-vs-metadurationms-명명-통일)).
>
> `status` 는 비-블로킹 노드이므로 항상 생략.

### 5.1 Case: 2xx 성공 (port `success`)

```json
{
  "config": {
    "method": "POST",
    "url": "https://api.example.com/users",
    "authentication": "integration",
    "integrationId": "int_http_1",
    "headers": [{ "key": "X-Request-Id", "value": "req-{{ $exec.id }}" }],
    "queryParams": [],
    "body": { "user": "{{ $input.name }}" },
    "bodyType": "json",
    "responseType": "json",
    "timeout": 30000,
    "followRedirects": true,
    "verifySsl": true
  },
  "output": {
    "response": { "id": 42, "name": "Alice" },
    "requestBody": { "user": "Alice" },
    "requestBodyType": "json",
    "responseHeaders": {
      "content-type": "application/json",
      "authorization": "[REDACTED]"
    }
  },
  "meta": { "statusCode": 201, "durationMs": 250 },
  "port": "success"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.method` | Enum | config echo (Principle 7) | 사용자가 입력한 raw method |
| `config.url` | string | config echo + sanitize | URL 내 `user:pass@` 및 자격증명 쿼리 (`api_key`/`token` 등) 제거. 그 외는 raw (`{{ }}` 보존) |
| `config.authentication` | Enum | config echo | `none` / `integration` / `custom` |
| `config.integrationId` | UUID? | config echo | `authentication='integration'` 시 echo. 자격증명 자체는 절대 echo 금지 (Principle 7) |
| `config.headers` / `config.queryParams` | KeyValue[] | config echo | 사용자 입력 raw (`{{ }}` 보존) |
| `config.body` / `config.bodyType` | unknown / Enum | config echo | raw body — 표현식 `{{ }}` 보존 |
| `config.responseType` / `config.timeout` / `config.followRedirects` / `config.verifySsl` | — | config echo | UI 입력값 raw |
| `output.response` | unknown | runtime — `res.json()` / `res.text()` | 응답 body. `responseType='json'` 에서 파싱 실패 시 `null` |
| `output.requestBody?` | unknown | runtime — evaluated | 실제 wire 에 나간 평가된 본문. 256KB 초과 시 잘림 (`bodyTruncated:true`). `body=undefined` 면 생략 |
| `output.requestBodyType` | string | runtime — evaluated | 실제 적용된 `bodyType` (schema 기본값 `'json'` 적용 후) |
| `output.responseHeaders?` | Record<string,string> | runtime | 응답 헤더. key 는 lowercase. `Authorization` / `Cookie` / `Set-Cookie` / `X-*-Token` / `X-*-Key` 등 자격증명-shape 값은 `[REDACTED]` |
| `output.bodyTruncated?` | boolean | runtime | 256KB cap 적용 시에만 `true` |
| `meta.statusCode` | number | engine inject (handler return) | HTTP 응답 status (2xx) |
| `meta.durationMs` | number | engine inject (handler return) | 요청 시작부터 응답 수신까지의 ms ([공통 §6.1](./0-common.md#61-metaduration-vs-metadurationms-명명-통일)) |
| `port` | `'success'` | handler return | 2xx 응답 분기 |

**Expression 접근 예**:
- `$node["X"].output.response.id` → 42
- `$node["X"].output.requestBody.user` → `"Alice"`
- `$node["X"].output.responseHeaders["content-type"]` → `"application/json"`
- `$node["X"].meta.statusCode` → 201
- `$node["X"].meta.durationMs` → 250
- `$node["X"].config.url` → `"https://api.example.com/users"` (raw, 자격증명 제거됨)
- `$node["X"].port` → `"success"`

### 5.3 Case: HTTP 4xx / 5xx 또는 Transport 실패 (port `error`)

CONVENTIONS Principle 3.2 의 표준 envelope `output.error.{code, message, details?}` 를 채운다. 4xx / 5xx 의 경우 서버가 돌려준 응답 body 는 `output.response` 에 그대로 보존(디버깅 용이).

#### 5.3.1 4xx / 5xx 응답

```json
{
  "config": {
    "method": "GET",
    "url": "https://api.example.com/users/missing",
    "authentication": "none",
    "headers": [],
    "queryParams": [],
    "bodyType": "json",
    "responseType": "json",
    "timeout": 30000,
    "followRedirects": true,
    "verifySsl": true
  },
  "output": {
    "response": { "error": "Not Found" },
    "requestBodyType": "json",
    "responseHeaders": { "content-type": "application/json" },
    "error": {
      "code": "HTTP_4XX",
      "message": "HTTP 404 Not Found",
      "details": {
        "statusCode": 404,
        "statusText": "Not Found",
        "url": "https://api.example.com/users/missing",
        "method": "GET"
      }
    }
  },
  "meta": { "statusCode": 404, "durationMs": 120 },
  "port": "error"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (§5.1과 동일) | config echo | |
| `output.response` | unknown | runtime — 서버 응답 body | 4xx/5xx 시에도 서버 body 보존 (디버깅) |
| `output.requestBody?` / `output.requestBodyType` / `output.responseHeaders?` / `output.bodyTruncated?` | (§5.1과 동일) | runtime | response 가 있으므로 `responseHeaders` 포함 |
| `output.error.code` | `'HTTP_4XX'` / `'HTTP_5XX'` | handler return | `statusCode >= 500` → `'HTTP_5XX'`, 그 외 ≥ 300 → `'HTTP_4XX'` |
| `output.error.message` | string | handler return | `HTTP {status} {statusText}` |
| `output.error.details.statusCode` | number | handler return | HTTP 응답 status |
| `output.error.details.statusText` | string | handler return | HTTP 응답 status text |
| `output.error.details.url` | string | handler return | 실제 요청한 URL (sanitize 적용 — 자격증명 제거) |
| `output.error.details.method` | string | handler return | 요청 method |
| `meta.statusCode` | number | handler return | HTTP 응답 status |
| `meta.durationMs` | number | handler return | 요청 ms |
| `port` | `'error'` | handler return | 에러 분기 |

#### 5.3.2 Transport 실패 (네트워크 오류 / 타임아웃)

`fetch` 가 reject 한 경우 (DNS / 연결 거부 / 소켓 / `AbortController` timeout). Response 자체가 없으므로 `output.responseHeaders` 는 미포함하고 `meta.statusCode = 0`.

```json
{
  "config": {
    "method": "POST",
    "url": "https://api.example.com/x",
    "authentication": "none",
    "headers": [],
    "queryParams": [],
    "body": { "ping": 1 },
    "bodyType": "json",
    "responseType": "json",
    "timeout": 30000,
    "followRedirects": true,
    "verifySsl": true
  },
  "output": {
    "response": { "error": "ECONNREFUSED" },
    "requestBody": { "ping": 1 },
    "requestBodyType": "json",
    "error": {
      "code": "HTTP_TRANSPORT_FAILED",
      "message": "ECONNREFUSED",
      "details": {
        "url": "https://api.example.com/x",
        "method": "POST"
      }
    }
  },
  "meta": { "statusCode": 0, "durationMs": 42 },
  "port": "error"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `output.response.error` | string | handler return | transport 실패 메시지 (legacy 호환 잔재 — 신규 코드는 `output.error` 를 사용) |
| `output.error.code` | `'HTTP_TRANSPORT_FAILED'` | handler return | 네트워크 / 타임아웃 / abort 통합 코드 |
| `output.error.message` | string | handler return | underlying error message (`Error.message` 또는 String 변환) |
| `output.error.details.url` / `output.error.details.method` | string | handler return | 시도한 요청 정보 (URL sanitize 적용) |
| `output.responseHeaders` | — | — | response 부재 → 생략 |
| `meta.statusCode` | `0` | handler return | transport 실패 magic number — `output.error.code === 'HTTP_TRANSPORT_FAILED'` 로 판별 권장 |
| `meta.durationMs` | number | handler return | 요청 시작부터 reject 시점까지 |
| `port` | `'error'` | handler return | 에러 분기 |

**Expression 접근 예** (5.3 공통):
- `$node["X"].output.error.code` → `"HTTP_4XX"` / `"HTTP_5XX"` / `"HTTP_TRANSPORT_FAILED"`
- `$node["X"].output.error.message` → 사람이 읽는 메시지
- `$node["X"].output.error.details.statusCode` → 404 (transport 실패 시 미정의)
- `$node["X"].output.response` → 서버 body (4xx/5xx) 또는 `{ error: "..." }` (transport)
- `$node["X"].port === 'error'` → 분기 라우팅

### 5.8 (D4 — 2026-05-17) handler.validate 실패만 throw, 나머지 모두 §5.3 으로 라우팅

D4 결정 이전에 본 절은 다양한 `IntegrationError` / `Error` throw → 노드 실행 실패 경로를 정의했었다. 현재는 다음 두 경로로 분리된다:

- **`handler.validate()` 실패** (config 형식 자체가 잘못된 경우): 여전히 사전 검증 단계에서 노드 실행 자체가 시작되지 않는다. warningRule + `evaluateMetadataBlockingErrors` 가 throw 하며 엔진이 워크플로우를 실패 처리. 예: `URL 을 입력해야 합니다.`, `method must be one of: ...`, `timeout must be a positive number`, `CRLF characters are not allowed in key/value`, `integrationId is required when authentication is "integration"`.
- **`execute()` 안의 모든 IntegrationError / SSRF / auth 실패**: §5.3 (`port: 'error'` + `output.error.*`) 으로 라우팅된다. 다음 코드들이 해당:
  - `INTEGRATION_NOT_FOUND` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` ([공통 §4.2](./0-common.md#42-공통-에러-코드))
  - `INTEGRATION_AUTH_UNSUPPORTED` — 지원하지 않는 auth_type
  - `HTTP_BLOCKED` — SSRF 차단 (사설/loopback/link-local/CGNAT/IPv6 ULA / redirect 5홉 초과 / 비-http(s) 프로토콜). Usage 로그에도 `HTTP_BLOCKED` 코드로 기록.
  - `Integration-based authentication is not available in this environment` — 내부 환경 오류는 `INTEGRATION_SERVICE_UNAVAILABLE` 코드로
  - `Missing workspace context` — `INTEGRATION_SERVICE_UNAVAILABLE` 코드로

> D4 이전의 "throw → 노드 실패" 동작은 폐기. 종전 아카이브 개선안의 `HTTP_SSRF_BLOCKED` → error 포트 전환 P1 후보는 D4 결정과 함께 완료 (코드명은 기존 `HTTP_BLOCKED` 유지). Usage 로그 (`status: 'failed'` + `error: {code, message}`) 는 동일하게 기록.

## 6. 에러 코드

런타임 (`port:'error'`) 에서 채워지는 `output.error.code` enum:

| 코드 | 조건 | `output.response` | `output.responseHeaders` | `meta.statusCode` |
|------|------|-------------------|---------------------------|-------------------|
| `HTTP_4XX` | `400 ≤ statusCode < 500` (또는 manual redirect 한도 도달한 3xx 도달 시) | 서버 body 보존 | 응답 헤더 (sanitize) | 응답 status |
| `HTTP_5XX` | `500 ≤ statusCode < 600` | 서버 body 보존 | 응답 헤더 (sanitize) | 응답 status |
| `HTTP_TRANSPORT_FAILED` | `fetch` reject (DNS / 연결 거부 / 소켓 / `AbortController` timeout) | `{ error: <message> }` (legacy 잔재) | — (response 없음) | `0` |
| `HTTP_BLOCKED` (D4) | SSRF 차단 (호스트 검증·DNS rebinding·redirect 한도·비-http(s) 프로토콜). 종전 throw 였으나 D4 이후 본 경로 | — | — | `0` |
| `INTEGRATION_*` ([공통 §4.2](./0-common.md#42-공통-에러-코드)) (D4) | Integration resolve / 자격증명 실패. `INTEGRATION_NOT_FOUND` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` / `INTEGRATION_AUTH_UNSUPPORTED` 모두 본 경로로 surface | — | — | `0` |
| `INTEGRATION_SERVICE_UNAVAILABLE` (D4) | IntegrationsService 미주입 또는 workspace context 누락 (deployment 오류). 종전 throw 였으나 D4 이후 본 경로 | — | — | `0` |

## 7. 캔버스 요약

[공통 §5](./0-common.md#5-캔버스-요약) — `HTTP Request` 행 인용 (`{method} {url}`, URL 35자 초과 시 잘림). 연결된 Integration 이 삭제된 경우 `⚠ Missing integration` (앰버색).
