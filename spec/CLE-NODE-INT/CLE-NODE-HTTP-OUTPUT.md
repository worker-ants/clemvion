---
id: "CLE-NODE-HTTP-OUTPUT"
title: "HTTP Request 노드 — 출력과 에러"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-HTTP"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT", "CLE-NODE-HTTP"]
area: "CLE-NODE-INT"
content_hash: "e9674c509f6c2bf41d4285eafa9bc9848ba04ed0fc30925f9ddeb2e6ce2a6a43"
read_as: "approved_fallback"
task: "CLE-T-6H2AKH"
source_paths: []
mirror_sha256: "820da9b44b0a2b9402856f284f7a7671747269f55c09767e4c8d3259e58fe196"
etag: "sha256-dcffef1bde4cb4e6df510eaed6281eaf438c653e9ece24bff8c9c587911b20b7"
---
## 개요

이 문서는 [HTTP Request 노드](CLE-NODE-HTTP.md) 의 하위 문서로 노드 출력의 케이스별 구조(성공 · 4xx·5xx 응답 · 전송 실패)와 사전 검증 · 런타임 에러 코드를 정한다. 실행 흐름은 [HTTP Request 노드 — 실행 로직](CLE-NODE-HTTP-EXEC.md) 이 정한다.

## 출력 구조

노드 출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 11 형식을 따른다. JSON 예시는 `undefined` 필드를 생략하고, 다섯 필드 밖의 최상위 키는 두지 않는다. `output.response` 는 Principle 8.2 의 1차 명명을 따른다. `status` 는 비블로킹 노드이므로 항상 생략한다. 케이스는 성공과 에러 둘뿐이다. 취소는 엔진이 기록하는 별도 종결이다. 노드 취소 신호로 요청이 끝나면 핸들러는 출력을 돌려주지 않는다. 엔진이 노드 실행을 취소됨(`cancelled`)으로 끝내고 취소 에러(`AbortError`)를 노드 실행의 `error` 에 남긴다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) 규칙 19).

### 2xx 성공 (`success`)

```json
{
  "config": {
    "method": "POST",
    "url": "https://api.example.com/users",
    "authentication": "integration",
    "integrationId": "int_http_1",
    "headers": [{ "key": "X-Request-Id", "value": "req-{{ $execution.id }}" }],
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
| `config.method` | Enum | 설정 에코 | 사용자가 입력한 method |
| `config.url` | string | 설정 에코 + 가림 | `user:pass@` 와 자격 증명 쿼리를 지운 값. 그 밖은 원본(`{{ }}` 보존) |
| `config.authentication` | Enum | 설정 에코 | `none` / `integration` / `custom` |
| `config.integrationId` | UUID? | 설정 에코 | `integration` 인증일 때 에코. 자격 증명 자체는 절대 에코하지 않는다 |
| `config.headers` / `config.queryParams` | KeyValue[] | 설정 에코 | 원본(`{{ }}` 보존) |
| `config.body` / `config.bodyType` | unknown / Enum | 설정 에코 | 원본 본문(`{{ }}` 보존) |
| `config.responseType` / `config.timeout` / `config.followRedirects` / `config.verifySsl` | — | 설정 에코 | 입력값 원본 |
| `output.response` | unknown | 런타임 `res.json()`·`res.text()` | 응답 본문. `json` 파싱 실패 시 `null` |
| `output.requestBody?` | unknown | 런타임(평가된 값) | 실제로 보낸 평가된 본문. 256KB 를 넘으면 잘린다. `body` 가 없으면 생략 |
| `output.requestBodyType` | string | 런타임 | 실제 적용된 `bodyType`(기본값 `'json'` 적용 후) |
| `output.responseHeaders?` | Record<string,string> | 런타임 | 응답 헤더. key 는 소문자. `Authorization`·`Cookie`·`Set-Cookie`·`X-*-Token`·`X-*-Key` 같은 자격 증명 형태 값과 `Location`(3xx 대상 URL)은 `[REDACTED]`. 단일 기준은 `_base/sanitize-response-headers.util.ts` |
| `output.bodyTruncated?` | boolean | 런타임 | 256KB 제한이 적용됐을 때만 `true` |
| `meta.statusCode` | number | 핸들러 반환 | HTTP 응답 상태(2xx) |
| `meta.durationMs` | number | 핸들러 반환 | 요청 시작부터 응답까지 ms |
| `port` | `'success'` | 핸들러 반환 | 2xx 분기 |

표현식 접근 예:

- `$node["X"].output.response.id` → `42`
- `$node["X"].output.requestBody.user` → `"Alice"`
- `$node["X"].output.responseHeaders["content-type"]` → `"application/json"`
- `$node["X"].meta.statusCode` → `201`
- `$node["X"].config.url` → `"https://api.example.com/users"` (원본, 자격 증명 제거)
- `$node["X"].port` → `"success"`

### 4xx·5xx 응답 (`error`)

[노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 3.2 의 `output.error.{code, message, details?}` 를 채운다. 서버가 돌려준 응답 본문은 디버깅을 위해 `output.response` 에 그대로 둔다. 따라가지 않은 3xx 응답도 이 모양이고 코드는 `HTTP_4XX` 다([실행 로직](CLE-NODE-HTTP-EXEC.md#실행-로직) 12단계).

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
| `config.*` | 성공 케이스와 같음 | 설정 에코 | |
| `output.response` | unknown | 서버 응답 본문 | 2xx 가 아닌 응답에서도 본문 보존 |
| `output.requestBody?` / `output.requestBodyType` / `output.responseHeaders?` / `output.bodyTruncated?` | 성공 케이스와 같음 | 런타임 | 응답이 있으므로 `responseHeaders` 포함 |
| `output.error.code` | `'HTTP_4XX'` / `'HTTP_5XX'` | 핸들러 반환 | `statusCode >= 500` 이면 `HTTP_5XX`, 그 밖(3xx·4xx)은 `HTTP_4XX` |
| `output.error.message` | string | 핸들러 반환 | `HTTP {status} {statusText}` |
| `output.error.details.statusCode` | number | 핸들러 반환 | HTTP 응답 상태. 3xx 일 수 있다 |
| `output.error.details.statusText` | string | 핸들러 반환 | HTTP 응답 상태 텍스트 |
| `output.error.details.url` | string | 핸들러 반환 | 이 응답을 받은 요청의 URL. 리다이렉트를 따라갔으면 마지막 홉의 URL 이다. `sanitizeUrlCredentials` 로 `user:pass@` 를 지우고, 이름 목록에 든 쿼리 키(`api_key`·`token`·`signature` 등)와 이번 호출에 붙인 통합 자격 증명 쿼리(`key_name`)의 값을 `[REDACTED]` 로 바꾼다. 쿼리 이름은 대소문자를 가리지 않는다([Rationale](#붙인-자격-증명-쿼리를-이름으로-가린다-2026-11-14)) |
| `output.error.details.method` | string | 핸들러 반환 | 요청 method |
| `meta.statusCode` | number | 핸들러 반환 | HTTP 응답 상태 |
| `meta.durationMs` | number | 핸들러 반환 | 요청 ms |
| `port` | `'error'` | 핸들러 반환 | 에러 분기 |

### 전송 실패 (`error`)

요청이 reject 된 경우(DNS·연결 거부·소켓·노드 자체 타임아웃)다. 응답이 없으므로 `output.responseHeaders` 를 넣지 않고 `meta.statusCode = 0` 이다. 노드 취소 신호로 끊긴 요청은 이 케이스가 아니다([출력 구조](#출력-구조) 서두).

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
| `output.response.error` | string | 핸들러 반환 | `output.error.message` 와 같은 값. 옛 호환을 위해 남은 필드(Deprecated)다. 새 코드는 `output.error.{code, message}` 를 기준으로 쓰고 이 필드에 기대지 않는다 |
| `output.error.code` | `'HTTP_TRANSPORT_FAILED'` | 핸들러 반환 | 네트워크 에러와 노드 자체 타임아웃을 묶은 코드. 노드 취소 신호로 끊긴 요청은 이 코드를 쓰지 않는다([출력 구조](#출력-구조) 서두) |
| `output.error.message` | string | 핸들러 반환 | 원인 에러 메시지(`Error.message` 또는 문자열 변환). `toLogError` 가 비밀값처럼 보이는 조각(`token=…`·`Bearer …`·긴 opaque 문자열)을 `***` 로 가린다 |
| `output.error.details.url` / `output.error.details.method` | string | 핸들러 반환 | 시도한 요청 정보. `url` 은 첫 요청 URL 이고 리다이렉트 홉에서 실패해도 같다. 가림은 4xx·5xx 의 `details.url` 과 같다 |
| `output.responseHeaders` | — | — | 응답이 없어 생략 |
| `meta.statusCode` | `0` | 핸들러 반환 | 전송 실패 표시값. 판별은 `output.error.code === 'HTTP_TRANSPORT_FAILED'` 를 권장 |
| `meta.durationMs` | number | 핸들러 반환 | 요청 시작부터 reject 까지 |
| `port` | `'error'` | 핸들러 반환 | 에러 분기 |

에러 케이스 표현식 접근 예:

- `$node["X"].output.error.code` → `"HTTP_4XX"` / `"HTTP_5XX"` / `"HTTP_TRANSPORT_FAILED"`
- `$node["X"].output.error.details.statusCode` → `404` (응답을 받지 못한 에러에는 없음)
- `$node["X"].output.response` → 서버 본문(4xx·5xx) 또는 `{ error: "..." }`(전송 실패)
- `$node["X"].port === 'error'` → 분기 라우팅

## 에러 코드

### 사전 검증 에러

`handler.validate()` 가 실패하면(설정 형식 자체가 잘못된 경우) 노드 실행이 시작되지 않는다. 경고 규칙과 `evaluateMetadataBlockingErrors` 가 throw 하고 엔진이 실행을 실패로 끝낸다. 예: `URL 을 입력해야 합니다.`, `method must be one of: ...`, `timeout must be a positive number`, `CRLF characters are not allowed in key/value`, `integrationId is required when authentication is "integration"`.

### 런타임 에러 (`port: 'error'`)

`execute()` 안의 실패는 모두 에러 포트로 간다([Rationale 「실패를 에러 포트로 통일」](CLE-NODE-HTTP.md#실패를-에러-포트로-통일-2026-05-17)). 노드 취소 신호로 생긴 `AbortError` 는 실패가 아니라서 이 표에 없다([출력 구조](#출력-구조) 서두).

| 코드 | 조건 | `output.error.details` | `output.response` | `output.responseHeaders` | `meta.statusCode` |
|------|------|------------------------|-------------------|--------------------------|-------------------|
| `HTTP_4XX` | `300 ≤ statusCode < 500`. 3xx 는 `none`·`custom` 인증의 3xx 와 `integration` 인증에서 `Location` 이 없는 3xx 다 | `statusCode`·`statusText`·`url`·`method` | 서버 본문 보존 | 응답 헤더(가림 적용) | 응답 상태 |
| `HTTP_5XX` | `500 ≤ statusCode < 600` | `statusCode`·`statusText`·`url`·`method` | 서버 본문 보존 | 응답 헤더(가림 적용) | 응답 상태 |
| `HTTP_TRANSPORT_FAILED` | 요청 reject(DNS·연결 거부·소켓·노드 자체 타임아웃). 리다이렉트 홉에서 사설망 차단 가드가 판정이 아닌 오류를 던진 경우도 여기로 합류한다 | `url`·`method` | `{ error: <message> }` (옛 호환) | — | `0` |
| `HTTP_BLOCKED` | 사설망 차단 판정(`SsrfBlockedError`: 호스트 검사·DNS rebinding·연결 시점 주소 판정·리다이렉트 대상 재검사·http(s) 가 아닌 프로토콜), 또는 판정이 아닌 리다이렉트 한도 초과(5홉을 따라간 뒤에도 `Location` 이 있는 3xx). 두 경우 모두 `output.error.message` 는 `Request blocked by SSRF policy.` | `url`·`method` | — | — | `0` |
| `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` | 통합 해소·자격 증명 실패([통합 노드 공통](CLE-NODE-INT-COMMON.md)) | `url`·`method` | — | — | `0` |
| `INTEGRATION_AUTH_UNSUPPORTED` | 지원하지 않는 `auth_type` | `url`·`method` | — | — | `0` |
| `INTEGRATION_CALL_FAILED` | 통합이 없거나 다른 워크스페이스 소속(`requireEntity` 의 `RESOURCE_NOT_FOUND` fallback), 또는 preflight 사설망 차단 가드의 고장 | `url`·`method` | — | — | `0` |
| `INTEGRATION_SERVICE_UNAVAILABLE` | `IntegrationsService` 미주입(`Integration-based authentication is not available in this environment`) 또는 workspace context 누락. 워크스페이스 누락의 현재 구현 차이는 [통합 노드 공통](CLE-NODE-INT-COMMON.md) 미결 사항 참조 | `url`·`method` | — | — | `0` |

`output.error.details` 의 `url` 은 실패한 시점에 따라 다르다. 모든 `url` 에 4xx·5xx 응답과 같은 `sanitizeUrlCredentials` 가림을 적용한다.

- 통합 해소 단계([실행 로직](CLE-NODE-HTTP-EXEC.md#실행-로직) 3단계)에서 끝난 실패(`INTEGRATION_*`, 통합 조회 실패의 `INTEGRATION_CALL_FAILED`)는 `base_url` 을 합치기 전 설정의 `url` 이다.
- 그 뒤의 실패는 `base_url` 과 쿼리(통합 자격 증명 쿼리 포함)를 붙인 요청 URL 이다. 붙인 자격 증명 쿼리의 값은 가린다. preflight 의 `HTTP_BLOCKED`·`INTEGRATION_CALL_FAILED` 가 여기에 든다.
- 리다이렉트를 따라가는 중에 난 `HTTP_BLOCKED` 와 `HTTP_TRANSPORT_FAILED` 는 첫 요청 URL 이다. 리다이렉트를 따라간 뒤 받은 응답의 `HTTP_4XX`·`HTTP_5XX` 는 마지막 홉의 URL 이다.

## Rationale

### `Location` 응답 헤더를 가리는 이유

`Location` 은 자격 증명 형태의 이름은 아니지만 가림 대상 목록에 넣었다(`_base/sanitize-response-headers.util.ts`). 3xx 대상 URL 을 `output.responseHeaders` 로 그대로 보이면, `output.error.details.url` 에서 `sanitizeUrlCredentials` 가 막는 URL 안 자격 증명(`user:pass@`, 자격 증명 쿼리)이 응답 헤더 경로로 다시 새어 나간다. 두 가림 경로를 대칭으로 유지하려는 결정이다. 배경은 유틸 파일 머리 주석에 있다.

### 리다이렉트 한도 초과와 3xx 응답의 출력 코드 (2026-11-13)

이전 서술은 직접 따라가는 한도에 닿으면 3xx 가 `HTTP_4XX` 로 나온다고 적었지만 실제로는 한도를 넘기면 `HTTP_BLOCKED` 가 나온다. 동작을 바꾸지 않고 서술을 지금 동작에 맞췄다.

- **3xx 는 `HTTP_4XX` 로 나간다.** 핸들러는 상태가 500 이상이면 `HTTP_5XX` 를 내고 그 밖의 2xx 아닌 응답은 모두 `HTTP_4XX` 로 낸다. 3xx 가 오는 경우는 `none`·`custom` 인증의 3xx 와 `integration` 인증에서 `Location` 이 없는 3xx 다. 채팅 채널의 실패 분류기는 `error.code` 만 보고 `HTTP_4XX` 를 `executionFailedThirdParty4xx` 로 안내한다. 그래서 302 로 끝난 실행은 «외부 서비스 요청이 거부되었습니다 (302)» 로 안내된다. 내부 실패(`executionFailedInternal`)로 분류되지는 않는다. [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) 의 분류 표는 이 행의 조건을 `details.statusCode` 400~499 로 적었지만 분류기는 상태 범위를 보지 않는다.
- **리다이렉트 한도 초과는 판정 없이 `HTTP_BLOCKED` 로 나간다.** 5홉을 따라간 뒤에도 `Location` 이 있는 3xx 가 오면 `followRedirectsSafely` 가 차단으로 돌려준다. 핸들러는 사설망 차단과 같은 코드와 문구(`Request blocked by SSRF policy.`)를 낸다. 사설망 차단 가드의 판정(`SsrfBlockedError`)은 없다. [통합 노드 공통](CLE-NODE-INT-COMMON.md) 의 «차단 코드는 판정에만 쓴다» 규칙에서 벗어나는 경우다. 채팅 채널은 `HTTP_BLOCKED` 를 내부 실패(`executionFailedInternal`)로 안내하므로 외부 서비스의 리다이렉트 반복이 우리 쪽 실패로 보인다. [「사설망 차단 메시지 일반화」](CLE-NODE-HTTP.md#사설망-차단-메시지-일반화-2026-07-05) 결정이 한도 초과를 일부러 `HTTP_BLOCKED` 로 묶었다.
- **고치지 않은 이유**: 둘 다 고치려면 핸들러가 다른 코드를 내거나 채팅 채널 분류기가 상태 범위를 봐야 한다. 3xx 와 한도 초과에 맞는 기존 코드가 없어서 새 에러 코드를 [에러 코드 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 에 올려야 할 수도 있다. 이번 개정은 서술을 구현에 맞추는 범위라 동작을 그대로 두었다. 3xx 와 한도 초과의 코드 정리와 채팅 채널 안내는 NERV Task `CLE-T-43KCNP` 가 맡는다. 한도 초과의 `HTTP_BLOCKED` 예외를 [에러 코드 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 의 행에 적는 일은 NERV Task `CLE-T-6G3084` 가 맡는다.

### 에러 `details` 를 구현에 맞춰 적는다 (2026-11-13)

2026-11-13 에 에러 케이스마다 `output.error.details` 의 필드를 코드에 맞춰 적었다. [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 3.2.2 의 HTTP Request 예도 같은 날 같은 필드로 고쳤다.

- 응답을 받은 `HTTP_4XX`·`HTTP_5XX` 만 `statusCode`·`statusText` 를 싣는다. 나머지 에러는 `url`·`method` 만 싣는다.
- 그때 `details.url` 의 가림은 `user:pass@` 와 이름 목록에 든 쿼리 키만 가렸다. 통합 자격 증명이 쿼리(`api_key` + `location=query`)이고 그 이름(`key_name`)이 목록에 없으면 값이 `details.url` 에 그대로 남았다. `details` 는 노드 실행 기록과 표현식 캐시에도 남는다. dry-run 미리보기는 자격 증명 쿼리를 붙이기 전 URL 을 써서 이 문제가 없었다.
- 출력이 바뀌는 일이라 서술을 맞추는 그 개정에서는 고치지 않았다. NERV Task `CLE-T-6H2AKH` 가 2026-11-14 에 고쳤다([붙인 자격 증명 쿼리를 이름으로 가린다](#붙인-자격-증명-쿼리를-이름으로-가린다-2026-11-14)).

### 붙인 자격 증명 쿼리를 이름으로 가린다 (2026-11-14)

NERV Task `CLE-T-6H2AKH` 에서 `details.url` 에 통합 자격 증명 쿼리의 값이 남던 문제를 고쳤다. 핸들러는 이번 호출에 붙인 자격 증명 쿼리의 이름을 `sanitizeUrlCredentials` 에 넘긴다. 이 함수는 이름 목록에 든 쿼리 키와 함께 넘겨받은 이름의 값을 `[REDACTED]` 로 바꾼다. 4xx·5xx · 전송 실패 · preflight 차단 · 리다이렉트를 따라간 뒤의 URL 에 모두 같은 규칙을 쓴다.

- **이름 목록을 늘리지 않았다.** `key_name` 은 사용자가 정하는 이름이라 목록을 늘려도 다 막을 수 없다. 이번 호출에 붙인 이름은 핸들러가 정확히 안다.
- **자격 증명을 붙이기 전 URL 을 쓰지 않았다.** `details.url` 은 실제로 보낸 요청의 URL 이라 디버깅할 때 `base_url` · 경로 · 사용자 쿼리를 그대로 보여 준다. 붙이기 전 URL 을 쓰면 실제 요청과 달라진다. 리다이렉트를 따라간 뒤의 URL 은 서버가 준 `Location` 이라 붙이기 전 URL 이 따로 없다. 이름으로 가리면 쿼리 자리는 남고 값만 가려진다.
- 사용자가 같은 이름의 쿼리를 직접 넣었으면 그 값도 가린다. 같은 이름이면 대상 서버가 자격 증명으로 읽는 값이다.
- 이름은 대소문자를 가리지 않고 비교한다. URL 로 파싱되지 않는 값(`base_url` 없는 상대 경로 등)도 `?` 뒤를 쿼리로 읽어 같은 규칙으로 가린다.
